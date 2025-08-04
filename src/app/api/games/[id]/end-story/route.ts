import { NextRequest, NextResponse } from 'next/server';
import { getGameRecordById, updateGameRecord } from '@/lib/storage';

// 玩家确认结束故事
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { playerId } = await request.json();

    // 获取游戏记录
    const gameRecord = getGameRecordById(id);
    if (!gameRecord) {
      return NextResponse.json({ success: false, error: 'Game not found' });
    }

    // 检查是否在最后一轮
    const currentRound = gameRecord.roundRecords.length;
    if (currentRound !== gameRecord.rounds) {
      return NextResponse.json({ success: false, error: 'Not in the final round' });
    }

    // 直接结束游戏，不需要所有人确认
    gameRecord.status = 'finished';
    gameRecord.finishedAt = Date.now();
    // 记录是谁结束的游戏
    (gameRecord as any).endedBy = playerId;

    // 为每个玩家生成游戏总结模板
    if (!gameRecord.finalSummary) {
      gameRecord.finalSummary = {};
    }

    // 这里我们只初始化，实际的总结生成可以在复盘页面进行，避免API超时
    for (const player of gameRecord.players) {
      if (!gameRecord.finalSummary[player]) {
        gameRecord.finalSummary[player] = {
          playerId: player,
          storyReview: '',
          plotAnalysis: '',
          storyElevation: '',
          playerAnalysis: {}
        };
      }
    }

    // 保存游戏记录
    updateGameRecord(gameRecord);

    return NextResponse.json({
      success: true,
      gameEnded: true,
      endedBy: playerId,
      message: 'Game completed successfully'
    });

  } catch (error) {
    console.error('End story error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to end story' 
    });
  }
}
