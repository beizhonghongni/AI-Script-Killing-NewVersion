import { NextRequest, NextResponse } from 'next/server';
import { getScriptById, upsertScriptRating, getScriptAggregateRating } from '@/lib/storage';
import { getUsers, saveUsers } from '@/lib/storage';

// GET: 获取评分聚合
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scriptId } = await params;
    const script = getScriptById(scriptId);
    if (!script) return NextResponse.json({ success: false, error: '剧本不存在' }, { status: 404 });
    const agg = getScriptAggregateRating(scriptId);
    return NextResponse.json({ success: true, rating: agg });
  } catch (e) {
    console.error('获取评分失败', e);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// POST: { userId, rating }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scriptId } = await params;
    const { userId, rating } = await req.json();
    if (typeof rating !== 'number' || rating < 0 || rating > 5) {
      return NextResponse.json({ success: false, error: '评分必须是0-5的数字' }, { status: 400 });
    }
    const script = getScriptById(scriptId);
    if (!script) return NextResponse.json({ success: false, error: '剧本不存在' }, { status: 404 });
    // 用户存在性校验
    const users = getUsers();
    if (!users.find(u => u.id === userId)) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }
    const agg = upsertScriptRating(scriptId, userId, rating);
    return NextResponse.json({ success: true, rating: agg });
  } catch (e) {
    console.error('评分失败', e);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}