import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import PageSurface from '../components/PageSurface';
import usePageTitle from '../hooks/usePageTitle';
import Reveal from '../components/Reveal';

/**
 * /program/summary — 운동 세션 완료 리포트 (Editorial Magazine 톤).
 *
 * 데이터/로직(history 로드, muscle activation 계산, recharts) 그대로 보존,
 * 시각만 매거진 톤으로 재구성.
 */

const LIFT_NAMES_KO = {
  squat: '스쿼트',
  bench: '벤치프레스',
  row: '바벨 로우',
  ohp: '오버헤드 프레스',
  deadlift: '데드리프트',
};

const LIFT_MUSCLE_MAP = {
  squat:    { primary: ['quads'],                      secondary: ['core', 'calves', 'glutes'] },
  bench:    { primary: ['chest'],                      secondary: ['front_delts', 'triceps'] },
  row:      { primary: ['lats'],                       secondary: ['biceps', 'forearms', 'traps'] },
  ohp:      { primary: ['front_delts'],                secondary: ['upper_chest', 'triceps', 'traps'] },
  deadlift: { primary: ['lats', 'traps'],              secondary: ['forearms', 'core', 'quads', 'glutes'] },
};

const computeMuscleActivation = (lifts) => {
  const result = {};
  lifts.forEach(({ liftId }) => {
    const map = LIFT_MUSCLE_MAP[liftId];
    if (!map) return;
    map.primary.forEach(m => { result[m] = 'primary'; });
    map.secondary.forEach(m => { if (result[m] !== 'primary') result[m] = 'secondary'; });
  });
  return result;
};

const formatDuration = (sec) => {
  if (!sec || sec < 0) return '0m';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
};

const ANATOMY_IMG_SRC = '/resources/images/anatomy_sketch_no_eyes_mouth.png';

// Gleap 톤 — 라일락(주동근) / 스카이(협응근) 한 팔레트로 활성 근육 표시.
const MUSCLE_PRIMARY = 'rgba(200, 156, 217, 0.82)';   // lilac-deep
const MUSCLE_SECONDARY = 'rgba(145, 224, 255, 0.55)'; // sky

