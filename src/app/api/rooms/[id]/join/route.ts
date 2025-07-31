import { NextRequest, NextResponse } from 'next/server';
import { getRoomById, updateRoom } from '@/lib/storage';

// 加入房间
export async function POST(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await request.json();
    const { id: roomId } = await params;
    
    const room = getRoomById(roomId);
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }
    
    if (room.players.length >= room.maxPlayers) {
      return NextResponse.json({ success: false, error: 'Room is full' }, { status: 400 });
    }
    
    if (room.players.includes(userId)) {
      return NextResponse.json({ success: false, error: 'Already in room' }, { status: 400 });
    }
    
    room.players.push(userId);
    updateRoom(room);
    
    return NextResponse.json({ success: true, room });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to join room' }, { status: 500 });
  }
}
