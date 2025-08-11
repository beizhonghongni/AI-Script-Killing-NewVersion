import { NextRequest, NextResponse } from 'next/server';

// 简化实现：从环境变量读取 Azure Speech key 与 endpoint，返回给前端用于 SDK 初始化。
// 生产中建议改为服务端换取一次性访问令牌，而不是直接下发密钥。

export async function GET(_request: NextRequest) {
  const key = process.env.AZURE_SPEECH_KEY;
  const endpoint = process.env.AZURE_SPEECH_ENDPOINT; // 例如 https://<region>.stt.speech.microsoft.com/
  const region = process.env.AZURE_SPEECH_REGION; // 可选：当仅提供区域时，前端可用 FromSubscription(region)

  if (!key || !endpoint) {
    return NextResponse.json({ success: false, error: 'Speech service not configured' }, { status: 500 });
  }

  // 返回给前端。提醒：这会暴露KEY，建议后续切换为STS token获取。
  return NextResponse.json({ success: true, key, endpoint, region });
}
