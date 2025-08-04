import { NextRequest, NextResponse } from 'next/server';
import { getGameRecordById, updateGameRecord } from '@/lib/storage';

// 发送聊天消息
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const gameId = params.id;
  
  try {
    const messageData = await request.json();
    
    // Convert to GameMessage format
    const gameMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: messageData.userId,
      senderName: messageData.username, // 这里已经是角色名了
      content: messageData.content,
      timestamp: messageData.timestamp,
      isNPC: false,
      characterId: messageData.characterId || null // 添加角色ID
    };
    
    // Read current game record
    const gameRecord = getGameRecordById(gameId);
    if (!gameRecord) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    
    // Add message to current round
    const currentRoundIndex = gameRecord.roundRecords.length - 1;
    if (currentRoundIndex >= 0) {
      gameRecord.roundRecords[currentRoundIndex].messages.push(gameMessage);
    } else {
      // Create initial round if none exists
      gameRecord.roundRecords.push({
        round: 1,
        plot: '',
        privateClues: {},
        messages: [gameMessage],
        isFinished: false
      });
    }
    
    // Save updated game record
    updateGameRecord(gameRecord);
    return NextResponse.json({ success: true, message: gameMessage });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
