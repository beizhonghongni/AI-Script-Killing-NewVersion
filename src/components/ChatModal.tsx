"use client";
import { useEffect, useRef, useState } from 'react';
import { User } from '@/types';

interface ChatModalProps { user: User; friend: { id: string; username: string }; onClose: () => void; collectedScripts?: any[]; }

export default function ChatModal({ user, friend, onClose, collectedScripts = [] }: ChatModalProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement|null>(null);
  const sinceRef = useRef<number>(0);

  useEffect(() => { connectSSE(); /* eslint-disable-next-line */ }, [friend.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function connectSSE() {
    const url = `/api/users/${user.id}/chat/stream?friendId=${friend.id}&since=${sinceRef.current}`;
    const es = new EventSource(url);
    es.addEventListener('batch', (e: any) => {
      try {
        const arr = JSON.parse(e.data);
        if (Array.isArray(arr) && arr.length) {
          setMessages(prev => {
            const merged = [...prev];
            arr.forEach(m => { if (!merged.find(x => x.id === m.id)) merged.push(m); });
            merged.sort((a,b)=>a.timestamp-b.timestamp);
            sinceRef.current = merged[merged.length-1].timestamp;
            return merged;
          });
        }
      } catch {}
    });
    es.addEventListener('ping', ()=>{});
    es.onerror = () => { es.close(); setTimeout(connectSSE, 2000); };
  }

  async function send(type: 'text' | 'script_share', scriptId?: string) {
    const content = type === 'text' ? input.trim() : (scriptId || '');
    if (!content) return;
    await fetch(`/api/users/${user.id}/chat`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ friendId: friend.id, content, type, scriptId }) });
    if (type==='text') setInput('');
    setShareOpen(false);
  }

  async function collect(scriptId: string) {
    await fetch(`/api/users/${user.id}/collect-shared`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ scriptId }) });
    window.dispatchEvent(new Event('userDataUpdated'));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[640px] max-h-[80vh] bg-gray-800 rounded-xl shadow-lg flex flex-col border border-gray-600">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">与 {friend.username} 聊天</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
          {messages.map(m => {
            const mine = m.senderId === user.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-lg px-3 py-2 ${mine ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`}>
                  {m.type === 'text' && <span>{m.content}</span>}
                  {m.type === 'script_share' && (
                    <div>
                      <div className="font-semibold mb-1">📘 分享的剧本ID: {m.scriptId}</div>
                      {!mine && <button onClick={() => collect(m.scriptId)} className="mt-1 text-xs bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded">收藏此剧本</button>}
                    </div>
                  )}
                  <div className="mt-1 text-[10px] opacity-70 text-right">{new Date(m.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef}></div>
        </div>
        <div className="p-3 border-t border-gray-700 space-y-2">
          <div className="flex items-center space-x-2">
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'){ send('text'); } }} placeholder="输入消息..." className="flex-1 bg-gray-700 text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={()=>send('text')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">发送</button>
            <div className="relative">
              <button onClick={()=>setShareOpen(o=>!o)} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded">分享剧本</button>
              {shareOpen && (
                <div className="absolute right-0 mt-2 w-56 max-h-64 overflow-y-auto bg-gray-900 border border-gray-600 rounded shadow-lg p-2 space-y-2 z-10">
                  {(!collectedScripts || collectedScripts.length===0) && <div className="text-gray-400 text-xs">暂无收藏</div>}
                  {collectedScripts?.map(sc => (
                    <div key={sc.id} className="p-2 bg-gray-700 rounded hover:bg-gray-600 cursor-pointer text-xs" onClick={()=>send('script_share', sc.originalScriptId || sc.id)}>
                      <div className="font-semibold truncate">{sc.title}</div>
                      <div className="opacity-70 truncate">{sc.background}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="text-[10px] text-gray-500">分享的脚本ID仅用于演示；前端可再拉取详情。</p>
        </div>
      </div>
    </div>
  );
}
