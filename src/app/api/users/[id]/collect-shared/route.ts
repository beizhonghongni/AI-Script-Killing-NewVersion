import { NextRequest, NextResponse } from 'next/server';
import { getUsers, saveUsers, getScriptById } from '@/lib/storage';
import { CollectedScript } from '@/types';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params;
    const { scriptId } = await request.json();
    if (!scriptId) return NextResponse.json({ success: false, error: '缺少scriptId' }, { status: 400 });
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    const script = getScriptById(scriptId);
    if (!script) return NextResponse.json({ success: false, error: '脚本不存在' }, { status: 404 });
    user.collectedScripts = user.collectedScripts || [];
    if (user.collectedScripts.find(c => c.originalScriptId === scriptId)) {
      return NextResponse.json({ success: false, error: '已收藏' });
    }
    const collected: CollectedScript = {
      id: `collected_${Date.now()}_${userId}`,
      originalScriptId: scriptId,
      originalGameId: '',
      title: script.title,
      rounds: script.rounds,
      background: script.background,
      characters: script.characters,
      roundContents: script.roundContents,
      plotRequirement: '',
      collectedAt: Date.now(),
      collectedBy: userId,
      personalScripts: {}
    } as any;
    user.collectedScripts.push(collected);
    saveUsers(users);
    return NextResponse.json({ success: true, collected });
  } catch (e) {
    console.error('Collect shared script error', e);
    return NextResponse.json({ success: false, error: '收藏失败' }, { status: 500 });
  }
}
