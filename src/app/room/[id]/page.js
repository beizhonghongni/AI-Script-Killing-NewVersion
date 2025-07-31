'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// AI NPC类型配置
const AI_CHARACTER_TYPES = [
  { id: 'logical', name: '逻辑分析型', description: '善于逻辑推理和细节分析' },
  { id: 'exploratory', name: '探索冒险型', description: '勇于尝试新想法和假设' },
  { id: 'mysterious', name: '神秘莫测型', description: '话语间常带有神秘色彩' },
  { id: 'social', name: '社交活跃型', description: '喜欢与人互动和交流' },
  { id: 'suspicious', name: '多疑谨慎型', description: '对一切都保持怀疑态度' },
  { id: 'emotional', name: '情感丰富型', description: '情绪表达丰富生动' },
  { id: 'calm', name: '冷静沉稳型', description: '始终保持冷静和理性' }
];

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const [room, setRoom] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [players, setPlayers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [rounds, setRounds] = useState('6');
  const [plotRequirement, setPlotRequirement] = useState('');
  const [selectedAITypes, setSelectedAITypes] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    } else {
      router.push('/');
      return;
    }

    fetchRoomData();
    fetchFriends();
  }, [params.id, router]);

  const fetchRoomData = async () => {
    try {
      const response = await fetch(`/api/rooms/${params.id}`);
      const data = await response.json();
      
      if (data.success) {
        setRoom(data.room);
        setPlayers(data.players);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to fetch room data:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return;
    
    const user = JSON.parse(userStr);
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

  const inviteFriend = async (friendId) => {
    try {
      const response = await fetch(`/api/rooms/${params.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: friendId })
      });
      
      if (response.ok) {
        fetchRoomData();
      }
    } catch (error) {
      console.error('Failed to invite friend:', error);
    }
  };

  const addAINPC = (type) => {
    const newSelectedTypes = new Set(selectedAITypes);
    if (newSelectedTypes.has(type)) {
      newSelectedTypes.delete(type);
    } else {
      newSelectedTypes.add(type);
    }
    setSelectedAITypes(newSelectedTypes);
  };

  const startGame = async () => {
    if (!plotRequirement.trim()) {
      alert('请输入剧情要求');
      return;
    }

    const roundCount = parseInt(rounds);
    if (isNaN(roundCount) || roundCount < 1 || roundCount > 20) {
      alert('请输入有效的轮数（1-20）');
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${params.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rounds: roundCount,
          plotRequirement,
          aiNPCTypes: Array.from(selectedAITypes)
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('游戏开始！');
        fetchRoomData();
      } else {
        alert('开始游戏失败：' + data.error);
      }
    } catch (error) {
      console.error('Failed to start game:', error);
      alert('开始游戏失败');
    }
  };

  const leaveRoom = async () => {
    if (!currentUser) return;
    
    try {
      const response = await fetch(`/api/rooms/${params.id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });
      
      if (response.ok) {
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to leave room:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">正在加载房间信息...</div>
      </div>
    );
  }

  if (!room || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">房间不存在或已被删除</div>
      </div>
    );
  }

  const isHost = currentUser.id === room.hostId;
  const availableFriends = friends.filter(friend => 
    !players.some(player => player.id === friend.id)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 房间标题栏 */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">{room.name}</h1>
              <p className="text-purple-300">房间号: {room.id} | 状态: {
                room.status === 'waiting' ? '等待中' : 
                room.status === 'playing' ? '游戏中' : '已结束'
              }</p>
            </div>
            <button
              onClick={leaveRoom}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              离开房间
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：玩家列表 */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">
                玩家列表 ({players.length}人)
              </h2>
              <div className="space-y-3">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">
                          {player.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-white">{player.username}</span>
                      {player.id === room.hostId && (
                        <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">
                          房主
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 邀请好友 */}
            {isHost && availableFriends.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
                <h3 className="text-lg font-bold text-white mb-4">邀请好友</h3>
                <div className="space-y-2">
                  {availableFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                    >
                      <span className="text-white">{friend.username}</span>
                      <button
                        onClick={() => inviteFriend(friend.id)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
                      >
                        邀请
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 右侧：游戏配置 */}
          <div className="lg:col-span-2">
            {isHost && room.status === 'waiting' && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
                <h2 className="text-xl font-bold text-white mb-6">游戏配置</h2>
                
                {/* 游戏轮数 */}
                <div className="mb-6">
                  <label className="block text-white font-medium mb-2">
                    游戏轮数
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={rounds}
                    onChange={(e) => setRounds(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="输入游戏轮数（1-20）"
                  />
                </div>

                {/* 剧情要求 */}
                <div className="mb-6">
                  <label className="block text-white font-medium mb-2">
                    剧情要求
                  </label>
                  <textarea
                    value={plotRequirement}
                    onChange={(e) => setPlotRequirement(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={4}
                    placeholder="描述你想要的剧情类型、背景设定、风格等..."
                  />
                </div>

                {/* AI NPC类型选择 */}
                <div className="mb-6">
                  <label className="block text-white font-medium mb-4">
                    选择AI NPC类型 (已选择: {selectedAITypes.size}个)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {AI_CHARACTER_TYPES.map((type) => (
                      <div
                        key={type.id}
                        onClick={() => addAINPC(type.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedAITypes.has(type.id)
                            ? 'bg-purple-600/30 border-purple-400 ring-2 ring-purple-500'
                            : 'bg-slate-700/50 border-slate-600 hover:border-purple-500'
                        }`}
                      >
                        <div className="text-white font-medium mb-1">{type.name}</div>
                        <div className="text-slate-300 text-sm">{type.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 开始游戏按钮 */}
                <button
                  onClick={startGame}
                  disabled={!plotRequirement.trim() || parseInt(rounds) < 1}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold rounded-lg transition-all disabled:cursor-not-allowed"
                >
                  开始游戏
                </button>
              </div>
            )}

            {/* 非房主或游戏中状态 */}
            {(!isHost || room.status !== 'waiting') && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
                <div className="text-center">
                  {room.status === 'waiting' ? (
                    <div className="text-white">
                      <h3 className="text-xl font-bold mb-4">等待房主开始游戏</h3>
                      <p className="text-slate-300">房主正在配置游戏参数...</p>
                    </div>
                  ) : room.status === 'playing' ? (
                    <div className="text-white">
                      <h3 className="text-xl font-bold mb-4">游戏进行中</h3>
                      <p className="text-slate-300">游戏已经开始，请等待剧本生成...</p>
                    </div>
                  ) : (
                    <div className="text-white">
                      <h3 className="text-xl font-bold mb-4">游戏已结束</h3>
                      <p className="text-slate-300">游戏已经结束，感谢参与！</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
