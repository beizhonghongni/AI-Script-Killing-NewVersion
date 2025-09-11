"use client";
import { useState } from 'react';

interface RSProps { value: number; onChange?: (v:number)=>void; size?: number; interactive?: boolean; }
export default function RatingStars({ value, onChange, size=20, interactive=false }: RSProps) {
  const [hover, setHover] = useState<number | null>(null);
  const stars = [1,2,3,4,5];
  const activeVal = hover !== null ? hover : value;
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !onChange) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); onChange(Math.min(5, (value||0)+1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(1, (value||0)-1)); }
  };
  return (
    <div className="flex items-center gap-1" role={interactive? 'radiogroup': undefined} onKeyDown={handleKey}>
      {stars.map(i => {
        const filled = i <= activeVal;
        return (
          <span
            key={i}
            role={interactive? 'radio': 'img'}
            aria-checked={interactive? (i === value): undefined}
            tabIndex={interactive? 0: -1}
            onMouseEnter={()=> interactive && setHover(i)}
            onMouseLeave={()=> interactive && setHover(null)}
            onClick={()=> interactive && onChange && onChange(i)}
            style={{ fontSize: size, lineHeight: 1, cursor: interactive? 'pointer':'default', transition:'transform .15s' }}
            className={filled? 'text-yellow-400 drop-shadow-sm hover:scale-110':'text-gray-600 hover:text-yellow-300'}
          >★</span>
        );
      })}
      {!interactive && <span className="text-xs text-gray-400 ml-1">{(value||0).toFixed(1)}</span>}
    </div>
  );
}
