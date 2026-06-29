import React, { useEffect, useState } from "react";
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
  { label: "Supplements", to: "/supplement", match: (p) => p.startsWith("/supplement") },
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
  const [scrolled, setScrolled] = useState(false);

  // 제품 페이지는 fixed 셸 안에서 내부 스크롤이라, 캡처 단계로 어떤 스크롤러든
  // 감지해 네비를 살짝 띄운다(소프트 그림자). 랜딩의 알약 모핑 대신 가벼운 elevation.
  useEffect(() => {
    const onScroll = (e) => {
      const t = e.target;
      const top = t && typeof t.scrollTop === "number" ? t.scrollTop : 0;
      setScrolled(top > 12);
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);

  const issueNo = String(dayOfYear()).padStart(3, "0");
  const now = new Date();
  const monthLabel = MONTH_LABELS[now.getMonth()];

  // FITCOACH 워드마크 — 로그인 시 /journal, 미로그인 시 유도 모달.
  const handleBrandClick = (e) => {
    if (!user) {
      e.preventDefault();
      setAuthPromptOpen(true);
    }
  };

  return (
    <nav
      className={`w-full z-[100] flex-shrink-0 font-sans transition-all duration-300 ${
        scrolled
          ? "bg-paper/85 backdrop-blur-md shadow-[0_6px_22px_-12px_rgba(26,20,16,0.22)]"
          : "bg-transparent"
      }`}
    >
      {/* Line 1 — Masthead: brand + issue + auth actions */}
      <div className="flex items-center justify-between px-8 py-3.5">
        <Link
          to="/journal"
          onClick={handleBrandClick}
          className="flex items-center gap-2 group"
        >
          <span
            className="w-[22px] h-[22px] rounded-full flex-shrink-0"
            style={{ background: "radial-gradient(circle at 50% 38%, var(--color-lilac), var(--color-lilac-deep))" }}
          />
          <span className="font-semibold text-[1.05rem] tracking-tight text-ink group-hover:opacity-80 transition-opacity">
            FitCoach
          </span>
        </Link>
        <div className="flex items-center gap-4 text-[0.8125rem] font-medium">
          <span className="text-hint hidden sm:inline">
            No. {issueNo} · {monthLabel}
          </span>
          {user ? (
            <>
              <AvatarMenu />
              <button
                onClick={onOpenSettings}
                className="text-taupe hover:text-ink transition-colors"
                aria-label="Settings"
              >
                Settings
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-taupe hover:text-ink transition-colors">
                로그인
              </Link>
              <Link
                to="/signup"
                className="bg-ink text-paper rounded-[10px] px-4 py-2 hover:opacity-90 transition-opacity"
              >
                무료로 시작
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Line 2 — Section tabs (데스크탑 전용 · 모바일은 하단 탭바 BottomNav 가 대체) */}
      <div className="hidden md:flex gap-7 px-8 pb-3 text-[0.8125rem] font-medium overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const active = tab.match(location.pathname);
          return (
            <Link
              key={tab.label}
              to={tab.to}
              className={`flex-shrink-0 pb-1 transition-colors ${
                active
                  ? "text-ink border-b-2 border-lilac"
                  : "text-taupe hover:text-ink"
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
