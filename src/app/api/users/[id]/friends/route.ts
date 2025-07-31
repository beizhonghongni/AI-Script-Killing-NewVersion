import { NextRequest, NextResponse } from 'next/server';
import { getUsers } from '@/lib/storage';

// 获取用户的好友列表
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params;
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    const friends = users.filter(u => user.friends.includes(u.id));
    
    return NextResponse.json({ 
      success: true, 
      friends: friends.map(f => ({
        id: f.id,
        username: f.username,
        isOnline: f.isOnline
      }))
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to get friends' }, { status: 500 });
  }
}
