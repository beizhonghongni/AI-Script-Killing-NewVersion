import { NextRequest, NextResponse } from 'next/server';
import { getRooms, createRoom, updateRoom } from '@/lib/storage';
import { generateId } from '@/lib/utils';
import { Room } from '@/types';

// 获取房间列表
export async function GET() {
  try {
    const rooms = getRooms();
    // 按创建时间倒序排列，新房间在最上面
    const sortedRooms = rooms
      .filter(room => room.isOnline)
      .sort((a, b) => b.createdAt - a.createdAt);
    
    return NextResponse.json({ 
      success: true, 
      rooms: sortedRooms
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to get rooms' }, { status: 500 });
  }
}

// 创建房间
export async function POST(request: NextRequest) {
  try {
    const { name, hostId } = await request.json();
    
    const room: Room = {
      id: generateId('room'),
      name,
      hostId,
      isOnline: true,
      players: [hostId],
      maxPlayers: 999, // 不限制最大人数
      status: 'waiting',
      createdAt: Date.now()
    };
    
    createRoom(room);
    
    return NextResponse.json({ success: true, room });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create room' }, { status: 500 });
  }
}
