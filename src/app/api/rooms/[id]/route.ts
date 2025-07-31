import { NextRequest, NextResponse } from 'next/server';
import { getRoomById, getUserById } from '@/lib/storage';

// 获取单个房间信息
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roomId } = await params;
    const room = getRoomById(roomId);
    
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }
    
    // 获取玩家详细信息
    const players = room.players.map(playerId => {
      const user = getUserById(playerId);
      return user ? {
        id: user.id,
        username: user.username,
        isOnline: user.isOnline
      } : null;
    }).filter(Boolean);
    
    return NextResponse.json({ success: true, room, players });
  } catch (error) {
    console.error('Error getting room:', error);
    return NextResponse.json({ success: false, error: 'Failed to get room' }, { status: 500 });
  }
}
