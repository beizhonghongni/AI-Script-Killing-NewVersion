// 用户数据类型
export interface User {
  id: string;
  username: string;
  password: string;
  isOnline: boolean;
  friends: string[]; // 好友ID列表
  savedScripts: string[]; // 收藏的剧本ID列表
  chatHistory: { [friendId: string]: ChatMessage[] };
  gameHistory: GameRecord[];
}

// AI NPC 角色类型
export type AICharacterType = 
  | 'logical'      // 逻辑分析型
  | 'exploratory'  // 探索冒险型
  | 'mysterious'   // 神秘莫测型
  | 'social'       // 社交活跃型
  | 'suspicious'   // 多疑谨慎型
  | 'emotional'    // 情感丰富型
  | 'calm';        // 冷静沉稳型

// 聊天消息
export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  type: 'text' | 'script_share';
  scriptId?: string; // 如果是分享剧本
}

// 房间数据类型
export interface Room {
  id: string;
  name: string;
  hostId: string;
  isOnline: boolean;
  players: string[]; // 玩家ID列表
  maxPlayers: number;
  scriptId?: string; // 当前使用的剧本ID
  gameId?: string; // 当前游戏ID
  status: 'waiting' | 'playing' | 'finished';
  createdAt: number;
}

// 剧本数据类型
export interface Script {
  id: string;
  title: string;
  rounds: number;
  background: string;
  characters: Character[]; // 角色列表
  roundContents: RoundContent[];
  createdAt: number;
  createdBy: string; // 创建者ID
}

// 角色信息
export interface Character {
  id: string;
  name: string;
  identity: string; // 身份/职业
  personality: string; // 性格特点
  isMainCharacter: boolean; // 是否为主要角色
}

export interface RoundContent {
  round: number;
  plot: string; // 本轮剧情
  privateClues: { [characterId: string]: string }; // 每个角色的私人线索
}

// AI NPC配置
export interface AINPCConfig {
  id: string;
  name: string;
  style: string; // NPC风格描述
  personality: string; // 性格特点
  isActive: boolean;
  type?: string; // AI类型
  characterId?: string; // 分配的角色ID
  characterName?: string; // 分配的角色名
}

// 个人剧本内容
export interface PersonalScript {
  characterId: string;
  personalBackground: string;
  personalRoundContents: PersonalRoundContent[];
}

export interface PersonalRoundContent {
  round: number;
  personalPlot: string;
  hiddenInfo: string;
}

// 游戏记录
export interface GameRecord {
  id: string;
  roomId: string;
  scriptId: string;
  hostId: string;
  players: string[]; // 真人玩家ID
  aiNPCs: AINPCConfig[]; // AI NPC配置
  playerCharacters: { [playerId: string]: string }; // 玩家角色分配 playerId -> characterId
  aiCharacters: { [aiId: string]: string }; // AI角色分配 aiId -> characterId
  personalScripts: { [characterId: string]: PersonalScript }; // 每个角色的个人剧本
  readyPlayers?: string[]; // 已准备的玩家ID列表
  plotRequirement: string; // 剧情指定
  rounds: number; // 轮数
  scriptBackground: string;
  roundRecords: RoundRecord[];
  status: 'preparing' | 'story_reading' | 'round_playing' | 'finished';
  createdAt: number;
  finishedAt?: number;
  finalSummary?: { [playerId: string]: GameSummary };
  endConfirmedPlayers?: string[]; // 确认结束游戏的玩家ID列表
}

export interface RoundRecord {
  round: number;
  plot: string;
  privateClues: { [playerId: string]: string };
  messages: GameMessage[];
  isFinished: boolean;
  summary?: string;
}

export interface GameMessage {
  id: string;
  senderId: string; // 玩家ID或NPC ID
  senderName: string;
  content: string;
  timestamp: number;
  isNPC: boolean;
}

// 游戏总结
export interface GameSummary {
  playerId: string;
  storyReview: string; // 故事复盘
  plotAnalysis: string; // 精彩点解密
  storyElevation: string; // 故事升华
  playerAnalysis: { [playerId: string]: PlayerAnalysis };
}

export interface PlayerAnalysis {
  playerId: string;
  playerName: string;
  viewpointSummary: string; // 观点总结
  plotRelatedComment: string; // 剧情相关点评
  styleComment: string; // 发言风格点评和夸奖
}

// LLM API相关类型
export interface LLMRequest {
  contents: {
    parts: {
      text: string;
    }[];
  }[];
}

export interface LLMResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
  }[];
}

// LLM调用上下文
export interface LLMContext {
  type: 'generate_script' | 'npc_decision' | 'round_decision' | 'final_summary';
  gameRecord?: GameRecord;
  plotRequirement?: string;
  rounds?: number;
  currentRound?: number;
  playerId?: string;
}
