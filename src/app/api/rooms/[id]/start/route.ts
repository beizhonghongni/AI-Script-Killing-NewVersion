import { NextRequest, NextResponse } from 'next/server';
import { generateScript, generatePersonalScript } from '@/lib/llm';
import { getRoomById, updateRoom, createGameRecord, createScript } from '@/lib/storage';
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
      const playerCount = room.players.length;
      const aiNPCCount = aiNPCTypes ? aiNPCTypes.length : 0;
      
      const script = await generateScript(plotRequirement, rounds, playerCount, aiNPCCount);

      // 保存生成的脚本
      createScript(script);

      // 将AI类型转换为完整的AI NPC配置
      const AI_CHARACTER_TYPES = [
        { id: 'logical', name: '逻辑分析型', personality: '善于逻辑推理和细节分析，说话条理清晰，喜欢用数据和事实支撑观点' },
        { id: 'exploratory', name: '探索冒险型', personality: '勇于尝试新想法和假设，思维活跃，经常提出创新性的观点' },
        { id: 'mysterious', name: '神秘莫测型', personality: '话语间常带有神秘色彩，喜欢用隐喻和暗示，给人深不可测的感觉' },
        { id: 'suspicious', name: '多疑谨慎型', personality: '对一切都保持怀疑态度，善于发现疑点，说话谨慎小心' },
        { id: 'emotional', name: '情感丰富型', personality: '情绪表达丰富生动，容易被剧情感动，说话带有强烈的感情色彩' },
        { id: 'calm', name: '冷静沉稳型', personality: '始终保持冷静和理性，不易激动，说话平和有条理' }
      ];

      const aiNPCs = (aiNPCTypes || []).map((typeId: string, index: number) => {
        const characterType = AI_CHARACTER_TYPES.find(type => type.id === typeId);
        if (!characterType) return null;
        
        // 分配给AI的角色（次要角色）
        const aiCharacter = script.characters[playerCount + index];
        
        return {
          id: `ai_${typeId}_${index}`,
          name: characterType.name,
          personality: characterType.personality,
          type: typeId,
          isActive: true,
          style: characterType.personality,
          characterId: aiCharacter?.id,
          characterName: aiCharacter?.name
        };
      }).filter(Boolean);

      // 创建玩家角色分配映射
      const playerCharacters: { [playerId: string]: string } = {};
      const aiCharacters: { [aiId: string]: string } = {};
      
      // 为真人玩家分配主要角色
      room.players.forEach((playerId, index) => {
        if (script.characters[index]) {
          playerCharacters[playerId] = script.characters[index].id;
        }
      });

      // 为AI分配次要角色
      aiNPCs.forEach((ai, index) => {
        if (ai && script.characters[playerCount + index]) {
          aiCharacters[ai.id] = script.characters[playerCount + index].id;
        }
      });

      // 为每个角色生成个人剧本
      const personalScripts: { [characterId: string]: any } = {};
      
      // 为真人玩家生成个人剧本（主要角色）
      for (let i = 0; i < playerCount && i < script.characters.length; i++) {
        const character = script.characters[i];
        try {
          const personalScript = await generatePersonalScript(
            script,
            character.id,
            script.characters,
            character.isMainCharacter
          );
          personalScripts[character.id] = {
            characterId: character.id,
            personalBackground: personalScript.personalBackground,
            personalRoundContents: personalScript.personalRoundContents
          };
        } catch (error) {
          console.error(`Failed to generate personal script for ${character.id}:`, error);
          // 使用默认的个人剧本
          personalScripts[character.id] = {
            characterId: character.id,
            personalBackground: `作为${character.name}，你发现自己卷入了这个复杂的事件中。${script.background}`,
            personalRoundContents: script.roundContents.map(rc => ({
              round: rc.round,
              personalPlot: rc.plot,
              hiddenInfo: "你有一些其他人不知道的信息..."
            }))
          };
        }
      }

      // 为AI NPC生成个人剧本（次要角色）
      for (let i = 0; i < aiNPCCount && i < aiNPCs.length; i++) {
        const character = script.characters[playerCount + i];
        if (character) {
          try {
            const personalScript = await generatePersonalScript(
              script,
              character.id,
              script.characters,
              character.isMainCharacter
            );
            personalScripts[character.id] = {
              characterId: character.id,
              personalBackground: personalScript.personalBackground,
              personalRoundContents: personalScript.personalRoundContents
            };
          } catch (error) {
            console.error(`Failed to generate personal script for AI ${character.id}:`, error);
            // 使用默认的个人剧本
            personalScripts[character.id] = {
              characterId: character.id,
              personalBackground: `作为${character.name}，你是这个事件的旁观者。${script.background}`,
              personalRoundContents: script.roundContents.map(rc => ({
                round: rc.round,
                personalPlot: rc.plot,
                hiddenInfo: "你可能注意到了一些细节..."
              }))
            };
          }
        }
      }

      // 创建游戏记录
      const gameRecord = {
        id: generateId('game'),
        roomId: roomId,
        hostId: room.hostId,
        scriptId: script.id,
        players: room.players,
        aiNPCs: aiNPCs,
        playerCharacters,
        aiCharacters,
        personalScripts,
        plotRequirement,
        rounds,
        scriptBackground: script.background,
        roundRecords: [],
        status: 'story_reading' as const,
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
