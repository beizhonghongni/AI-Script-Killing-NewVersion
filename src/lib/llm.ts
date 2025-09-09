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
  // 智能提取剧情主题与轮数
  const themeMatch = /剧情要求[:：]\s*([^\n]+)|剧情主题[:：]\s*([^\n]+)/.exec(prompt);
  const theme = (themeMatch && (themeMatch[1] || themeMatch[2]))?.trim().slice(0,60) || '临时主题';
  const roundsMatch = /游戏轮数[:：]\s*(\d+)|总轮数[:：]\s*(\d+)/.exec(prompt);
  const rounds = roundsMatch ? parseInt(roundsMatch[1] || roundsMatch[2], 10) : 3;
  const playersMatch = /真人玩家数量[:：]\s*(\d+)/.exec(prompt);
  const aiMatch = /AI NPC数量[:：]\s*(\d+)/.exec(prompt);
  const playerCount = playersMatch ? parseInt(playersMatch[1],10) : 2;
  const aiCount = aiMatch ? parseInt(aiMatch[1],10) : 1;
  const total = playerCount + aiCount;
  const chars = Array.from({length: total}).map((_,i)=>({
    id: `char_${i+1}`,
    name: `角色${i+1}`,
    identity: i < playerCount ? `核心身份${i+1}` : `配角身份${i+1}`,
    personality: i < playerCount ? '积极推理' : '观察谨慎',
    isMainCharacter: i < playerCount
  }));
  const background = `【背景】本剧本主题：${theme}。玩家被卷入一场逐步揭开的事件中。请围绕主题进行推理，隐藏动机、冲突与伏笔会在后续轮次逐步浮现。`;

  // 生成接近1000字的占位剧情（在服务端降级时提升体验）
  function buildRoundPlot(roundIndex: number): string {
    const baseSegments = [
      `【场景切入】时间推进到新的节点，环境细节被进一步描摹：空气里残留的气味、窗外的光线变化与细微噪声共同营造出紧张的氛围。`,
      `【事件推进】与“${theme}”核心冲突相关的一个关键现象出现，引发所有角色短暂沉默；有人试探性提出假设，有人否认，有人刻意回避。`,
      `【人物交锋】两名主要角色围绕线索真伪展开针锋相对的追问，措辞保持克制却暗含火药味；一名配角突然插入补充旁观视角，使推理分支被迫拆解重组。`,
      `【线索揭示】新的线索被曝光：它表面指向显而易见的方向，但细节层面存在自相矛盾；角色们各自挑选符合自身立场的碎片进行拼接，形成多条暂时并存的解释路径。`,
      `【心理与伏笔】一位角色在短暂沉默后给出貌似配合的回应，却在措辞中留下不自然的修饰；另一位角色表情或语气的细节被敏锐者记录下，成为下一轮潜在爆点。`,
      `【未解悬念】本轮末尾出现一个无法立即验证的小型反常现象：它既可能是他人布置的障眼物，也可能是更深层结构的接口，迫使所有人改变原先的推理优先级。`
    ];
    // 根据轮次稍作差异
    if (roundIndex === 0) baseSegments.unshift(`【轮次引导】第${roundIndex+1}轮正式开始，角色们在初步交换认知后进入更具针对性的排查阶段，仍存在对主题“${theme}”本质误读的空间。`);
    if (roundIndex === rounds - 1) baseSegments.push(`【逼近真相】随着前序矛盾被压缩，隐藏结构轮廓逐渐清晰，然而仍有一处核心动机缺口无人能自洽填补，为最终揭示蓄势。`);

    let text = `第${roundIndex+1}轮剧情展开：` + baseSegments.join('');
    // 字数（中文字符）不足则填充分析性补述
    const targetMin = 900; // 允许 900 - 1100 区间
    const filler = `【细节补述】角色之间的呼吸节奏、语速变化与视线停顿都被记录进集体记忆；这些微妙标记将在后续被重新比对，构成推翻或巩固某条推理链的证据。`;
    while ([...text].length < targetMin) {
      text += filler;
      if ([...text].length > 1120) break; // 上限保护
    }
    return text;
  }

  const roundContents = Array.from({length: rounds}).map((_,i)=>{
    return {
      round: i+1,
      plot: buildRoundPlot(i),
      privateClues: Object.fromEntries(chars.map(c=>[c.id,`线索${i+1}-${c.id}：与“${theme}”相关的个性化提示，暗示其立场或潜在误导点。`]))
    };
  });

  if (prompt.includes('生成剧本') || prompt.includes('剧本')) {
    return JSON.stringify({
      title: `${theme}·推理剧本`,
      background,
      characters: chars,
      roundContents
    });
  } else if (prompt.includes('个人剧本')) {
    return JSON.stringify({
      personalBackground: `你与“${theme}”事件存在隐秘关联，这段个人背景用于帮助你制定推理策略。`,
      personalRoundContents: [
        { round: 1, personalPlot: `个人视角：第一轮中你注意到他人忽视的细节，涉及“${theme}”的隐藏线索。`, hiddenInfo: '你掌握的隐藏动机碎片。' }
      ]
    });
  } else if (prompt.includes('AI角色是否要说话')) {
    return JSON.stringify({ shouldSpeak: true, content: '我觉得这里的矛盾点还没解释清楚。' });
  }

  // 其他通用占位
  return '这是一个模拟响应，用于开发测试。';
}

