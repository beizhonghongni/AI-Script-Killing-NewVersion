'use client';

import { useState } from 'react';

interface CreateRoomModalProps {
  onClose: () => void;
  onSubmit: (roomData: any) => void;
}

export default function CreateRoomModal({ onClose, onSubmit }: CreateRoomModalProps) {
  const [roomName, setRoomName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    
    onSubmit({
      name: roomName.trim()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-game-card rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-white">创建游戏房间</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              房间名称
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="input-field w-full"
              placeholder="请输入房间名称"
              required
            />
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-300 text-sm">
              💡 创建房间后，你可以在房间内设置剧情要求、游戏轮数，并邀请好友或添加AI NPC参与游戏。
            </p>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 py-3"
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 py-3"
            >
              创建房间
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
