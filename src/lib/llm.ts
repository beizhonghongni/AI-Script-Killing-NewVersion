import { LLMRequest, LLMResponse, LLMContext, GameRecord, Script, AINPCConfig } from '@/types';

const GEMINI_API_KEY = 'AIzaSyBlRd7b8-Lx3AXKFRTLz9jHqC7T4dJ51jg';
const GEMINI_2_5_PRO_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_2_0_FLASH_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// 通用LLM调用函数
export async function callLLM(prompt: string, useProModel = false): Promise<string> {
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
export async function generateScript(
  plotRequirement: string, 
  rounds: number, 
  playerCount: number, 
  aiNPCCount: number
): Promise<Script> {
  const totalCharacters = playerCount + aiNPCCount;
  const prompt = `
你是一个专业的剧本杀剧本创作者。请根据以下要求创建一个完整的剧本：

剧情要求：${plotRequirement}
游戏轮数：${rounds}
真人玩家数量：${playerCount}（需要分配重要角色）
AI NPC数量：${aiNPCCount}（需要分配次要角色）
总角色数量：${totalCharacters}

请创建一个包含以下内容的剧本：
1. 引人入胜的故事背景（200-300字）
2. ${totalCharacters}个角色（包含姓名、身份、性格特点）
   - 前${playerCount}个角色是重要角色（给真人玩家）
   - 后${aiNPCCount}个角色是次要角色（给AI NPC）
3. 每轮的剧情发展（每轮100-150字）
4. 每轮每个角色的私人线索（每个50-80字，要有差异性和关联性）

输出格式必须是严格的JSON格式：
{
  "title": "剧本标题",
  "background": "故事背景描述",
  "characters": [
    {
      "id": "character1",
      "name": "角色姓名",
      "identity": "角色身份/职业",
      "personality": "性格特点",
      "isMainCharacter": true
    }
  ],
  "roundContents": [
    {
      "round": 1,
      "plot": "第一轮剧情",
      "privateClues": {
        "character1": "角色1的私人线索",
        "character2": "角色2的私人线索"
      }
    }
  ]
}

请确保：
- 剧情有悬念、逻辑清晰
- 前${playerCount}个角色是剧情核心人物（重要角色）
- 后${aiNPCCount}个角色是配角或旁观者（次要角色）
- 私人线索之间有关联但又各不相同
- 角色姓名要符合剧情背景
`;

  const response = await callLLM(prompt, true);
  
  try {
    // 清理响应中的markdown代码块标记
    let cleanedResponse = response.trim();
    
    // 移除开头的```json或```
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.slice(7);
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.slice(3);
    }
    
    // 移除结尾的```
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.slice(0, -3);
    }
    
    // 去除首尾空白字符
    cleanedResponse = cleanedResponse.trim();
    
    console.log('Cleaned LLM response:', cleanedResponse.substring(0, 200) + '...');
    
    const scriptData = JSON.parse(cleanedResponse);
    
    const script: Script = {
      id: `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: scriptData.title,
      rounds: rounds,
      background: scriptData.background,
      characters: scriptData.characters || [],
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
  const lastMessage = recentMessages[recentMessages.length - 1]; // 最后一条消息
  
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

${lastMessage ? `
最新发言是 ${lastMessage.senderName} 说的："${lastMessage.content}"
请特别考虑是否要回应这条最新发言。
` : ''}

请决定：
1. 是否需要发言（重点考虑是否要回应最新发言、讨论热度、是否有新信息、角色性格等）
2. 如果发言，说什么内容（符合角色性格，最好能回应最新发言的内容，推进讨论，不要重复已说过的内容）

输出格式必须是JSON：
{
  "shouldSpeak": true/false,
  "content": "发言内容（如果shouldSpeak为true）"
}

注意：
- 优先考虑回应最新发言的内容
- 不要总是发言，要有节制（约30-50%的概率发言）
- 发言要符合角色性格
- 要推进剧情或提供有价值的信息
- 避免重复别人已经说过的内容
- 如果最新发言提到了相关信息或问题，更倾向于回应
`;

  const response = await callLLM(prompt, false);
  
  try {
    // 清理响应中的markdown代码块标记
    let cleanedResponse = response.trim();
    
    // 移除开头的```json或```
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.slice(7);
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.slice(3);
    }
    
    // 移除结尾的```
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.slice(0, -3);
    }
    
    // 去除首尾空白字符
    cleanedResponse = cleanedResponse.trim();
    
    const decision = JSON.parse(cleanedResponse);
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

// 6. 生成AI NPC回复 - 使用2.0 Flash
export async function generateNPCResponse(context: {
  userMessage: string;
  aiNPC: AINPCConfig;
  gameContext: {
    background: string;
    currentRound: number;
    recentMessages: any[];
  };
  gameRecord: GameRecord;
}): Promise<string> {
  const { userMessage, aiNPC, gameContext, gameRecord } = context;
  
  const prompt = `你是一个剧本杀游戏中的AI NPC，名为"${aiNPC.name}"，性格特点是：${aiNPC.personality}。

游戏背景：
${gameContext.background}

当前是第${gameContext.currentRound}轮，刚才有玩家说了："${userMessage}"

最近的聊天记录：
${gameContext.recentMessages.map(msg => `${msg.senderName}: ${msg.content}`).join('\n')}

请根据你的性格特点，对这个发言做出1-2句简短的回应。回应要：
1. 符合你的性格特点（${aiNPC.personality}）
2. 与游戏剧情相关
3. 推动剧情发展或引发思考
4. 语言自然，不要过于正式
5. 不要暴露你是AI的身份

直接输出回复内容，不要JSON格式：`;

  try {
    const response = await callLLM(prompt, false);
    return response.trim();
  } catch (error) {
    console.error('Failed to generate NPC response:', error);
    // 返回备用回复
    const fallbackResponses = [
      "有意思的观点...",
      "这让我想到了什么...",
      "确实值得深思。",
      "或许事情没那么简单。",
      "继续说说你的想法。"
    ];
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
  }
}

// 7. 为特定角色生成个人剧本 - 让每个玩家看到不同内容
export async function generatePersonalScript(
  baseScript: Script,
  characterId: string,
  allCharacters: any[],
  isMainCharacter: boolean
): Promise<{
  personalBackground: string;
  personalRoundContents: any[];
}> {
  const character = allCharacters.find(c => c.id === characterId);
  if (!character) {
    throw new Error('Character not found');
  }

  const prompt = `
你是专业的剧本杀编剧，现在需要为特定角色创建个人版本的剧本内容。

基础剧本信息：
标题：${baseScript.title}
总背景：${baseScript.background}
总轮数：${baseScript.rounds}

当前角色信息：
角色ID：${characterId}
角色姓名：${character.name}
角色身份：${character.identity}
角色性格：${character.personality}
是否主角：${isMainCharacter ? '是' : '否'}

所有角色：
${allCharacters.map(c => `${c.name}（${c.identity}）`).join('、')}

请为这个角色创建个人版本的剧本，包括：

1. 个人视角的故事背景（150-200字）
   - 从该角色的视角重新描述故事背景
   - 突出与该角色相关的信息
   - 适当增加该角色的个人动机和秘密

2. 每轮的个人剧情内容（每轮80-120字）
   - 从该角色视角描述剧情发展
   - 包含该角色独有的观察和感受

基础轮次剧情参考：
${baseScript.roundContents.map(rc => `第${rc.round}轮：${rc.plot}`).join('\n')}

输出格式必须是JSON：
{
  "personalBackground": "从角色视角的故事背景",
  "personalRoundContents": [
    {
      "round": 1,
      "personalPlot": "从角色视角的第一轮剧情",
      "hiddenInfo": "该角色知道但其他人不知道的信息"
    }
  ]
}

注意：
- 每个角色的个人剧本都应该不同
- 主角应该获得更多关键信息
- 配角应该有辅助性的信息和视角
- 保持与基础剧情的一致性，但增加个人特色
`;

  try {
    const response = await callLLM(prompt, true);
    
    // 清理响应
    let cleanedResponse = response.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.slice(7);
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.slice(3);
    }
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.slice(0, -3);
    }
    cleanedResponse = cleanedResponse.trim();
    
    const personalScript = JSON.parse(cleanedResponse);
    return personalScript;
  } catch (error) {
    console.error('Failed to generate personal script:', error);
    
    // 返回默认的个人剧本
    return {
      personalBackground: `作为${character.name}，你发现自己卷入了这个复杂的事件中。${baseScript.background}`,
      personalRoundContents: baseScript.roundContents.map(rc => ({
        round: rc.round,
        personalPlot: `第${rc.round}轮：${rc.plot}`,
        hiddenInfo: "你有一些其他人不知道的信息..."
      }))
    };
  }
}
