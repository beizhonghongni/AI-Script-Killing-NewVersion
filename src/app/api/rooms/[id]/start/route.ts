import { NextRequest, NextResponse } from 'next/server';
import { generateScript, generatePersonalScript } from '@/lib/llm';
import { getRoomById, updateRoom, createGameRecord, createScript } from '@/lib/storage';
import { generateId } from '@/lib/utils';

// 降级剧本生成函数
function generateFallbackScript(plotRequirement: string, rounds: number, playerCount: number, aiCount: number) {
  const scriptId = generateId('script');
  
  // 生成角色
  const characters = [];
  
  // 真人角色
  for (let i = 0; i < playerCount; i++) {
    characters.push({
      id: generateId('char'),
      name: `角色${i + 1}`,
      identity: `身份${i + 1}`,
      personality: `性格特点${i + 1}`,
      isMainCharacter: true
    });
  }
  
  // AI角色
  for (let i = 0; i < aiCount; i++) {
    characters.push({
      id: generateId('char'),
      name: `AI角色${i + 1}`,
      identity: `AI身份${i + 1}`,
      personality: `AI性格特点${i + 1}`,
      isMainCharacter: false
    });
  }
  
  // 生成轮次内容
  const roundContents = [];
  for (let round = 1; round <= rounds; round++) {
    roundContents.push({
      round: round,
      plot: `第${round}轮剧情：${plotRequirement}相关的故事发展...`
    });
  }
  
  return {
    id: scriptId,
    title: '默认剧本',
    background: `基于您的要求"${plotRequirement}"生成的故事背景`,
    rounds: rounds,
    characters: characters,
    roundContents: roundContents,
    createdAt: Date.now(),
    createdBy: 'fallback'
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { rounds, plotRequirement, aiNPCTypes } = await request.json();
    const { id: roomId } = await params;
    
    const room = getRoomById(roomId);
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    console.log(`开始游戏，房间ID: ${roomId}，当前状态: ${room.status}`);

    let script: any;
    let personalScripts: { [characterId: string]: any } = {};

    // 检查是否是收藏剧本
    if ((room as any).collectedScript) {
      // 使用收藏剧本
      const collectedScript = (room as any).collectedScript;
      script = {
        id: generateId('script'),
        title: collectedScript.title,
        rounds: collectedScript.rounds,
        background: collectedScript.background,
        characters: collectedScript.characters,
        roundContents: collectedScript.roundContents,
        createdAt: Date.now(),
        createdBy: 'collected'
      };

      // 使用原有的个人剧本
      collectedScript.characters.forEach((char: any) => {
        if (collectedScript.personalScripts && collectedScript.personalScripts[char.id]) {
          personalScripts[char.id] = collectedScript.personalScripts[char.id];
        }
      });
    } else {
      // 生成新剧本
      try {
        console.log('开始生成剧本...');
        const playerCount = room.players.length;
        const aiNPCCount = aiNPCTypes ? aiNPCTypes.length : 0;
        
        script = await generateScript(plotRequirement, rounds, playerCount, aiNPCCount);
        console.log('剧本生成成功');

        // 为每个角色生成个人剧本
        console.log('开始生成个人剧本...');
        for (let i = 0; i < script.characters.length; i++) {
          const character = script.characters[i];
          try {
            console.log(`为角色 ${character.name} 生成个人剧本...`);
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
            console.log(`角色 ${character.name} 个人剧本生成成功`);
          } catch (error) {
            console.error(`Failed to generate personal script for ${character.id}:`, error);
            // 使用默认的个人剧本
            personalScripts[character.id] = {
              characterId: character.id,
              personalBackground: `作为${character.name}，你发现自己卷入了这个复杂的事件中。${script.background}`,
              personalRoundContents: script.roundContents.map((rc: any) => ({
                round: rc.round,
                personalPlot: rc.plot,
                hiddenInfo: "你有一些其他人不知道的信息..."
              }))
            };
          }
        }
      } catch (llmError) {
        console.error('Failed to generate script:', llmError);
        
        // 生成一个简单的默认剧本作为降级方案
        console.log('使用默认剧本作为降级方案');
        script = generateFallbackScript(plotRequirement, rounds, room.players.length, aiNPCTypes?.length || 0);
        
        // 为每个角色生成简单的个人剧本
        script.characters.forEach((character: any) => {
          personalScripts[character.id] = {
            characterId: character.id,
            personalBackground: `作为${character.name}，你发现自己卷入了这个复杂的事件中。${script.background}`,
            personalRoundContents: script.roundContents.map((rc: any) => ({
              round: rc.round,
              personalPlot: rc.plot,
              hiddenInfo: "你有一些其他人不知道的信息..."
            }))
          };
        });
        
        console.log('默认剧本生成完成');
      }
    }

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

    const playerCount = room.players.length;
    const aiNPCCount = aiNPCTypes ? aiNPCTypes.length : 0;

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
      plotRequirement: (room as any).collectedScript ? (room as any).collectedScript.plotRequirement : plotRequirement,
      rounds: (room as any).collectedScript ? (room as any).collectedScript.rounds : rounds,
      scriptBackground: script.background,
      script: script, // 添加完整的剧本数据
      roundRecords: [],
      status: 'story_reading' as const,
      createdAt: Date.now()
    };

    createGameRecord(gameRecord);

    // 更新房间信息 - 设置为游戏状态并添加游戏相关信息
    const finalRoom = { 
      ...room, 
      status: 'playing' as const,
      scriptId: script.id,
      gameId: gameRecord.id
    };
    
    console.log(`更新房间状态为游戏中，房间ID: ${roomId}`);
    updateRoom(finalRoom);
    console.log(`房间状态更新完成，新状态: ${finalRoom.status}`);

    return NextResponse.json({ 
      success: true, 
      script,
      gameRecord 
    });
    
  } catch (error) {
    console.error('Start game error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to start game' 
    }, { status: 500 });
  }
}
