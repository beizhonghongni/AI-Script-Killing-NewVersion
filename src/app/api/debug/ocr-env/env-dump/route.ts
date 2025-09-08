import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function GET() {
  const p = path.join(process.cwd(), '.env.local');
  let exists = false; let size = 0; let first200 = ''; let encodingNote='';
  try {
    if (fs.existsSync(p)) {
      exists = true;
      const buf = fs.readFileSync(p);
      size = buf.length;
      // try detect BOM
      if (buf[0] === 0xFF && buf[1] === 0xFE) encodingNote='UTF-16LE?';
      if (buf[0] === 0xFE && buf[1] === 0xFF) encodingNote='UTF-16BE?';
      if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) encodingNote='UTF-8-BOM';
      first200 = buf.toString('utf8',0,200).replace(/\r/g,'\\r').replace(/\n/g,'\\n');
    }
  } catch (e) { encodingNote = 'read error '+(e as any)?.message; }
  return NextResponse.json({ exists, size, encodingNote, first200 });
}
