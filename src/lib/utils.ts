import { User } from '@/types';

// 初始化三个测试用户
export function initializeTestUsers(): User[] {
  return [
    {
      id: 'user_xiaoming',
      username: '小明',
      password: '123456',
      isOnline: false,
      friends: ['user_xiaolin', 'user_xiaobao'],
      savedScripts: [],
      chatHistory: {},
      gameHistory: []
    },
    {
      id: 'user_xiaolin',
      username: '小林',
      password: '123456',
      isOnline: false,
      friends: ['user_xiaoming', 'user_xiaobao'],
      savedScripts: [],
      chatHistory: {},
      gameHistory: []
    },
    {
      id: 'user_xiaobao',
      username: '小宝',
      password: '123456',
      isOnline: false,
      friends: ['user_xiaoming', 'user_xiaolin'],
      savedScripts: [],
      chatHistory: {},
      gameHistory: []
    }
  ];
}

// 生成唯一ID
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 格式化时间
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 获取在线状态显示
export function getOnlineStatus(isOnline: boolean): string {
  return isOnline ? '在线' : '离线';
}

// 验证密码
export function validatePassword(password: string): boolean {
  return password.length >= 6;
}

// 验证用户名
export function validateUsername(username: string): boolean {
  return username.length >= 2 && username.length <= 20;
}
