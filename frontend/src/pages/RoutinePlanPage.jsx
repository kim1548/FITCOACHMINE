import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { programInitialState, getProgram, resolveSession } from '../programs';
import PageSurface from '../components/PageSurface';
import { useConfirm } from '../components/ui/ConfirmProvider';
import usePageTitle from '../hooks/usePageTitle';

/**
 * /program — Program library (Editorial Magazine 톤).
 *
 * mockup: frontend/mockup/루틴고르는페이지2.html
 * 상단: "— Currently training" — 진행 중 프로그램 포스터 + Up next 미리보기
 * 하단: "— Program library" — 10개 프로그램을 Penguin Classics 시리즈처럼 세로 행으로
 *
 * 데이터 / 핸들러 / localStorage 로직은 기존 그대로. 시각만 재구성.
 */

const PROGRAMS = [
  { id: 'stronglifts',       name: 'StrongLifts 5x5',     level: '초급',     img: '/resources/images/program_stronglifts.png',       desc: '스쿼트·벤치·로우 5×5 기본, 세션마다 +2.5kg 자동 증량. 가장 단순한 입문 루틴.' },
  { id: 'madcow',            name: 'Madcow 5x5',          level: '중급',     img: '/resources/images/program_madcow.png',            desc: '주간 +2.5kg 증량, 50→100% 램핑 세트. StrongLifts 졸업자용 중급 루틴.' },
  { id: 'nsuns',             name: 'nSuns 5/3/1 LP',      level: '중상~상급', img: '/resources/images/program_nsuns.png',             desc: 'AMRAP 기반 자동 TM 조정, 9세트 고볼륨 다중 %. Wendler 5/3/1 LP 변형.' },
  { id: 'starting_strength', name: 'Starting Strength',   level: '초급',     img: '/resources/images/program_starting_strength.png', desc: '스쿼트·벤치·데드·OHP·파워클린 3×5. Mark Rippetoe의 입문 표준.' },
  { id: 'greyskull_lp',      name: 'Greyskull LP',        level: '초급',     img: '/resources/images/program_greyskull.png',         desc: '마지막 세트 AMRAP, 상·하체 격일 분할. AMRAP 도입 입문 LP.' },
  { id: 'gzclp',             name: 'GZCLP',               level: '초중급',   img: '/resources/images/program_gzclp.png',             desc: 'T1(5/3/1)·T2(10×3)·T3(15+) 3-tier 세트, AMRAP 기반 증량. Cody LeFever.' },
  { id: 'wendler_531',       name: 'Wendler 5/3/1',       level: '중급',     img: '/resources/images/program_wendler_531.png',       desc: '4주 사이클(5/3/1/디로드), TM 90% 기준. 보수적이고 지속 가능한 클래식.' },
  { id: 'texas_method',      name: 'Texas Method',        level: '중급',     img: '/resources/images/program_texas_method.png',      desc: '월 볼륨·수 라이트·금 인텐시티 3분할, PR 세트 기반 중급 LP의 고전.' },
  { id: 'ppl',               name: 'Push / Pull / Legs',  level: '중급',     img: '/resources/images/program_ppl.png',               desc: '푸시·풀·레그 3분할 또는 6일. 부위별 보디빌딩식 하이퍼트로피.' },
  { id: 'phul',              name: 'PHUL',                level: '중급',     img: '/resources/images/program_phul.png',              desc: '주 4일 파워(2일) + 하이퍼트로피(2일). 근력·근비대 동시 추구. Layne Norton.' },
];

