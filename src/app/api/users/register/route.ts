import { NextRequest, NextResponse } from 'next/server';
import { getUsers, saveUsers } from '@/lib/storage';
import { generateId, validatePassword, validateUsername } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (!validateUsername(username)) {
      return NextResponse.json({ success: false, error: '用户名长度需2-20' }, { status: 400 });
    }
    if (!validatePassword(password)) {
      return NextResponse.json({ success: false, error: '密码至少6位' }, { status: 400 });
    }
    const users = getUsers();
    if (users.find(u => u.username === username)) {
      return NextResponse.json({ success: false, error: '用户名已存在' }, { status: 409 });
    }
    const newId = generateId('user');
    const newUser = {
      id: newId,
      username,
      password,
      isOnline: true,
      friends: users.map(u => u.id),
      savedScripts: [],
      chatHistory: {},
      gameHistory: [],
      collectedScripts: []
    } as any;
    users.forEach(u => { if (!u.friends.includes(newId)) u.friends.push(newId); });
    users.push(newUser);
    saveUsers(users);
    const { password: _pw, ...safe } = newUser;
    return NextResponse.json({ success: true, user: safe });
  } catch (e) {
    console.error('Register error', e);
    return NextResponse.json({ success: false, error: '注册失败' }, { status: 500 });
  }
}
