import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

// POST { key: 'AIza...' } to set runtime key (not persisted). ONLY for local dev.
export async function POST(req: NextRequest) {
  try {
    const data = await req.json().catch(()=>({}));
    const key = (data.key || '').toString().trim();
    if (!key) return NextResponse.json({ success:false, error:'缺少 key' }, { status:400 });
    // @ts-ignore
    (globalThis as any).__GEMINI_RUNTIME_KEY = key;
    return NextResponse.json({ success:true, message:'Runtime Gemini key 已设置 (内存, 进程重启即失效)', preview: key.slice(0,8)+'...'+key.slice(-4) });
  } catch(e:any) {
    return NextResponse.json({ success:false, error:e?.message||'解析失败' }, { status:500 });
  }
}
