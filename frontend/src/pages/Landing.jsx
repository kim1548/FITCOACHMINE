import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageSurface from '../components/PageSurface';
import TopNavbar from '../components/TopNavbar';
import usePageTitle from '../hooks/usePageTitle';

/**
 * / — 비로그인 사용자를 위한 시네마틱 표지 + 매거진 본문 (Editorial 톤).
 *
 * 상태 분기:
 *   - 첫 방문(localStorage fc_visited 없음): 100vh 풀블리드 표지
 *   - 재방문(fc_visited 있음): 50vh 단축 표지
 *   - 로그인 사용자: App.jsx 의 RootRoute 에서 /journal 로 리다이렉트 (여기 도달 X)
 *
 * 전환:
 *   - 스크롤이 표지 높이의 80% 초과하면 TopNavbar 가 위에서 슬라이드 인
 *   - 본문은 PageSurface 안 — pt-[88px] 로 헤더 공간 확보
 *
 * 접근성:
 *   - prefers-reduced-motion 시 모든 모션·슬라이드인 비활성화
 *   - CTA(REGISTER/SIGN IN) Tab 키 + Enter 로 접근 가능
 */

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const SECTIONS = [
  { no: '01', label: 'Journal',    sub: 'Calendar · daily entry',           desc: '오늘의 운동·식단·체성분·코멘트를 한 페이지로. 달력에서 날짜를 누르면 그 날의 entry 가 펼쳐집니다.' },
  { no: '02', label: 'Program',    sub: 'Library of 10 strength programs',  desc: 'StrongLifts · 5/3/1 · nSuns · Texas Method 등 10가지 검증된 프로그램. 자동 증량과 1RM 계산기.' },
  { no: '03', label: 'Form Check', sub: 'AI pose analysis',                 desc: '영상 한 편을 업로드하면 18종 운동에 대해 안정성·가동범위·동작품질·자세·코어 5축 진단.' },
  { no: '04', label: 'Meals',      sub: 'Macros + AI feedback',             desc: '사진·검색·즐겨찾기로 한 끼씩 빠르게 기록. 칼로리·탄수·단백·지방 목표 대비 진척.' },
  { no: '05', label: 'Body',       sub: 'InBody timeline',                  desc: '체중·골격근·체지방·체지방률을 매번 기록하면 매거진 톤의 추이 그래프가 자동으로 그려집니다.' },
  { no: '06', label: 'Personals',  sub: 'Find a training companion',        desc: '같은 무게를 드는 사람을 찾는 우아한 방식 — 위치·1RM·한 줄 메시지로 짧은 글을 남깁니다.' },
];

const STEPS = [
  { no: '01', label: 'Sign up', desc: '신체 정보·라이프스타일·이번 달 목표를 입력하면 BMR·TDEE 가 자동으로 계산됩니다.' },
  { no: '02', label: 'Record',  desc: '매일의 운동·식단·체성분을 한 화면에서 기록 — 한 끼, 한 세트, 한 측정.' },
  { no: '03', label: 'Review',  desc: '하루는 entry, 한 주는 캘린더, 한 달은 그래프. 모든 변화가 매거진 페이지로 모입니다.' },
];

