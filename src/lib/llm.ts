import { LLMRequest, LLMResponse, LLMContext, GameRecord, Script, AINPCConfig } from '@/types';

const GEMINI_API_KEY = 'AIzaSyBlRd7b8-Lx3AXKFRTLz9jHqC7T4dJ51jg';
const GEMINI_2_5_PRO_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_2_0_FLASH_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// 通用LLM调用函数
async function callLLM(prompt: string, useProModel = false): Promise<string> {
  const url = useProModel ? GEMINI_2_5_PRO_URL : GEMINI_2_0_FLASH_URL;
  
  const request: LLMRequest = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data: LLMResponse = await response.json();
    
    if (data.candidates && data.candidates.length > 0) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('No response from LLM');
    }
  } catch (error) {
    console.error('LLM API call failed:', error);
    throw error;
  }
}

// 1. 生成剧本 - 使用2.5 Pro
export async function generateScript(plotRequirement: string, rounds: number): Promise<Script> {
  const prompt = `
你是一个专业的剧本杀剧本创作者。请根据以下要求创建一个完整的剧本：

剧情要求：${plotRequirement}
游戏轮数：${rounds}

请创建一个包含以下内容的剧本：
1. 引人入胜的故事背景（200-300字）
2. 每轮的剧情发展（每轮100-150字）
3. 每轮每个玩家的私人线索（每个50-80字，要有差异性和关联性）

输出格式必须是严格的JSON格式：
{
  "title": "剧本标题",
  "background": "故事背景描述",
  "roundContents": [
    {
      "round": 1,
      "plot": "第一轮剧情",
      "privateClues": {
        "player1": "玩家1的私人线索",
        "player2": "玩家2的私人线索",
        "player3": "玩家3的私人线索"
      }
    }
  ]
}

请确保剧情有悬念、逻辑清晰，私人线索之间有关联但又各不相同。
`;

  const response = await callLLM(prompt, true);
  
  try {
    const scriptData = JSON.parse(response);
    
    const script: Script = {
      id: `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: scriptData.title,
      rounds: rounds,
      background: scriptData.background,
      roundContents: scriptData.roundContents,
      createdAt: Date.now(),
      createdBy: 'system'
    };
    
    return script;
  } catch (error) {
    console.error('Failed to parse script JSON:', error);
    throw new Error('Failed to generate valid script');
  }
}

// 2. AI NPC发言决策 - 使用2.0 Flash
export async function getNPCAction(
  npc: AINPCConfig,
  gameRecord: GameRecord,
  currentRound: number
): Promise<{ shouldSpeak: boolean; content?: string }> {
  const currentRoundRecord = gameRecord.roundRecords[currentRound - 1];
  const recentMessages = currentRoundRecord.messages.slice(-10); // 最近10条消息
  
  const prompt = `
你正在扮演一个AI NPC角色，需要决定是否在当前讨论中发言。

NPC信息：
- 姓名：${npc.name}
- 风格：${npc.style}
- 性格：${npc.personality}

故事背景：${gameRecord.scriptBackground}

当前轮次：${currentRound}
当前剧情：${currentRoundRecord.plot}
你的私人线索：${currentRoundRecord.privateClues[npc.id] || '无特殊线索'}

最近的讨论记录：
${recentMessages.map(msg => `${msg.senderName}: ${msg.content}`).join('\n')}

请决定：
1. 是否需要发言（考虑讨论热度、是否有新信息、角色性格等）
2. 如果发言，说什么内容（符合角色性格，推进讨论，不要重复已说过的内容）

输出格式必须是JSON：
{
  "shouldSpeak": true/false,
  "content": "发言内容（如果shouldSpeak为true）"
}

注意：
- 不要总是发言，要有节制
- 发言要符合角色性格
- 要推进剧情或提供有价值的信息
- 避免重复别人已经说过的内容
`;

  const response = await callLLM(prompt, false);
  
  try {
    const decision = JSON.parse(response);
    return {
      shouldSpeak: decision.shouldSpeak,
      content: decision.shouldSpeak ? decision.content : undefined
    };
  } catch (error) {
    console.error('Failed to parse NPC decision JSON:', error);
    return { shouldSpeak: false };
  }
}

// 3. 轮次进展决策 - 使用2.0 Flash
export async function shouldAdvanceRound(gameRecord: GameRecord, currentRound: number): Promise<boolean> {
  const currentRoundRecord = gameRecord.roundRecords[currentRound - 1];
  const recentMessages = currentRoundRecord.messages.slice(-15); // 最近15条消息
  
  const prompt = `
你需要分析当前剧本杀游戏的讨论情况，判断是否应该进入下一轮。

当前轮次：${currentRound}/${gameRecord.rounds}
当前剧情：${currentRoundRecord.plot}

最近的讨论记录：
${recentMessages.map(msg => `${msg.senderName}: ${msg.content}`).join('\n')}

请分析：
1. 讨论是否充分（玩家们是否已经充分交流）
2. 是否还有未解决的关键问题
3. 讨论氛围是否开始冷场
4. 是否有玩家表示想继续讨论

输出格式必须是JSON：
{
  "shouldAdvance": true/false,
  "reason": "判断理由"
}

判断标准：
- 如果讨论已经比较充分且开始冷场，建议进入下一轮
- 如果还有激烈讨论或未解决的问题，建议继续当前轮
- 如果明显有玩家想继续说话，建议等待
`;

  const response = await callLLM(prompt, false);
  
  try {
    const decision = JSON.parse(response);
    return decision.shouldAdvance;
  } catch (error) {
    console.error('Failed to parse round decision JSON:', error);
    return false; // 默认不推进
  }
}

// 4. 游戏总结生成 - 使用2.5 Pro
export async function generateGameSummary(
  gameRecord: GameRecord,
  playerId: string
): Promise<{
  storyReview: string;
  plotAnalysis: string;
  storyElevation: string;
  playerAnalysis: { [playerId: string]: any };
}> {
  const playerMessages = gameRecord.roundRecords
    .flatMap(round => round.messages)
    .filter(msg => msg.senderId === playerId);
  
  const allMessages = gameRecord.roundRecords
    .flatMap(round => round.messages);
  
  const prompt = `
请为剧本杀游戏生成详细的复盘总结。

故事背景：${gameRecord.scriptBackground}

完整游戏记录：
${gameRecord.roundRecords.map(round => 
  `第${round.round}轮:\n剧情: ${round.plot}\n讨论记录:\n${round.messages.map(msg => `${msg.senderName}: ${msg.content}`).join('\n')}`
).join('\n\n')}

目标玩家ID：${playerId}
目标玩家发言记录：
${playerMessages.map(msg => `${msg.senderName}: ${msg.content}`).join('\n')}

请生成以下内容：

1. 故事复盘（200-300字）：整个故事的发展脉络和关键转折点
2. 精彩点解密（150-200字）：游戏中的高光时刻和巧妙设计
3. 故事升华（100-150字）：这个故事的深层含义和启发

4. 每个玩家的分析：
   - 观点总结：该玩家在游戏中的主要观点和立场
   - 剧情相关点评：该玩家对剧情推进的贡献
   - 风格点评：该玩家的发言风格特点，要夸奖和鼓励

输出格式必须是JSON：
{
  "storyReview": "故事复盘",
  "plotAnalysis": "精彩点解密", 
  "storyElevation": "故事升华",
  "playerAnalysis": {
    "玩家ID": {
      "playerName": "玩家名称",
      "viewpointSummary": "观点总结",
      "plotRelatedComment": "剧情相关点评",
      "styleComment": "风格点评（要夸奖）"
    }
  }
}
`;

  const response = await callLLM(prompt, true);
  
  try {
    const summary = JSON.parse(response);
    return summary;
  } catch (error) {
    console.error('Failed to parse game summary JSON:', error);
    throw new Error('Failed to generate game summary');
  }
}