const PROGRAM_LIFTS = {
  stronglifts:       [{ id: 'squat', name: '스쿼트' }, { id: 'bench', name: '벤치프레스' }, { id: 'deadlift', name: '데드리프트' }, { id: 'ohp', name: '오버헤드 프레스' }, { id: 'row', name: '바벨 로우' }],
  madcow:            [{ id: 'squat', name: '스쿼트' }, { id: 'bench', name: '벤치프레스' }, { id: 'deadlift', name: '데드리프트' }, { id: 'ohp', name: '오버헤드 프레스' }, { id: 'row', name: '바벨 로우' }],
  nsuns:             [{ id: 'bench', name: '벤치프레스' }, { id: 'squat', name: '스쿼트' }, { id: 'ohp', name: '오버헤드 프레스' }, { id: 'deadlift', name: '데드리프트' }],
  starting_strength: [{ id: 'squat', name: '스쿼트' }, { id: 'bench', name: '벤치프레스' }, { id: 'deadlift', name: '데드리프트' }, { id: 'ohp', name: '오버헤드 프레스' }],
  greyskull_lp:      [{ id: 'squat', name: '스쿼트' }, { id: 'bench', name: '벤치프레스' }, { id: 'deadlift', name: '데드리프트' }, { id: 'ohp', name: '오버헤드 프레스' }],
  gzclp:             [{ id: 'squat', name: '스쿼트' }, { id: 'bench', name: '벤치프레스' }, { id: 'deadlift', name: '데드리프트' }, { id: 'ohp', name: '오버헤드 프레스' }, { id: 'row', name: '바벨 로우' }],
  wendler_531:       [{ id: 'squat', name: '스쿼트' }, { id: 'bench', name: '벤치프레스' }, { id: 'deadlift', name: '데드리프트' }, { id: 'ohp', name: '오버헤드 프레스' }],
  texas_method:      [{ id: 'squat', name: '스쿼트' }, { id: 'bench', name: '벤치프레스' }, { id: 'deadlift', name: '데드리프트' }, { id: 'ohp', name: '오버헤드 프레스' }, { id: 'row', name: '바벨 로우' }],
  ppl:               [{ id: 'squat', name: '스쿼트' }, { id: 'bench', name: '벤치프레스' }, { id: 'deadlift', name: '데드리프트' }, { id: 'ohp', name: '오버헤드 프레스' }, { id: 'row', name: '바벨 로우' }],
  phul:              [{ id: 'squat', name: '스쿼트' }, { id: 'bench', name: '벤치프레스' }, { id: 'deadlift', name: '데드리프트' }, { id: 'ohp', name: '오버헤드 프레스' }, { id: 'row', name: '바벨 로우' }],
};

const PROGRAM_META = {
  stronglifts:       { label: 'StrongLifts 5x5',     note: '1RM × 50%부터 시작합니다. 모르겠으면 5회 완수 가능한 무게로 입력하세요.' },
  madcow:            { label: 'Madcow 5x5',          note: '1RM × 50%부터 시작해 매주 +2.5kg 증량합니다.' },
  nsuns:             { label: 'nSuns 5/3/1 LP',      note: 'TM(Training Max) = 1RM × 90%으로 자동 설정되어 세트 무게가 계산됩니다.' },
  starting_strength: { label: 'Starting Strength',   note: '1RM × 50%부터 시작합니다. 모르겠으면 5회 완수 가능한 무게로 입력하세요.' },
  greyskull_lp:      { label: 'Greyskull LP',        note: '1RM × 50%부터 시작합니다. 각 운동 마지막 세트는 가능한 최대 반복(AMRAP)으로 수행합니다.' },
  gzclp:             { label: 'GZCLP',               note: 'T1은 1RM의 70%, T2는 50%, 보조 운동(T3)은 45%로 시작해 3단 구조로 진행됩니다.' },
  wendler_531:       { label: 'Wendler 5/3/1',       note: 'TM(Training Max) = 1RM × 90%으로 시작하며, 4주 사이클로 진행됩니다.' },
  texas_method:      { label: 'Texas Method',        note: '1RM × 50%부터 시작합니다. 월(볼륨)·수(회복)·금(강도)으로 주간 증량합니다.' },
  ppl:               { label: 'Push / Pull / Legs',  note: '1RM × 50%부터 시작합니다. 마지막 세트에서 목표+4회 이상이면 증량됩니다.' },
  phul:              { label: 'PHUL',                note: '파워일은 1RM의 60%, 하이퍼트로피일은 45%로 시작해 4분할로 진행됩니다.' },
};

const PROGRAM_VARIANTS = {
  nsuns: [
    { id: '4day', label: '주 4일', tag: 'Time-saver',     desc: '4개 Day 패턴. 시간이 부족하거나 회복 위주로 가고 싶을 때.' },
    { id: '5day', label: '주 5일', tag: 'Standard',       desc: '원본 nSuns 의 기본 구성. 가장 일반적으로 사용되는 변형.' },
    { id: '6day', label: '주 6일', tag: 'High volume',    desc: '회복력이 충분하고 추가 볼륨을 원할 때. 가장 공격적인 변형.' },
  ],
};

