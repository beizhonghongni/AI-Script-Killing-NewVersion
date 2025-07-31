<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# LLM推理大师 - 项目说明

## 项目概述
这是一个基于LLM的大模型Web游戏平台，名为"LLM推理大师"。用户可以在平台上体验由AI NPC参与的剧本杀游戏。

## 技术栈
- **框架**: Next.js 15 with App Router
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **数据存储**: 本地JSON文件
- **AI模型**: Google Gemini API (2.5 Pro & 2.0 Flash)

## 项目结构
```
src/
├── app/                 # Next.js App Router页面
│   ├── api/            # API路由
│   ├── globals.css     # 全局样式
│   ├── layout.tsx      # 布局组件
│   └── page.tsx        # 主页
├── components/         # React组件
├── lib/               # 工具函数和服务
│   ├── storage.ts     # 数据存储操作
│   ├── llm.ts         # LLM API调用
│   └── utils.ts       # 工具函数
└── types/             # TypeScript类型定义
```

## 核心功能
1. **用户系统**: 登录、好友列表、在线状态
2. **房间管理**: 创建房间、加入房间、观战
3. **剧本生成**: 使用LLM生成剧本内容
4. **游戏流程**: 故事阅读、轮次讨论、AI NPC参与
5. **剧本收藏**: 收藏和分享剧本

## 数据模型
- **User**: 用户信息、好友关系、游戏历史
- **Room**: 房间信息、玩家列表、游戏状态
- **Script**: 剧本内容、轮次剧情、私人线索
- **GameRecord**: 游戏记录、聊天记录、AI NPC配置

## LLM集成
- **剧本生成**: 使用Gemini 2.5 Pro生成完整剧本
- **NPC决策**: 使用Gemini 2.0 Flash决定NPC行为
- **轮次推进**: 使用Gemini 2.0 Flash判断是否进入下一轮
- **游戏总结**: 使用Gemini 2.5 Pro生成游戏复盘

## 开发指南
- 所有React组件都使用TypeScript
- 使用Tailwind CSS的自定义主题配色
- API路由使用Next.js App Router约定
- 数据操作通过storage.ts统一管理
- LLM调用通过llm.ts统一处理

## 注意事项
- 项目使用本地JSON文件存储，适合开发和演示
- LLM API密钥已配置，注意保护隐私
- 界面设计注重游戏氛围和用户体验
- 代码结构清晰，便于后期维护和扩展
