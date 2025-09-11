import { NextRequest, NextResponse } from 'next/server';
import { getScripts, getScriptAggregateRating } from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listed = searchParams.get('listed');
    let scripts = getScripts();
    if (listed === '1') {
      scripts = scripts.filter(s => s.isListedForSale);
    }
    // 附加评分聚合（若无缓存）
    scripts = scripts.map(s => {
      if (s.averageRating === undefined || s.ratingCount === undefined) {
        const agg = getScriptAggregateRating(s.id);
        return { ...s, averageRating: agg.average, ratingCount: agg.count };
      }
      return s;
    });
    
    return NextResponse.json({
      success: true,
  scripts: scripts
    });
  } catch (error) {
    console.error('获取剧本列表失败:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误'
    }, { status: 500 });
  }
}
