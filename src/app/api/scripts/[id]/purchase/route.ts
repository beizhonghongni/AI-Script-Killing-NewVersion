import { NextRequest, NextResponse } from 'next/server';
import { getScripts, saveScripts, getUsers, saveUsers, ensureUserEconomicFields } from '@/lib/storage';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scriptId } = await params;
    const { buyerId } = await req.json();
    const scripts = getScripts();
    const script = scripts.find(s => s.id === scriptId);
    if (!script) return NextResponse.json({ success: false, error: '剧本不存在' }, { status: 404 });
    if (!script.isListedForSale || script.derivativeOfScriptId) {
      return NextResponse.json({ success: false, error: '剧本不可购买' }, { status: 400 });
    }
    const users = getUsers();
    const buyer = users.find(u => u.id === buyerId);
    const author = users.find(u => u.id === script.createdBy);
    if (!buyer || !author) return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    ensureUserEconomicFields(buyer, false);
    ensureUserEconomicFields(author, false);
    if (buyer.id === author.id) {
      return NextResponse.json({ success: false, error: '作者无需购买' }, { status: 400 });
    }
    const price = script.price || 0;
    if ((buyer.balance || 0) < price) {
      return NextResponse.json({ success: false, error: '余额不足' }, { status: 400 });
    }
    // 扣款 & 加款
    buyer.balance = (buyer.balance || 0) - price;
    author.balance = (author.balance || 0) + price;
    buyer.purchasedScripts = buyer.purchasedScripts || [];
    if (!buyer.purchasedScripts.includes(scriptId)) buyer.purchasedScripts.push(scriptId);

    // 若尚未加入收藏列表，则自动收藏一份快照，便于直接在“收藏剧本”中开局
    buyer.collectedScripts = buyer.collectedScripts || [];
    const alreadyCollected = buyer.collectedScripts.some(cs => cs.originalScriptId === script.id || cs.id === script.id);
    if (!alreadyCollected) {
      buyer.collectedScripts.push({
        id: `collected_${Date.now()}_${buyer.id}`,
        originalScriptId: script.id,
        originalGameId: 'purchase_direct',
        title: script.title,
        rounds: script.rounds,
        background: script.background,
        characters: script.characters,
        roundContents: script.roundContents,
        plotRequirement: script.plotRequirement || '',
        personalScripts: {},
        collectedAt: Date.now(),
        collectedBy: buyer.id,
        rootOriginalScriptId: script.rootOriginalScriptId || script.id,
        originalAuthorId: script.originalAuthorId || script.createdBy,
        derivativeOfScriptId: script.derivativeOfScriptId,
      } as any);
    }
    saveUsers(users);
    return NextResponse.json({ success: true, balance: buyer.balance, autoCollected: !alreadyCollected });
  } catch (e) {
    console.error('购买失败', e);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}