// Editorial 시리즈 메타 — Vol 번호 + author/year/level + tags + featured 용 인용문
const PROGRAM_VISUAL = {
  stronglifts:       { vol: '01', author: 'Mehdi',           year: '2009',    level: 'Beginner',     tags: ['5×5', 'Linear', '3 days·week'], quote: '입문 lifter 의 가장 단순한 출발선.' },
  madcow:            { vol: '02', author: 'Bill Starr',      year: '1970s',   level: 'Intermediate', tags: ['5×5', 'Ramping', '3 days·week'], quote: 'StrongLifts 의 자연스러운 다음 챕터.' },
  nsuns:             { vol: '03', author: 'nsuns (Wendler)', year: '2017',    level: 'Advanced',     tags: ['AMRAP', 'High volume', '4–6 days·week'], quote: '고볼륨 + 자동 TM. 진지한 진척용.' },
  starting_strength: { vol: '04', author: 'Mark Rippetoe',   year: '2005',    level: 'Beginner',     tags: ['3×5', 'Linear', '3 days·week'], quote: '입문 표준으로 가장 자주 인용됨.' },
  greyskull_lp:      { vol: '05', author: 'John Sheaffer',   year: '2007',    level: 'Beginner',     tags: ['LP', 'AMRAP', 'Upper focus'], quote: '상체 위주 입문 LP 의 변주.' },
  gzclp:             { vol: '06', author: 'Cody LeFever',    year: '2016',    level: 'Beginner+',    tags: ['3-Tier', 'AMRAP', '4 days·week'], quote: 'T1/T2/T3 — 보조까지 정밀한 LP.' },
  wendler_531:       { vol: '07', author: 'Jim Wendler',     year: '2009',    level: 'Intermediate', tags: ['5/3/1', 'TM 90%', '4-week cycle'], quote: '보수적이고 지속 가능한 클래식.' },
  texas_method:      { vol: '08', author: 'Bill Starr (adapted)', year: '1970s', level: 'Intermediate', tags: ['Vol/Light/Int', 'PR sets', '3 days·week'], quote: '주 3회 PR 기반 고전 중급 LP.' },
  ppl:               { vol: '09', author: 'Classic split',   year: '—',       level: 'Intermediate', tags: ['Hypertrophy', '3/6 split', 'Body part'], quote: '부위별 보디빌딩식 분할의 정석.' },
  phul:              { vol: '10', author: 'Layne Norton',    year: '2013',    level: 'Intermediate', tags: ['Power+Hyper', '4 days·week', 'Hybrid'], quote: '근력·근비대 동시 추구의 하이브리드.' },
};

// 공통 포스터 (cover image) — 매거진 시리즈의 핵심 비주얼.
// size 별 스케일만 다름. 폰트·번호·프레임 시스템은 동일 — "시스템은 하나, 스케일만 변주".
const POSTER_DIMS = {
  compact:  { cls: 'w-[76px] h-[106px]',   fs: '11px' },
  sm:       { cls: 'w-[100px] h-[140px]',  fs: '13px' },
  featured: { cls: 'w-[142px] h-[198px]',  fs: '18px' },
  lg:       { cls: 'w-[150px] h-[210px]',  fs: '22px' },
};
const Poster = ({ programId, size = 'sm' }) => {
  const p = PROGRAMS.find(x => x.id === programId);
  const v = PROGRAM_VISUAL[programId];
  const { cls, fs } = POSTER_DIMS[size] || POSTER_DIMS.sm;
  const [broken, setBroken] = useState(false);
  return (
    <div className={`${cls} photo-frame flex-shrink-0 border border-ink/15 bg-paper-soft`}>
      {p?.img && !broken ? (
        <img
          src={p.img}
          alt={p.name}
          className="w-full h-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
          <span className="font-poster text-ink uppercase tracking-tight leading-[0.92]" style={{ fontSize: fs }}>
            {p?.name || ''}
          </span>
          <span className="font-mono text-[8px] text-ink/45 tracking-meta uppercase mt-3">
            Vol. {v?.vol || '—'}
          </span>
        </div>
      )}
    </div>
  );
};

