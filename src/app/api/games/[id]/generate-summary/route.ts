import { NextRequest, NextResponse } from 'next/server';
import { getGameRecordById, updateGameRecord, getUserById } from '@/lib/storage';
import { callLLM } from '@/lib/llm';
import { GameSummary, PlayerAnalysis } from '@/types';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { playerId } = await request.json();

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

    // 获取用户信息以确定角色
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

    // 构建其他玩家信息
    const otherPlayersInfo = gameRecord.players
      .filter(pid => pid !== playerId)
      .map(pid => {
        const playerCharacterId = gameRecord.playerCharacters[pid];
        const playerName = playerCharacterId || `玩家${gameRecord.players.indexOf(pid) + 1}`;
        return {
          id: pid,
          name: playerName,
          messages: gameRecord.roundRecords
            .flatMap(round => round.messages)
            .filter(msg => msg.senderId === pid)
        };
      });

    // 生成故事复盘
    const storyReviewPrompt = `
你是一个专业的剧本杀游戏复盘师。请为玩家"${characterName}"生成一份精彩的故事复盘。

游戏背景: ${gameRecord.scriptBackground}
总轮数: ${gameRecord.rounds}

完整游戏记录:
${gameMessages}

请从"${characterName}"的视角，用第一人称写一份生动有趣的故事复盘，包括：
1. 整个故事的发展脉络
2. 关键转折点和悬疑moments
3. 你在游戏中的体验和感受
4. 故事的高潮和结局

要求：
- 用第一人称叙述，仿佛是玩家在回忆这次游戏
- 语言生动有趣，带有感情色彩
- 突出游戏的精彩和悬疑感
- 200-300字左右

请直接返回复盘内容，不要包含其他格式。
`;

    const storyReview = await callLLM(storyReviewPrompt, true); // 使用Pro模型生成更好的总结

    // 生成精彩点解密
    const plotAnalysisPrompt = `
基于刚才的游戏记录，请为玩家"${characterName}"生成精彩点解密部分。

分析以下内容：
1. 游戏中最精彩的推理和讨论片段
2. 关键线索的发现和推理过程
3. 玩家之间的精彩互动和辩论
4. AI NPC的精彩表现

要求：
- 客观分析游戏中的精彩moments
- 突出推理的逻辑性和趣味性
- 150-250字左右

请直接返回分析内容。
`;

    const plotAnalysis = await callLLM(plotAnalysisPrompt, true);

    // 生成故事升华
    const elevationPrompt = `
请为这次剧本杀游戏生成故事升华部分，从更深层次的角度分析这个故事。

游戏背景: ${gameRecord.scriptBackground}
游戏过程: ${gameMessages}

请从以下角度进行升华：
1. 故事背后的深层含义或社会意义
2. 人性的展现和思考
3. 游戏给人的启发和感悟
4. 角色命运的思考

要求：
- 具有一定的哲学深度
- 语言优美，富有感染力
- 100-200字左右

请直接返回升华内容。
`;

    const storyElevation = await callLLM(elevationPrompt, true);

    // 生成玩家分析
    const playerAnalysis: { [playerId: string]: PlayerAnalysis } = {};
    
    for (const otherPlayer of otherPlayersInfo) {
      const playerMessages = otherPlayer.messages.map(msg => msg.content).join('\n');
      
      const playerAnalysisPrompt = `
请对玩家"${otherPlayer.name}"在这次剧本杀游戏中的表现进行分析。

该玩家的所有发言:
${playerMessages}

请从以下三个方面进行分析：
1. 观点总结: 该玩家在游戏中的主要观点和立场
2. 剧情贡献: 该玩家对推进剧情发展的贡献
3. 发言风格: 该玩家的发言特点，用赞赏的语气进行点评

要求：
- 客观公正，突出正面特点
- 每个方面50-80字
- 语言友善，富有鼓励性

请按以下格式返回：
观点总结: [内容]
剧情贡献: [内容]  
发言风格: [内容]
`;

      const analysisResult = await callLLM(playerAnalysisPrompt, false); // 使用较快的模型分析玩家

      // 解析返回结果
      const lines = analysisResult.split('\n').filter(line => line.trim());
      let viewpointSummary = '';
      let plotRelatedComment = '';
      let styleComment = '';

      lines.forEach(line => {
        if (line.includes('观点总结:')) {
          viewpointSummary = line.replace('观点总结:', '').trim();
        } else if (line.includes('剧情贡献:')) {
          plotRelatedComment = line.replace('剧情贡献:', '').trim();
        } else if (line.includes('发言风格:')) {
          styleComment = line.replace('发言风格:', '').trim();
        }
      });

      playerAnalysis[otherPlayer.id] = {
        playerId: otherPlayer.id,
        playerName: otherPlayer.name,
        viewpointSummary: viewpointSummary || '积极参与讨论，展现了良好的游戏态度。',
        plotRelatedComment: plotRelatedComment || '为游戏的推进做出了自己的贡献。',
        styleComment: styleComment || '发言自然流畅，展现了独特的个人风格。'
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
