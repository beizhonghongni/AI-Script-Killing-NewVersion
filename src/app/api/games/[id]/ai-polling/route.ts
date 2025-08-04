import { NextRequest, NextResponse } from 'next/server';
import { getNPCAction } from '@/lib/llm';
import { getGameRecordById, updateGameRecord } from '@/lib/storage';
import { GameMessage } from '@/types';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { userMessage, aiNPC, gameContext } = await request.json();

    // 获取游戏记录
    const gameRecord = getGameRecordById(id);
    if (!gameRecord) {
      return NextResponse.json({ success: false, error: 'Game not found' });
    }

    // 确保当前轮次记录存在
    const currentRound = gameContext.currentRound || 1;
    
    // 调用改进的LLM决定AI是否接话，传递更详细的上下文
    const decision = await getNPCAction(aiNPC, gameRecord, currentRound);

    if (decision.shouldSpeak && decision.content) {
      // 获取剧本信息来找到AI角色名
      let characterName = aiNPC.name;
      
      // 如果有角色ID，尝试从存储中获取剧本信息
      if (aiNPC.characterId) {
        try {
          // 这里我们使用 gameRecord 中的 scriptBackground 和其他信息
          // 或者从 aiNPC 的配置中获取角色名
          characterName = aiNPC.characterName || aiNPC.name;
        } catch (error) {
          console.log('Could not get character name, using NPC name');
        }
      }
      
      // 创建AI NPC消息
      const aiMessage: GameMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        senderId: aiNPC.id,
        senderName: characterName, // 使用游戏中的角色名或NPC名
        content: decision.content,
        timestamp: Date.now(),
        isNPC: true
      };

      // 添加消息到当前轮次记录
      const currentRoundIndex = gameRecord.roundRecords.length - 1;
      if (currentRoundIndex >= 0) {
        gameRecord.roundRecords[currentRoundIndex].messages.push(aiMessage);
        updateGameRecord(gameRecord);
      }

      return NextResponse.json({
        success: true,
        shouldSpeak: true,
        message: aiMessage
      });
    } else {
      return NextResponse.json({
        success: true,
        shouldSpeak: false
      });
    }
  } catch (error) {
    console.error('AI polling response error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process AI polling response' 
    });
  }
}
