import React, { useEffect } from "react";
import Settings from "../pages/Settings";

/**
 * 우측 슬라이드 Settings drawer — Editorial Magazine 톤.
 *
 * - 데스크탑 폭 w-[26.25rem], 모바일 전체 폭
 * - 백드롭 클릭 / Close × / ESC 닫힘
 * - 닫혀있어도 DOM 유지, translate-x 로 슬라이드
 */
const SettingsDrawer = ({ isOpen, onClose, theme, setTheme }) => {
  // ESC 로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // drawer 열려있는 동안 body 스크롤 잠금
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  return (
    <>
      {/* 백드롭 */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Drawer 본체 */}
      <aside
        className={`fixed right-0 top-0 bottom-0 z-[201] w-full md:w-[26.25rem] bg-paper text-ink border-l border-ink/15 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Settings"
      >
        {/* Masthead */}
        <header className="sticky top-0 z-10 flex items-baseline justify-between px-6 py-4 border-b border-ink/15 bg-paper">
          <div>
            <div className="font-display italic text-lg text-ink leading-none">Settings</div>
            <div className="font-mono text-[0.625rem] text-taupe tracking-meta uppercase mt-1.5">
              — Preferences · Account
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[0.6875rem] tracking-meta uppercase text-taupe hover:text-ink transition-colors"
            aria-label="닫기"
          >
            Close ×
          </button>
        </header>

        {/* 본문 스크롤 영역 */}
        <div className="h-[calc(100%-4.5rem)] overflow-y-auto px-6 py-8">
          <Settings theme={theme} setTheme={setTheme} />
        </div>
      </aside>
    </>
  );
};

export default SettingsDrawer;
