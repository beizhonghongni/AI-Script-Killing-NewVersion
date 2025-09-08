import { LLMRequest, LLMResponse, LLMContext, GameRecord, Script, AINPCConfig } from '@/types';

// 动态获取 Gemini Key: 优先 .env，其次运行时设置的内存 key，可用调试端点 POST 设置
function getGeminiApiKey(): string {
  const envKey = (process.env.GEMINI_API_KEY || '').replace(/"/g,'').trim();
  // @ts-ignore
  const runtimeKey = (globalThis as any).__GEMINI_RUNTIME_KEY || '';
  const key = envKey || runtimeKey || '';
  if (!key) {
    // 仅第一次提示
    // @ts-ignore
    if (!(globalThis as any).__GEMINI_KEY_WARNED) {
      console.warn('[LLM] 未检测到 GEMINI_API_KEY（可在 .env.local 设置，或调用 /api/debug/gemini-set 运行时注入）');
      // @ts-ignore
      (globalThis as any).__GEMINI_KEY_WARNED = true;
    }
  }
  return key;
}
// Correct model endpoints
const GEMINI_2_5_PRO_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';
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
  } else if (prompt.includes('剧本')) {
    // 更宽松匹配，确保任何剧本生成指令的降级路径返回可解析 JSON
    return JSON.stringify({
      title: '临时剧本',
      background: '这是在网络不可用或API降级模式下生成的占位背景。',
      characters: [
        { id: 'char_1', name: '角色1', identity: '占位身份1', personality: '冷静理性', isMainCharacter: true },
        { id: 'char_2', name: '角色2', identity: '占位身份2', personality: '活跃好奇', isMainCharacter: true }
      ],
      roundContents: [
        { round: 1, plot: '第一轮占位剧情：玩家将围绕主题展开讨论。', privateClues: { char_1: '线索A', char_2: '线索B' } }
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
      'X-goog-api-key': getGeminiApiKey(),
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
3. 每轮的剧情发展（每轮必须约1000字，目标900-1100字，详细描述情节发展、环境细节、人物反应、人物心理、伏笔与冲突推进）
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
- **重要：每轮剧情必须达到约1000字（900-1100字范围），要包含丰富的环境渲染、人物动作/表情/心理、线索埋设、矛盾冲突与推进**
`;
  const raw = await callLLM(prompt, true);

  function tryExtractJSON(text: string): any | null {
    let t = text.trim();
    if (t.startsWith('```json')) t = t.slice(7);
    else if (t.startsWith('```')) t = t.slice(3);
    if (t.endsWith('```')) t = t.slice(0, -3);
    t = t.trim();
    // 尝试截取第一个 { 到最后一个 }
    const first = t.indexOf('{');
    const last = t.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      const candidate = t.slice(first, last + 1);
      try { return JSON.parse(candidate); } catch { /* ignore */ }
    }
    try { return JSON.parse(t); } catch { return null; }
  }

  const primaryData = tryExtractJSON(raw);
  if (primaryData && primaryData.title && Array.isArray(primaryData.characters) && Array.isArray(primaryData.roundContents)) {
    return {
      id: `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: primaryData.title,
      rounds,
      background: primaryData.background,
      characters: primaryData.characters,
      roundContents: primaryData.roundContents,
      createdAt: Date.now(),
      createdBy: 'system'
    };
  }

  console.warn('[generateScript] 主体一次性生成失败，进入增量模式');

  // -------- 增量模式 --------
  // Step1: 骨架
  const skeletonPrompt = `请仅输出 JSON，不要任何多余文字：\n{\n  "title": "标题",\n  "background": "250-300字背景",\n  "characters": [ { "id": "char_1", "name": "角色1", "identity": "身份", "personality": "性格", "isMainCharacter": true } ]\n}\n要求：共 ${totalCharacters} 个角色，前 ${playerCount} 主角 isMainCharacter=true，后 ${aiNPCCount} 为配角。剧情主题：${plotRequirement}`;
  const skeletonRaw = await callLLM(skeletonPrompt, true);
  const skeleton = tryExtractJSON(skeletonRaw) || {};
  const characters = Array.isArray(skeleton.characters) && skeleton.characters.length === totalCharacters
    ? skeleton.characters
    : Array.from({ length: totalCharacters }).map((_, i) => ({
        id: `char_${i+1}`,
        name: `角色${i+1}`,
        identity: `身份${i+1}`,
        personality: `性格${i+1}`,
        isMainCharacter: i < playerCount
      }));

  // Step2: 每轮内容
  const roundContents: any[] = [];
  for (let r = 1; r <= rounds; r++) {
  const perRoundPrompt = `仅输出本轮 JSON：{\n "round": ${r},\n "plot": "第${r}轮 1000字剧情(900-1100字, 包含环境描写/人物行为/心理活动/冲突推进/伏笔)",\n "privateClues": { "角色ID": "该角色50-80字线索" }\n}\n角色ID列表: ${characters.map(c=>c.id).join(', ')}\n剧情主题：${plotRequirement}`;
    const roundRaw = await callLLM(perRoundPrompt, false);
    const rd = tryExtractJSON(roundRaw) || {};
    const clues: any = {};
    characters.forEach(c => {
      clues[c.id] = (rd.privateClues && rd.privateClues[c.id]) || `线索：${plotRequirement} 的线索片段 (${c.id})`;
    });
    roundContents.push({ round: r, plot: rd.plot || `第${r}轮剧情：${plotRequirement} 发展...`, privateClues: clues });
  }

  return {
    id: `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: skeleton.title || `临时剧本：${plotRequirement.slice(0,20)}`,
    rounds,
    background: skeleton.background || `背景：${plotRequirement} 的故事设定。`,
    characters,
    roundContents,
    createdAt: Date.now(),
    createdBy: 'incremental'
  };
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
  
  const friendStyleHint = npc.friendStyleOfUserId ? `\n- 该AI基于一位好友的发言风格进行表达（更贴近日常聊天口吻、语气、句式），但内容需与当前剧情紧密相关。` : '';
  const prompt = `
你正在扮演一个AI NPC角色，需要决定是否在当前讨论中发言。

NPC信息：
- 姓名：${npc.name}
- 风格：${npc.style}
- 性格：${npc.personality}
${friendStyleHint}

故事背景：${gameRecord.scriptBackground}

当前轮次：${currentRound}
当前剧情：${currentRoundRecord.plot}
你的私人线索：${currentRoundRecord.privateClues[npc.id] || '无特殊线索'}

最近的讨论记录（按时间顺序，最后一条是最新的）：
${recentMessages.map(msg => `${msg.senderName}: ${msg.content}`).join('\n')}

${lastMessage ? `最新发言 => ${lastMessage.senderName}: ${lastMessage.content}` : ''}

请决定：
1. 是否需要发言（重点考虑是否要回应最新发言、讨论热度、是否有新信息、角色性格等）
2. 如果发言，说什么内容（必须使用第一人称“我”，符合角色性格，直接回应最新发言并推进讨论，不要重复已说过的内容，控制在1-2句、总字数不超过60字、不要使用叙述者视角或第三人称描述该NPC）

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
    const directAddressed = !!(lastMessage && lastMessage.content && (lastMessage.content.includes(npc.name) || /[?？]$/.test(lastMessage.content) ));
    let content: string | undefined = undefined;
    if (decision.shouldSpeak && typeof decision.content === 'string') {
      let t = decision.content.trim();
      // 去引号
      t = t.replace(/^["“”']+|["“”']+$/g, '');
      // 保证第一人称
      if (!t.includes('我')) {
        t = (t.length <= 58 ? `我觉得${t}` : `我觉得${t.slice(0, 56)}`);
      }
  // 不要把自己名字当成第二人称或第三人称提及，替换为“我”
  const selfName = npc.name.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`);
  const selfNameRegex = new RegExp(selfName + '(?=[，。！!？?、,\s])', 'g');
  t = t.replace(selfNameRegex, '我');
  // 避免“我觉得我”重复
  t = t.replace(/我觉得我/g, '我觉得');
      // 限长
      if (t.length > 60) t = t.slice(0, 60);
      content = t;
    } else if (!decision.shouldSpeak && directAddressed) {
      // 如果被直接点名或问号结尾却不想说，强制给一句回应
      let t = lastMessage?.content.includes('去哪') ? '我昨天去了别的地方办点事，现在可以说明。' : '我在，刚才在整理线索，我的看法稍后说。';
      if (t.length > 60) t = t.slice(0,60);
      content = t;
      decision.shouldSpeak = true;
    }
    return {
      shouldSpeak: !!decision.shouldSpeak,
      content
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
  const realPlayers = Array.from(new Set(gameRecord.players)).map(pid => {
    const name = allMessages.find(m => m.senderId === pid)?.senderName || pid;
    return { id: pid, name };
  });
  
  const prompt = `
请为剧本杀游戏生成客观理性的复盘总结，避免夸张与情绪化语气，像资深法医式记录员：

故事背景：${gameRecord.scriptBackground}

真人玩家列表（仅对下列玩家进行点评，忽略AI NPC）：
${realPlayers.map(p => `- ${p.id}（${p.name}）`).join('\n')}

完整游戏记录：
${gameRecord.roundRecords.map(round => 
  `第${round.round}轮:\n剧情: ${round.plot}\n讨论记录:\n${round.messages.map(msg => `${msg.senderName}: ${msg.content}`).join('\n')}`
).join('\n\n')}

目标玩家ID：${playerId}
目标玩家发言记录：
${playerMessages.map(msg => `${msg.senderName}: ${msg.content}`).join('\n')}

请生成以下内容（务必理性、克制、专业）：

1. 故事复盘（200-300字）：按时间线概述主要事件、关键线索与转折，避免主观评价。
2. 精彩点解密（150-200字）：指出逻辑巧点与有效推理片段，引用具体证据或发言，不夸饰。
3. 故事总结（100-150字）：对本局结构与机制的理性总结（不使用煽情词汇）。

4. 每个玩家的分析（逐个玩家，仅包含上述真人玩家；playerAnalysis的key用玩家ID）：
   - 观点总结：该玩家的核心主张或怀疑对象（基于其发言）。
   - 剧情相关点评：该玩家对推进调查、串联线索或证伪的具体贡献。
   - 发言风格：简要描述其表达风格与沟通特点，保持中性、建设性，不夸大不贬损。

输出格式必须是JSON：
{
  "storyReview": "故事复盘",
  "plotAnalysis": "精彩点解密", 
  "storyElevation": "故事总结",
  "playerAnalysis": {
    "玩家ID": {
      "playerName": "玩家名称",
      "viewpointSummary": "观点总结",
      "plotRelatedComment": "剧情相关点评",
    "styleComment": "发言风格"
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

请根据你的性格特点，对这个发言做出1-2句简短的回应。必须严格遵守：
1. 仅使用第一人称“我”，不要出现第三人称描述自己或旁白语气。
2. 与游戏剧情相关并回应该玩家刚才的话，推动讨论。
3. 自然口语化，不要过于书面或官话；长度不超过60字。
4. 不要暴露你是AI，不要复述系统信息或背景。

直接输出文本内容（不要JSON、不要引号、不要前后缀）：`;

  try {
    const response = await callLLM(prompt, false);
    let t = response.trim();
    // 去引号
    t = t.replace(/^["“”']+|["“”']+$/g, '');
    // 保证第一人称
    if (!t.includes('我')) {
      t = (t.length <= 58 ? `我觉得${t}` : `我觉得${t.slice(0, 56)}`);
    }
  const selfName = aiNPC.name.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`);
  const selfNameRegex = new RegExp(selfName + '(?=[，。！!？?、,\s])', 'g');
  t = t.replace(selfNameRegex, '我');
  t = t.replace(/我觉得我/g, '我觉得');
    // 限长
    if (t.length > 60) t = t.slice(0, 60);
    return t;
  } catch (error) {
    console.error('Failed to generate NPC response:', error);
    // 返回备用回复
    const fallbackResponses = [
      "我觉得这个点有意思。",
      "我有个想法，先听我说。",
      "我有点怀疑这里不对劲。",
      "我更倾向于另一种解释。",
      "我想再确认一个细节。"
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

2. 每轮的个人剧情内容（每轮必须400-500字）
   - 从该角色视角详细描述剧情发展
   - 包含该角色独有的观察、感受和内心活动
   - 添加环境细节和情感描述

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
- **重要：每轮个人剧情必须达到400-500字，要有丰富的细节和情感描述**
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
