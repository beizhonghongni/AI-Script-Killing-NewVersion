'use client';

import { useState, useEffect } from 'react';
import { User, Room } from '@/types';
import FriendsList from './FriendsList';
import RoomsList from './RoomsList';
import CreateRoomModal from './CreateRoomModal';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [friends, setFriends] = useState([]);

  useEffect(() => {
    fetchRooms();
    fetchFriends();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms');
      const data = await response.json();
      if (data.success) {
        setRooms(data.rooms);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  };

  const fetchFriends = async () => {
    try {
      const response = await fetch(`/api/users/${user.id}/friends`);
      const data = await response.json();
      if (data.success) {
        setFriends(data.friends);
      }
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
  };

  const handleCreateRoom = async (roomData: any) => {
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...roomData,
          hostId: user.id
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setRooms([...rooms, data.room]);
        setShowCreateRoom(false);
      }
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg via-slate-800 to-slate-900">
      {/* 头部导航 */}
      <header className="bg-game-card border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-game-accent to-yellow-400 bg-clip-text text-transparent">
                LLM推理大师
              </h1>
              <span className="text-gray-400">|</span>
              <span className="text-white">欢迎, {user.username}</span>
            </div>
            
            <button
              onClick={onLogout}
              className="btn-secondary px-4 py-2"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
          {/* 左侧栏 */}
          <div className="col-span-4 space-y-6">
            {/* 好友列表 */}
            <div className="h-1/2">
              <div className="card h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center">
                    <span className="mr-2">👥</span>
                    好友列表
                  </h2>
                  <span className="text-sm text-gray-400">
                    {friends.filter((f: any) => f.isOnline).length}/{friends.length} 在线
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <FriendsList friends={friends} />
                </div>
              </div>
            </div>

            {/* 收藏剧本 */}
            <div className="h-1/2">
              <div className="card h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center">
                    <span className="mr-2">📚</span>
                    收藏剧本
                  </h2>
                  <span className="text-sm text-gray-400">
                    {user.savedScripts?.length || 0} 个
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {user.savedScripts?.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3">📖</div>
                      <p className="text-gray-400 text-sm">暂无收藏剧本</p>
                      <p className="text-gray-500 text-xs mt-1">完成游戏后可收藏喜欢的剧本</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {user.savedScripts?.map((scriptId, index) => (
                        <div key={scriptId} className="bg-gray-800 rounded-lg p-3 hover:bg-gray-700 transition-colors cursor-pointer">
                          <h4 className="text-white text-sm font-medium">剧本 #{index + 1}</h4>
                          <p className="text-gray-400 text-xs mt-1">点击查看详情</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 右侧栏 - 房间区域 */}
          <div className="col-span-8">
            <div className="card h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <span className="mr-3">🎮</span>
                  游戏房间
                </h2>
                <button
                  onClick={() => setShowCreateRoom(true)}
                  className="btn-primary px-6 py-3 text-lg flex items-center space-x-2"
                >
                  <span>+</span>
                  <span>创建房间</span>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <RoomsList rooms={rooms} currentUser={user} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 创建房间模态框 */}
      {showCreateRoom && (
        <CreateRoomModal
          onClose={() => setShowCreateRoom(false)}
          onSubmit={handleCreateRoom}
        />
      )}
    </div>
  );
}
