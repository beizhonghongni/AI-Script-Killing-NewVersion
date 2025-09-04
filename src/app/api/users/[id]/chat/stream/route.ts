import { NextRequest } from 'next/server';
import { getUsers } from '@/lib/storage';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params;
  const { searchParams } = new URL(request.url);
  const friendId = searchParams.get('friendId');
  const since = Number(searchParams.get('since') || '0');
  if (!friendId) return new Response('缺少friendId', { status: 400 });
  const users = getUsers();
  const me = users.find(u => u.id === userId);
  if (!me) return new Response('用户不存在', { status: 404 });
  if (!me.friends.includes(friendId)) return new Response('不是好友', { status: 403 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function pushBatch(list: any[]) {
        if (list.length) {
          controller.enqueue(encoder.encode('event: batch\n'));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(list)}\n\n`));
        }
      }
      const initial = (me.chatHistory[friendId] || []).filter(m => m.timestamp > since);
      pushBatch(initial);
      const interval = setInterval(() => {
        try {
          const freshUsers = getUsers();
            const cur = freshUsers.find(u => u.id === userId);
            if (!cur) return;
            const diff = (cur.chatHistory[friendId] || []).filter(m => m.timestamp > since);
            if (diff.length) {
              pushBatch(diff);
            }
        } catch {}
      }, 1500);
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode('event: ping\n'));
        controller.enqueue(encoder.encode('data: {}\n\n'));
      }, 20000);
      (controller as any)._cleanup = () => { clearInterval(interval); clearInterval(heartbeat); };
    },
    cancel() {
      const c: any = this as any;
      if (c._cleanup) c._cleanup();
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' } });
}
