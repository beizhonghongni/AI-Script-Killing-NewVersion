// Test script for DashScope STT & local API.
// Run: npx ts-node scripts/test-stt.ts --file path/to/audio.wav
// Options: --no-direct (skip direct call) --no-local (skip local call)

import fs from 'fs';
import path from 'path';

interface Args { file?: string; direct?: boolean; local?: boolean; }
function parseArgs(): Args {
  const out: Args = { direct: true, local: true } as any;
  process.argv.slice(2).forEach((a,i,arr)=>{
    if (a === '--file') out.file = arr[i+1];
    if (a === '--no-direct') out.direct = false;
    if (a === '--no-local') out.local = false;
  });
  return out;
}

async function main() {
  const { file, direct, local } = parseArgs();
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) { console.error('Missing DASHSCOPE_API_KEY'); process.exit(1); }
  if (!file) { console.error('Use --file path'); process.exit(1); }
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) { console.error('File not found', abs); process.exit(1); }
  const buf = fs.readFileSync(abs);
  const blob = new Blob([buf]);
  console.log('Audio size', buf.length);

  if (direct) {
    console.log('\n[Direct DashScope]');
    const fd = new FormData();
    fd.append('file', blob, path.basename(abs));
    fd.append('model', process.env.DASHSCOPE_STT_MODEL || 'qwen-audio-asr');
    const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/audio/transcriptions', { method:'POST', headers:{ Authorization:`Bearer ${apiKey}` }, body: fd });
    const t = await res.text();
    console.log('Status', res.status); console.log(t);
  }

  if (local) {
    console.log('\n[Local /api/speech/transcribe]');
    const fd2 = new FormData();
    fd2.append('audio', blob, path.basename(abs));
    const base = process.env.LOCAL_BASE_URL || 'http://localhost:3001';
    const url = base.replace(/\/$/, '') + '/api/speech/transcribe';
    const res2 = await fetch(url, { method:'POST', body: fd2 });
    const t2 = await res2.text();
    console.log('Base', base, 'Status', res2.status); console.log(t2);
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
