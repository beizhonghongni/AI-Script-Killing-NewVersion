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

    // 初始化确认结束的玩家列表
    if (!gameRecord.endConfirmedPlayers) {
      gameRecord.endConfirmedPlayers = [];
    }

    // 添加当前玩家到确认列表（如果还没有确认）
    if (!gameRecord.endConfirmedPlayers.includes(playerId)) {
      gameRecord.endConfirmedPlayers.push(playerId);
    }

    const totalPlayers = gameRecord.players.length;
    const confirmedPlayers = gameRecord.endConfirmedPlayers.length;

    // 检查是否所有玩家都确认结束
    if (confirmedPlayers >= totalPlayers) {
      // 标记游戏为已完成
      gameRecord.status = 'finished';
      gameRecord.finishedAt = Date.now();

      // 为每个玩家生成游戏总结
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
        message: 'Game completed successfully'
      });
    } else {
      // 还有玩家未确认，保存当前状态
      updateGameRecord(gameRecord);

      return NextResponse.json({
        success: true,
        gameEnded: false,
        confirmedPlayers: confirmedPlayers,
        totalPlayers: totalPlayers,
        message: `Waiting for other players (${confirmedPlayers}/${totalPlayers})`
      });
    }

  } catch (error) {
    console.error('End story error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to end story' 
    });
  }
}
