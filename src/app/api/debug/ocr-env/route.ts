import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function manual() {
  try {
    const p = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(p)) return { found:false };
    const buf = fs.readFileSync(p);
    let txt = buf.toString('utf8');
    // 兼容 UTF16/UTF8 BOM 去除
    txt = txt.replace(/^\uFEFF/, '');
    const lines = txt.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      if (k === 'ALIYUN_OCR_APPCODE' && v) return { found:true, length: v.length };
    }
    return { found:false };
  } catch (e) { return { found:false, err: String(e) }; }
}

export const runtime = 'nodejs';

export async function GET() {
  const envVal = process.env.ALIYUN_OCR_APPCODE || '';
  const envLoaded = !!envVal;
  const local = manual();
  return NextResponse.json({
    processEnv: envLoaded ? 'present' : 'missing',
    processEnvLength: envVal.length,
    manualFileFound: local.found,
    manualLength: local.length || 0,
    decision: envLoaded ? 'runtime using process.env' : (local.found ? 'will fallback manual parse (已实现)' : 'no value anywhere'),
    cwd: process.cwd(),
    debugDir: __dirname,
    hint: !envLoaded && !local.found ? '确认 .env.local 与 package.json 同级且变量名精确 ALIYUN_OCR_APPCODE / 如仍不生效可通过 formData appcode 提交调试' : undefined
  });
}
