"use client";
import { useEffect, useState } from 'react';
import RatingStars from './RatingStars';

interface ScriptRemixModalProps {
  scriptId: string;
  onClose: () => void;
  currentUser: any;
  onRemixCompleted?: (script:any)=>void;
}

export default function ScriptRemixModal({ scriptId, onClose, currentUser, onRemixCompleted }: ScriptRemixModalProps) {
  const [baseScript, setBaseScript] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [instructions, setInstructions] = useState('');
  const [working, setWorking] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [overwrite, setOverwrite] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/scripts/${scriptId}`);
      if (!res.ok) {
        setError(`请求失败(${res.status})`);
      } else {
        const data = await res.json();
        if (data.success) setBaseScript(data.script); else setError(data.error||'加载失败');
      }
    } catch (e:any) {
      setError('网络错误：可能是服务未启动或断开');
    }
    setLoading(false);
  };

  useEffect(()=> { load(); },[scriptId]);

  const applyRemix = async () => {
    if (!instructions.trim()) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/remix`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: currentUser.id, instructions, overwrite }) });
      const data = await res.json();
      if (data.success) {
        setPreview(data.script);
        setHistory(h => [...h, { at: Date.now(), instructions, script: data.script }]);
        setInstructions('');
        // 如果返回collected或overwrite成功，触发外部刷新用户数据
        if (data.collected || data.overwritten) {
          window.dispatchEvent(new Event('userDataUpdated'));
        }
      } else {
        alert(data.error || '修改失败');
      }
    } catch { alert('网络错误'); }
    setWorking(false);
  };

  const finish = () => {
    if (!preview) { alert('还没有生成修改版本'); return; }
    onRemixCompleted && onRemixCompleted(preview);
    onClose();
  };

  const showScript = preview || baseScript;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-game-card w-full max-w-6xl h-[90vh] rounded-xl flex flex-col overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="text-white font-semibold text-lg">二次创作：{baseScript?.title || '...'}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧原/预览 */}
          <div className="w-2/3 border-r border-gray-700 flex flex-col">
            <div className="p-4 overflow-y-auto text-sm text-gray-300 leading-relaxed space-y-6">
              {loading && <div>加载中...</div>}
              {error && (
                <div className="space-y-2">
                  <div className="text-red-400">{error}</div>
                  <button onClick={load} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white">重试</button>
                </div>
              )}
              {showScript && (
                <>
                  <section>
                    <h3 className="text-white font-medium mb-2">背景</h3>
                    <p className="whitespace-pre-wrap">{showScript.background}</p>
                  </section>
                  <section>
                    <h3 className="text-white font-medium mb-2">角色</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {showScript.characters.map((c:any)=>(
                        <div key={c.id} className="bg-gray-800/60 p-2 rounded">
                          <div className="text-white text-xs font-semibold">{c.name}</div>
                          <div className="text-gray-400 text-xs">{c.identity}</div>
                          <div className="text-gray-500 text-[11px] line-clamp-2">{c.personality}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h3 className="text-white font-medium mb-2">轮次剧情</h3>
                    <div className="space-y-4">
                      {showScript.roundContents.map((r:any)=>(
                        <div key={r.round} className="bg-gray-800/40 p-3 rounded">
                          <div className="text-purple-300 font-medium mb-1">第{r.round}轮</div>
                          <p className="text-gray-300 text-xs whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">{r.plot}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
          {/* 右侧指令区 */}
          <div className="w-1/3 flex flex-col">
            <div className="p-4 space-y-3 border-b border-gray-700">
              <div className="text-white text-sm font-medium">修改指令</div>
              <textarea value={instructions} onChange={e=> setInstructions(e.target.value)} className="w-full h-32 bg-gray-800 rounded p-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500" placeholder="示例：修改第2轮结尾增加反转线索，并把角色A性格改成更偏执" />
              {baseScript && currentUser?.id === baseScript.createdBy && (
                <label className="flex items-center gap-2 text-xs text-gray-400 select-none">
                  <input type="checkbox" checked={overwrite} onChange={e=> setOverwrite(e.target.checked)} className="accent-purple-500" />
                  覆盖原脚本(仅原作者可选) – 将直接修改原脚本而不是创建新副本
                </label>
              )}
              <div className="flex gap-2">
                <button disabled={working || !instructions.trim()} onClick={applyRemix} className="px-3 py-2 bg-game-accent text-white rounded text-sm disabled:opacity-50">{working? '生成中...':'应用修改'}</button>
                <button onClick={finish} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm">完成并保存</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs text-gray-400">
              <div className="text-gray-300 text-sm font-medium">修改历史</div>
              {history.length === 0 && <div className="text-gray-500">暂无</div>}
              {history.map(h => (
                <div key={h.at} className="border border-gray-700 rounded p-2">
                  <div className="text-[10px] text-gray-500">{new Date(h.at).toLocaleTimeString()}</div>
                  <div className="text-gray-300 whitespace-pre-wrap">{h.instructions}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}