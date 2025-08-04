import { NextRequest, NextResponse } from 'next/server';
import { getGameRecordById, updateGameRecord, getScriptById } from '@/lib/storage';

// 标记玩家已准备
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const gameId = params.id;
  
  try {
    const { playerId } = await request.json();
    
    // 获取游戏记录
    const gameRecord = getGameRecordById(gameId);
    if (!gameRecord) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    
    // 初始化准备玩家列表
    if (!gameRecord.readyPlayers) {
      gameRecord.readyPlayers = [];
    }
    
    // 添加玩家到准备列表
    if (!gameRecord.readyPlayers.includes(playerId)) {
      gameRecord.readyPlayers.push(playerId);
    }
    
    // 检查是否所有玩家都准备好了
    const allReady = gameRecord.players.every(pid => gameRecord.readyPlayers.includes(pid));
    
    if (allReady && gameRecord.roundRecords.length === 0) {
      // 所有玩家准备好且还没开始剧情，开始第一轮
      gameRecord.status = 'story_reading';
      
      // 获取剧本，添加第一轮内容
      const script = getScriptById(gameRecord.scriptId);
      if (script && script.roundContents && script.roundContents.length > 0) {
        const firstRound = script.roundContents[0];
        gameRecord.roundRecords.push({
          round: 1,
          plot: firstRound.plot,
          privateClues: firstRound.privateClues,
          messages: [],
          isFinished: false
        });
      }
    }
    
    // 保存更新
    updateGameRecord(gameRecord);
    
    return NextResponse.json({ 
      success: true, 
      readyPlayers: gameRecord.readyPlayers,
      allReady
    });
  } catch (error) {
    console.error('Ready API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
