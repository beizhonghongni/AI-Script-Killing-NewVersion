'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { GameRecord, GameSummary } from '@/types';

export default function GameSummaryPage() {
  const { id } = useParams();
  const router = useRouter();
  const [gameRecord, setGameRecord] = useState<GameRecord | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userSummary, setUserSummary] = useState<GameSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // 获取当前用户ID
    const userId = sessionStorage.getItem('currentUserId');
    if (!userId) {
      router.push('/');
      return;
    }
    setCurrentUserId(userId);

    // 获取游戏记录
    fetchGameRecord();
  }, [id, router]);

  const fetchGameRecord = async () => {
    try {
      const response = await fetch(`/api/games/${id}`);
      const data = await response.json();
      
      if (data.success) {
        setGameRecord(data.gameRecord);
        
        // 检查是否已有该用户的总结
        if (data.gameRecord.finalSummary?.[currentUserId]) {
          setUserSummary(data.gameRecord.finalSummary[currentUserId]);
        }
      } else {
        setError('Failed to load game record');
      }
    } catch (error) {
      console.error('Error fetching game record:', error);
      setError('Failed to load game record');
    }
  };

  const generateSummary = async () => {
    if (!gameRecord || !currentUserId) return;

    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch(`/api/games/${id}/generate-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: currentUserId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setUserSummary(data.summary);
        // 刷新游戏记录以获取最新的总结数据
        await fetchGameRecord();
      } else {
        setError(data.error || 'Failed to generate summary');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      setError('Failed to generate summary');
    } finally {
      setIsGenerating(false);
    }
  };

  const goBackToMain = () => {
    router.push('/');
  };

  if (!gameRecord) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-2">
            🎭 游戏复盘
          </h1>
          <div className="text-lg text-gray-300">
            房间: {gameRecord.roomId} | 游戏时长: {
              gameRecord.finishedAt && gameRecord.createdAt ? 
              Math.round((gameRecord.finishedAt - gameRecord.createdAt) / 60000) + ' 分钟' : 
              '未知'
            }
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* 游戏基本信息 */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-cyan-400">📖 游戏信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">剧情背景:</span>
              <p className="mt-1 text-gray-300">{gameRecord.scriptBackground}</p>
            </div>
            <div>
              <span className="text-gray-400">参与玩家:</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {gameRecord.players.map((playerId, index) => (
                  <span key={index} className="bg-blue-600/30 px-2 py-1 rounded text-blue-300">
                    玩家 {index + 1}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-gray-400">AI NPC:</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {gameRecord.aiNPCs.map((npc, index) => (
                  <span key={index} className="bg-purple-600/30 px-2 py-1 rounded text-purple-300">
                    {npc.characterName || npc.name}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-gray-400">游戏轮数:</span>
              <p className="mt-1 text-gray-300">{gameRecord.rounds} 轮</p>
            </div>
          </div>
        </div>

        {/* 个人总结区域 */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-cyan-400">🎯 我的游戏总结</h2>
          
          {!userSummary ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">还没有生成您的个人游戏总结</p>
              <button
                onClick={generateSummary}
                disabled={isGenerating}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    正在生成总结...
                  </div>
                ) : (
                  '🎨 生成我的游戏总结'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 故事复盘 */}
              <div>
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">📚 故事复盘</h3>
                <p className="text-gray-300 leading-relaxed">{userSummary.storyReview}</p>
              </div>

              {/* 精彩点解密 */}
              <div>
                <h3 className="text-lg font-semibold text-green-400 mb-2">💡 精彩点解密</h3>
                <p className="text-gray-300 leading-relaxed">{userSummary.plotAnalysis}</p>
              </div>

              {/* 故事升华 */}
              <div>
                <h3 className="text-lg font-semibold text-purple-400 mb-2">✨ 故事升华</h3>
                <p className="text-gray-300 leading-relaxed">{userSummary.storyElevation}</p>
              </div>

              {/* 玩家分析 */}
              {Object.values(userSummary.playerAnalysis || {}).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-pink-400 mb-4">👥 玩家表现分析</h3>
                  <div className="space-y-4">
                    {Object.values(userSummary.playerAnalysis).map((analysis, index) => (
                      <div key={index} className="bg-gray-700/30 rounded-lg p-4">
                        <h4 className="font-semibold text-cyan-300 mb-2">{analysis.playerName}</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-400">观点总结:</span>
                            <p className="text-gray-300">{analysis.viewpointSummary}</p>
                          </div>
                          <div>
                            <span className="text-gray-400">剧情贡献:</span>
                            <p className="text-gray-300">{analysis.plotRelatedComment}</p>
                          </div>
                          <div>
                            <span className="text-gray-400">发言风格:</span>
                            <p className="text-gray-300">{analysis.styleComment}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 重新生成按钮 */}
              <div className="text-center pt-4">
                <button
                  onClick={generateSummary}
                  disabled={isGenerating}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? '正在重新生成...' : '🔄 重新生成总结'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="text-center">
          <button
            onClick={goBackToMain}
            className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300"
          >
            🏠 返回主页
          </button>
        </div>
      </div>
    </div>
  );
}
