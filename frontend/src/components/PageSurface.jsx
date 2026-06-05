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
 * 폭은 유동형: 모바일은 풀폭, md 이상은 min(88vw, 1700px) — 화면 비율을 따라
 * 같이 커져서 노트북·데스크탑이 같은 여백 비율로 보이고, 초대형 모니터에선
 * 가독성을 위해 1700px 에서 멈춘다.
 *
 * @param {number} maxWidth  - (레거시) 더 이상 사용하지 않음. 폭은 위 유동 규칙으로 통일.
 * @param {React.ReactNode} children
 * @param {string} className - 패널에 추가할 클래스
 */
const PageSurface = ({ children, className = '' }) => (
  <div className="pt-[4rem] md:pt-[5.5rem] pb-[5.25rem] md:pb-8">
    <div
      className={`mx-auto w-full md:w-[min(88vw,1700px)] bg-paper border border-page-border ${className}`}
      style={{
        borderTopColor: 'var(--color-page-edge)',
        minHeight: 'calc(100vh - 128px)',
      }}
    >
      {children}
    </div>
  </div>
);

export default PageSurface;
