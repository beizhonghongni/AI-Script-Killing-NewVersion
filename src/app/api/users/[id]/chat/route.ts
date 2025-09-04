import { NextRequest, NextResponse } from 'next/server';
import { getUsers, saveUsers, getScriptById } from '@/lib/storage';
import { generateId } from '@/lib/utils';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params;
    const { friendId, content, type = 'text', scriptId } = await request.json();
    if (!friendId) return NextResponse.json({ success: false, error: '缺少friendId' }, { status: 400 });
    const users = getUsers();
    const sender = users.find(u => u.id === userId);
    const receiver = users.find(u => u.id === friendId);
    if (!sender || !receiver) return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    if (!sender.friends.includes(friendId)) return NextResponse.json({ success: false, error: '不是好友' }, { status: 403 });
    if (type === 'script_share') {
      const script = scriptId ? getScriptById(scriptId) : null;
      if (!script) return NextResponse.json({ success: false, error: '脚本不存在' }, { status: 404 });
    }
    const msg = {
      id: generateId('chat'),
      senderId: userId,
      content: content || '',
      type,
      scriptId: type === 'script_share' ? scriptId : undefined,
      timestamp: Date.now()
    };
    sender.chatHistory[friendId] = sender.chatHistory[friendId] || [];
    receiver.chatHistory[userId] = receiver.chatHistory[userId] || [];
    sender.chatHistory[friendId].push(msg);
    receiver.chatHistory[userId].push(msg);
    saveUsers(users);
    return NextResponse.json({ success: true, message: msg });
  } catch (e) {
    console.error('Send chat error', e);
    return NextResponse.json({ success: false, error: '发送失败' }, { status: 500 });
  }
}
