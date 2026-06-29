import React from 'react';

/**
 * 콘텐츠 폭 정렬 래퍼 (Gleap 라이트 — 풀블리드).
 *
 * 옛 "paper-on-surface" 프레임(흰 패널 + 테두리)은 제거. 랜딩처럼 콘텐츠가
 * 배경 위에 직접 얹히고, 가로만 중앙 max-width 로 정렬한다. 배경/색은 각 페이지
 * 루트(bg-surface + 옅은 웜 그라데이션)가 담당.
 *
 * 폭: 모바일 풀폭, md 이상 min(92vw, 1400px) — 상단은 고정 네비 높이만큼 패딩.
 *
 * @param {number} maxWidth  - (레거시) 미사용.
 * @param {React.ReactNode} children
 * @param {string} className - 콘텐츠 컨테이너에 추가할 클래스
 */
const PageSurface = ({ children, className = '' }) => (
  <div className="pt-[4rem] md:pt-[5.5rem] lg:pt-10 pb-[5.25rem] md:pb-8">
    <div className={`mx-auto w-full md:w-[min(92vw,87.5rem)] ${className}`}>
      {children}
    </div>
  </div>
);

export default PageSurface;