const RoutinePlanPage = ({ theme }) => {
  usePageTitle('Program · FitCoach');

  const navigate = useNavigate();
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState(null);
  const [weights, setWeights] = useState({ squat: 0, bench: 0, deadlift: 0, ohp: 0, row: 0 });
  const [showCalc, setShowCalc] = useState(false);
  const [calcWeight, setCalcWeight] = useState(60);
  const [calcReps, setCalcReps] = useState(5);
  const [applyTarget, setApplyTarget] = useState('squat');
  const [programVariant, setProgramVariant] = useState(null);
  const [existingProgram, setExistingProgram] = useState(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('fiteating.program') || 'null');
      if (saved?.selectedId) setExistingProgram(saved);
    } catch {}
  }, []);

  const handleResume = () => {
    if (!existingProgram) return;
    navigate('/program/play', { state: existingProgram });
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: '현재 진행 중인 프로그램을 초기화할까요?',
      description: '증량 기록 그래프(히스토리)는 그대로 유지됩니다.',
      confirmLabel: 'Reset',
      destructive: true,
    });
    if (!ok) return;
    localStorage.removeItem('fiteating.program');
    setExistingProgram(null);
  };

  const estimated1RM = calcWeight > 0 && calcReps > 0 ? calcWeight * (1 + calcReps / 30) : 0;

  const applyEstimate = () => {
    const rounded = Math.round(estimated1RM / 2.5) * 2.5;
    setWeights(prev => ({ ...prev, [applyTarget]: rounded }));
    setShowCalc(false);
  };

  const handleStartProgram = async () => {
    let existing = null;
    try { existing = JSON.parse(localStorage.getItem('fiteating.program') || 'null'); } catch {}
    const isSameProgram = existing?.selectedId === selectedId;

    if (existing?.selectedId && !isSameProgram) {
      const prevName = PROGRAMS.find(p => p.id === existing.selectedId)?.name || existing.selectedId;
      const ok = await confirm({
        title: `"${prevName}" 의 증량 상태가 초기화됩니다.`,
        description: '새 프로그램으로 갈아타면 이전 working weight 기록이 사라집니다. 그래도 시작할까요?',
        confirmLabel: 'Start new',
        destructive: true,
      });
      if (!ok) return;
    }

    const init = programInitialState(selectedId, weights);
    const workingWeights = isSameProgram && existing?.workingWeights
      ? { ...init.workingWeights, ...existing.workingWeights }
      : init.workingWeights;
    const consecutiveFails = isSameProgram && existing?.consecutiveFails
      ? { ...init.consecutiveFails, ...existing.consecutiveFails }
      : init.consecutiveFails;
    const stages = isSameProgram && existing?.stages
      ? { ...init.stages, ...existing.stages }
      : init.stages;

    const navState = {
      selectedId,
      programVariant,
      weights,
      workingWeights,
      consecutiveFails,
      stages,
      lastCompletedWorkout: isSameProgram ? existing.lastCompletedWorkout : null,
    };
    localStorage.setItem('fiteating.program', JSON.stringify(navState));
    navigate('/program/play', { state: navState });
  };

  useEffect(() => {
    if (selectedId && PROGRAM_LIFTS[selectedId]) {
      const firstLift = PROGRAM_LIFTS[selectedId][0].id;
      const isValid = PROGRAM_LIFTS[selectedId].some(l => l.id === applyTarget);
      if (!isValid) setApplyTarget(firstLift);
    }
    setProgramVariant(null);
    if (selectedId && existingProgram?.selectedId === selectedId && existingProgram.weights) {
      setWeights(prev => ({ ...prev, ...existingProgram.weights }));
    }
  }, [selectedId, existingProgram]);

  const needsVariantPick = selectedId && PROGRAM_VARIANTS[selectedId] && !programVariant;

  const adjustWeight = (liftId, delta) => {
    setWeights(prev => {
      const next = Math.max(0, Math.min(500, (prev[liftId] || 0) + delta));
      return { ...prev, [liftId]: next };
    });
  };

  // 현재 진행 중 프로그램 정보
  const currentProg = existingProgram
    ? PROGRAMS.find(p => p.id === existingProgram.selectedId)
    : null;
  const currentLifts = existingProgram
    ? (PROGRAM_LIFTS[existingProgram.selectedId] || [])
    : [];
  const resumeProgram = existingProgram ? getProgram(existingProgram) : null;
  const nextLabel = resumeProgram
    ? resolveSession(resumeProgram, existingProgram.lastCompletedWorkout).label
    : '다음 세션';

  // 다음 세션에 표시할 lift weights (workingWeights 기반)
  const nextLiftRows = currentLifts.slice(0, 3).map(lift => {
    const ww = existingProgram?.workingWeights || {};
    const w = ww[lift.id] ?? ww[`${lift.id}-T1`] ?? ww[`${lift.id}-T3`] ?? ww[`${lift.id}-P`];
    return { id: lift.id, name: lift.name, weight: w };
  }).filter(r => r.weight !== undefined);

  // Featured = 첫 번째 프로그램, compact = 나머지. "시스템은 하나, 스케일만 변주".
  const featuredProgram = PROGRAMS[0];
  const restPrograms = PROGRAMS.slice(1);

  return (
    <div
      className="fixed inset-0 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in duration-300"
      style={{ scrollbarWidth: 'none' }}
    >
      <PageSurface maxWidth={1200}>
      <div className="w-full px-6 md:px-12 py-8">

        {/* ====================================================
            Currently training
            ==================================================== */}
        {existingProgram && currentProg && (
          <section className="pb-8">
            <div className="flex items-baseline justify-between mb-4">
              <div className="font-mono text-[11px] text-accent-red tracking-label uppercase">
                — Currently training
              </div>
              <div className="font-mono text-[10px] text-hint tracking-meta uppercase">
                Last · {nextLabel}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] gap-6 items-start">
              <Poster programId={currentProg.id} size="lg" />

              <div>
                {(() => {
                  // mockup 처럼 헤드라인을 "StrongLifts 5×5" → "StrongLifts" + italic gold "5×5" 로 분리.
                  const m = currentProg.name.match(/^(\S+)\s+(.+)$/);
                  return (
                    <h1 className="font-display text-3xl md:text-4xl leading-[1.0] tracking-tight font-normal mb-2">
                      {m ? <>{m[1]} <em className="italic text-accent-gold">{m[2]}</em></> : currentProg.name}
                    </h1>
                  );
                })()}
                <p className="font-display italic text-sm text-taupe mb-5">
                  Next — {nextLabel}
                </p>

                {nextLiftRows.length > 0 && (
                  <>
                    <div className="font-mono text-[10px] text-ink tracking-label uppercase mb-2">
                      ▸ Up next
                    </div>
                    <div className="font-mono text-[13px] border-t border-ink/15 pt-2">
                      {nextLiftRows.map(row => (
                        <div key={row.id} className="flex justify-between py-1 border-b border-ink/8 last:border-b-0">
                          <span className="text-body">{row.name}</span>
                          <span className="text-ink tabular-nums">
                            {row.weight}<span className="text-taupe"> kg</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="flex gap-3 mt-5">
                  <button
                    onClick={handleReset}
                    className="font-mono text-[11px] tracking-label uppercase px-5 py-2.5 border border-ink/20 text-taupe hover:text-ink hover:border-ink/40 transition-colors"
                  >
                    ↻ Reset
                  </button>
                  <button
                    onClick={handleResume}
                    className="flex-1 font-mono text-[11px] tracking-label uppercase px-5 py-2.5 bg-accent-red text-ink hover:bg-accent-red/90 transition-colors"
                  >
                    Continue session<span className="hidden md:inline"> →</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ====================================================
            Program library — START HERE (featured) + THE FULL LIBRARY (compact)
            ==================================================== */}
        <section className={existingProgram ? 'pt-2 border-t border-ink/15' : ''}>
          <div className="max-w-[640px] py-8">
            <div className="flex items-baseline justify-between mb-3">
              <div className="font-mono text-[11px] text-accent-red tracking-label uppercase">
                — Start here
              </div>
              <div className="font-mono text-[10px] text-hint tracking-meta uppercase">
                {PROGRAMS.length.toString().padStart(2, '0')} entries
              </div>
            </div>
            <h2 className="font-display text-4xl md:text-5xl leading-[1.0] tracking-tight font-normal">
              Choose your <em className="italic text-accent-gold">next chapter.</em>
            </h2>
            <p className="font-display italic text-sm text-taupe mt-3 leading-relaxed">
              {existingProgram
                ? '진행 중인 프로그램을 바꾸거나, 다음에 도전할 시리즈를 선택하세요.'
                : '반세기 동안 검증된 strength 프로그램 열 가지. 입문이라면 아래 첫 시리즈부터.'}
            </p>
          </div>

          {/* Featured block — START HERE */}
          {(() => {
            const v = PROGRAM_VISUAL[featuredProgram.id] || {};
            const isCurrent = existingProgram?.selectedId === featuredProgram.id;
            return (
              <button
                onClick={() => setSelectedId(featuredProgram.id)}
                className="w-full text-left grid grid-cols-1 md:grid-cols-[142px_1fr] gap-6 p-6 md:p-7 border border-accent-gold/30 bg-accent-gold/[0.05] hover:bg-accent-gold/[0.08] transition-colors mb-8"
              >
                <Poster programId={featuredProgram.id} size="featured" />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap mb-1">
                    <span className="font-display italic text-3xl leading-none text-hint">
                      {v.vol || '—'}
                    </span>
                    <span className="font-display text-3xl md:text-4xl text-ink leading-tight">
                      {featuredProgram.name}
                    </span>
                    {isCurrent && (
                      <span className="font-mono text-[9px] tracking-label uppercase text-accent-gold border border-accent-gold px-2 py-1">
                        In progress
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-taupe tracking-meta uppercase mb-3">
                    {v.author} · {v.year} · {v.level}
                  </div>
                  {v.tags && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {v.tags.map(t => (
                        <span
                          key={t}
                          className="font-mono text-[9px] text-taupe tracking-meta uppercase border border-ink/15 px-2 py-1"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="font-display italic text-[15px] text-body leading-relaxed mb-3">
                    {featuredProgram.desc}
                  </p>
                  {v.quote && (
                    <blockquote className="font-display italic text-base text-ink leading-relaxed border-l-2 border-accent-red pl-3 mb-5 m-0">
                      "{v.quote}"
                    </blockquote>
                  )}
                  <span className="inline-block font-mono text-[11px] tracking-label uppercase text-accent-red border border-accent-red px-4 py-2">
                    → Start {featuredProgram.name}
                  </span>
                </div>
              </button>
            );
          })()}

          {/* THE FULL LIBRARY — compact rows */}
          <div className="font-mono text-[11px] text-accent-red tracking-label uppercase mb-3 pt-2">
            — The full library
          </div>
          <div className="border-t border-ink/15">
            {restPrograms.map(p => {
              const v = PROGRAM_VISUAL[p.id] || {};
              const isCurrent = existingProgram?.selectedId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`grid grid-cols-[76px_1fr_auto] gap-5 py-4 border-b border-ink/8 w-full text-left transition-colors items-center ${
                    isCurrent ? 'bg-accent-gold/[0.04]' : 'hover:bg-ink/[0.03]'
                  }`}
                >
                  <Poster programId={p.id} size="compact" />

                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2.5 flex-wrap mb-1">
                      <span className="font-display italic text-lg leading-none text-hint">
                        {v.vol || '—'}
                      </span>
                      <span className="font-display text-lg text-ink leading-tight">
                        {p.name}
                      </span>
                      <span className="font-mono text-[10px] text-taupe tracking-meta uppercase">
                        · {v.level}
                      </span>
                    </div>
                    <p className="font-display italic text-[13px] text-body leading-snug line-clamp-1">
                      {p.desc}
                    </p>
                  </div>

                  <div className="self-center flex-shrink-0">
                    {isCurrent ? (
                      <span className="font-mono text-[9px] tracking-label uppercase text-accent-gold border border-accent-gold px-2 py-1 inline-block">
                        In progress
                      </span>
                    ) : (
                      <span className="font-mono text-lg text-taupe">›</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-mono text-[11px] text-hint tracking-meta">
          <span className="uppercase">— FITCOACH —</span>
          <span className="uppercase text-taupe">Program library · {PROGRAMS.length}</span>
        </div>
      </div>
      </PageSurface>

      {/* ====================================================
          Program select modal (variant + weight input)
          ==================================================== */}
      {selectedId && PROGRAM_LIFTS[selectedId] && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[88vh] flex flex-col bg-paper text-ink border border-ink/15 animate-in zoom-in-95 duration-200"
          >
            <header className="flex-shrink-0 flex items-baseline justify-between px-6 py-4 border-b border-ink/15 bg-paper">
              <div>
                <div className="font-display italic text-base text-ink leading-none">
                  {PROGRAM_META[selectedId].label}
                </div>
                {programVariant && (
                  <div className="font-mono text-[10px] text-taupe tracking-meta uppercase mt-1">
                    · {PROGRAM_VARIANTS[selectedId].find(v => v.id === programVariant)?.label}
                  </div>
                )}
              </div>
              <div className="flex items-baseline gap-4">
                {!needsVariantPick && (
                  <button
                    onClick={() => setShowCalc(true)}
                    className="font-mono text-[10px] tracking-meta uppercase text-accent-gold hover:text-ink transition-colors"
                  >
                    1RM calc
                  </button>
                )}
                <button
                  onClick={() => setSelectedId(null)}
                  className="font-mono text-[11px] tracking-meta uppercase text-taupe hover:text-ink transition-colors"
                >
                  Close ×
                </button>
              </div>
            </header>

            <div
              className="overflow-y-auto px-6 py-6 [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none' }}
            >
              {needsVariantPick ? (
                <>
                  <div className="font-mono text-[10px] text-accent-red tracking-label uppercase mb-4">
                    — Pick a variant
                  </div>
                  <div className="space-y-3">
                    {PROGRAM_VARIANTS[selectedId].map(v => (
                      <button
                        key={v.id}
                        onClick={() => setProgramVariant(v.id)}
                        className="w-full text-left border border-ink/15 hover:border-accent-red transition-colors p-5 group"
                      >
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="font-display text-xl text-ink">{v.label}</span>
                          <span className="font-mono text-[10px] text-accent-gold tracking-meta uppercase">
                            {v.tag}
                          </span>
                        </div>
                        <p className="font-display italic text-sm text-taupe leading-relaxed">
                          {v.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-mono text-[10px] text-accent-red tracking-label uppercase mb-3">
                    — 1RM entry
                  </div>
                  <p className="font-display italic text-sm text-taupe mb-5 leading-relaxed">
                    {PROGRAM_META[selectedId].note}
                  </p>

                  <div className="border border-ink/15">
                    {PROGRAM_LIFTS[selectedId].map((lift, i, arr) => (
                      <div
                        key={lift.id}
                        className={`flex items-center justify-between gap-4 px-4 py-3 ${
                          i < arr.length - 1 ? 'border-b border-ink/8' : ''
                        }`}
                      >
                        <span className="font-display text-[15px] text-ink">{lift.name}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => adjustWeight(lift.id, -2.5)}
                            className="w-7 h-7 font-mono text-base text-taupe hover:text-ink hover:bg-ink/5 transition-colors flex items-center justify-center"
                            aria-label="감소"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="0"
                            max="500"
                            step="2.5"
                            value={weights[lift.id]}
                            onChange={(e) => setWeights({ ...weights, [lift.id]: parseFloat(e.target.value) || 0 })}
                            style={{ MozAppearance: 'textfield' }}
                            className="w-16 px-2 py-1.5 text-center font-display text-accent-red tabular-nums bg-paper border border-ink/15 focus:border-accent-red outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => adjustWeight(lift.id, 2.5)}
                            className="w-7 h-7 font-mono text-base text-taupe hover:text-ink hover:bg-ink/5 transition-colors flex items-center justify-center"
                            aria-label="증가"
                          >
                            +
                          </button>
                          <span className="font-mono text-[10px] text-taupe tracking-meta ml-1">kg</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleStartProgram}
                    className="w-full mt-6 font-mono text-[11px] tracking-label uppercase py-3.5 bg-accent-red text-ink hover:bg-accent-red/90 transition-colors"
                  >
                    {existingProgram?.selectedId === selectedId ? 'Continue session →' : 'Start program →'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ====================================================
          1RM calculator modal
          ==================================================== */}
      {showCalc && createPortal(
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setShowCalc(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm max-h-[88vh] flex flex-col bg-paper text-ink border border-ink/15 animate-in zoom-in-95 duration-200"
          >
            <header className="flex-shrink-0 flex items-baseline justify-between px-6 py-4 border-b border-ink/15">
              <div>
                <div className="font-display italic text-base text-ink leading-none">1RM Calculator</div>
                <div className="font-mono text-[10px] text-taupe tracking-meta uppercase mt-1">
                  · Epley formula
                </div>
              </div>
              <button
                onClick={() => setShowCalc(false)}
                className="font-mono text-[11px] tracking-meta uppercase text-taupe hover:text-ink transition-colors"
              >
                Close ×
              </button>
            </header>

            <div
              className="overflow-y-auto px-6 py-6 [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none' }}
            >
              <p className="font-display italic text-sm text-taupe mb-5 leading-relaxed">
                실제로 들어본 무게와 반복 횟수를 입력하면 추정 1RM 을 계산합니다.
              </p>

              <div className="border border-ink/15 mb-5">
                <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-ink/8">
                  <span className="font-display text-[15px] text-ink">Weight</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCalcWeight(w => Math.max(0, w - 2.5))}
                      className="w-7 h-7 font-mono text-base text-taupe hover:text-ink hover:bg-ink/5 transition-colors flex items-center justify-center"
                      aria-label="감소"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="500"
                      step="2.5"
                      value={calcWeight}
                      onChange={(e) => setCalcWeight(parseFloat(e.target.value) || 0)}
                      style={{ MozAppearance: 'textfield' }}
                      className="w-16 px-2 py-1.5 text-center font-display text-accent-red tabular-nums bg-paper border border-ink/15 focus:border-accent-red outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCalcWeight(w => Math.min(500, w + 2.5))}
                      className="w-7 h-7 font-mono text-base text-taupe hover:text-ink hover:bg-ink/5 transition-colors flex items-center justify-center"
                      aria-label="증가"
                    >
                      +
                    </button>
                    <span className="font-mono text-[10px] text-taupe tracking-meta ml-1">kg</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="font-display text-[15px] text-ink">Reps</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCalcReps(r => Math.max(1, r - 1))}
                      className="w-7 h-7 font-mono text-base text-taupe hover:text-ink hover:bg-ink/5 transition-colors flex items-center justify-center"
                      aria-label="감소"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      step="1"
                      value={calcReps}
                      onChange={(e) => setCalcReps(parseInt(e.target.value) || 1)}
                      style={{ MozAppearance: 'textfield' }}
                      className="w-16 px-2 py-1.5 text-center font-display text-accent-red tabular-nums bg-paper border border-ink/15 focus:border-accent-red outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCalcReps(r => Math.min(20, r + 1))}
                      className="w-7 h-7 font-mono text-base text-taupe hover:text-ink hover:bg-ink/5 transition-colors flex items-center justify-center"
                      aria-label="증가"
                    >
                      +
                    </button>
                    <span className="font-mono text-[10px] text-taupe tracking-meta ml-1">reps</span>
                  </div>
                </div>
              </div>

              <div className="border-y border-accent-gold/40 py-5 my-5 text-center bg-accent-gold/[0.04]">
                <div className="font-mono text-[10px] text-accent-gold tracking-label uppercase mb-2">
                  — Estimated 1RM
                </div>
                <div className="font-display text-5xl text-ink leading-none tabular-nums">
                  {estimated1RM.toFixed(1)}
                  <span className="font-display italic text-base text-taupe ml-1">kg</span>
                </div>
                <p className="font-display italic text-[11px] text-hint mt-3">
                  Weight × (1 + reps / 30)
                </p>
              </div>

              <div className="font-mono text-[10px] text-taupe tracking-label uppercase mb-2">
                — Apply to
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={applyTarget}
                  onChange={(e) => setApplyTarget(e.target.value)}
                  className="flex-1 px-3 py-2.5 font-display text-sm text-ink bg-paper border border-ink/15 focus:border-accent-red outline-none"
                >
                  {(selectedId && PROGRAM_LIFTS[selectedId] ? PROGRAM_LIFTS[selectedId] : []).map(lift => (
                    <option key={lift.id} value={lift.id} className="bg-paper">
                      {lift.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={applyEstimate}
                  disabled={estimated1RM <= 0}
                  className="font-mono text-[11px] tracking-label uppercase px-4 py-2.5 bg-accent-red text-ink hover:bg-accent-red/90 disabled:bg-ink/10 disabled:text-hint transition-colors"
                >
                  Apply
                </button>
              </div>
              <p className="font-display italic text-[11px] text-hint mt-2 leading-relaxed">
                적용 시 2.5kg 단위로 반올림되어 1RM 입력란에 반영됩니다.
              </p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default RoutinePlanPage;