// 通用LLM调用函数，带有重试机制
export async function callLLM(prompt: string, useProModel = false, retries = 3): Promise<string> {
  // 如果启用模拟模式，直接返回模拟响应
  if (ENABLE_MOCK_MODE) {
    console.log('使用模拟LLM响应');
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000)); // 模拟延迟
    return getMockResponse(prompt);
  }
  
  const primaryUrl = useProModel ? GEMINI_2_5_PRO_URL : GEMINI_2_0_FLASH_URL;
  
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
      
    let response = await fetch(primaryUrl, {
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

        // 如果是 503 / 502 / 504 并且当前使用的是 Pro 模型，则立即尝试降级到 Flash 模型一次（同一 attempt 内）
        if (useProModel && (response.status === 503 || response.status === 502 || response.status === 504)) {
          console.log('Pro 模型过载，尝试降级到 Flash 模型...');
          try {
            response = await fetch(GEMINI_2_0_FLASH_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-goog-api-key': getGeminiApiKey(),
              },
              body: JSON.stringify(request),
              signal: AbortSignal.timeout(45000)
            });
            if (response.ok) {
              const data: LLMResponse = await response.json();
              if (data.candidates?.length) {
                console.log(`降级到 Flash 成功 (尝试 ${attempt})`);
                return data.candidates[0].content.parts[0].text;
              }
            } else {
              console.warn('降级到 Flash 仍失败:', response.status, response.statusText);
            }
          } catch (downgradeErr) {
            console.warn('降级调用异常:', downgradeErr);
          }
        }
        
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

// 通用宽松 JSON 提取（去除 markdown 包裹、截取第一个 { 到最后一个 }、清理 BOM / 多余前缀）
function extractJSONFlexible(raw: string): any | null {
  if (!raw) return null;
  let t = raw.trim();
  // 去掉可能的中文前言，找到第一个 '{'
  const firstBrace = t.indexOf('{');
  if (firstBrace > 0) {
    t = t.slice(firstBrace);
  }
  if (t.startsWith('```json')) t = t.slice(7);
  else if (t.startsWith('```')) t = t.slice(3);
  if (t.endsWith('```')) t = t.slice(0, -3);
  t = t.replace(/^[\uFEFF\s]+/, '').trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    const candidate = t.slice(first, last + 1);
    try { return JSON.parse(candidate); } catch { /* ignore */ }
  }
  try { return JSON.parse(t); } catch { return null; }
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
3. 每轮的剧情发展（每轮约1000字左右，建议控制在900-1100字；需包含关键情节推进、核心冲突、必要的环境/人物/伏笔要素，信息密度高且节奏紧凑）
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
- **重要：每轮剧情控制在约1000字（900-1100字之间），保持信息密度与推进节奏，避免冗长堆砌或无效对白**
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
  const perRoundPrompt = `仅输出本轮 JSON：{\n "round": ${r},\n "plot": "第${r}轮 1000字剧情(目标900-1100字; 包含事件进展/角色心理/冲突或伏笔1-2处; 需自然连贯)",\n "privateClues": { "角色ID": "该角色50-80字线索" }\n}\n角色ID列表: ${characters.map(c=>c.id).join(', ')}\n剧情主题：${plotRequirement}`;
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
    const response = await callLLM(prompt, true); // 优先 Pro
    let parsed = extractJSONFlexible(response);

    // 如果第一次解析失败，尝试再提示模型只输出 JSON（闪回重试一次，使用较小模型）
    if (!parsed) {
      console.warn('[generatePersonalScript] 初次解析失败，尝试二次约束 JSON');
      const enforcePrompt = `只输出严格 JSON，不要额外说明：\n${prompt}\n\n（再次提醒：只输出 JSON）`;
      const secondRaw = await callLLM(enforcePrompt, false); // 用 flash 降低过载概率
      parsed = extractJSONFlexible(secondRaw);
    }

    if (parsed && parsed.personalBackground && Array.isArray(parsed.personalRoundContents)) {
      // 结构与长度修正：确保每轮字段完整
      parsed.personalRoundContents = parsed.personalRoundContents.map((r: any, idx: number) => ({
        round: r.round || (idx + 1),
        personalPlot: r.personalPlot || r.plot || `第${idx + 1}轮：${baseScript.roundContents[idx]?.plot || '剧情待补充'}`,
        hiddenInfo: r.hiddenInfo || r.secret || '你掌握着一些暂时不便透露的线索'
      }));
      return parsed;
    }
    throw new Error('Parsed result missing required fields');
  } catch (error) {
    console.error('Failed to generate personal script:', error);
    // 返回可用的降级版本
    return {
      personalBackground: `作为${character.name}，你发现自己卷入了事件。${baseScript.background}`,
      personalRoundContents: baseScript.roundContents.map(rc => ({
        round: rc.round,
        personalPlot: `【个人视角】第${rc.round}轮：${rc.plot}`,
        hiddenInfo: '暂无额外隐藏信息'
      }))
    };
  }
}
