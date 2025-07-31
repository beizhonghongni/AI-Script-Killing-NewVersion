import { NextRequest, NextResponse } from 'next/server';
import { getRoomById, updateRoom, deleteRoom } from '@/lib/storage';

// 离开房间
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

    // 移除玩家
    const playerIndex = room.players.indexOf(userId);
    if (playerIndex === -1) {
      return NextResponse.json({ success: false, error: 'Not in room' }, { status: 400 });
    }

    room.players.splice(playerIndex, 1);

    // 如果是房主离开且房间还有其他玩家，转移房主
    if (room.hostId === userId && room.players.length > 0) {
      room.hostId = room.players[0];
    }

    // 如果房间没有玩家了，删除房间
    if (room.players.length === 0) {
      deleteRoom(roomId);
    } else {
      updateRoom(room);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to leave room' }, { status: 500 });
  }
}
