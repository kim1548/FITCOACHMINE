import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Users, Dumbbell, Video, Utensils, Activity, BookOpen, Pill } from "lucide-react";

/**
 * 모바일 전용 하단 탭바 (md 미만에서만 노출).
 * 데스크탑은 TopNavbar 의 섹션 탭을 그대로 쓴다 — 라벨/순서/매칭 규칙 동일.
 * iPhone 홈 인디케이터를 피하려 safe-area-inset-bottom 만큼 아래 여백을 둔다.
 */
const TABS = [
  { label: "Community", to: "/community", Icon: Users,    match: (p) => p.startsWith("/community") },
  { label: "Program",   to: "/program",   Icon: Dumbbell, match: (p) => p.startsWith("/program") },
  { label: "Form",      to: "/formcheck", Icon: Video,    match: (p) => p.startsWith("/formcheck") },
  { label: "Meals",     to: "/meals",     Icon: Utensils, match: (p) => p.startsWith("/meals") },
  { label: "Supp",      to: "/supplement", Icon: Pill,    match: (p) => p.startsWith("/supplement") },
  { label: "Body",      to: "/body",      Icon: Activity, match: (p) => p.startsWith("/body") },
  { label: "Journal",   to: "/journal",   Icon: BookOpen, match: (p) => p.startsWith("/journal") },
];

const BottomNav = () => {
  const { pathname } = useLocation();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-[100] bg-paper border-t border-ink/10 flex justify-around items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map(({ label, to, Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={label}
            to={to}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors ${
              active ? "text-lilac-deep" : "text-taupe hover:text-ink"
            }`}
          >
            {active && (
              <span className="absolute top-0 inset-x-0 mx-auto h-[2px] w-8 bg-lilac-deep" />
            )}
            <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
            <span className="font-sans text-[0.5625rem] tracking-tight leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
