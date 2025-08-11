import { NextRequest, NextResponse } from 'next/server';
import { getUsers, getUserById, getGameRecords } from '@/lib/storage';

// 返回：当前用户能使用的“好友风格”列表及其简要描述
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // 当前用户
  const users = getUsers();
  const me = users.find(u => u.id === id);
  if (!me) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

  // 能使用谁的风格：对方的 styleGrantsTo 包含我
  const granters = users.filter(u => (u.styleGrantsTo || []).includes(id));

  // 计算每个好友最近三局的发言风格摘要（简单版：连接最近三局文本，截断）
  const gameRecords = getGameRecords();
  const friendStyles = granters.map(friend => {
    // 找出该好友参与的最近三局
    const participated = gameRecords
      .filter(gr => gr.players.includes(friend.id))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 3);
    const texts: string[] = [];
    participated.forEach(gr => {
      gr.roundRecords.forEach(rr => {
        rr.messages
          .filter(m => m.senderId === friend.id && !m.isNPC)
          .forEach(m => texts.push(m.content));
      });
    });
    const sample = texts.join(' ');
    // 简要风格：截断展示
    const brief = sample.length > 200 ? sample.slice(0, 200) + '…' : sample;
    return {
      userId: friend.id,
      username: friend.username,
      recentStyleSample: brief,
      recentMessageCount: texts.length
    };
  });

  return NextResponse.json({ success: true, friendStyles });
}
