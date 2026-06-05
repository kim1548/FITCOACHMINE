import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthPromptModal from "./ui/AuthPromptModal";
import AvatarMenu from "./AvatarMenu";

/**
 * Editorial Magazine 톤의 상단 마스트헤드.
 *
 * Line 1: FITCOACH 워드마크 (italic serif) + Issue No (오늘 day-of-year) + 인증 액션
 * Line 2: 섹션 탭 (Log · Program · Form · Diet · Body · Personals)
 *
 * 디자인 토큰만 사용 — bg-paper, text-ink, text-taupe, accent-red, accent-gold,
 * font-display, font-mono, tracking-meta, tracking-label.
 */

// 라벨은 기존 하단 Navbar 의 그대로 — 목업은 스타일(매거진 톤)만 참고.
const TABS = [
  { label: "Community",  to: "/community", match: (p) => p.startsWith("/community") },
  { label: "PROGRAM",    to: "/program",   match: (p) => p.startsWith("/program") },
  { label: "Form Check", to: "/formcheck", match: (p) => p.startsWith("/formcheck") },
  { label: "MEALS",      to: "/meals",     match: (p) => p.startsWith("/meals") },
  { label: "BODY",       to: "/body",      match: (p) => p.startsWith("/body") },
  { label: "Journal",    to: "/journal",   match: (p) => p.startsWith("/journal") },
];

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const dayOfYear = () => {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
};

const TopNavbar = ({ onOpenSettings }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  const issueNo = String(dayOfYear()).padStart(3, "0");
  const now = new Date();
  const monthLabel = MONTH_LABELS[now.getMonth()];
  const yearLabel = now.getFullYear();

  // FITCOACH 워드마크 — 로그인 시 /journal, 미로그인 시 유도 모달.
  const handleBrandClick = (e) => {
    if (!user) {
      e.preventDefault();
      setAuthPromptOpen(true);
    }
  };

  return (
    <nav className="w-full bg-paper border-b border-ink/15 z-[100] flex-shrink-0">
      {/* Line 1 — Masthead: brand + issue + auth actions */}
      <div className="flex items-baseline justify-between px-6 py-3 border-b border-ink/12">
        <Link
          to="/journal"
          onClick={handleBrandClick}
          className="font-display italic text-lg text-ink hover:text-accent-gold transition-colors tracking-tight"
        >
          FITCOACH
        </Link>
        <div className="flex items-baseline gap-5 font-mono text-[0.6875rem] tracking-meta uppercase">
          <span className="text-taupe hidden sm:inline">
            No. {issueNo} — {monthLabel} {yearLabel}
          </span>
          {user ? (
            <>
              <AvatarMenu />
              <button
                onClick={onOpenSettings}
                className="text-taupe hover:text-ink transition-colors"
                aria-label="설정"
              >
                Settings
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-taupe hover:text-ink transition-colors">
                → Sign in
              </Link>
              <Link to="/signup" className="text-accent-red hover:text-ink transition-colors">
                → Register
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Line 2 — Section tabs (데스크탑 전용 · 모바일은 하단 탭바 BottomNav 가 대체) */}
      <div className="hidden md:flex gap-6 px-6 py-2 font-mono text-[0.6875rem] tracking-meta uppercase overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const active = tab.match(location.pathname);
          return (
            <Link
              key={tab.label}
              to={tab.to}
              className={`flex-shrink-0 transition-colors ${
                active
                  ? "text-ink border-b border-accent-red pb-1"
                  : "text-taupe hover:text-ink pb-1"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* 미로그인 사용자가 FITCOACH 워드마크를 누르면 노출되는 유도 모달 */}
      <AuthPromptModal
        open={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
      />
    </nav>
  );
};

export default TopNavbar;
