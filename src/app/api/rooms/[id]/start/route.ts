import { NextRequest, NextResponse } from 'next/server';
import { generateScript } from '@/lib/llm';
import { getRoomById, updateRoom, createGameRecord } from '@/lib/storage';
import { generateId } from '@/lib/utils';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { rounds, plotRequirement, aiNPCTypes } = await request.json();
    const { id: roomId } = await params;
    
    const room = getRoomById(roomId);
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    // 更新房间状态为游戏中
    const updatedRoom = { ...room, status: 'playing' as const };
    updateRoom(updatedRoom);

    // 使用LLM 2.5 Pro生成剧本
    try {
      const script = await generateScript(plotRequirement, rounds);

      // 创建游戏记录
      const gameRecord = {
        id: generateId('game'),
        roomId: roomId,
        hostId: room.hostId,
        scriptId: script.id,
        players: room.players,
        aiNPCs: aiNPCTypes || [],
        plotRequirement,
        rounds,
        scriptBackground: script.background,
        roundRecords: [],
        status: 'preparing' as const,
        createdAt: Date.now()
      };

      createGameRecord(gameRecord);

      // 更新房间信息
      const finalRoom = { 
        ...updatedRoom, 
        scriptId: script.id,
        gameId: gameRecord.id
      };
      updateRoom(finalRoom);

      return NextResponse.json({ 
        success: true, 
        script,
        gameRecord 
      });
    } catch (llmError) {
      console.error('Failed to generate script:', llmError);
      
      // 如果剧本生成失败，恢复房间状态
      const restoredRoom = { ...room, status: 'waiting' as const };
      updateRoom(restoredRoom);
      
      return NextResponse.json({ 
        success: false, 
        error: '剧本生成失败，请稍后重试' 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Start game error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to start game' 
    }, { status: 500 });
  }
}
