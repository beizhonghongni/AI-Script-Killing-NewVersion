import { NextRequest, NextResponse } from 'next/server';
import { getUserById, getScripts, saveScripts, getScriptById } from '@/lib/storage';

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

		// 在全局脚本库中找到对应脚本
		const scripts = getScripts();
		const idx = scripts.findIndex(s => s.id === collectedScriptId);
		if (idx === -1) {
			return NextResponse.json({ success: false, error: '全局脚本不存在，无法上架' }, { status: 404 });
		}
		const script = scripts[idx];

		// 校验原创：必须无 derivativeOfScriptId 且 createdBy === userId
		if (script.createdBy !== userId || script.derivativeOfScriptId) {
			return NextResponse.json({ success: false, error: '仅可上架本人原创剧本（非二次创作）' }, { status: 403 });
		}

		script.isListedForSale = true;
		script.price = price;
		scripts[idx] = script;
		saveScripts(scripts);

		return NextResponse.json({ success: true, script });
	} catch (e) {
		console.error('收藏剧本上架失败', e);
		return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
	}
}

