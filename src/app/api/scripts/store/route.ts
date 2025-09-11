import { NextRequest, NextResponse } from 'next/server';
import { getScripts, saveScripts, getUserById, updateUser, ensureUserEconomicFields, getScriptAggregateRating } from '@/lib/storage';

// GET: 列出在售原创剧本
export async function GET() {
  try {
    let scripts = getScripts().filter(s => s.isListedForSale && !s.derivativeOfScriptId && (s.rootOriginalScriptId === undefined || s.rootOriginalScriptId === s.id));
    // 补充评分聚合
    scripts = scripts.map(s => {
      if (s.averageRating === undefined || s.ratingCount === undefined) {
        const agg = getScriptAggregateRating(s.id);
        return { ...s, averageRating: agg.average, ratingCount: agg.count };
      }
      return s;
    });
    scripts.sort((a,b) => {
      const aAvg = a.averageRating ?? 0; const bAvg = b.averageRating ?? 0;
      if (bAvg !== aAvg) return bAvg - aAvg;
      const aCount = a.ratingCount ?? 0; const bCount = b.ratingCount ?? 0;
      if (bCount !== aCount) return bCount - aCount;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return NextResponse.json({ success: true, scripts });
  } catch (e) {
    console.error('获取商店剧本失败', e);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// POST: 上架 { userId, scriptId, price }
export async function POST(req: NextRequest) {
  try {
    const { userId, scriptId, price } = await req.json();
    if (typeof price !== 'number' || price < 0) {
      return NextResponse.json({ success: false, error: '价格无效' }, { status: 400 });
    }
    const scripts = getScripts();
    const idx = scripts.findIndex(s => s.id === scriptId);
    if (idx === -1) return NextResponse.json({ success: false, error: '剧本不存在' }, { status: 404 });
    const script = scripts[idx];
    // 必须是原创（没有 derivativeOfScriptId 且 rootOriginalScriptId===自身或未设置）且作者匹配
    if (script.createdBy !== userId || script.derivativeOfScriptId) {
      return NextResponse.json({ success: false, error: '仅原创作者可上架' }, { status: 403 });
    }
    scripts[idx].isListedForSale = true;
    scripts[idx].price = price;
    saveScripts(scripts);
    return NextResponse.json({ success: true, script: scripts[idx] });
  } catch (e) {
    console.error('上架失败', e);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}