import { NextResponse } from 'next/server';
export const runtime = 'nodejs';

export async function GET() {
  const raw = process.env.GEMINI_API_KEY || '';
  const shown = raw ? raw.slice(0,8) + '...' + raw.slice(-4) : '';
  return NextResponse.json({
    hasKey: !!raw,
    length: raw.length,
    preview: shown,
    envKeys: Object.keys(process.env).filter(k=>k.includes('GEMINI')).sort(),
    note: '如果 hasKey=false 说明 .env.local 未被加载或需重启 dev；Windows 下需完全重启进程。'
  });
}
