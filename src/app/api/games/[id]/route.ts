import { NextRequest, NextResponse } from 'next/server';
import { getGameRecords, getScriptById } from '@/lib/storage';

// 获取游戏记录详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gameId } = await params;
    const gameRecords = getGameRecords();
    const gameRecord = gameRecords.find(record => record.id === gameId);
    
    if (!gameRecord) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    // 获取剧本信息
    const script = getScriptById(gameRecord.scriptId);
    
    return NextResponse.json({ 
      success: true, 
      gameRecord: {
        ...gameRecord,
        script
      }
    });
  } catch (error) {
    console.error('Error getting game record:', error);
    return NextResponse.json({ success: false, error: 'Failed to get game record' }, { status: 500 });
  }
}
