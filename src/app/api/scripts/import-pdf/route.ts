import { NextRequest, NextResponse } from 'next/server';
// 强制使用 Node 运行时以便文件系统读取 .env.local
export const runtime = 'nodejs';
import { getScripts, saveScripts, getUsers, saveUsers } from '@/lib/storage';
import { callLLM } from '@/lib/llm';
import { ocrPdfWithAliyun } from '@/lib/ocr';
import { generateId } from '@/lib/utils';
// 延迟加载 pdf-parse，避免构建阶段触发其对测试资源的读取
// (某些环境下 pdf-parse 引入时会尝试访问其测试文件导致 ENOENT)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
  const files = formData.getAll('pdfs') as File[];
  // 支持客户端临时传入 appcode（只有本地开发，用于调试 env 未生效）
  const appcodeOverride = (formData.get('appcode') || request.headers.get('x-aliyun-appcode') || '').toString().trim() || undefined;
  const overridePlayersRaw = formData.get('recommendedPlayerCount');
  const overrideRoundsRaw = formData.get('rounds');
  const userId = formData.get('userId') ? String(formData.get('userId')) : undefined;
  const overridePlayers = overridePlayersRaw ? Number(overridePlayersRaw) : undefined;
  const overrideRounds = overrideRoundsRaw ? Number(overrideRoundsRaw) : undefined;
    
    if (!files || files.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '请上传至少一个PDF文件' 
      });
    }

    // 解析所有PDF文件内容
  const pdfContents: { filename: string; content: string }[] = [];
    // 动态导入 pdf-parse
  // 直接导入核心实现，避免 index.js 中的调试代码尝试读取 test/data 示例PDF
  const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
  const hasAppCode = !!process.env.ALIYUN_OCR_APPCODE;
  if (!hasAppCode) {
    console.log('[IMPORT] 当前未检测到 ALIYUN_OCR_APPCODE, cwd=', process.cwd());
  }
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      let finalText = '';
  let parseWarn = hasAppCode ? '' : '未检测到环境变量 ALIYUN_OCR_APPCODE';
  const ocrText = await ocrPdfWithAliyun(buf, appcodeOverride);
      let visibleLen = 0;
      if (ocrText) {
        finalText = ocrText;
        visibleLen = finalText.replace(/\s+/g,'').length;
      } else {
        if (!process.env.ALIYUN_OCR_APPCODE) {
          parseWarn = 'OCR未配置(缺少 ALIYUN_OCR_APPCODE)';
        } else {
          parseWarn = 'OCR无结果';
        }
        // Fallback 尝试 pdf-parse
        try {
          const data = await pdfParse(buf);
          finalText = (data.text || '').replace(/\u0000/g,'').trim();
          visibleLen = finalText.replace(/\s+/g,'').length;
        } catch (e:any) {
          parseWarn += ';pdf-parse失败:' + e?.message;
        }
      }
      if (visibleLen < 30) {
        finalText = `（未能从 ${file.name} 提取足够文字；${parseWarn || 'OCR无结果'}。当前hasAppCode=${hasAppCode}。若为扫描件请确认 AppCode 未过期/有配额或先离线OCR。）`;
      }
  console.log('[IMPORT] 文件解析结果', { file: file.name, chars: visibleLen, parseWarn, usedOCR: !!ocrText, hasAppCode, override: !!appcodeOverride });
      pdfContents.push({ filename: file.name, content: finalText });
    }

    if (pdfContents.length === 0) {
      return NextResponse.json({ success: false, error: 'PDF解析失败，请确认文件内容' });
    }

    // 使用LLM分析多个PDF内容并聚合为一个可玩的剧本（轮数 1-25 自适应）
    const MAX_TOTAL_CHARS = 20000; // 避免 prompt 过长
    let accumulated = 0;
    const truncatedBlocks = pdfContents.map(p => {
      const remain = MAX_TOTAL_CHARS - accumulated;
      if (remain <= 0) return `【${p.filename}】\n(已截断)`;
      const sliceLen = Math.min(remain, 6000, p.content.length);
      accumulated += sliceLen;
      return `【${p.filename}】\n${p.content.slice(0, sliceLen)}`;
    });

    const prompt = `你是资深剧本杀策划，请将多个外部剧本/文本素材整合为一套标准游戏数据。只返回严格 JSON，禁止任何解释、前后缀、注释、markdown 代码块、额外问候。

素材片段（可能已截断）：\n${truncatedBlocks.join('\n\n')}\n\n` +
`输出字段(严格保持结构)：\n{\n  "title": "整体剧本标题",\n  "background": "世界观+初始事件 200-400字",\n  "rounds": 1-25整数,\n  "recommendedPlayerCount": 3-12整数,\n  "allowNPCFill": true/false,\n  "characters": [ { "id": "c1", "name": "角色名", "roleType": "阵营/身份", "personality": "性格短描述", "motivation": "核心动机", "isKey": true/false } ],\n  "roundContents": [ { "round": 1, "plot": "该轮公开剧情 120-250字", "privateClues": { "c1": "私密线索<=120字" } } ],\n  "finalResolution": "真相/结局 120-200字",\n  "mechanics": "若有特殊机制简述",\n  "npcSuggestion": { "needNPC": true/false, "minHumanPlayers": 整数, "maxNPC": 整数, "reason": "一句话原因" }\n}\n\n规则：1 不生成无关字段 2 若信息不足 rounds<=6 3 若无法判断某字段给空字符串或合理缺省 4 始终输出合法 JSON。`;

    function attemptExtractJSON(raw: string) {
      let text = raw.trim();
      // 去掉 markdown 包裹
      text = text.replace(/```json[\s\S]*?\n/g, '');
      text = text.replace(/```/g, '');
      // 取第一个 { 到最后一个 }
      const first = text.indexOf('{');
      const last = text.lastIndexOf('}');
      if (first !== -1 && last !== -1 && last > first) {
        text = text.slice(first, last + 1);
      }
      // 去除可能的中文全角引号
      text = text.replace(/[“”]/g, '"');
      // 删除多余注释行
      text = text.replace(/(^|\n)\s*\/\/.*?(?=\n|$)/g, '');
      // 尝试修复尾部逗号
      text = text.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(text);
    }

  let scriptData: any = null;
    let llmRaw = '';
    try {
      llmRaw = await callLLM(prompt, true);
      try {
        scriptData = attemptExtractJSON(llmRaw);
      } catch (e1) {
        console.warn('初次解析失败，尝试再处理一次:', e1);
        // 尝试移除非JSON字符后重试
        const stripped = llmRaw.replace(/[\u0000-\u001F]/g, '');
        try { scriptData = attemptExtractJSON(stripped); } catch (e2) {
          console.error('二次解析失败:', e2);
        }
      }
    } catch (err) {
      console.error('LLM调用失败:', err);
    }

  if (!scriptData) {
      // 构造降级剧本：简单拆分每个文件前若干行作为轮次
      const fallbackRounds = Math.min(5, pdfContents.length * 2 || 3);
      const characters = Array.from({ length: 4 }).map((_, i) => ({
        id: generateId('char'),
        name: `角色${i + 1}`,
        identity: `身份${i + 1}`,
        personality: `由导入文本生成的占位角色`,
        isMainCharacter: i < 4
      }));
      const roundContents = Array.from({ length: fallbackRounds }).map((_, i) => ({
        round: i + 1,
        plot: `占位剧情第${i + 1}轮：${pdfContents[i % pdfContents.length].content.slice(0,120)}`,
        privateClues: {}
      }));
      const script = {
        id: generateId('script'),
        title: '导入剧本(降级)',
        rounds: fallbackRounds,
        background: 'LLM解析失败，使用占位聚合背景。',
        characters,
        roundContents,
        finalResolution: '',
        mechanics: '',
        recommendedPlayerCount: 4,
        allowNPCFill: true,
        npcSuggestion: { needNPC: true, minHumanPlayers: 2, maxNPC: 2, reason: '占位建议' },
        createdAt: Date.now(),
        createdBy: 'import-fallback'
      };
      const scripts = getScripts();
      scripts.push(script);
      saveScripts(scripts);
      // 若提供 userId，将其直接加入用户的收藏（伪originalGameId）
      if (userId) {
        try {
          const users = getUsers();
            const idx = users.findIndex(u => u.id === userId);
            if (idx !== -1) {
              if (!users[idx].collectedScripts) users[idx].collectedScripts = [];
              const already = users[idx].collectedScripts!.some(cs => cs.originalScriptId === script.id && cs.originalGameId === 'import_direct');
              if (!already) {
                users[idx].collectedScripts!.push({
                  id: generateId('collected'),
                  originalScriptId: script.id,
                  originalGameId: 'import_direct',
                  title: script.title,
                  rounds: script.rounds,
                  background: script.background,
                  characters: script.characters,
                  roundContents: script.roundContents,
                  plotRequirement: '',
                  personalScripts: {},
                  collectedAt: Date.now(),
                  collectedBy: userId
                });
                saveUsers(users);
              }
            }
        } catch (e) { console.warn('添加到用户收藏失败(降级路径):', e); }
      }
      return NextResponse.json({ success: true, script, warning: 'LLM解析失败，已生成占位剧本' });
    }

    // 生成剧本ID和时间戳
    // 角色映射：将 roleType/motivation 转换为系统需要的字段
    const mappedCharacters = (scriptData.characters || []).map((c: any, idx: number) => ({
      id: c.id || generateId('char'),
      name: c.name || `角色${idx + 1}`,
      identity: c.roleType || c.identity || `身份${idx + 1}`,
      personality: [c.personality, c.motivation].filter(Boolean).join('；'),
      isMainCharacter: typeof c.isKey === 'boolean' ? c.isKey : idx < (scriptData.recommendedPlayerCount || 4)
    }));

    // 如果 LLM 返回却没有角色或轮次，生成占位数据补齐
    let ensuredCharacters = mappedCharacters;
    if (!ensuredCharacters.length) {
      ensuredCharacters = Array.from({ length: 4 }).map((_, i) => ({
        id: generateId('char'),
        name: `角色${i + 1}`,
        identity: `身份${i + 1}`,
        personality: '占位角色',
        isMainCharacter: i < 4
      }));
    }

    const computedRounds = Math.min(25, Math.max(1, overrideRounds || scriptData.rounds || (scriptData.roundContents?.length) || 3));
  const computedPlayers = Math.min(12, Math.max(3, overridePlayers || scriptData.recommendedPlayerCount || ensuredCharacters.filter((c: any) => c.isMainCharacter).length || ensuredCharacters.length || 4));

    const scriptId = generateId('script');
    const rawMergedText = pdfContents.map(p=>`【${p.filename}】\n${p.content}`).join('\n\n');
  const script = {
      id: scriptId,
      title: scriptData.title || '导入的剧本',
      rounds: computedRounds,
      background: scriptData.background || '',
  characters: ensuredCharacters,
  roundContents: (scriptData.roundContents || []).slice(0, computedRounds).map((r: any, idx: number) => ({
        round: Number(r.round) || idx + 1,
        plot: r.plot || '',
        privateClues: r.privateClues && typeof r.privateClues === 'object' ? r.privateClues : {}
      })),
      finalResolution: scriptData.finalResolution || '',
      mechanics: scriptData.mechanics || '',
      recommendedPlayerCount: computedPlayers,
      allowNPCFill: scriptData.allowNPCFill !== false,
      npcSuggestion: scriptData.npcSuggestion || null,
      createdAt: Date.now(),
  createdBy: 'import',
  rawImportedText: rawMergedText
    };

    // 若轮次数组仍为空，使用原文片段生成占位轮次
    if (!script.roundContents.length) {
      const fallbackRounds = Math.min(script.rounds || 3, 6);
      const pieces = pdfContents.map(p => p.content.replace(/\n+/g,' ').slice(0,140));
      script.roundContents = Array.from({ length: fallbackRounds }).map((_,i)=>({
        round: i+1,
        plot: pieces[i % pieces.length] || `占位剧情 第${i+1}轮`,
        privateClues: {}
      }));
    }

    // 保存到剧本数据
    const scripts = getScripts();
    scripts.push(script);
    saveScripts(scripts);

    // 如果提供 userId，自动放入用户收藏列表，方便在“收藏剧本”中直接看到
    if (userId) {
      try {
        const users = getUsers();
        const idx = users.findIndex(u => u.id === userId);
        if (idx !== -1) {
          const user = users[idx];
          if (!user.collectedScripts) user.collectedScripts = [];
          const exists = user.collectedScripts.some(cs => cs.originalScriptId === script.id && cs.originalGameId === 'import_direct');
          if (!exists) {
            user.collectedScripts.push({
              id: generateId('collected'),
              originalScriptId: script.id,
              originalGameId: 'import_direct',
              title: script.title,
              rounds: script.rounds,
              background: script.background,
              characters: script.characters,
              roundContents: script.roundContents,
              plotRequirement: '',
              personalScripts: {},
              collectedAt: Date.now(),
              collectedBy: userId
            });
            saveUsers(users);
          }
        }
      } catch (e) { console.warn('添加到用户收藏失败:', e); }
    }

    return NextResponse.json({ 
      success: true, 
      script: script,
      message: `成功导入剧本：${script.title}` 
    });

  } catch (error) {
    console.error('导入PDF剧本失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '导入失败：' + error.message 
    });
  }
}
