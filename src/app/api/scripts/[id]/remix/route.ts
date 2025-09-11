import { NextRequest, NextResponse } from 'next/server';
import { getScriptById, getScripts, saveScripts, getUserById, updateUser } from '@/lib/storage';
import { callLLM } from '@/lib/llm';
import { Script } from '@/types';

// POST body: { userId, instructions }
// 逻辑：
// 1. 读取原剧本
// 2. 调用 LLM 生成仅修改的字段（diff JSON）或回传全量（带 unchanged 标记）
// 3. 合并 -> 新脚本（标记 derivative 信息）
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scriptId } = await params;
  const { userId, instructions, overwrite, personalCollectedId } = await req.json();
    if (!instructions || typeof instructions !== 'string') {
      return NextResponse.json({ success: false, error: '缺少修改说明' }, { status: 400 });
    }
    const base = getScriptById(scriptId);
    if (!base) return NextResponse.json({ success: false, error: '剧本不存在' }, { status: 404 });

    // 如果是修改个人收藏副本，基于个人副本进行diff
    let personalUser = null as any;
    let personalCollected = null as any;
    let baseForDiff: any = base;
    if (personalCollectedId) {
      personalUser = getUserById(userId);
      if (!personalUser) return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
      personalCollected = personalUser.collectedScripts?.find(cs => cs.id === personalCollectedId);
      if (!personalCollected) return NextResponse.json({ success: false, error: '未找到对应的个人收藏副本' }, { status: 404 });
      // 使用个人收藏副本作为diff基础（这样可以连续多次二次创作累积修改）
      baseForDiff = personalCollected;
    }

  const prompt = `你是资深剧本杀编辑，需要进行“指令驱动 + 一致性联动”增量修改。用户说的“剧本”包含：背景、角色(身份/性格/动机)、各轮剧情、每轮全部角色私人线索。给定原始剧本(JSON)与修改指令：
=== 原始剧本 JSON 开始 ===
${JSON.stringify(baseForDiff)}
=== 原始剧本 JSON 结束 ===

用户修改指令：${instructions}

规则：
1. 精确执行指令；若指令引入/删除/改变元素（人物关系、地点、暗线、物品、冲突、反转、情绪基调），需要同步更新所有受影响部分。
2. 受影响范围：background / 相关角色属性(identity, personality, 可能隐含动机描述) / 轮次剧情plot / 对应轮次所有角色 privateClues。
3. 指令出现 任意关键词：背景|场景|设定|角色|人物|性格|动机|线索|clue|伏笔|反转 -> 必须返回对应被影响部分（即便只是微调）。
4. 修改过的轮次对象需返回完整 { round, plot, privateClues }。privateClues 中列出该剧本全部角色的线索键；未变化的线索可原样返回。
5. 若剧情新增元素但原 background 未体现，应在 background 中补写；若剧情变化无需调整背景，可仍返回 background 以保持显式同步。
6. 若无任何应改动（极少见），返回 { "modified": false }。
7. 输出严格 JSON 结构（无 markdown 包裹、无注释）：
{
  "modified": true,
  "title": "(仅标题确需修改时)",
  "background": "(按规则5，需要变或显式同步时返回)",
  "characters": [ ...(仅改动角色对象) ],
  "roundContents": [ ...(仅改动轮次完整对象) ]
}
8. 不返回未修改的角色或轮次；未出现的字段视为保持不变。
9. 不要虚构无关大幅重写；保持最小必要修改同时保证逻辑前后一致。
`;

    const raw = await callLLM(prompt, true);
    let diff: any;
    try {
      diff = JSON.parse(raw.trim().replace(/^```json|```/g,''));
    } catch {
      return NextResponse.json({ success: false, error: 'LLM输出解析失败', raw });
    }

    // 如果是个人收藏副本编辑，直接更新用户收藏，不创建新脚本
    if (personalCollected && personalUser) {
      const diffHasChanges = !!(diff.title || diff.background || (Array.isArray(diff.characters)&&diff.characters.length) || (Array.isArray(diff.roundContents)&&diff.roundContents.length));
      if (!diffHasChanges) {
        return NextResponse.json({ success: true, noChange: true, collectedScript: personalCollected, diffRaw: raw });
      }
      const historyEntry = {
        at: Date.now(),
        instructions,
        changedRounds: Array.isArray(diff.roundContents) ? diff.roundContents.map((r:any)=>r.round).filter((v:any)=>typeof v==='number') : [],
        changedCharacters: Array.isArray(diff.characters) ? diff.characters.map((c:any)=>c.id).filter((v:any)=>!!v) : [],
        titleChanged: !!diff.title,
        backgroundChanged: !!diff.background,
      };
      if (diff.title) personalCollected.title = diff.title;
      if (diff.background) personalCollected.background = diff.background;
      if (Array.isArray(diff.characters) && diff.characters.length) {
        const charMap = new Map(personalCollected.characters.map((c:any)=>[c.id,c]));
        diff.characters.forEach((c:any)=>{ if (c.id && charMap.has(c.id)) Object.assign(charMap.get(c.id)!, c); });
        personalCollected.characters = Array.from(charMap.values());
      }
      if (Array.isArray(diff.roundContents) && diff.roundContents.length) {
        const rcMap = new Map(personalCollected.roundContents.map((r:any)=>[r.round,r]));
        diff.roundContents.forEach((r:any)=>{ if (r.round && rcMap.has(r.round)) Object.assign(rcMap.get(r.round)!, r); });
        personalCollected.roundContents = Array.from(rcMap.values()).sort((a:any,b:any)=>a.round-b.round);
      }
      (personalCollected.remixHistory = personalCollected.remixHistory || []).push(historyEntry);
      try { updateUser(personalUser); } catch (e) { console.error('保存个人收藏修改失败', e); }
      return NextResponse.json({ success: true, collectedScript: personalCollected, personal: true, diffRaw: raw });
    }

    // 如果请求覆盖且是原作者，直接就地修改原脚本
    if (overwrite && userId === base.createdBy) {
      const scripts = getScripts();
      const target = scripts.find(s => s.id === base.id);
      if (!target) return NextResponse.json({ success: false, error: '原脚本未找到(覆盖失败)' }, { status: 404 });
      if (diff.title) target.title = diff.title;
      if (diff.background) target.background = diff.background;
      if (Array.isArray(diff.characters) && diff.characters.length) {
        const charMap = new Map(target.characters.map(c => [c.id, c]));
        diff.characters.forEach((c: any) => { if (c.id && charMap.has(c.id)) { Object.assign(charMap.get(c.id)!, c); } });
        target.characters = Array.from(charMap.values());
      }
      if (Array.isArray(diff.roundContents) && diff.roundContents.length) {
        const rcMap = new Map(target.roundContents.map(r => [r.round, r]));
        diff.roundContents.forEach((r: any) => { if (r.round && rcMap.has(r.round)) { Object.assign(rcMap.get(r.round)!, r); } });
        target.roundContents = Array.from(rcMap.values()).sort((a,b)=>a.round-b.round);
      }
      saveScripts(scripts);
      return NextResponse.json({ success: true, script: target, overwritten: true, diffRaw: raw });
    }

    // 否则创建新的派生脚本
    const newScript: Script = {
      ...base,
      id: `script_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      createdAt: Date.now(),
      derivativeOfScriptId: base.id,
      rootOriginalScriptId: base.rootOriginalScriptId || base.id,
      originalAuthorId: base.originalAuthorId || base.createdBy,
      createdBy: userId, // 新的作者（再创作者）
    };

  if (diff.title) newScript.title = diff.title;
    if (diff.background) newScript.background = diff.background;
    if (Array.isArray(diff.characters) && diff.characters.length) {
      const charMap = new Map(newScript.characters.map(c => [c.id, c]));
      diff.characters.forEach((c: any) => { if (c.id && charMap.has(c.id)) { Object.assign(charMap.get(c.id)!, c); } });
      newScript.characters = Array.from(charMap.values());
    }
    if (Array.isArray(diff.roundContents) && diff.roundContents.length) {
      const rcMap = new Map(newScript.roundContents.map(r => [r.round, r]));
      diff.roundContents.forEach((r: any) => { if (r.round && rcMap.has(r.round)) { Object.assign(rcMap.get(r.round)!, r); } });
      newScript.roundContents = Array.from(rcMap.values()).sort((a,b)=>a.round-b.round);
    }
    // 上架状态继承关闭（防止直接带价格）
    newScript.isListedForSale = false;
    newScript.price = undefined;

    const scripts = getScripts();
    scripts.push(newScript);
    saveScripts(scripts);

    // 自动加入用户收藏（便于后续查看）
    const user = getUserById(userId);
    if (user) {
      (user.collectedScripts = user.collectedScripts || []);
      // 避免重复收藏
      if (!user.collectedScripts.find(cs => cs.id === newScript.id)) {
        user.collectedScripts.push({
          id: newScript.id,
            originalScriptId: base.id, // 原始脚本ID（用于继续指向根）
            originalGameId: 'remix_manual',
            title: newScript.title,
            rounds: newScript.rounds,
            background: newScript.background,
            characters: newScript.characters,
            roundContents: newScript.roundContents,
            plotRequirement: newScript.plotRequirement || '',
            collectedAt: Date.now(),
            collectedBy: userId,
            rootOriginalScriptId: newScript.rootOriginalScriptId,
            originalAuthorId: newScript.originalAuthorId,
            derivativeOfScriptId: newScript.derivativeOfScriptId,
            remixHistory: [{
              at: Date.now(),
              instructions,
              changedRounds: Array.isArray(diff.roundContents) ? diff.roundContents.map((r:any)=>r.round).filter((v:any)=>typeof v==='number') : [],
              changedCharacters: Array.isArray(diff.characters) ? diff.characters.map((c:any)=>c.id).filter((v:any)=>!!v) : [],
              titleChanged: !!diff.title,
              backgroundChanged: !!diff.background,
            }],
        } as any);
        try { updateUser(user); } catch (e) { console.error('更新用户收藏失败', e); }
      }
    }

    return NextResponse.json({ success: true, script: newScript, diffRaw: raw, collected: true });
  } catch (e) {
    console.error('二次创作失败', e);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}