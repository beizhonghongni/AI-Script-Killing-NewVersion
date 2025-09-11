"use client";
import { useState } from 'react';
import Modal from './Modal';
import RatingStars from './RatingStars';

interface PurchaseScriptModalProps {
  open: boolean;
  onClose: () => void;
  script: any;
  userId: string;
  balance: number | null;
  onPurchased: (newBalance:number)=> void;
}

export default function PurchaseScriptModal({ open, onClose, script, userId, balance, onPurchased }: PurchaseScriptModalProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (!script) return null;

  const doPurchase = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/scripts/${script.id}/purchase`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ buyerId: userId }) });
      const data = await res.json();
      if (data.success) { setDone(true); onPurchased(data.balance); window.dispatchEvent(new Event('userDataUpdated')); }
      else setError(data.error || '购买失败');
    } catch { setError('网络错误'); }
    setLoading(false);
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={done? '购买成功':'购买剧本'}>
      <div className="space-y-5">
        {!done && <>
          <div>
            <h4 className="text-white text-lg font-semibold mb-1">{script.title}</h4>
            <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
              <span>作者: {script.originalAuthorId || script.createdBy}</span>
              <span>轮数: {script.rounds}</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed line-clamp-6 whitespace-pre-line">{script.background}</p>
          </div>
          <div className="flex items-center gap-3">
            <RatingStars value={script.averageRating || 0} size={22} />
            <span className="text-xs text-gray-500">{script.ratingCount || 0} 次评分</span>
          </div>
          <div className="flex items-center justify-between bg-gray-800/60 rounded px-4 py-3">
            <div className="text-sm text-gray-300">价格：<span className="text-yellow-400 font-semibold">¥{script.price || 0}</span></div>
            <div className="text-sm text-gray-300">我的余额：<span className="text-blue-400 font-semibold">{balance ?? '...'}</span></div>
          </div>
          {error && <div className="text-sm text-red-400">{error}</div>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm disabled:opacity-50">取消</button>
            <button onClick={doPurchase} disabled={loading} className="px-5 py-2 rounded bg-game-accent hover:bg-opacity-80 text-white text-sm font-medium disabled:opacity-50">{loading? '处理中...':'确认购买'}</button>
          </div>
        </>}
        {done && <div className="space-y-4">
          <div className="text-green-400 font-medium">已购买并自动加入收藏，可在左侧“收藏剧本”中创建房间。</div>
          <div className="flex justify-end">
            <button onClick={onClose} className="px-5 py-2 rounded bg-game-accent text-white text-sm">关闭</button>
          </div>
        </div>}
      </div>
    </Modal>
  );
}
