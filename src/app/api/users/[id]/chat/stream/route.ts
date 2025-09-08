import { NextRequest } from 'next/server';
import { getUsers } from '@/lib/storage';

// 改进版 SSE：
// 1. 维护 lastSentTimestamp，避免重复发送
// 2. 在 controller.closed / try-catch 中检测到关闭后停止 enqueue，防止 Invalid state
// 3. 初次发送后更新 lastSentTimestamp
// 4. 心跳先检测是否仍可写
export async function GET(request: NextRequest, context: any) {
  const rawParams = context?.params ? (context.params.then ? await context.params : context.params) : {};
  const { id: userId } = rawParams as { id?: string };
  const { searchParams } = new URL(request.url);
  const friendId = searchParams.get('friendId');
  const since = Number(searchParams.get('since') || '0');
  if (!userId) return new Response('缺少userId', { status: 400 });
  if (!friendId) return new Response('缺少friendId', { status: 400 });
  const users = getUsers();
  const me = users.find(u => u.id === userId);
  if (!me) return new Response('用户不存在', { status: 404 });
  if (!me.friends.includes(friendId)) return new Response('不是好友', { status: 403 });

  const encoder = new TextEncoder();
  let closed = false;
  let lastSent = since;

  const stream = new ReadableStream({
    start(controller) {
      function safeEnqueue(str: string) {
        if (closed) return;
        try { controller.enqueue(encoder.encode(str)); } catch { closed = true; }
      }
      function pushBatch(list: any[]) {
        if (list.length) {
          safeEnqueue('event: batch\n');
          safeEnqueue(`data: ${JSON.stringify(list)}\n\n`);
          const maxTs = Math.max(...list.map(m => m.timestamp));
          if (maxTs > lastSent) lastSent = maxTs;
        }
      }
      const initial = (me.chatHistory[friendId] || []).filter(m => m.timestamp > lastSent);
      pushBatch(initial);
      const interval = setInterval(() => {
        if (closed) return;
        try {
          const freshUsers = getUsers();
          const cur = freshUsers.find(u => u.id === userId);
          if (!cur) return;
          const diff = (cur.chatHistory[friendId] || []).filter(m => m.timestamp > lastSent);
          if (diff.length) pushBatch(diff);
        } catch {}
      }, 1200);
      const heartbeat = setInterval(() => {
        if (closed) return;
        safeEnqueue('event: ping\n');
        safeEnqueue('data: {}\n\n');
      }, 18000);
      (controller as any)._cleanup = () => { if (!closed) { closed = true; } clearInterval(interval); clearInterval(heartbeat); };
    },
    cancel() { closed = true; }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}
