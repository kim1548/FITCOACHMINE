import React from 'react';

/**
 * 영양 목표 진행률 한 줄 — Editorial Magazine 톤.
 * < 80% : taupe (부족·중립)
 * 80~110% : accent-gold (적정·강조)
 * > 110% : accent-red (과잉·경고)
 */
export const barColor = (pct) => {
  if (pct < 80) return 'bg-gradient-to-r from-lilac to-lilac-deep';
  if (pct <= 110) return 'bg-gradient-to-r from-lilac to-lilac-deep';
  return 'bg-[#c43c2f]';
};

const NutritionProgressRow = ({ label, consumed, target, unit }) => {
  const safeTarget = target || 1;
  const pct = Math.round(((consumed || 0) / safeTarget) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-sans text-[0.625rem] text-taupe tracking-meta uppercase">
          {label}
        </span>
        <span className="font-sans text-[0.6875rem] tabular-nums text-ink">
          {Math.round(consumed || 0)}
          <span className="text-hint"> / {target}{unit}</span>
          <span className="ml-2 text-hint">{pct}%</span>
        </span>
      </div>
      <div className="h-0.5 bg-ink/10 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${barColor(pct)}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
};

export default NutritionProgressRow;
