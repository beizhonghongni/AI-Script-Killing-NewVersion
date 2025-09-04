import { NextRequest, NextResponse } from 'next/server';
import { getRoomById, updateRoom } from '@/lib/storage';

// 加入房间（修正 params 类型为标准对象）
export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const rawParams = context?.params ? (context.params.then ? await context.params : context.params) : {};
    const { id: roomId } = rawParams as { id?: string };
    const { userId } = await request.json();

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
    console.error('Join room error:', error);
    return NextResponse.json({ success: false, error: 'Failed to join room' }, { status: 500 });
  }
}
