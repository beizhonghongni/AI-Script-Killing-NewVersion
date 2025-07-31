import { NextRequest, NextResponse } from 'next/server';
import { getUsers, updateUser } from '@/lib/storage';

// 用户登出
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    
    if (user) {
      user.isOnline = false;
      updateUser(user);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false, error: 'Logout failed' }, { status: 500 });
  }
}
