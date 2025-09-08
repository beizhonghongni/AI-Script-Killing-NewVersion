import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Gemini-based audio transcription (generateContent). We embed the audio bytes directly.
// Env:
// - GEMINI_API_KEY (required)
// - GEMINI_STT_MODEL (optional, default gemini-2.5-flash; fallback gemini-2.0-flash)
// Request: multipart/form-data with field 'audio' (File), optional 'language'.
// Response: { success, text, model, rawPromptTokens?, rawResponseTokens?, attempts }

interface GeminiCandidatePartText {
  text: string;
}
interface GeminiCandidate {
  content?: { parts?: GeminiCandidatePartText[] };
}
interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}

export async function POST(request: NextRequest) {
  const attempts: any[] = [];
  try {
  const headerKey = (request.headers.get('x-gemini-key') || '').replace(/"/g,'').trim();
  // @ts-ignore
  const runtimeKey = (globalThis as any).__GEMINI_RUNTIME_KEY || '';
  const apiKey = (headerKey || process.env.GEMINI_API_KEY || runtimeKey || '').replace(/"/g,'').trim();
    if (!apiKey) {
      return NextResponse.json({ success:false, error:'GEMINI_API_KEY 未配置' }, { status:500 });
    }
    const form = await request.formData();
    const audio = form.get('audio');
    if (!audio || !(audio instanceof File)) {
      return NextResponse.json({ success:false, error:'缺少音频文件（字段名 audio）' }, { status:400 });
    }
    const language = (form.get('language') || 'zh').toString();
    const fileName = (audio as File).name || 'speech.webm';
    const arrayBuf = await (audio as File).arrayBuffer();
    const sizeBytes = arrayBuf.byteLength;
    if (sizeBytes > 20 * 1024 * 1024) {
      return NextResponse.json({ success:false, error:'音频超过 20MB，请分段或使用 Files API 方案（未实现）' }, { status:400 });
    }
    const base64 = Buffer.from(arrayBuf).toString('base64');
    // Infer mime
    let mime = (audio as File).type || '';
    if (!mime) {
      if (/\.wav$/i.test(fileName)) mime = 'audio/wav';
      else if (/\.mp3$/i.test(fileName)) mime = 'audio/mp3';
      else if (/\.ogg$/i.test(fileName)) mime = 'audio/ogg';
      else if (/\.flac$/i.test(fileName)) mime = 'audio/flac';
      else if (/\.aac$/i.test(fileName)) mime = 'audio/aac';
      else mime = 'audio/webm';
    }

    const primaryModel = (process.env.GEMINI_STT_MODEL || 'gemini-2.5-flash').trim();
    const fallbackModels = [primaryModel, 'gemini-2.0-flash'];

    const promptBase = language.startsWith('zh')
      ? '请将以下音频完整精准转写为纯文本，不要添加额外说明或格式，仅输出文字。'
      : 'Transcribe the following audio into plain text only. Output only the transcript.';

    for (const model of fallbackModels) {
      attempts.push({ stage:'try-model', model });
      const body = {
        contents: [
          {
            parts: [
              { text: promptBase },
              { inline_data: { mime_type: mime, data: base64 } }
            ]
          }
        ]
      };
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const res = await fetch(url, {
          method:'POST',
            headers:{ 'Content-Type':'application/json', 'X-goog-api-key': apiKey },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(60000)
        });
        const text = await res.text();
        let json: GeminiResponse | any = null;
        try { json = JSON.parse(text); } catch { /* ignore */ }
        attempts.push({ stage:'model-response', model, status: res.status, ok: res.ok, snippet: text.slice(0,160) });
        if (!res.ok && /API key not valid/i.test(text)) {
          // stop further attempts because key invalid for all models
          break;
        }
        if (res.ok && json?.candidates?.length) {
          const transcript = json.candidates[0].content?.parts?.[0]?.text?.trim() || '';
          return NextResponse.json({ success:true, text: transcript, model, usage: json.usageMetadata, attempts });
        }
      } catch (e:any) {
        attempts.push({ stage:'model-error', model, error: e?.message });
      }
    }

    return NextResponse.json({ success:false, error:'Gemini 转写失败', attempts, tried: fallbackModels }, { status:400 });
  } catch (err:any) {
    attempts.push({ stage:'exception', error: err?.message });
    return NextResponse.json({ success:false, error: err?.message || '服务器错误', attempts }, { status:500 });
  }
}
