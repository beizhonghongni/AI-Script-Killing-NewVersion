"use client";
import { useState } from 'react';
import RatingStars from './RatingStars';
import Modal from './Modal';

interface RateScriptModalProps {
  open: boolean;
  onClose: () => void;
  scriptId: string; // original script id
  displayTitle: string;
  userId: string;
  onRated?: (rating: number) => void;
}

export default function RateScriptModal({ open, onClose, scriptId, displayTitle, userId, onRated }: RateScriptModalProps) {
  const [tempRating, setTempRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    if (!tempRating) { setMessage('请选择星级'); return; }
    setSubmitting(true); setMessage(null);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/rating`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId, rating: tempRating }) });
      const data = await res.json();
      if (data.success) { setMessage('评分成功'); onRated && onRated(tempRating); }
      else setMessage(data.error || '评分失败');
    } catch { setMessage('网络错误'); }
    setSubmitting(false);
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={`为剧本评分`}> 
      <div className="space-y-5">
        <div>
          <div className="text-sm text-gray-400 mb-1">剧本</div>
          <div className="text-white font-medium">{displayTitle}</div>
        </div>
        <div>
          <div className="text-sm text-gray-400 mb-2">选择星级</div>
          <div className="flex items-center gap-4">
            <RatingStars value={tempRating} onChange={v=> setTempRating(v)} size={30} interactive />
            {tempRating>0 && <span className="text-game-accent text-sm">{tempRating} 星</span>}
          </div>
          <p className="text-xs text-gray-500 mt-2">点击第 N 颗星即为 {`>`}= N 星。再次点击同一星可重新选择。</p>
        </div>
        {message && <div className={`text-sm ${message.includes('成功')? 'text-green-400':'text-red-400'}`}>{message}</div>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm disabled:opacity-50">关闭</button>
          <button onClick={submit} disabled={submitting} className="px-4 py-2 rounded bg-game-accent hover:bg-opacity-80 text-white text-sm font-medium disabled:opacity-50">{submitting? '提交中...':'提交评分'}</button>
        </div>
      </div>
    </Modal>
  );
}
