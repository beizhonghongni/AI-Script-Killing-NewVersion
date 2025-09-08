import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function GET() {
  const cwd = process.cwd();
  let files: string[] = [];
  try { files = fs.readdirSync(cwd); } catch (e) { files = ['<read error>' + (e as any)?.message]; }
  const dirs: Record<string,string[]> = {};
  const bases = [cwd, __dirname, path.dirname(__dirname)];
  for (const b of bases) {
    try { dirs[b] = fs.readdirSync(b).slice(0,40); } catch { dirs[b] = ['<error>']; }
  }
  return NextResponse.json({
    cwd,
    envKeys: Object.keys(process.env).filter(k=>k.includes('ALIYUN')||k.includes('OCR')).slice(0,30),
    hasVar: !!process.env.ALIYUN_OCR_APPCODE,
    cwdFiles: files.slice(0,60),
    probe: dirs,
    note: '确认 .env.local 是否在这些目录；若不在，需把文件放到 dev 启动目录或使用 formData appcode 覆盖。'
  });
}
