import { NextRequest, NextResponse } from 'next/server';
import { getScriptById, ensureUserEconomicFields, getUserById, updateUser } from '@/lib/storage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const script = getScriptById(id);
    if (!script) return NextResponse.json({ success: false, error: '剧本不存在' }, { status: 404 });
    return NextResponse.json({ success: true, script });
  } catch (e) {
    console.error('获取剧本失败', e);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}