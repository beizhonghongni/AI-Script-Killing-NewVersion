import { NextRequest, NextResponse } from 'next/server';
import { getUsers, saveUsers, getGameRecords, getScripts } from '@/lib/storage';
import { CollectedScript } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const { scriptId, gameId } = await request.json();

    // 获取用户数据
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return NextResponse.json({ 
        success: false, 
        error: '用户不存在' 
      }, { status: 404 });
    }

    // 获取游戏记录
    const gameRecords = getGameRecords();
    const gameRecord = gameRecords.find(g => g.id === gameId);
    
    if (!gameRecord) {
      return NextResponse.json({ 
        success: false, 
        error: '游戏记录不存在' 
      }, { status: 404 });
    }

    // 获取原始剧本信息
    const scripts = getScripts();
    const originalScript = scripts.find(s => s.id === gameRecord.scriptId);
    
    if (!originalScript) {
      return NextResponse.json({ 
        success: false, 
        error: '原始剧本不存在' 
      }, { status: 404 });
    }

    // 检查是否已经收藏过这个剧本
    const user = users[userIndex];
    if (!user.collectedScripts) {
      user.collectedScripts = [];
    }

    const alreadyCollected = user.collectedScripts.some(
      script => script.originalGameId === gameId
    );

    if (alreadyCollected) {
      return NextResponse.json({ 
        success: false, 
        error: '该剧本已经收藏过了' 
      });
    }

    // 创建收藏剧本对象
    const collectedScript: CollectedScript = {
      id: `collected_${Date.now()}_${userId}`,
      originalScriptId: scriptId,
      originalGameId: gameId,
      title: originalScript.title || '未知剧本',
      rounds: originalScript.rounds || gameRecord.rounds || 0,
      background: originalScript.background || gameRecord.scriptBackground || '',
      characters: originalScript.characters || [],
      roundContents: originalScript.roundContents || [],
      plotRequirement: gameRecord.plotRequirement || '', // 剧情指定来自游戏记录
      personalScripts: gameRecord.personalScripts || {},
      collectedAt: Date.now(),
      collectedBy: userId
    };

    // 添加到用户的收藏列表
    user.collectedScripts.push(collectedScript);
    
    // 保存更新后的用户数据
    saveUsers(users);

    return NextResponse.json({ 
      success: true, 
      message: '剧本收藏成功',
      collectedScript 
    });

  } catch (error) {
    console.error('收藏剧本失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '服务器错误' 
    }, { status: 500 });
  }
}