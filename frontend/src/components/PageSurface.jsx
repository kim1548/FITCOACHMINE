import React from 'react';

/**
 * Page-on-surface 톤 시스템의 공통 래퍼.
 *
 * - 바깥 여백(scrollable container)의 배경: bg-surface
 * - 안쪽 콘텐츠 패널 배경: bg-paper + hairline border (상단 살짝 밝은 edge)
 *
 * 명도 차이는 4~5%로 미묘하게 — 사용자가 "다른 색"이라 의식하지 않고
 * "콘텐츠가 표면 위에 놓여있다"는 안정감만 느끼는 수준.
 *
 * @param {number} maxWidth  - 패널 최대 폭 (px). 텍스트 페이지는 720, 리스트는 1100~1200.
 * @param {React.ReactNode} children
 * @param {string} className - 패널에 추가할 클래스
 */
const PageSurface = ({ children, maxWidth = 1200, className = '' }) => (
  <div className="pt-[64px] md:pt-[88px] pb-[84px] md:pb-8">
    <div
      className={`mx-auto bg-paper border border-page-border ${className}`}
      style={{
        maxWidth: `${maxWidth}px`,
        borderTopColor: 'var(--color-page-edge)',
        minHeight: 'calc(100vh - 128px)',
      }}
    >
      {children}
    </div>
  </div>
);

export default PageSurface;
