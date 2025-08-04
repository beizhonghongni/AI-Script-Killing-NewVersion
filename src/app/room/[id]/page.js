'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

// AI NPC类型配置
const AI_CHARACTER_TYPES = [
  { id: 'logical', name: '逻辑分析型', description: '善于逻辑推理和细节分析' },
  { id: 'exploratory', name: '探索冒险型', description: '勇于尝试新想法和假设' },
  { id: 'mysterious', name: '神秘莫测型', description: '话语间常带有神秘色彩' }, 
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
  const [rounds, setRounds] = useState('6');
  const [plotRequirement, setPlotRequirement] = useState('');
  const [selectedAITypes, setSelectedAITypes] = useState(new Map()); // 改为Map存储数量
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [readyPlayers, setReadyPlayers] = useState(new Set()); // 已准备的玩家
  const chatContainerRef = useRef(null); // 聊天容器引用

  useEffect(() => {
    // 使用sessionStorage而不是localStorage，避免多标签页冲突
    const userStr = sessionStorage.getItem('currentUser');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    } else {
      router.push('/');
      return;
    }

    fetchRoomData();
  }, [params.id, router]);

  // 自动滚动到聊天底部
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const fetchRoomData = async () => {
    try {
      const response = await fetch(`/api/rooms/${params.id}`);
      const data = await response.json();
      
      if (data.success) {
        setRoom(data.room);
        setPlayers(data.players);
        
        // 如果游戏已开始，获取游戏数据
        if (data.room.status === 'playing' && data.room.gameId) {
          fetchGameData(data.room.gameId);
        }
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

  const fetchGameData = async (gameId) => {
    try {
      const response = await fetch(`/api/games/${gameId}`);
      const data = await response.json();
      if (data.success) {
        setGameData(data.gameRecord);
        // 获取当前轮次的聊天消息
        const currentRound = data.gameRecord.roundRecords.length - 1;
        if (currentRound >= 0) {
          setChatMessages(data.gameRecord.roundRecords[currentRound]?.messages || []);
        }
        // 获取准备状态
        if (data.gameRecord.readyPlayers) {
          setReadyPlayers(new Set(data.gameRecord.readyPlayers));
        }
      }
    } catch (error) {
      console.error('Failed to fetch game data:', error);
    }
  };

  // AI类型数量管理函数
  const adjustAICount = (type, delta) => {
    const newSelectedTypes = new Map(selectedAITypes);
    const currentCount = newSelectedTypes.get(type) || 0;
    const newCount = Math.max(0, currentCount + delta);
    
    if (newCount === 0) {
      newSelectedTypes.delete(type);
    } else {
      newSelectedTypes.set(type, newCount);
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

    // 构建AI NPC数组，根据数量重复类型
    const aiNPCTypes = [];
    for (const [type, count] of selectedAITypes) {
      for (let i = 0; i < count; i++) {
        aiNPCTypes.push(type);
      }
    }

    try {
      const response = await fetch(`/api/rooms/${params.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rounds: roundCount,
          plotRequirement,
          aiNPCTypes: aiNPCTypes
        })
      });

      const data = await response.json();
      if (data.success) {
        // 直接刷新数据，不显示弹窗
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

  // 获取玩家角色名的辅助函数
  const getPlayerCharacterName = (playerId) => {
    if (!gameData?.playerCharacters || !gameData?.script?.characters) return null;
    const characterId = gameData.playerCharacters[playerId];
    const character = gameData.script.characters.find(c => c.id === characterId);
    return character?.name;
  };

  // 获取AI角色名和类型的辅助函数
  const getAICharacterInfo = (aiNPC) => {
    if (!gameData?.script?.characters) return { characterName: null, typeName: null };
    const character = gameData.script.characters.find(c => c.id === aiNPC.characterId);
    return {
      characterName: character?.name || aiNPC.characterName,
      typeName: aiNPC.name || aiNPC.type
    };
  };

  // 游戏界面渲染
  const renderGameInterface = () => {
    if (!gameData) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-white">
            <h3 className="text-xl font-bold mb-4">加载游戏数据中...</h3>
            <p className="text-slate-300">请稍候，正在获取剧本信息...</p>
          </div>
        </div>
      );
    }

    const currentRound = gameData.roundRecords.length;
    const script = gameData.script || {};
    const currentRoundContent = script.roundContents?.[currentRound - 1];

    return (
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：玩家列表和AI角色 */}
        <div className="w-80 bg-slate-800/50 backdrop-blur-sm border-r border-purple-500/30 flex flex-col">
          {/* 玩家列表 */}
          <div className="p-6 border-b border-purple-500/20">
            <h2 className="text-lg font-bold text-white mb-4">玩家列表</h2>
            <div className="space-y-3">
              {players.map((player) => {
                const characterName = getPlayerCharacterName(player.id);
                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">
                          {player.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="text-white font-medium">{player.username}</div>
                        {characterName && (
                          <div className="text-purple-300 text-xs">扮演: {characterName}</div>
                        )}
                      </div>
                    </div>
                    {player.id === room.hostId && (
                      <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">
                        房主
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI角色列表 */}
          {gameData?.aiNPCs && gameData.aiNPCs.length > 0 && (
            <div className="p-6 flex-1 overflow-y-auto">
              <h2 className="text-lg font-bold text-white mb-4">AI角色</h2>
              <div className="space-y-3">
                {gameData.aiNPCs.map((ai) => {
                  const { characterName, typeName } = getAICharacterInfo(ai);
                  return (
                    <div
                      key={ai.id}
                      className="p-3 bg-slate-700/50 rounded-lg border border-blue-500/30"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">AI</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-medium">{characterName || typeName}</div>
                          <div className="text-blue-300 text-xs">{typeName}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 中间：剧情显示区域 */}
        <div className="flex-1 flex flex-col bg-slate-900/50">
          {/* 当前剧情 */}
          <div className="p-6 border-b border-purple-500/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">📖 剧情回顾</h3>
              {/* 房主控制按钮 */}
              {isHost && currentRoundContent && (
                <div className="flex items-center space-x-2">
                  {currentRound < gameData?.rounds ? (
                    <button
                      onClick={advanceToNextRound}
                      className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg transition-all text-sm shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      进入下一轮 →
                    </button>
                  ) : (
                    <div className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg text-sm">
                      最后一轮 ✓
                    </div>
                  )}
                </div>
              )}
              
              {/* 最后一轮所有玩家都可以结束故事 */}
              {currentRound === gameData?.rounds && currentRoundContent && (
                <button
                  onClick={endStory}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-lg transition-all text-sm shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  结束故事 🏁
                </button>
              )}
            </div>
            
            {/* 剧情滚动区域 */}
            <div className="max-h-64 overflow-y-auto space-y-4">
              {gameData?.script?.roundContents?.map((roundContent, index) => {
                const roundNumber = roundContent.round;
                const isCurrentRound = roundNumber === currentRound;
                const hasReached = roundNumber <= currentRound;
                
                if (!hasReached) return null; // 只显示已经到达的轮次
                
                return (
                  <div 
                    key={roundNumber}
                    className={`rounded-xl border p-4 transition-all ${
                      isCurrentRound 
                        ? 'bg-slate-800/70 border-purple-500/50 ring-1 ring-purple-500/30' 
                        : 'bg-slate-800/30 border-slate-600/50'
                    }`}
                  >
                    <div className={`text-sm mb-2 flex items-center justify-between ${
                      isCurrentRound ? 'text-purple-300' : 'text-slate-400'
                    }`}>
                      <span>第 {roundNumber} 轮 / 共 {gameData?.rounds} 轮</span>
                      {isCurrentRound && <span className="text-xs bg-purple-600 px-2 py-1 rounded">当前</span>}
                    </div>
                    <div className={`leading-relaxed ${
                      isCurrentRound ? 'text-white' : 'text-slate-300'
                    }`}>
                      {(() => {
                        const myCharacterId = gameData?.playerCharacters?.[currentUser?.id];
                        const personalScript = myCharacterId ? gameData?.personalScripts?.[myCharacterId] : null;
                        const personalRoundContent = personalScript?.personalRoundContents?.find(prc => prc.round === roundNumber);
                        return personalRoundContent?.personalPlot || roundContent.plot || '剧情加载中...';
                      })()}
                    </div>
                  </div>
                );
              })}
              
              {/* 只在真正的故事阅读阶段显示准备按钮 - 即没有轮次记录且状态为story_reading */}
              {gameData?.status === 'story_reading' && (!gameData?.roundRecords || gameData.roundRecords.length === 0) && (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
                  <div className="text-center">
                    <p className="text-white mb-4">📖 请仔细阅读你的角色背景故事</p>
                    <div className="text-slate-300 text-sm mb-6">
                      阅读完成后，点击下方按钮开始剧情游戏
                    </div>
                    {!readyPlayers.has(currentUser?.id) ? (
                      <button
                        onClick={markPlayerReady}
                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        ✅ 已看完，开始剧情
                      </button>
                    ) : (
                      <div>
                        <p className="text-green-400 mb-2 text-lg">✅ 已准备就绪</p>
                        <p className="text-sm text-slate-400">
                          等待其他玩家准备完成... ({readyPlayers.size}/{players.length})
                        </p>
                        <div className="mt-3">
                          <div className="bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-green-500 to-emerald-500 h-full transition-all duration-500"
                              style={{ width: `${(readyPlayers.size / players.length) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* 等待剧情开始的提示 - 当没有剧本内容且不是story_reading状态时 */}
              {(!gameData?.script?.roundContents || gameData.script.roundContents.length === 0) && 
               (!gameData?.roundRecords || gameData.roundRecords.length === 0) && 
               gameData?.status !== 'story_reading' && (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
                  <div className="text-center text-slate-400">
                    等待剧情开始...
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 聊天区域 */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-6 pb-2 flex-shrink-0">
              <h3 className="text-lg font-bold text-white mb-4">💬 讨论区</h3>
            </div>
            <div 
              ref={chatContainerRef}
              className="flex-1 px-6 pb-4 overflow-y-auto min-h-0"
              style={{ maxHeight: 'calc(100vh - 400px)' }}
            >
              <div className="space-y-3">
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-3 rounded-lg max-w-[80%] ${
                      message.isNPC
                        ? 'bg-blue-600/20 border border-blue-500/30 ml-4'
                        : message.senderId === currentUser?.id
                        ? 'bg-purple-600/20 border border-purple-500/30 ml-auto'
                        : 'bg-slate-600/20 border border-slate-500/30'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`text-sm font-medium ${
                        message.isNPC ? 'text-blue-300' : 'text-purple-300'
                      }`}>
                        {message.senderName || '匿名'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-white text-sm">{message.content}</div>
                  </div>
                ))}
                {chatMessages.length === 0 && (
                  <div className="text-center text-slate-400 py-8">
                    暂无讨论内容，开始你的推理吧！
                  </div>
                )}
              </div>
            </div>
            {/* 消息输入 */}
            <div className="p-6 pt-4 border-t border-purple-500/20 flex-shrink-0">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="输入消息..."
                  className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={sendMessage}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-lg transition-all"
                >
                  发送
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：个人信息和线索 */}
        <div className="w-80 bg-slate-800/50 backdrop-blur-sm border-l border-purple-500/30 flex flex-col">
          {/* 角色信息 */}
          <div className="p-6 border-b border-purple-500/20">
            <h3 className="text-lg font-bold text-white mb-4">🎭 我的角色</h3>
            {(() => {
              const myCharacterId = gameData?.playerCharacters?.[currentUser?.id];
              const myCharacter = gameData?.script?.characters?.find(c => c.id === myCharacterId);
              
              return myCharacter ? (
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-yellow-300 font-bold text-lg mb-2">{myCharacter.name}</div>
                  <div className="text-slate-300 text-sm mb-2">{myCharacter.identity}</div>
                  <div className="text-slate-400 text-xs">{myCharacter.personality}</div>
                </div>
              ) : (
                <div className="text-slate-400 text-center py-4">角色信息加载中...</div>
              );
            })()}
          </div>

          {/* 故事背景 */}
          <div className="p-6 border-b border-purple-500/20">
            <h3 className="text-lg font-bold text-white mb-4">🌟 我的背景故事</h3>
            <div className="bg-slate-700/50 rounded-lg p-4 max-h-40 overflow-y-auto">
              <div className="text-slate-300 text-sm leading-relaxed">
                {(() => {
                  const myCharacterId = gameData?.playerCharacters?.[currentUser?.id];
                  const personalScript = myCharacterId ? gameData?.personalScripts?.[myCharacterId] : null;
                  return personalScript?.personalBackground || gameData?.scriptBackground || '背景加载中...';
                })()}
              </div>
            </div>
          </div>

          {/* 私人线索 */}
          <div className="p-6 flex-1 overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">🔍 私人信息</h3>
            
            {(() => {
              const myCharacterId = gameData?.playerCharacters?.[currentUser?.id];
              const currentRoundNum = gameData?.roundRecords?.length || 0;
              const userClue = currentRoundNum > 0 ? 
                gameData?.roundRecords[currentRoundNum - 1]?.privateClues?.[myCharacterId] : null;
              
              // 获取个人剧本中的隐藏信息
              const personalScript = myCharacterId ? gameData?.personalScripts?.[myCharacterId] : null;
              const personalRoundContent = personalScript?.personalRoundContents?.find(prc => prc.round === currentRoundNum);
              const hiddenInfo = personalRoundContent?.hiddenInfo;

              return (
                <div className="space-y-4">
                  {/* 私人线索 */}
                  {userClue && (
                    <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-500/30">
                      <div className="text-yellow-300 text-sm font-semibold mb-2">📋 线索</div>
                      <div className="text-yellow-100 text-sm leading-relaxed">
                        {userClue}
                      </div>
                    </div>
                  )}
                  
                  {/* 隐藏信息 */}
                  {hiddenInfo && (
                    <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/30">
                      <div className="text-red-300 text-sm font-semibold mb-2">🤫 秘密信息</div>
                      <div className="text-red-100 text-sm leading-relaxed">
                        {hiddenInfo}
                      </div>
                    </div>
                  )}
                  
                  {!userClue && !hiddenInfo && (
                    <div className="text-slate-400 text-center py-4 text-sm">
                      {currentRoundNum > 0 ? '本轮暂无私人信息' : '游戏开始后将显示信息'}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    // 获取当前用户的角色名
    const myCharacterId = gameData?.playerCharacters?.[currentUser?.id];
    const myCharacter = gameData?.script?.characters?.find(c => c.id === myCharacterId);
    const characterName = myCharacter?.name || currentUser.username;

    const messageData = {
      username: characterName, // 使用角色名而不是真人名
      content: newMessage.trim(),
      timestamp: Date.now(),
      userId: currentUser.id,
      characterId: myCharacterId // 添加角色ID信息
    };

    try {
      const response = await fetch(`/api/games/${gameData.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.message) {
          setChatMessages([...chatMessages, result.message]);
          setNewMessage('');
          
          // 触发AI NPC轮询回复
          triggerAIPollingResponse(result.message);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // AI NPC轮询回复功能 - 实现您要求的轮询逻辑
  const triggerAIPollingResponse = async (userMessage) => {
    if (!gameData?.aiNPCs || gameData.aiNPCs.length === 0) return;
    
    try {
      // 轮询每个AI NPC，让LLM决定是否接话
      for (const aiNPC of gameData.aiNPCs) {
        // 获取更新后的聊天消息列表（包含刚发送的消息）
        const updatedMessages = [...chatMessages, userMessage];
        
        const response = await fetch(`/api/games/${gameData.id}/ai-polling`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage: userMessage, // 传递完整的用户消息对象
            aiNPC: aiNPC,
            gameContext: {
              background: gameData.scriptBackground,
              currentRound: gameData.roundRecords.length,
              currentPlot: gameData.roundRecords[gameData.roundRecords.length - 1]?.plot,
              privateClues: gameData.roundRecords[gameData.roundRecords.length - 1]?.privateClues,
              recentMessages: updatedMessages.slice(-10), // 包含最新消息的上下文
              lastMessage: userMessage // 明确标记最新的用户消息
            }
          })
        });

        if (response.ok) {
          const aiResult = await response.json();
          if (aiResult.success && aiResult.shouldSpeak && aiResult.message) {
            setChatMessages(prev => [...prev, aiResult.message]);
            // 给AI之间一点响应间隔，避免同时说话
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }
    } catch (error) {
      console.error('Failed to get AI polling response:', error);
    }
  };

  // 标记玩家已准备
  const markPlayerReady = async () => {
    if (!currentUser || readyPlayers.has(currentUser.id)) return;
    
    try {
      const response = await fetch(`/api/games/${gameData.id}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: currentUser.id })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setReadyPlayers(new Set([...readyPlayers, currentUser.id]));
          
          // 检查是否所有玩家都准备好了
          if (result.allReady) {
            // 开始第一轮剧情
            fetchGameData(gameData.id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to mark ready:', error);
    }
  };

  // 房主控制进入下一轮
  const advanceToNextRound = async () => {
    if (!isHost || !gameData) return;
    
    const currentRound = gameData.roundRecords.length;
    const nextRound = currentRound + 1;
    
    if (nextRound > gameData.rounds) {
      alert('已经是最后一轮了！');
      return;
    }
    
    try {
      const response = await fetch(`/api/games/${gameData.id}/advance-round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentRound: currentRound,
          nextRound: nextRound
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 刷新游戏数据
          fetchGameData(gameData.id);
          // 显示成功提示
          if (result.isLastRound) {
            alert(`已进入最后一轮！游戏即将结束。`);
          }
        } else {
          alert('进入下一轮失败：' + result.error);
        }
      } else {
        alert('进入下一轮失败');
      }
    } catch (error) {
      console.error('Failed to advance round:', error);
      alert('进入下一轮失败');
    }
  };

  // 结束故事功能
  const endStory = async () => {
    if (!gameData || !currentUser) return;
    
    try {
      const response = await fetch(`/api/games/${gameData.id}/end-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          playerId: currentUser.id
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 如果游戏成功结束，跳转到复盘页面
          if (result.gameEnded) {
            window.location.href = `/game-summary/${gameData.id}`;
          } else {
            // 显示等待其他玩家的提示
            alert(`您已确认结束故事！等待其他玩家确认... (${result.confirmedPlayers}/${result.totalPlayers})`);
            // 刷新游戏数据
            fetchGameData(gameData.id);
          }
        } else {
          alert('结束故事失败：' + result.error);
        }
      } else {
        alert('结束故事失败');
      }
    } catch (error) {
      console.error('Failed to end story:', error);
      alert('结束故事失败');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="h-screen flex flex-col">
        {/* 房间标题栏 */}
        <div className="bg-slate-800/50 backdrop-blur-sm border-b border-purple-500/30 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{room.name}</h1>
              <p className="text-purple-300 text-sm">房间号: {room.id} | 状态: {
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

        {/* 根据游戏状态显示不同界面 */}
        {room.status === 'playing' ? (
          renderGameInterface()
        ) : (
          <div className="flex-1 p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {/* 左侧：玩家列表和AI选择 */}
              <div className="lg:col-span-1">
                {/* 玩家列表 */}
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

                {/* AI NPC选择 */}
                {isHost && room.status === 'waiting' && (
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
                    <h3 className="text-lg font-bold text-white mb-4">
                      AI NPC选择 (已选择: {Array.from(selectedAITypes.values()).reduce((sum, count) => sum + count, 0)}个)
                    </h3>
                    <div className="space-y-3">
                      {AI_CHARACTER_TYPES.map((type) => {
                        const count = selectedAITypes.get(type.id) || 0;
                        return (
                          <div
                            key={type.id}
                            className={`p-3 rounded-lg border transition-all ${
                              count > 0
                                ? 'bg-purple-600/30 border-purple-400 ring-1 ring-purple-500'
                                : 'bg-slate-700/50 border-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-white font-medium text-sm">{type.name}</div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => adjustAICount(type.id, -1)}
                                  disabled={count === 0}
                                  className="w-6 h-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-full flex items-center justify-center transition-colors disabled:cursor-not-allowed text-xs"
                                >
                                  -
                                </button>
                                <span className="text-white font-bold w-6 text-center text-sm">{count}</span>
                                <button
                                  onClick={() => adjustAICount(type.id, 1)}
                                  className="w-6 h-6 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center transition-colors text-xs"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            <div className="text-slate-300 text-xs">{type.description}</div>
                          </div>
                        );
                      })}
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
                        onFocus={(e) => console.log('Input focused')}
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-text"
                        placeholder="输入游戏轮数（1-20）"
                        autoComplete="off"
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
                        onFocus={(e) => console.log('Textarea focused')}
                        onClick={(e) => e.target.focus()}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none cursor-text"
                        style={{
                          minHeight: '120px',
                          fontFamily: 'inherit',
                          fontSize: '14px',
                          lineHeight: '1.5'
                        }}
                        rows={6}
                        placeholder="描述你想要的剧情类型、背景设定、风格等..."
                        autoComplete="off"
                        spellCheck="false"
                      />
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
                {(!isHost || room.status !== 'waiting') && room.status !== 'playing' && (
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
                    <div className="text-center">
                      {room.status === 'waiting' ? (
                        <div className="text-white">
                          <h3 className="text-xl font-bold mb-4">等待房主开始游戏</h3>
                          <p className="text-slate-300">房主正在配置游戏参数...</p>
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
        )}
      </div>
    </div>
  );
}
