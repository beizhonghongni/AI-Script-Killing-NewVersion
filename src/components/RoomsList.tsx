'use client';

import { Room, User } from '@/types';
import { useRouter } from 'next/navigation';

interface RoomsListProps {
  rooms: Room[];
  currentUser: User;
}

export default function RoomsList({ rooms, currentUser }: RoomsListProps) {
  const router = useRouter();

  const handleJoinRoom = async (roomId: string) => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      
      const data = await response.json();
      if (data.success) {
        // 跳转到游戏房间
        router.push(`/room/${roomId}`);
      }
    } catch (error) {
      console.error('Failed to join room:', error);
    }
  };

  const handleEnterRoom = (roomId: string) => {
    // 直接进入房间（用户已在房间中）
    router.push(`/room/${roomId}`);
  };

  if (rooms.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🎮</div>
        <h3 className="text-xl font-semibold text-white mb-2">暂无活跃房间</h3>
        <p className="text-gray-400">创建一个房间开始游戏吧！</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {rooms.map((room) => (
        <div key={room.id} className="card hover:bg-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{room.name}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              room.status === 'waiting' 
                ? 'bg-green-600 text-white' 
                : room.status === 'playing'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-600 text-white'
            }`}>
              {room.status === 'waiting' ? '等待中' : 
               room.status === 'playing' ? '游戏中' : '已结束'}
            </span>
          </div>
          
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">房主:</span>
              <span className="text-white">{room.hostId}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">人数:</span>
              <span className="text-white">{room.players.length}/{room.maxPlayers}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">创建时间:</span>
              <span className="text-white">
                {new Date(room.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          <div className="flex space-x-2">
            {room.status === 'waiting' && room.players.length < room.maxPlayers && (
              <button
                onClick={() => handleJoinRoom(room.id)}
                className="btn-primary flex-1"
                disabled={room.players.includes(currentUser.id)}
              >
                {room.players.includes(currentUser.id) ? '已加入' : '加入房间'}
              </button>
            )}
            
            {room.status === 'playing' && (
              <button className="btn-secondary flex-1">
                观战
              </button>
            )}
            
            {room.players.includes(currentUser.id) && (
              <button 
                onClick={() => handleEnterRoom(room.id)}
                className="btn-primary flex-1"
              >
                进入房间
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
