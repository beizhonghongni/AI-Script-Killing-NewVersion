"use client";
import { useState } from 'react';

export default function RatingStars({ value, onChange, size=20 }: { value: number; onChange?: (v:number)=>void; size?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const stars = [0,1,2,3,4];
  return (
    <div className="flex items-center gap-1">
      {stars.map(i => {
        const filled = (hover !== null ? i <= hover : i < value);
        return (
          <span
            key={i}
            role={onChange? 'button': 'img'}
            onMouseEnter={()=> onChange && setHover(i)}
            onMouseLeave={()=> onChange && setHover(null)}
            onClick={()=> onChange && onChange(i+1)}
            style={{ fontSize: size, lineHeight: 1, cursor: onChange? 'pointer':'default' }}
            className={filled? 'text-yellow-400':'text-gray-500'}
          >★</span>
        );
      })}
      <span className="text-xs text-gray-400 ml-1">{value?.toFixed?.(1) || value}</span>
    </div>
  );
}