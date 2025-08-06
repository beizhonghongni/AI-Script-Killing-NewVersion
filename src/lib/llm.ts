import { LLMRequest, LLMResponse, LLMContext, GameRecord, Script, AINPCConfig } from '@/types';

const GEMINI_API_KEY = 'AIzaSyBurtcL5QVBYKi1FmJBIzBa7nlasUvt5To';
const GEMINI_2_5_PRO_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_2_0_FLASH_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// 开发模式下的模拟响应
const ENABLE_MOCK_MODE = false;

// 模拟LLM响应函数
function getMockResponse(prompt: string): string {
  if (prompt.includes('生成剧本')) {
    return JSON.stringify({
      title: "神秘的古堡谜案",
      background: "在一个暴风雨的夜晚，几位客人被邀请到古老的维多利亚庄园过夜。然而，当第二天早晨到来时，庄园的主人却离奇死亡。每个人都有动机，每个人都有秘密。真相究竟是什么？",
      characters: [
        {
          id: "char_001",
          name: "爱丽丝·维多利亚",
          identity: "庄园继承人",
          personality: "优雅但隐藏着不为人知的秘密",
          isMainCharacter: true
        },
        {
          id: "char_002", 
          name: "詹姆斯·布朗",
          identity: "律师",
          personality: "严谨理性，擅长分析",
          isMainCharacter: true
        },
        {
          id: "char_003",
          name: "莎拉·琼斯",
          identity: "管家",
          personality: "忠诚但神秘莫测",
          isMainCharacter: false
        }
      ],
      roundContents: [
        {
          round: 1,
          plot: "第一轮：发现尸体。庄园主人被发现死在书房中，现场一片狼藉。"
        },
        {
          round: 2,
          plot: "第二轮：初步调查。警察到达现场，开始询问各位客人的不在场证明。"
        },
        {
          round: 3,
          plot: "第三轮：深入调查。更多的线索被发现，每个人的动机逐渐浮出水面。"
        }
      ]
    });
  } else if (prompt.includes('个人剧本')) {
    return JSON.stringify({
      personalBackground: "你是这个故事中的关键人物，有着不为人知的秘密。",
      personalRoundContents: [
        {
          round: 1,
          personalPlot: "你发现了尸体，心中充满了恐惧和疑虑。",
          hiddenInfo: "你知道一些其他人不知道的秘密..."
        }
      ]
    });
  } else if (prompt.includes('AI角色是否要说话')) {
    return Math.random() > 0.7 ? "是" : "否";
  } else if (prompt.includes('AI角色发言')) {
    const responses = [
      "我觉得这件事很可疑...",
      "让我们仔细分析一下线索",
      "这个说法有矛盾之处",
      "我想起了一个重要的细节"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  } else if (prompt.includes('故事复盘') || prompt.includes('回忆这次游戏')) {
    return "这是一次精彩的剧本杀体验！在这个神秘的故事中，我们一起探索了人性的复杂与真相的曲折。每个角色都有自己的秘密，每个线索都指向不同的方向。通过层层推理和激烈讨论，我们最终揭开了事件的真相。这个故事让我们看到了在关键时刻，人性的选择往往决定了命运的走向。整个游戏过程充满了悬疑和惊喜，每一次的发言都可能改变我们对真相的认知。";
  } else if (prompt.includes('精彩点解密') || prompt.includes('精彩的推理')) {
    return "游戏中最精彩的时刻是当关键线索被发现的那一瞬间，所有人的表情都发生了微妙的变化。每个玩家的推理都展现了独特的逻辑思维，特别是在分析证据时的严谨态度令人印象深刻。AI角色的参与为游戏增添了更多的不确定性，它们的发言往往在关键时刻提供了重要的线索或者制造了有趣的误导。整个讨论过程中，玩家们的互动自然流畅，展现了良好的游戏素养。";
  } else if (prompt.includes('故事升华') || prompt.includes('深层含义')) {
    return "这个故事让我们思考了人性中善与恶的界限。在复杂的人际关系中，每个人都有自己的立场和难处。真相往往比表面看起来更加复杂，正如生活中的许多选择一样，没有绝对的对错。这次游戏体验提醒我们要用包容的心态去理解他人，同时也要保持独立思考的能力。";
  } else if (prompt.includes('观点总结') || prompt.includes('剧情贡献') || prompt.includes('发言风格')) {
    return "观点总结: 该玩家在游戏中展现了敏锐的观察力和逻辑推理能力，能够抓住关键线索进行深入分析。\n剧情贡献: 通过积极的参与和精彩的发言，为游戏的推进和氛围营造做出了重要贡献。\n发言风格: 发言条理清晰，语言生动有趣，既能保持游戏的紧张感又不失幽默风趣。";
  } else {
    return "这是一个模拟响应，用于开发测试。";
  }
}

// 通用LLM调用函数，带有重试机制
export async function callLLM(prompt: string, useProModel = false, retries = 3): Promise<string> {
  // 如果启用模拟模式，直接返回模拟响应
  if (ENABLE_MOCK_MODE) {
    console.log('使用模拟LLM响应');
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000)); // 模拟延迟
    return getMockResponse(prompt);
  }
  
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

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`LLM API调用尝试 ${attempt}/${retries}...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify(request),
        // 增加超时时间
        signal: AbortSignal.timeout(60000) // 60秒超时
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`LLM API错误 (尝试 ${attempt}): ${response.status} ${response.statusText}`, errorText);
        
        // 如果是服务器错误（5xx）且还有重试次数，则继续重试
        if (response.status >= 500 && attempt < retries) {
          console.log(`服务器错误，等待 ${attempt * 2} 秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000)); // 递增延迟
          continue;
        }
        
        // 如果重试次数用完，使用降级方案
        if (attempt === retries && response.status >= 500) {
          console.log('LLM服务不可用，使用降级方案');
          return getMockResponse(prompt);
        }
        
        // 对于非服务器错误也使用降级方案
        console.log('API调用失败，使用降级方案');
        return getMockResponse(prompt);
      }

      const data: LLMResponse = await response.json();
      
      if (data.candidates && data.candidates.length > 0) {
        console.log(`LLM API调用成功 (尝试 ${attempt})`);
        return data.candidates[0].content.parts[0].text;
      } else {
        throw new Error('No response from LLM');
      }
    } catch (error) {
      console.error(`LLM API调用失败 (尝试 ${attempt}):`, error);
      
      // 如果是最后一次尝试，使用降级方案
      if (attempt === retries) {
        console.log('所有重试失败，使用降级方案');
        return getMockResponse(prompt);
      }
      
      // 如果不是服务器错误，直接抛出
      if (error instanceof Error && !error.message.includes('503') && !error.message.includes('502') && !error.message.includes('504')) {
        // 对于非服务器错误，也使用降级方案
        console.log('非服务器错误，使用降级方案');
        return getMockResponse(prompt);
      }
      
      // 等待后重试
      console.log(`等待 ${attempt * 2} 秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
  
  console.log('LLM API调用失败，使用降级方案');
  return getMockResponse(prompt);
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
1. 引人入胜的故事背景（300-400字）
2. ${totalCharacters}个角色（包含姓名、身份、性格特点）
   - 前${playerCount}个角色是重要角色（给真人玩家）
   - 后${aiNPCCount}个角色是次要角色（给AI NPC）
3. 每轮的剧情发展（每轮400-500字）
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
