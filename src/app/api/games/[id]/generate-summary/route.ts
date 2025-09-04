import { NextRequest, NextResponse } from 'next/server';
import { getGameRecordById, updateGameRecord, getUserById } from '@/lib/storage';
import { callLLM } from '@/lib/llm';
import { GameSummary, PlayerAnalysis } from '@/types';

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const rawParams = context?.params ? (context.params.then ? await context.params : context.params) : {};
    const { id } = rawParams as { id?: string };
    const { playerId, force } = await request.json();

    // 获取游戏记录
    const gameRecord = getGameRecordById(id);
    if (!gameRecord) {
      return NextResponse.json({ success: false, error: 'Game not found' });
    }

    // 检查是否在最后一轮（允许玩家在最后一轮生成复盘）
    const currentRound = gameRecord.roundRecords.length;
    if (currentRound !== gameRecord.rounds) {
      return NextResponse.json({ success: false, error: 'Can only generate summary in the final round' });
    }

    // 检查是否已经有缓存的复盘结果
  if (!force && gameRecord.finalSummary && Object.keys(gameRecord.finalSummary).length > 0) {
      // 检查缓存的复盘内容是否为空
      const cachedSummary = Object.values(gameRecord.finalSummary)[0];
      if (cachedSummary && cachedSummary.storyReview && cachedSummary.storyReview.trim() && 
          cachedSummary.plotAnalysis && cachedSummary.plotAnalysis.trim() && 
          cachedSummary.storyElevation && cachedSummary.storyElevation.trim()) {
        // 返回已缓存的复盘结果（内容非空）
        console.log('返回缓存的复盘结果');
        return NextResponse.json({ success: true, summary: cachedSummary });
      } else {
        // 如果缓存内容为空，清除缓存并重新生成
        console.log('缓存内容为空，清除缓存重新生成');
        delete gameRecord.finalSummary;
      }
    }

  // 获取用户信息以确定角色（保留，但不再用于第一人称复盘）
  const user = getUserById(playerId);
  const characterId = gameRecord.playerCharacters[playerId];
  const characterName = characterId || `玩家${gameRecord.players.indexOf(playerId) + 1}`;

    // 构建游戏历史消息
    let gameMessages = '';
    gameRecord.roundRecords.forEach((round, index) => {
      gameMessages += `\n第${index + 1}轮剧情: ${round.plot}\n`;
      
      round.messages.forEach(msg => {
        const senderName = msg.isNPC ? msg.senderName : 
          (gameRecord.playerCharacters[msg.senderId] ? 
           `角色${gameRecord.playerCharacters[msg.senderId]}` : 
           `玩家${gameRecord.players.indexOf(msg.senderId) + 1}`);
        gameMessages += `${senderName}: ${msg.content}\n`;
      });
    });

    // 收集所有真人玩家信息（包含请求者），名称优先使用聊天中的 senderName
    const allMessages = gameRecord.roundRecords.flatMap(round => round.messages);
    const allPlayersInfo = gameRecord.players.map(pid => {
      const nameFromChat = allMessages.find(m => m.senderId === pid)?.senderName;
      const playerCharacterId = gameRecord.playerCharacters[pid];
      const fallbackName = playerCharacterId || `玩家${gameRecord.players.indexOf(pid) + 1}`;
      return {
        id: pid,
        name: nameFromChat || fallbackName,
        messages: allMessages.filter(msg => msg.senderId === pid)
      };
    });

  // 生成故事复盘（客观理性，避免情绪化）
  const storyReviewPrompt = `
你是剧本杀复盘记录员。基于以下游戏背景与完整记录，给出客观、理性、面向全体的本局剧情复盘摘要。

游戏背景: ${gameRecord.scriptBackground}
总轮数: ${gameRecord.rounds}

完整游戏记录:
${gameMessages}

写作要求：
- 不使用第一人称与煽情词汇；按时间线概述主要事件、关键线索、转折与结局；
- 语言简洁克制、信息密度高；
- 200-300字。

直接输出文本内容（不要JSON、不要标题）。
`;

    const storyReview = await callLLM(storyReviewPrompt, true); // 使用Pro模型生成更好的总结
    console.log('Story review LLM result:', storyReview);

  // 生成精彩点解密（中性、基于证据）
  const plotAnalysisPrompt = `
基于上述记录，输出“关键推理与机制要点”分析：
1) 哪些发言或线索起到证伪/证成作用（引用片段或概述要点）；
2) 逻辑链条如何从线索串联到结论；
3) 可能的歧义点与替代路径。

要求：
- 客观、中性，不夸张；
- 150-220字；
- 直接输出文本内容。
`;

    const plotAnalysis = await callLLM(plotAnalysisPrompt, true);
    console.log('Plot analysis LLM result:', plotAnalysis);

  // 生成故事总结（理性收束）
  const elevationPrompt = `
请对本局做理性收束：
- 用3-4句话总结本局的结构特点、线索配置与讨论节奏；
- 指出对下一次同类局可复用的经验（如信息披露节奏、协作与分歧处理）。

要求：100-160字；中性、专业。
`;

    const storyElevation = await callLLM(elevationPrompt, true);
    console.log('Story elevation LLM result:', storyElevation);

    // 生成玩家分析
    const playerAnalysis: { [playerId: string]: PlayerAnalysis } = {};
    
    for (const p of allPlayersInfo) {
      const playerMessages = p.messages.map(msg => `${msg.senderName || p.name}: ${msg.content}`).join('\n');
      
      const playerAnalysisPrompt = `
对下列玩家进行理性点评（基于其真实发言）："${p.name}"。

该玩家的全部发言（按时间顺序）：
${playerMessages}

请分三点输出：
1. 观点总结：该玩家的核心主张/怀疑对象及依据（客观转述）。
2. 剧情相关点评：其对推进调查、串联线索或证伪的具体贡献（举1-2处）。
3. 发言风格：表达特点与合作度（中性描述，避免评判性词语）。

每点40-70字；直接按以下格式返回：
观点总结: ...\n剧情相关点评: ...\n发言风格: ...
`;

      const analysisResult = await callLLM(playerAnalysisPrompt, false);

      // 解析返回结果
      const lines = analysisResult.split('\n').filter(line => line.trim());
      let viewpointSummary = '';
      let plotRelatedComment = '';
      let styleComment = '';

      lines.forEach(line => {
        if (line.includes('观点总结')) {
          viewpointSummary = line.split(':')[1]?.trim() || line.replace('观点总结', '').trim();
        } else if (line.includes('剧情相关点评') || line.includes('剧情贡献')) {
          plotRelatedComment = line.split(':')[1]?.trim() || line.replace('剧情相关点评', '').trim();
        } else if (line.includes('发言风格')) {
          styleComment = line.split(':')[1]?.trim() || line.replace('发言风格', '').trim();
        }
      });

      playerAnalysis[p.id] = {
        playerId: p.id,
        playerName: p.name,
        viewpointSummary: viewpointSummary || '该玩家的主张较为稳定，并基于当轮信息作出判断。',
        plotRelatedComment: plotRelatedComment || '在关键节点提供线索关联或证伪思路，促进讨论收敛。',
        styleComment: styleComment || '表达清晰，互动配合度良好。'
      };
    }

    // 构建完整的游戏总结
    const summary: GameSummary = {
      playerId,
      storyReview: storyReview.trim(),
      plotAnalysis: plotAnalysis.trim(),
      storyElevation: storyElevation.trim(),
      playerAnalysis
    };

    console.log('Final summary object:', JSON.stringify(summary, null, 2));

    // 保存到游戏记录
    if (!gameRecord.finalSummary) {
      gameRecord.finalSummary = {};
    }
    gameRecord.finalSummary[playerId] = summary;
    
    updateGameRecord(gameRecord);

    return NextResponse.json({
      success: true,
      summary
    });

  } catch (error) {
    console.error('Generate summary error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to generate summary' 
    });
  }
}
