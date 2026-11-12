import React, { useState } from 'react';
import { Package } from 'lucide-react';

interface ProductThumbProps {
  src?: string;
  alt: string;
  size?: number;
  className?: string;
}

/** Product photo thumbnail; falls back to a quiet box icon if missing or broken. */
export const ProductThumb: React.FC<ProductThumbProps> = ({ src, alt, size = 48, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const show = src && !failed;
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {show ? (
        <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <Package className="text-slate-600" style={{ width: size * 0.4, height: size * 0.4 }} strokeWidth={1.5} />
      )}
    </div>
  );
};

/** Large product photo that fills its container; quiet fallback when missing or broken. */
export const ProductPhoto: React.FC<{ src?: string; alt: string; className?: string }> = ({ src, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`overflow-hidden bg-slate-950 flex items-center justify-center ${className}`}>
      {src && !failed ? (
        <img src={src} alt={alt} className="w-full h-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <div className="flex flex-col items-center gap-2 text-slate-600">
          <Package className="w-12 h-12" strokeWidth={1.25} />
          <span className="text-sm">No photo yet</span>
        </div>
      )}
    </div>
  );
};
