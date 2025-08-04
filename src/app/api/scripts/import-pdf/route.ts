import { NextRequest, NextResponse } from 'next/server';
import { getScripts, saveScripts } from '@/lib/storage';
import { callLLM } from '@/lib/llm';
import pdfParse from 'pdf-parse';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('pdfs') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '请上传至少一个PDF文件' 
      });
    }

    // 解析所有PDF文件内容
    const pdfContents = [];
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const data = await pdfParse(Buffer.from(buffer));
      pdfContents.push({
        filename: file.name,
        content: data.text
      });
    }

    // 使用LLM分析PDF内容并生成剧本
    const prompt = `请分析以下PDF剧本内容，并将其转换为我们系统可以使用的剧本格式。

PDF文件内容：
${pdfContents.map(pdf => `文件名：${pdf.filename}\n内容：${pdf.content}`).join('\n\n')}

请返回一个JSON格式的剧本，包含以下字段：
{
  "title": "剧本标题",
  "background": "剧本背景故事",
  "rounds": 剧本轮数,
  "characters": [
    {
      "id": "character1",
      "name": "角色名",
      "identity": "角色身份",
      "personality": "角色性格",
      "isMainCharacter": true/false
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

注意：
1. 请确保至少有2-6个角色
2. 设置合适的轮数（通常3-6轮）
3. 为每个角色分配合理的私人线索
4. 保持剧情的连贯性和趣味性
5. 适应推理类剧本杀的游戏模式

请只返回JSON格式，不要包含其他解释文字。`;

    let scriptData;
    try {
      const response = await callLLM(prompt, true); // 使用Pro模型
      
      // 解析LLM返回的JSON
      try {
        // 清理LLM返回的内容，移除可能的markdown格式
        const cleanedResponse = response
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .trim();
        
        scriptData = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('解析LLM返回的JSON失败:', parseError);
        return NextResponse.json({ 
          success: false, 
          error: 'LLM返回的剧本格式无效' 
        });
      }
    } catch (llmError) {
      console.error('LLM调用失败:', llmError);
      return NextResponse.json({ 
        success: false, 
        error: 'LLM分析失败：' + llmError.message 
      });
    }

    // 生成剧本ID和时间戳
    const scriptId = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const script = {
      id: scriptId,
      title: scriptData.title || '导入的剧本',
      rounds: scriptData.rounds || 3,
      background: scriptData.background || '',
      characters: scriptData.characters || [],
      roundContents: scriptData.roundContents || [],
      createdAt: Date.now(),
      createdBy: 'import' // 标记为导入的剧本
    };

    // 保存到剧本数据
    const scripts = getScripts();
    scripts.push(script);
    saveScripts(scripts);

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
