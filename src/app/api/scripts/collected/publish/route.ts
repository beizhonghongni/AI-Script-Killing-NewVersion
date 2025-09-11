import { NextRequest, NextResponse } from 'next/server';
import { getUserById, getScripts, saveScripts, getUsers } from '@/lib/storage';

// POST /api/scripts/collected/publish
// body: { userId: string, collectedScriptId: string, price: number }
// 规则：
// - 必须存在用户且在其 collectedScripts 中找到该剧本
// - 必须是该用户原创：script.createdBy === userId 且没有 derivativeOfScriptId
// - 若已上架则更新价格；否则标记 isListedForSale=true
// - 返回更新后的 script
export async function POST(req: NextRequest) {
	try {
		const { userId, collectedScriptId, price } = await req.json();
		if (!userId || !collectedScriptId) {
			return NextResponse.json({ success: false, error: '缺少 userId 或 collectedScriptId' }, { status: 400 });
		}
		if (typeof price !== 'number' || price < 0) {
			return NextResponse.json({ success: false, error: '价格无效' }, { status: 400 });
		}

		const user = getUserById(userId);
		if (!user) return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
			const collected = user.collectedScripts?.find(cs => cs.id === collectedScriptId);
			if (!collected) return NextResponse.json({ success: false, error: '该剧本不在用户收藏中' }, { status: 404 });

			const scripts = getScripts();
			// 可能：collected.id 不是真实脚本ID（收藏时使用了独立ID），需要 originalScriptId
			let scriptIndex = scripts.findIndex(s => s.id === collectedScriptId);
			if (scriptIndex === -1 && collected.originalScriptId) {
				scriptIndex = scripts.findIndex(s => s.id === collected.originalScriptId);
			}
			if (scriptIndex === -1) {
				return NextResponse.json({ success: false, error: '全局脚本不存在（可能已被删除），无法上架' }, { status: 404 });
			}
			const script = scripts[scriptIndex];

			// 如果脚本是系统生成的且尚未标记原始作者，可在首次上架时“认领作者”
			const systemCreators = new Set(['system','fallback','incremental','collected']);
			if (!script.derivativeOfScriptId && systemCreators.has(script.createdBy) && !script.originalAuthorId) {
				script.createdBy = userId;
				script.originalAuthorId = userId;
				script.rootOriginalScriptId = script.rootOriginalScriptId || script.id;
			}

			// 校验原创：必须无 derivativeOfScriptId 且 createdBy === userId（或 originalAuthorId === userId）
			if (script.derivativeOfScriptId) {
				return NextResponse.json({ success: false, error: '二次创作剧本不能直接上架，请上架最初原创版本' }, { status: 403 });
			}
			if (script.createdBy !== userId) {
				return NextResponse.json({ success: false, error: '只有原创作者可以上架该剧本' }, { status: 403 });
			}

			script.isListedForSale = true;
			script.price = price;
			scripts[scriptIndex] = script;
			saveScripts(scripts);

			return NextResponse.json({ success: true, script, claimed: systemCreators.has(script.createdBy) });
	} catch (e) {
		console.error('收藏剧本上架失败', e);
		return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
	}
}

