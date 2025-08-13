import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: 'Azure 语音服务已移除，请改用 /api/speech/transcribe 接口',
    deprecated: true
  }, { status: 410 });
}
