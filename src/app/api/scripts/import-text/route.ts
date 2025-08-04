import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { createScript } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    // 用于测试：接受文本内容而不是PDF文件
    const { textContent } = await request.json();
    
    if (!textContent) {
      return NextResponse.json({ 
        success: false, 
        error: '请提供文本内容' 
      }, { status: 400 });
    }

    console.log('收到文本内容，开始LLM分析...');

    // 构建LLM提示
    const prompt = `
请分析以下剧本内容，将其转换为符合我们游戏格式的JSON结构。要求：

1. 提取或创建剧本标题
2. 提取背景故事
3. 识别角色（至少2个，最多6个）
4. 创建3轮游戏内容，每轮都要有：
   - 线索描述
   - 玩家可以采取的行动
   - 讨论要点
5. 为每个角色创建个人剧本（包含角色背景、秘密、目标）
6. 设定剧情要求

剧本内容：
${textContent}

请返回严格的JSON格式：
{
  "title": "剧本标题",
  "background": "背景故事",
  "characters": [
    {
      "name": "角色名",
      "description": "角色描述"
    }
  ],
  "rounds": 3,
  "roundContents": [
    {
      "round": 1,
      "title": "第一轮标题",
      "description": "第一轮内容",
      "clues": ["线索1", "线索2"],
      "actions": ["行动1", "行动2"],
      "discussion": "讨论要点"
    }
  ],
  "personalScripts": {
    "角色名": {
      "background": "角色背景",
      "secret": "角色秘密",
      "goal": "角色目标",
      "information": "专属信息"
    }
  },
  "plotRequirement": "剧情要求"
}
`;

    console.log('调用LLM分析剧本...');
    const llmResponse = await callLLM(prompt);
    
    console.log('LLM响应:', llmResponse);
    
    // 清理和解析LLM响应
    let cleanedResponse = llmResponse.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.slice(7);
    }
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.slice(0, -3);
    }
    
    let scriptData;
    try {
      scriptData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('JSON解析失败:', parseError);
      return NextResponse.json({ 
        success: false, 
        error: 'LLM返回的内容无法解析为有效的JSON格式' 
      }, { status: 500 });
    }

    // 验证必需字段
    if (!scriptData.title || !scriptData.background || !scriptData.characters) {
      return NextResponse.json({ 
        success: false, 
        error: '剧本数据不完整，缺少必要字段' 
      }, { status: 500 });
    }

    // 生成唯一ID
    const scriptId = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 构建完整的剧本对象
    const completeScript = {
      id: scriptId,
      title: scriptData.title,
      background: scriptData.background,
      characters: scriptData.characters,
      rounds: scriptData.rounds || 3,
      roundContents: scriptData.roundContents || [],
      personalScripts: scriptData.personalScripts || {},
      plotRequirement: scriptData.plotRequirement || '完成剧本',
      imported: true,
      importedAt: Date.now(),
      createdAt: Date.now(),
      createdBy: 'system' // 导入的剧本标记为系统创建
    };

    // 保存剧本
    console.log('保存导入的剧本...');
    createScript(completeScript);

    console.log('剧本导入成功:', completeScript.title);

    return NextResponse.json({
      success: true,
      message: '剧本导入成功',
      script: {
        id: completeScript.id,
        title: completeScript.title,
        background: completeScript.background,
        characters: completeScript.characters,
        rounds: completeScript.rounds
      }
    });

  } catch (error) {
    console.error('导入剧本失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '服务器处理失败，请稍后重试' 
    }, { status: 500 });
  }
}
