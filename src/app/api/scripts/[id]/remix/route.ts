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
  const { userId, instructions, overwrite } = await req.json();
    if (!instructions || typeof instructions !== 'string') {
      return NextResponse.json({ success: false, error: '缺少修改说明' }, { status: 400 });
    }
    const base = getScriptById(scriptId);
    if (!base) return NextResponse.json({ success: false, error: '剧本不存在' }, { status: 404 });

    const prompt = `你是剧本杀剧本的资深编辑。给定原始剧本(JSON)与用户的二次创作修改指令，只对涉及的部分进行最小必要修改：
=== 原始剧本 JSON 开始 ===
${JSON.stringify(base)}
=== 原始剧本 JSON 结束 ===

用户修改指令：${instructions}

要求：
1. 只修改与指令相关的字段及保持逻辑一致所需的关联字段，其余保持完全一致。
2. 输出严格 JSON，结构：
{
  "modified": true,
  "title": "(如需改标题才提供)",
  "background": "(仅修改时提供)",
  "characters": [ ...(仅有改动的角色对象，未改的不返回) ],
  "roundContents": [ ...(仅改动的轮次对象 round/plot/privateClues) ]
}
3. 不返回未修改的部分；未提供字段表示保持不变。
4. roundContents 中仅包含修改过的轮次，且提供完整该轮对象。
`;

    const raw = await callLLM(prompt, true);
    let diff: any;
    try {
      diff = JSON.parse(raw.trim().replace(/^```json|```/g,''));
    } catch {
      return NextResponse.json({ success: false, error: 'LLM输出解析失败', raw });
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