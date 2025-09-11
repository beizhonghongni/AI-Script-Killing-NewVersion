import { NextRequest, NextResponse } from 'next/server';
import { getScriptById, createScript, getScripts, saveScripts } from '@/lib/storage';
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
    const { userId, instructions } = await req.json();
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

    // 合并
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

    // 保存
    const scripts = getScripts();
    scripts.push(newScript);
    saveScripts(scripts);

    return NextResponse.json({ success: true, script: newScript, diffRaw: raw });
  } catch (e) {
    console.error('二次创作失败', e);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}