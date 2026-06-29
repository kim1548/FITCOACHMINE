import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronsLeft, Menu, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthPromptModal from "./ui/AuthPromptModal";
import AvatarMenu from "./AvatarMenu";

/**
 * 데스크탑(lg+) 좌측 사이드바 — 랜딩 제품 미리보기와 동일한 레이아웃.
 * bone 배경 / 라일락 로고 / 세로 메뉴(active = 흰 알약) / 하단 설정·계정.
 * open=false 면 왼쪽으로 슬라이드아웃되고, 본문은 --sb-w(App)로 동시에 늘어난다.
 * lg 미만에서는 숨김 — 모바일/태블릿은 TopNavbar + BottomNav 가 담당.
 */
const NAV = [
  { label: "Journal",     to: "/journal",    match: (p) => p.startsWith("/journal") },
  { label: "Program",     to: "/program",    match: (p) => p.startsWith("/program") },
  { label: "Form Check",  to: "/formcheck",  match: (p) => p.startsWith("/formcheck") },
  { label: "Meals",       to: "/meals",      match: (p) => p.startsWith("/meals") },
  { label: "Body",        to: "/body",       match: (p) => p.startsWith("/body") },
  { label: "Supplements", to: "/supplement", match: (p) => p.startsWith("/supplement") },
  { label: "Community",   to: "/community",  match: (p) => p.startsWith("/community") },
];

const Sidebar = ({ open = true, onToggle, onOpenSettings }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  const handleBrandClick = (e) => {
    if (!user) {
      e.preventDefault();
      setAuthPromptOpen(true);
    }
  };

  return (
    <>
      <aside
        className={`hidden lg:flex fixed left-0 top-0 bottom-0 w-[15rem] z-[120] flex-col bg-bone border-r border-ink/8 font-sans transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 로고 + 접기 버튼 */}
        <div className="flex items-center justify-between pl-6 pr-3 py-6 flex-shrink-0">
          <Link to="/journal" onClick={handleBrandClick} className="flex items-center gap-2 group">
            <span
              className="w-[22px] h-[22px] rounded-full flex-shrink-0"
              style={{ background: "radial-gradient(circle at 50% 38%, var(--color-lilac), var(--color-lilac-deep))" }}
            />
            <span className="font-semibold text-[1.1rem] tracking-tight text-ink group-hover:opacity-80 transition-opacity">
              FitCoach
            </span>
          </Link>
          <button
            onClick={onToggle}
            aria-label="사이드바 접기"
            className="p-1.5 rounded-[10px] text-taupe hover:text-ink hover:bg-ink/[0.04] transition-colors"
          >
            <ChevronsLeft size={18} />
          </button>
        </div>

        {/* 메뉴 */}
        <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-y-auto [&::-webkit-scrollbar]:hidden">
          {NAV.map((it) => {
            const active = it.match(location.pathname);
            return (
              <Link
                key={it.label}
                to={it.to}
                className={`px-3.5 py-2.5 rounded-[12px] text-[0.9rem] transition-colors ${
                  active
                    ? "bg-paper text-ink font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.06)]"
                    : "text-taupe hover:text-ink hover:bg-ink/[0.04] font-medium"
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>

        {/* 하단 — 설정 / 계정 */}
        <div className="px-3 py-4 border-t border-ink/8 flex flex-col gap-1 flex-shrink-0">
          {user ? (
            <>
              <div className="px-1">
                <AvatarMenu up />
              </div>
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-2 text-left px-3.5 py-2.5 rounded-[12px] text-[0.85rem] font-medium text-taupe hover:text-ink hover:bg-ink/[0.04] transition-colors"
              >
                <SettingsIcon size={15} /> Settings
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3.5 py-2.5 rounded-[12px] text-[0.85rem] font-medium text-taupe hover:text-ink hover:bg-ink/[0.04] transition-colors"
              >
                로그인
              </Link>
              <Link
                to="/signup"
                className="text-center bg-ink text-paper rounded-[10px] px-3.5 py-2.5 text-[0.85rem] font-medium hover:opacity-90 transition-opacity"
              >
                무료로 시작
              </Link>
            </>
          )}
        </div>

        <AuthPromptModal open={authPromptOpen} onClose={() => setAuthPromptOpen(false)} />
      </aside>

      {/* 접혔을 때 — 다시 여는 플로팅 버튼 */}
      {!open && (
        <button
          onClick={onToggle}
          aria-label="사이드바 열기"
          className="hidden lg:flex fixed top-5 left-5 z-[130] items-center justify-center w-10 h-10 rounded-full bg-paper border border-ink/10 shadow-[0_4px_12px_-4px_rgba(26,20,16,0.22)] text-ink hover:bg-bone transition-colors"
        >
          <Menu size={18} />
        </button>
      )}
    </>
  );
};

export default Sidebar;
