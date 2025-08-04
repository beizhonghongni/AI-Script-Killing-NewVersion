import { NextRequest, NextResponse } from 'next/server';
import { getGameRecordById, updateGameRecord } from '@/lib/storage';
import { generateNPCResponse } from '@/lib/llm';

// AI NPC响应API
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const gameId = params.id;
  
  try {
    const { userMessage, aiNPC, gameContext } = await request.json();
    
    // 获取游戏记录
    const gameRecord = getGameRecordById(gameId);
    if (!gameRecord) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    
    // 生成AI响应
    const aiResponse = await generateNPCResponse({
      userMessage,
      aiNPC,
      gameContext,
      gameRecord
    });
    
    if (!aiResponse) {
      return NextResponse.json({ error: 'Failed to generate AI response' }, { status: 500 });
    }
    
    // 创建AI消息对象
    const aiMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: `ai_${aiNPC.id}`,
      senderName: aiNPC.name,
      content: aiResponse,
      timestamp: Date.now(),
      isNPC: true
    };
    
    // 添加到当前轮次
    const currentRoundIndex = gameRecord.roundRecords.length - 1;
    if (currentRoundIndex >= 0) {
      gameRecord.roundRecords[currentRoundIndex].messages.push(aiMessage);
      updateGameRecord(gameRecord);
    }
    
    return NextResponse.json({ success: true, message: aiMessage });
  } catch (error) {
    console.error('AI response API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
