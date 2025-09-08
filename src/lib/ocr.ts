// Aliyun OCR (PDF) integration helper
// Requires: set ALIYUN_OCR_APPCODE in environment (.env.local) - DO NOT commit real secret.
// Fallback only activates when normal pdf-parse yields too little text (<30 visible chars).

const OCR_ENDPOINT = 'https://generalpdf.market.alicloudapi.com/ocrservice/pdf';

interface AliyunOCRResponseGeneric {
  content?: string;
  result?: string;
  [k: string]: any;
}

function extractTextFlexible(resp: AliyunOCRResponseGeneric): string {
  if (!resp || typeof resp !== 'object') return '';
  if (typeof resp.content === 'string' && resp.content.trim()) return resp.content;
  if (typeof resp.result === 'string' && resp.result.trim()) return resp.result;
  const collected: string[] = [];
  const visit = (node: any) => {
    if (!node) return;
    if (typeof node === 'string') {
      if (node.trim()) collected.push(node.trim());
      return;
    }
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (typeof node === 'object') {
      if (typeof node.text === 'string' && node.text.trim()) collected.push(node.text.trim());
      if (typeof node.words === 'string' && node.words.trim()) collected.push(node.words.trim());
      if (typeof node.content === 'string' && node.content.trim()) collected.push(node.content.trim());
      for (const k of Object.keys(node)) {
        if (['text','words','content'].includes(k)) continue;
        visit(node[k]);
      }
    }
  };
  visit(resp);
  return Array.from(new Set(collected)).join('\n');
}

import fs from 'fs';
import path from 'path';

let cachedAppCode: string | null | undefined;

function tryReadEnvFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // 支持两种格式：KEY=VALUE  或  直接只写 AppCode 一行
    let directOnly = content.trim();
    if (directOnly && !directOnly.includes('=') && directOnly.length > 10 && directOnly.length < 80) {
      return directOnly.replace(/['"\s]/g,'');
    }
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key === 'ALIYUN_OCR_APPCODE' && val) return val.replace(/['"]/g,'');
    }
  } catch (e) {
    console.warn('[OCR] read env file error', filePath, e);
  }
  return null;
}

function tryReadJsonConfig(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw);
    const val = json.ALIYUN_OCR_APPCODE || json.aliyunOcrAppcode || json.ocrAppCode || json.aliyunAppCode;
    if (typeof val === 'string' && val.trim()) return val.trim();
  } catch (e) {
    console.warn('[OCR] read json config error', filePath, e);
  }
  return null;
}

function manualLoadAppCode(): string | null {
  const tried: string[] = [];
  const candidateRelativeFiles = [
    '.env.local',
    '.env',
    'data/appcode.txt',
    'data/aliyun_appcode.txt',
    'data/ocr_appcode.txt',
    'data/config.json',
    'config/appcode.txt',
    'config/ocr_appcode.txt'
  ];
  const startDirs = [process.cwd(), __dirname];
  for (const base of startDirs) {
    let dir = base;
    for (let depth = 0; depth < 7; depth++) {
      for (const rel of candidateRelativeFiles) {
        const abs = path.join(dir, rel);
        tried.push(abs);
        let val: string | null = null;
        if (rel.endsWith('.json')) {
          val = tryReadJsonConfig(abs);
        } else {
          val = tryReadEnvFile(abs);
        }
        if (val) {
          console.log('[OCR] AppCode 通过文件加载:', abs);
          return val;
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  console.warn('[OCR] manualLoadAppCode 未找到 AppCode (前若干尝试路径)=', tried.slice(0,8));
  return null;
}

export async function ocrPdfWithAliyun(buffer: Buffer, override?: string): Promise<string | null> {
  let appcode = process.env.ALIYUN_OCR_APPCODE;
  if (override && override.trim()) appcode = override.trim();
  if (!appcode) {
    if (cachedAppCode === undefined) {
      cachedAppCode = manualLoadAppCode();
      if (cachedAppCode) console.log('[OCR] 使用手动解析 .env.local 中的 AppCode');
    }
    appcode = cachedAppCode || '';
  }
  if (!appcode) {
    console.warn('[OCR] ALIYUN_OCR_APPCODE 未配置 (process.env keys=', Object.keys(process.env).filter(k=>k.includes('ALIYUN')||k.includes('OCR')).join(','), ' cwd=', process.cwd(), ' __dirname=', __dirname, ')');
    return null;
  }
  try {
    const base64 = buffer.toString('base64');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const resp = await fetch(OCR_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `APPCODE ${appcode}`,
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify({ fileBase64: base64, prob: false, charInfo: false, rotate: true, table: false }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const text = await resp.text();
    let data: AliyunOCRResponseGeneric;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!resp.ok) {
      console.error('[OCR] Aliyun OCR error', resp.status, data);
      return null;
    }
    const extracted = extractTextFlexible(data).trim();
    if (extracted.length < 10) return null;
    return extracted;
  } catch (err) {
    console.warn('[OCR] exception', err);
    return null;
  }
}