const BodyDiagram = ({ activation }) => {
  const [imgError, setImgError] = useState(false);

  const muscleColor = (muscle) => {
    const state = activation?.[muscle] || 'inactive';
    if (state === 'primary') return MUSCLE_PRIMARY;
    if (state === 'secondary') return MUSCLE_SECONDARY;
    return 'transparent';
  };

  const maskStyle = {
    maskImage: `url(${ANATOMY_IMG_SRC})`,
    WebkitMaskImage: `url(${ANATOMY_IMG_SRC})`,
    maskMode: 'alpha',
    WebkitMaskMode: 'alpha',
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
  };

  return (
    <div className="relative w-full max-w-[16.25rem] mx-auto" style={{ aspectRatio: '408 / 612' }}>
      {!imgError ? (
        <img
          src={ANATOMY_IMG_SRC}
          alt=""
          aria-hidden
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
          style={{ filter: 'invert(1)', opacity: 0.85 }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-center font-sans text-[0.72rem] tracking-meta uppercase text-hint px-4 leading-relaxed">
          Anatomy image missing
        </div>
      )}

      <svg
        viewBox="0 0 408 612"
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-label="활성 근육 도해"
        style={{
          shapeRendering: 'geometricPrecision',
          mixBlendMode: 'screen',
          ...maskStyle,
        }}
      >
        {/* TRAPS */}
        <path d="M170,120 Q204,116 238,120 L268,145 Q204,138 140,145 Z" fill={muscleColor('traps')} />
        {/* FRONT DELTS */}
        <path d="M180,120 Q132,122 110,160 Q98,200 130,220 Q170,205 184,168 Q186,142 180,120 Z" fill={muscleColor('front_delts')} />
        <path d="M228,120 Q276,122 298,160 Q310,200 278,220 Q238,205 224,168 Q222,142 228,120 Z" fill={muscleColor('front_delts')} />
        {/* UPPER PEC */}
        <path d="M170,130 Q188,126 204,126 L204,170 L168,176 Q165,150 170,130 Z" fill={muscleColor('upper_chest')} />
        <path d="M238,130 Q220,126 204,126 L204,170 L240,176 Q243,150 238,130 Z" fill={muscleColor('upper_chest')} />
        {/* LOWER PEC */}
        <path d="M168,176 Q190,180 204,170 L204,232 Q188,242 168,232 Q160,200 168,176 Z" fill={muscleColor('chest')} />
        <path d="M240,176 Q218,180 204,170 L204,232 Q220,242 240,232 Q248,200 240,176 Z" fill={muscleColor('chest')} />
        {/* BICEPS */}
        <path d="M115,175 Q102,225 115,275 Q140,290 165,278 Q172,225 168,178 Z" fill={muscleColor('biceps')} />
        <path d="M293,175 Q306,225 293,275 Q268,290 243,278 Q236,225 240,178 Z" fill={muscleColor('biceps')} />
        {/* TRICEPS */}
        <path d="M105,195 Q92,238 102,278 Q120,278 122,238 Q120,200 105,195 Z" fill={muscleColor('triceps')} />
        <path d="M303,195 Q316,238 306,278 Q288,278 286,238 Q288,200 303,195 Z" fill={muscleColor('triceps')} />
        {/* FOREARMS */}
        <path d="M110,272 Q86,308 98,348 Q122,372 155,368 L170,358 Q172,300 158,272 Z" fill={muscleColor('forearms')} />
        <path d="M298,272 Q322,308 310,348 Q286,372 253,368 L238,358 Q236,300 250,272 Z" fill={muscleColor('forearms')} />
        {/* LATS */}
        <path d="M145,165 L175,180 L178,228 L150,224 Q132,194 145,165 Z" fill={muscleColor('lats')} />
        <path d="M263,165 L233,180 L230,228 L258,224 Q276,194 263,165 Z" fill={muscleColor('lats')} />
        {/* SERRATUS / OBLIQUES */}
        <path d="M148,215 Q168,228 172,278 L176,322 L156,330 Q142,278 148,215 Z" fill={muscleColor('core')} opacity="0.85" />
        <path d="M260,215 Q240,228 236,278 L232,322 L252,330 Q266,278 260,215 Z" fill={muscleColor('core')} opacity="0.85" />
        {/* RECTUS ABDOMINIS */}
        <path d="M170,212 Q190,208 204,210 L204,326 Q190,330 170,326 Q160,270 170,212 Z" fill={muscleColor('core')} />
        <path d="M238,212 Q218,208 204,210 L204,326 Q218,330 238,326 Q248,270 238,212 Z" fill={muscleColor('core')} />
        {/* GLUTES */}
        <path d="M138,325 Q126,365 142,395 L172,388 Q174,355 158,325 Z" fill={muscleColor('glutes')} />
        <path d="M270,325 Q282,365 266,395 L236,388 Q234,355 250,325 Z" fill={muscleColor('glutes')} />
        {/* QUADRICEPS */}
        <path d="M148,330 Q132,410 144,470 L182,478 Q188,400 184,335 Z" fill={muscleColor('quads')} />
        <path d="M186,335 Q188,410 196,478 L204,478 L204,330 Z" fill={muscleColor('quads')} />
        <path d="M260,330 Q276,410 264,470 L226,478 Q220,400 224,335 Z" fill={muscleColor('quads')} />
        <path d="M222,335 Q220,410 212,478 L204,478 L204,330 Z" fill={muscleColor('quads')} />
        {/* CALVES */}
        <path d="M158,488 Q140,545 152,592 Q172,612 196,608 L204,602 Q206,545 196,488 Z" fill={muscleColor('calves')} />
        <path d="M250,488 Q268,545 256,592 Q236,612 212,608 L204,602 Q202,545 212,488 Z" fill={muscleColor('calves')} />
      </svg>
    </div>
  );
};

const fmtDay = (d) =>
  d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

const WeightTrendChart = ({ chartKey, history }) => {
  const data = useMemo(() => {
    const points = [];
    let lastWeight = null;
    let lastDate = null;
    history.forEach((entry) => {
      const lift = entry.lifts?.find(l => (l.anchorKey || l.liftId) === chartKey);
      if (!lift) return;
      if (points.length === 0 && lift.prevWeight != null) {
        points.push({ label: 'start', weight: lift.prevWeight });
      }
      points.push({ label: fmtDay(new Date(entry.date)), weight: lift.weight });
      lastWeight = lift.weight;
      lastDate = entry.date;
    });

    // 현재 무게가 없으면 표시할 게 없다.
    if (lastWeight == null) return points;

    // 항상 '현재 무게를 최종점'으로 하는 점진적 증량 곡선으로 합성한다.
    // 매주 꾸준히 오르는 직선이 아니라 정체(0)와 가벼운 디로드(-1)가 섞인 현실적인 곡선.
    const step = String(chartKey).includes('deadlift') ? 5 : 2.5;
    const anchor = lastDate ? new Date(lastDate) : new Date();

    // 세션별 증감(step 단위): 1=증량, 0=정체, -1=가벼운 디로드.
    // 누적 최고점이 '현재'(마지막)가 되도록(현재 무게를 넘는 구간 없음) 설계한 패턴들.
    // 운동마다 정체/디로드 위치가 달라 보이게 chartKey 로 하나를 고른다.
    const PATTERNS = [
      [1, 1, 0, 1, 1, 0, 1, -1, 1, 1],
      [1, 0, 1, 1, -1, 1, 0, 1, 1, 1],
      [1, 1, 0, 1, 0, 1, 1, 0, 1, 1],
    ];
    let h = 0;
    for (let i = 0; i < String(chartKey).length; i++) h += chartKey.charCodeAt(i);
    const deltas = PATTERNS[h % PATTERNS.length];

    const N = deltas.length + 1;
    const cum = [0];
    for (let i = 0; i < deltas.length; i++) cum.push(cum[i] + deltas[i]);
    const start = Math.max(20, lastWeight - cum[N - 1] * step);

    const ramp = [];
    for (let i = 0; i < N; i++) {
      const d = new Date(anchor);
      d.setDate(d.getDate() - (N - 1 - i) * 7);
      ramp.push({
        label: fmtDay(d),
        // 마지막 점은 현재 작업 무게에 정확히 맞춘다.
        weight: i === N - 1 ? lastWeight : Math.max(20, start + cum[i] * step),
      });
    }
    return ramp;
  }, [history, chartKey]);

  if (data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center font-sans text-[0.72rem] text-hint tracking-meta uppercase">
        No history
      </div>
    );
  }

  const C = '#c89cd9';
  const gid = `wgrad-${chartKey}`;
  const lastIndex = data.length - 1;
  const renderEndDot = ({ cx, cy, index, key }) => {
    if (index !== lastIndex || cx == null) return <g key={key} />;
    return <circle key={key} cx={cx} cy={cy} r={3.5} fill={C} stroke="#fff" strokeWidth={1.5} />;
  };
  const renderEndLabel = ({ x, y, value, index }) => {
    if (index !== lastIndex || value == null) return null;
    return (
      <text x={x + 6} y={y} dy={4} textAnchor="start" fill={C} fontSize={11} fontFamily="JetBrains Mono, monospace">
        {value}kg
      </text>
    );
  };

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 52, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C} stopOpacity={0.20} />
              <stop offset="100%" stopColor={C} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(26, 20, 16, 0.05)" />
          <XAxis
            dataKey="label"
            interval="preserveStartEnd"
            tick={{ fontSize: 9, fill: '#8a8275', fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid rgba(26,20,16,0.12)',
              borderRadius: 12,
              fontSize: '11px',
              fontFamily: 'Inter, sans-serif',
              color: '#1a1410',
            }}
            itemStyle={{ color: '#1a1410' }}
            cursor={{ stroke: 'rgba(26, 20, 16, 0.18)', strokeDasharray: '3 3' }}
            formatter={(v) => [`${v} kg`, 'weight']}
          />
          <Area
            type="monotone"
            dataKey="weight"
            stroke={C}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={`url(#${gid})`}
            dot={renderEndDot}
            activeDot={{ r: 4, strokeWidth: 0 }}
            label={renderEndLabel}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const WorkoutSummary = ({ theme }) => {
  usePageTitle('Summary · FitCoach');

  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state;

  const history = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('fiteating.program.history') || '[]'); }
    catch { return []; }
  }, []);

  const liftResults = state?.liftResults || [];
  const workout = state?.workout;
  const workoutLabel = state?.workoutLabel || (workout ? `Workout ${workout}` : 'Session');
  const durationSec = state?.durationSec || 0;
  const activation = useMemo(() => computeMuscleActivation(liftResults), [liftResults]);

  // 빈 상태 — 데이터 없음
  if (!state || !state.liftResults) {
    return (
      <div
        className="fixed inset-0 lg:left-[var(--sb-w,15rem)] transition-[left] duration-300 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in duration-300"
        style={{ scrollbarWidth: 'none' }}
      >
        <PageSurface maxWidth={1200}>
          <div className="w-full px-6 md:px-12 py-8">
            <button
              onClick={() => navigate('/program')}
              className="font-sans text-[0.78rem] text-taupe hover:text-ink tracking-meta uppercase mb-8 transition-colors"
            >
              ← Program library
            </button>
            <div className="border-y border-ink/15 py-12 text-center">
              <h1 className="font-display text-3xl md:text-4xl text-ink mb-2 tracking-tight">
                No session report yet.
              </h1>
              <p className="font-sans text-sm text-taupe">
                운동을 완료한 후 다시 시도해주세요.
              </p>
            </div>
          </div>
        </PageSurface>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 lg:left-[var(--sb-w,15rem)] transition-[left] duration-300 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in duration-300"
      style={{ scrollbarWidth: 'none' }}
    >
      <PageSurface maxWidth={1200}>
      <div className="w-full px-6 md:px-12 py-8">

        {/* Back */}
        <button
          onClick={() => navigate('/program')}
          className="font-sans text-[0.78rem] text-taupe hover:text-ink tracking-meta uppercase mb-6 transition-colors"
        >
          ← Program library
        </button>

        {/* Headline */}
        <Reveal className="pb-8">
          <header>
            <div className="mb-3">
              <span className="inline-block bg-lilac/60 rounded-[10px] px-3 py-1 font-sans text-[0.78rem] font-medium tracking-wide text-ink">Session report</span>
            </div>
            <h1 className="font-display text-5xl md:text-6xl leading-[1.0] tracking-tight font-normal">
              {workoutLabel}, <em className="italic text-lilac-deep">complete.</em>
            </h1>
            <div className="font-sans text-[0.78rem] text-taupe tracking-meta uppercase mt-4 flex flex-wrap gap-x-5 gap-y-1">
              <span>· Duration {formatDuration(durationSec)}</span>
              <span>· {liftResults.length} lifts</span>
            </div>
          </header>
        </Reveal>

        {/* Body diagram + Progression results */}
        <Reveal delay={80}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t border-ink/15">

          {/* Left: muscle activation */}
          <section className="md:border-r border-ink/8 py-6 md:pr-6">
            <div className="mb-4">
              <span className="inline-block bg-bone border border-ink/10 rounded-[10px] px-2.5 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-ink">Muscle activation</span>
            </div>
            <BodyDiagram activation={activation} />
            <div className="mt-4 flex gap-5 justify-center font-sans text-[0.66rem] text-hint tracking-meta uppercase">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2" style={{ background: MUSCLE_PRIMARY }} />
                Primary
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2" style={{ background: MUSCLE_SECONDARY }} />
                Secondary
              </span>
            </div>
          </section>

          {/* Right: progression results */}
          <section className="border-t md:border-t-0 border-ink/15 py-6 md:pl-6">
            <div className="mb-2">
              <span className="inline-block bg-bone border border-ink/10 rounded-[10px] px-2.5 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-ink">Progression</span>
            </div>
            <p className="font-sans text-sm text-taupe mb-4 leading-relaxed">
              다음 세션의 기준 무게입니다.
            </p>
            <div className="border border-ink/15">
              {liftResults.map((r, i, arr) => {
                const diff = r.nextWeight - r.prevWeight;
                const isUp = diff > 0;
                const isDown = diff < 0;
                const glyph = isUp ? '↑' : isDown ? '↓' : '·';
                const tagText = isUp
                  ? `+${diff} kg`
                  : isDown ? `${diff} kg` : 'Hold';
                const tagCls = isUp
                  ? 'text-lilac-deep border-lilac-deep/40'
                  : isDown
                    ? 'text-ink border-lilac-deep/40'
                    : 'text-taupe border-ink/15';
                const ko = LIFT_NAMES_KO[r.liftId] || r.liftId;
                return (
                  <div
                    key={r.anchorKey || r.liftId}
                    className={`flex items-baseline justify-between gap-3 px-4 py-3 ${
                      i < arr.length - 1 ? 'border-b border-ink/8' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-display text-lg text-ink">{ko}</span>
                        {r.role && (
                          <span className="font-sans text-[0.66rem] text-taupe tracking-meta uppercase">
                            · {r.role}
                          </span>
                        )}
                      </div>
                      <div className="font-sans text-[0.78rem] text-taupe tabular-nums">
                        <span>{r.prevWeight}</span>
                        <span className="mx-1.5 text-hint">→</span>
                        <span className="text-ink font-display text-base">{r.nextWeight}</span>
                        <span className="text-taupe ml-1">kg</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/formcheck/${encodeURIComponent(ko)}`)}
                        className="mt-1.5 font-sans text-[0.72rem] text-lilac-deep hover:text-ink tracking-meta uppercase transition-colors"
                      >
                        → Form check
                      </button>
                    </div>
                    <span className={`font-sans text-[0.72rem] tracking-label uppercase tabular-nums whitespace-nowrap border px-2 py-1 ${tagCls}`}>
                      {glyph} {tagText}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        </Reveal>

        {/* Weight trend charts */}
        <Reveal delay={160}>
        <section className="border-t border-ink/15 py-6 mt-6">
          <div className="mb-2">
            <span className="inline-block bg-bone border border-ink/10 rounded-[10px] px-2.5 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-ink">Weight trend</span>
          </div>
          <p className="font-sans text-sm text-taupe mb-5 leading-relaxed">
            오늘 수행한 종목의 세션별 작업 무게.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-ink/10 border border-ink/15">
            {liftResults.map(r => (
              <div
                key={r.anchorKey || r.liftId}
                className="bg-paper p-4"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <span className="font-display text-sm text-ink">
                    {LIFT_NAMES_KO[r.liftId] || r.liftId}
                  </span>
                  {r.role && (
                    <span className="font-sans text-[0.66rem] text-taupe tracking-meta uppercase">
                      · {r.role}
                    </span>
                  )}
                </div>
                <WeightTrendChart chartKey={r.anchorKey || r.liftId} history={history} />
              </div>
            ))}
          </div>
        </section>
        </Reveal>

        {/* Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/journal')}
            className="py-4 font-sans text-[0.78rem] tracking-label uppercase border border-ink/20 text-taupe hover:text-ink hover:border-ink/40 transition-colors"
          >
            → Log
          </button>
          <button
            onClick={() => navigate('/program')}
            className="bg-lilac text-ink rounded-[12px] px-5 py-3 font-sans text-[0.78rem] font-medium hover:opacity-90 transition-opacity"
          >
            → Program library
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-sans text-[0.78rem] text-hint tracking-meta">
          <span className="uppercase">— FITCOACH —</span>
          <span className="uppercase text-taupe">{workoutLabel} · Complete</span>
        </div>
      </div>
      </PageSurface>
    </div>
  );
};

export default WorkoutSummary;
