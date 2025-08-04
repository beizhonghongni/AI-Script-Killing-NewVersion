import { NextRequest, NextResponse } from 'next/server';
import { getGameRecordById, updateGameRecord, getScriptById } from '@/lib/storage';

// 房主控制进入下一轮
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { currentRound, nextRound } = await request.json();

    // 获取游戏记录
    const gameRecord = getGameRecordById(id);
    if (!gameRecord) {
      return NextResponse.json({ success: false, error: 'Game not found' });
    }

    // 验证轮次
    if (nextRound > gameRecord.rounds) {
      return NextResponse.json({ success: false, error: 'Cannot exceed max rounds' });
    }

    if (gameRecord.roundRecords.length !== currentRound) {
      return NextResponse.json({ success: false, error: 'Round mismatch' });
    }

    // 获取剧本信息
    const script = getScriptById(gameRecord.scriptId);
    if (!script) {
      return NextResponse.json({ success: false, error: 'Script not found' });
    }

    // 获取下一轮的剧情内容
    const nextRoundContent = script.roundContents.find(rc => rc.round === nextRound);
    if (!nextRoundContent) {
      return NextResponse.json({ success: false, error: 'Next round content not found' });
    }

    // 创建新的轮次记录
    const newRoundRecord = {
      round: nextRound,
      plot: nextRoundContent.plot,
      privateClues: nextRoundContent.privateClues || {},
      messages: [],
      isFinished: false
    };

    // 添加新轮次到游戏记录
    gameRecord.roundRecords.push(newRoundRecord);
    
    // 如果是最后一轮，标记游戏状态
    if (nextRound === gameRecord.rounds) {
      gameRecord.status = 'round_playing'; // 最后一轮进行中
    } else {
      gameRecord.status = 'round_playing'; // 进行中
    }

    // 保存更新的游戏记录
    updateGameRecord(gameRecord);

    return NextResponse.json({
      success: true,
      message: `Successfully advanced to round ${nextRound}`,
      newRound: nextRound,
      plot: nextRoundContent.plot,
      isLastRound: nextRound === gameRecord.rounds
    });

  } catch (error) {
    console.error('Advance round error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to advance to next round' 
    });
  }
}