const Landing = () => {
  usePageTitle('FitCoach — 매일의 strength 저널');

  const scrollRef = useRef(null);
  const heroRef = useRef(null);
  const [showHeader, setShowHeader] = useState(false);

  // 0) Flashlight — 상단 중앙에서 내려오는 한 줄기 약한 빛이 마우스를 향해 회전.
  //    손전등을 비추는 느낌. 리스너는 히어로에만 바인딩 → 본문 진입 시 자동 mouseleave.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const CLAMP_DEG = 50; // 손전등은 더 크게 꺾여도 OK (실제 손전등 느낌)

    const flashlight = document.createElement('div');
    flashlight.className = 'flashlight';
    flashlight.setAttribute('aria-hidden', 'true');
    hero.appendChild(flashlight);

    const onEnter = () => flashlight.classList.add('active');
    const onLeave = () => flashlight.classList.remove('active');
    const onMove = (e) => {
      const rect = hero.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      // 마우스가 너무 위에 있으면 atan2 가 발산 → 최소 깊이 보장
      const mouseY = Math.max(60, e.clientY - rect.top);
      const beamX = rect.width / 2; // 상단 중앙 고정 앵커
      const dx = mouseX - beamX;
      const dy = mouseY;
      // CSS rotate(+) 시계방향 → 수직 빔 하단이 LEFT swing.
      // 마우스 오른쪽이면 음수 회전이 필요해 부호 반전.
      let angle = -(Math.atan2(dx, dy) * 180) / Math.PI;
      if (angle > CLAMP_DEG) angle = CLAMP_DEG;
      if (angle < -CLAMP_DEG) angle = -CLAMP_DEG;
      flashlight.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    };

    hero.addEventListener('mouseenter', onEnter);
    hero.addEventListener('mouseleave', onLeave);
    hero.addEventListener('mousemove', onMove);

    return () => {
      hero.removeEventListener('mouseenter', onEnter);
      hero.removeEventListener('mouseleave', onLeave);
      hero.removeEventListener('mousemove', onMove);
      if (flashlight.parentNode) flashlight.parentNode.removeChild(flashlight);
    };
  }, []);

  // 1) 스크롤 추적 — 표지 80% 지나면 TopNavbar 슬라이드인.
  //    재방문 분기 없음. 매번 풀블리드 표지부터 시작.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const compute = () => {
      const threshold = window.innerHeight * 0.8;
      setShowHeader(el.scrollTop > threshold);
    };
    compute();
    el.addEventListener('scroll', compute, { passive: true });
    window.addEventListener('resize', compute);
    return () => {
      el.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
    };
  }, []);

  // 2) IntersectionObserver — landing-reveal 요소를 뷰포트 진입 시 페이드인.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const els = root.querySelectorAll('.landing-reveal');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { root, threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 0);
  const dayOfYear = String(Math.floor((now - start) / 86400000)).padStart(3, '0');
  const monthLabel = MONTH_LABELS[now.getMonth()];

  return (
    <div
      ref={scrollRef}
      className="fixed inset-0 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none', overscrollBehavior: 'contain' }}
    >

      {/* 슬라이드인 헤더 — scrollTop > 80% 표지 높이부터 등장 */}
      <div
        className={`fixed top-0 left-0 right-0 z-[60] transform transition-transform duration-300 ${
          showHeader ? 'translate-y-0' : '-translate-y-full'
        }`}
        aria-hidden={!showHeader}
      >
        <TopNavbar onOpenSettings={() => {}} />
      </div>

      {/* ================================================================
          COVER STATE — 풀블리드 표지. 실루엣·Ken Burns 제거, 절제된 ambient
          + 커서 따라가는 후광 (.landing-hero + .cursor-glow 동적 주입)
          ================================================================ */}
      <section
        ref={heroRef}
        className="landing-hero w-full flex flex-col"
      >
        {/* 표지 내 통합 마스트헤드 — 플렉스 흐름의 첫 항목 (항상 상단, 안 줄어듦) */}
        <div className="relative z-20 shrink-0 flex items-baseline justify-between px-6 md:px-12 pt-6 md:pt-8">
          <Link
            to="/"
            className="font-display italic text-xl md:text-2xl lg:text-3xl text-ink leading-none tracking-tight hover:text-accent-gold transition-colors"
          >
            FITCOACH
          </Link>
          <div className="font-mono text-[10px] md:text-[11px] text-taupe tracking-meta uppercase">
            No. {dayOfYear} — {monthLabel.toUpperCase()} {year}
          </div>
        </div>

        {/* 히어로 — flex-1 로 남은 공간 차지, justify-end 로 콘텐츠 좌하단 정렬.
            min-h-0 가 없으면 작은 뷰포트에서 flex item 이 안 줄어들어 위로 흘러넘침. */}
        <div className="relative z-10 flex-1 min-h-0 flex flex-col justify-center md:justify-end px-6 md:px-12 pt-8 md:pt-12 pb-12 md:pb-28">
          <div className="max-w-[640px]">
            <div className="font-mono text-[11px] text-accent-red tracking-label uppercase mb-3 md:mb-4">
              — Premiere issue · Welcome
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[0.98] tracking-tight font-normal">
              The journal of <br />
              your <em className="italic text-accent-gold">active</em>{' '}
              <em className="italic text-accent-gold">self.</em>
            </h1>
            <p className="font-display italic text-sm md:text-base lg:text-lg text-taupe mt-4 md:mt-5 leading-relaxed max-w-[480px]">
              운동 · 식단 · 체성분 — 매일의 기록이 한 권의 매거진처럼 쌓이는 헬스 코칭 트래커.
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-6 md:mt-8">
              <Link
                to="/signup"
                className="font-mono text-[11px] tracking-label uppercase px-6 py-3.5 bg-accent-red text-ink hover:bg-accent-red/90 transition-colors"
              >
                → Register
              </Link>
              <Link
                to="/login"
                className="font-mono text-[11px] tracking-label uppercase px-6 py-3.5 border border-ink/25 text-taupe hover:text-ink hover:border-ink/45 transition-colors"
              >
                → Sign in
              </Link>
              <Link
                to="/journal"
                className="font-mono text-[11px] tracking-meta uppercase px-3 py-3.5 text-hint hover:text-ink transition-colors"
              >
                → Browse as guest
              </Link>
            </div>
          </div>
        </div>

      </section>

      {/* ================================================================
          APP STATE — 본문 (PageSurface 안)
          ================================================================ */}
      <PageSurface maxWidth={1100}>
        <div className="w-full">

          {/* What's inside */}
          <section className="px-6 md:px-12 py-8 md:py-10 border-b border-ink/15">
            <div className="max-w-[640px] pb-6 landing-reveal">
              <div className="flex items-baseline justify-between mb-3">
                <div className="font-mono text-[11px] text-accent-red tracking-label uppercase">
                  — What's inside
                </div>
                <div className="font-mono text-[10px] text-hint tracking-meta uppercase">
                  {SECTIONS.length.toString().padStart(2, '0')} sections
                </div>
              </div>
              <h2 className="font-display text-3xl md:text-4xl leading-[1.0] tracking-tight font-normal">
                여섯 개의 챕터, <em className="italic text-accent-gold">하나의 페이지.</em>
              </h2>
            </div>

            <div className="border-t border-ink/15">
              {SECTIONS.map((s, idx) => (
                <div
                  key={s.no}
                  className="landing-row landing-reveal grid grid-cols-[64px_1fr_auto] gap-5 py-5 pl-3 border-b border-ink/8 last:border-b-0 items-baseline"
                  style={{ transitionDelay: `${idx * 70}ms` }}
                >
                  <span className="font-display italic text-2xl leading-none text-hint tabular-nums">
                    {s.no}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2.5 flex-wrap mb-1">
                      <span className="font-display text-xl md:text-2xl text-ink leading-tight">
                        {s.label}
                      </span>
                      <span className="font-mono text-[10px] text-taupe tracking-meta uppercase">
                        · {s.sub}
                      </span>
                    </div>
                    <p className="font-display italic text-[14px] text-body leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                  <span className="landing-row-arrow font-mono text-lg text-hint self-center pr-1">
                    ›
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section className="px-6 md:px-12 py-8 md:py-10 border-b border-ink/15">
            <div className="max-w-[640px] pb-6 landing-reveal">
              <div className="font-mono text-[11px] text-accent-red tracking-label uppercase mb-3">
                — How it works
              </div>
              <h2 className="font-display text-3xl md:text-4xl leading-[1.0] tracking-tight font-normal">
                Three steps, <em className="italic text-accent-gold">one record.</em>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-ink/10 border border-ink/10">
              {STEPS.map((step, idx) => (
                <div
                  key={step.no}
                  className="landing-reveal bg-paper p-6"
                  style={{ transitionDelay: `${idx * 80}ms` }}
                >
                  <div className="font-display italic text-4xl text-accent-gold leading-none mb-3 tabular-nums">
                    {step.no}
                  </div>
                  <div className="font-mono text-[10px] text-accent-red tracking-label uppercase mb-2">
                    — {step.label}
                  </div>
                  <p className="font-display italic text-[14px] text-body leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Closing CTA */}
          <section className="px-6 md:px-12 py-10 md:py-12 border-b border-ink/15 bg-accent-red/[0.04]">
            <div className="max-w-[640px] landing-reveal">
              <div className="font-mono text-[11px] text-accent-red tracking-label uppercase mb-3">
                — Begin
              </div>
              <h2 className="font-display text-3xl md:text-4xl leading-[1.05] tracking-tight font-normal mb-4">
                오늘의 entry 부터 <em className="italic text-accent-gold">시작하세요.</em>
              </h2>
              <p className="font-display italic text-sm text-taupe mb-6 leading-relaxed">
                회원가입은 5분이면 충분합니다. 기록할 수록 정확해지는 트래커.
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Link
                  to="/signup"
                  className="font-mono text-[11px] tracking-label uppercase px-6 py-3.5 bg-accent-red text-ink hover:bg-accent-red/90 transition-colors"
                >
                  → Create account
                </Link>
                <Link
                  to="/login"
                  className="font-mono text-[11px] tracking-label uppercase px-6 py-3.5 border border-ink/20 text-taupe hover:text-ink hover:border-ink/40 transition-colors"
                >
                  → I already have one
                </Link>
                <Link
                  to="/journal"
                  className="font-mono text-[11px] tracking-meta uppercase px-3 py-3.5 text-hint hover:text-ink transition-colors"
                >
                  → Just looking
                </Link>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="px-6 md:px-12 py-6 flex justify-between items-center font-mono text-[11px] text-hint tracking-meta">
            <span className="uppercase">— FITCOACH —</span>
            <span className="uppercase text-taupe">Vol. 01 · {year}</span>
          </div>
        </div>
      </PageSurface>
    </div>
  );
};

export default Landing;
