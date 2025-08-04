import { NextRequest, NextResponse } from 'next/server';
import { getScripts } from '@/lib/storage';

export async function GET() {
  try {
    const scripts = getScripts();
    
    return NextResponse.json({
      success: true,
      scripts: scripts
    });
  } catch (error) {
    console.error('获取剧本列表失败:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误'
    }, { status: 500 });
  }
}
