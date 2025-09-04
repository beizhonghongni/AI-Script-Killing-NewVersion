import { NextRequest, NextResponse } from 'next/server';
import { getGameRecordById, updateGameRecord, getScriptById } from '@/lib/storage';

// 标记玩家已准备
// 标准的 Next.js App Router Handler 签名: (request, { params })
export async function POST(
  request: NextRequest,
  context: any
) {
  const rawParams = context?.params ? (context.params.then ? await context.params : context.params) : {};
  const { id: gameId } = rawParams as { id?: string };

  try {
    const { playerId } = await request.json();

    const gameRecord = getGameRecordById(gameId);
    if (!gameRecord) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // 初始化准备玩家列表
    if (!gameRecord.readyPlayers) gameRecord.readyPlayers = [];

    // 添加玩家到准备列表
    if (!gameRecord.readyPlayers.includes(playerId)) {
      gameRecord.readyPlayers.push(playerId);
    }

    // 是否全部准备
    const allReady = gameRecord.players.every(pid => gameRecord.readyPlayers!.includes(pid));

    // 若是第一次且全部准备，加载第一轮剧情
    if (allReady && gameRecord.roundRecords.length === 0) {
      gameRecord.status = 'story_reading';
      const script = getScriptById(gameRecord.scriptId);
      if (script?.roundContents?.length) {
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

    updateGameRecord(gameRecord);
    return NextResponse.json({ success: true, readyPlayers: gameRecord.readyPlayers, allReady });
  } catch (error) {
    console.error('Ready API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
