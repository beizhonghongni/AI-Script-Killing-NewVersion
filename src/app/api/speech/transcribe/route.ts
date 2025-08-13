import { NextRequest, NextResponse } from 'next/server';

// Transcribe uploaded audio via Aliyun DashScope (OpenAI-compatible) audio.transcriptions API
// Env vars:
// - DASHSCOPE_API_KEY: your DashScope API key
// - DASHSCOPE_BASE_URL: optional, defaults to https://dashscope.aliyuncs.com/compatible-mode/v1
// - DASHSCOPE_STT_MODEL: optional, defaults to paraformer-realtime-v1

export async function POST(request: NextRequest) {
  try {
    // Prefer env var; allow header override only for local dev convenience
    const envKey = process.env.DASHSCOPE_API_KEY;
    const headerKey = request.headers.get('x-dashscope-key') || undefined;
    const apiKey = envKey || headerKey;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'DASHSCOPE_API_KEY 未配置。请在.env.local设置，或在请求头x-dashscope-key中提供（仅用于本地调试）。' }, { status: 500 });
    }

    const baseUrl = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    // Use qwen-audio-asr as requested
    const model = process.env.DASHSCOPE_STT_MODEL || 'qwen-audio-asr';

    const form = await request.formData();
    const audio = form.get('audio');
    if (!audio || !(audio instanceof File)) {
      return NextResponse.json({ success: false, error: '缺少音频文件（字段名 audio）' }, { status: 400 });
    }

    // Build a new multipart body following OpenAI-compatible spec: file + model
    const dashForm = new FormData();
    dashForm.append('file', audio, (audio as File).name || 'speech.webm');
    dashForm.append('model', model);
    // Optional params commonly supported; harmless if ignored
    if (form.get('language')) dashForm.append('language', String(form.get('language')));
    if (form.get('prompt')) dashForm.append('prompt', String(form.get('prompt')));

    const dashRes = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: dashForm,
    });

    const text = await dashRes.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!dashRes.ok) {
      const message = (data as any)?.error?.message || (data as any)?.message || '转写失败';
      return NextResponse.json({ success: false, error: message, details: data }, { status: dashRes.status });
    }

    // OpenAI-compatible responses usually provide { text: "..." }
  const transcript = (data as any)?.text || (data as any)?.result || '';
    return NextResponse.json({ success: true, text: transcript, raw: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '服务器错误' }, { status: 500 });
  }
}
