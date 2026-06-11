import React, { useState } from 'react';
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis } from 'recharts';
import { Loader2 } from 'lucide-react';

/**
 * FeedbackDetail — AI 자세 분석 결과 매거진 리포트 (Editorial Magazine 톤).
 *
 * /formcheck/:exId 의 분석 종료 후 RoutinePlayPage 내부에 렌더된다.
 * Page wrapper 는 부모(RoutinePlayPage)에서 PageSurface 로 감싸므로 여기는
 * 내부 콘텐츠 영역만 담당.
 */

const CATEGORIES = [
  { key: 'Stability', label: '안정성' },
  { key: 'ROM', label: '가동범위' },
  { key: 'Movement Quality', label: '동작 품질' },
  { key: 'Posture', label: '자세' },
  { key: 'Core', label: '코어' },
];

const verdictOf = (score) => {
  if (score >= 85) return { tag: 'Excellent', cls: 'text-accent-gold' };
  if (score >= 70) return { tag: 'Solid',     cls: 'text-ink' };
  if (score >= 50) return { tag: 'Needs work', cls: 'text-body' };
  return { tag: 'Critical', cls: 'text-accent-red' };
};

const FeedbackDetail = ({ result, exerciseName, onReset, onSaveToJournal }) => {
  const [openCat, setOpenCat] = useState(null);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[25rem] text-taupe gap-3">
        <Loader2 className="animate-spin" size={20} />
        <p className="font-mono text-[0.6875rem] tracking-meta uppercase">Loading report…</p>
      </div>
    );
  }

  // 운동-종류 불일치 — 점수를 주지 않고 명확히 거절
  if (result.exercise_match === false) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="pb-6">
          <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase mb-3">
            — Mismatch detected
          </div>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.0] tracking-tight font-normal">
            이 영상은 <em className="italic text-accent-gold">{exerciseName}</em><br />
            동작으로 보이지 않습니다.
          </h1>
          <p className="font-display italic text-[0.9375rem] text-body leading-relaxed border-l-2 border-accent-red pl-3 mt-5 m-0">
            "선택한 운동과 영상 속 자세가 일치하지 않아 정확한 분석을 진행하지 않았습니다.
            올바른 운동을 선택했는지, 전신이 화면에 들어오는지 확인해 주세요."
          </p>
        </header>
        <section className="border-t border-ink/15 pt-6 mt-2">
          <button
            onClick={onReset}
            className="font-mono text-[0.6875rem] tracking-label uppercase px-5 py-3 border border-accent-red text-accent-red hover:bg-accent-red hover:text-ink transition-colors"
          >
            ↻ 다시 분석하기
          </button>
        </section>
        <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-mono text-[0.6875rem] text-hint tracking-meta">
          <span className="uppercase">— FITCOACH —</span>
          <span className="uppercase text-taupe">Form analysis · {exerciseName}</span>
        </div>
      </div>
    );
  }

  // 분석 서비스 일시 오류 (사이드카 연결 실패 등)
  if (result.analysis_error) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="pb-6">
          <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase mb-3">
            — Analysis unavailable
          </div>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.0] tracking-tight font-normal">
            분석을 <em className="italic text-accent-gold">완료하지 못했습니다.</em>
          </h1>
          <p className="font-display italic text-[0.9375rem] text-body leading-relaxed border-l-2 border-accent-red pl-3 mt-5 m-0">
            "{result.overall || '분석 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'}"
          </p>
        </header>
        <section className="border-t border-ink/15 pt-6 mt-2">
          <button onClick={onReset} className="font-mono text-[0.6875rem] tracking-label uppercase px-5 py-3 border border-accent-red text-accent-red hover:bg-accent-red hover:text-ink transition-colors">
            ↻ 다시 시도
          </button>
        </section>
      </div>
    );
  }

  // 모델 미지원 운동 — 정밀 분석 준비 중 (가짜 점수 대신 정직하게 안내)
  if (result.exercise_supported === false) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="pb-6">
          <div className="font-mono text-[0.6875rem] text-accent-gold tracking-label uppercase mb-3">
            — Coming soon
          </div>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.0] tracking-tight font-normal">
            <em className="italic text-accent-gold">{exerciseName}</em> 정밀 분석은<br />
            준비 중입니다.
          </h1>
          <p className="font-display italic text-[0.9375rem] text-body leading-relaxed border-l-2 border-accent-gold pl-3 mt-5 m-0">
            "현재 스쿼트·벤치프레스·데드리프트(및 그 변형)에 대해 AI 자세 분석을 제공합니다.
            이 운동은 곧 추가될 예정입니다."
          </p>
        </header>
        <section className="border-t border-ink/15 pt-6 mt-2">
          <button onClick={onReset} className="font-mono text-[0.6875rem] tracking-label uppercase px-5 py-3 border border-ink/20 text-taupe hover:text-ink hover:border-ink/40 transition-colors">
            ↻ 다른 운동 분석
          </button>
        </section>
        <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-mono text-[0.6875rem] text-hint tracking-meta">
          <span className="uppercase">— FITCOACH —</span>
          <span className="uppercase text-taupe">Form analysis · {exerciseName}</span>
        </div>
      </div>
    );
  }

  const score = result.score || 0;
  const verdict = verdictOf(score);

  // 모델이 실제로 평가한 카테고리만 표시 (측정 안 한 항목을 0점으로 보여주지 않음)
  const shownCats = CATEGORIES.filter((c) => result.cat_scores?.[c.key] != null);
  const showRadar = shownCats.length >= 3; // 2개 이하면 레이더가 선처럼 찌그러지므로 막대만
  const radarData = shownCats.map((c) => ({
    subject: c.label,
    A: result.cat_scores[c.key],
  }));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Headline */}
      <header className="pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
            — Entry · Form analysis
            {result.approx && <span className="text-taupe normal-case tracking-normal"> · 근사 분석</span>}
          </div>
          <div className={`font-mono text-[0.625rem] tracking-label uppercase ${verdict.cls}`}>
            {verdict.tag}
          </div>
        </div>

        <h1 className="font-display text-4xl md:text-5xl leading-[1.0] tracking-tight font-normal">
          {exerciseName}, <em className="italic text-accent-gold">analyzed.</em>
        </h1>

        {result.overall && (
          <blockquote className="font-display italic text-[0.9375rem] text-body leading-relaxed border-l-2 border-accent-red pl-3 mt-4 m-0">
            "{result.overall}"
          </blockquote>
        )}
      </header>

      {/* Score + Radar */}
      <section className={`border-t border-ink/15 py-6 ${showRadar ? 'grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-6 md:gap-8' : ''}`}>

        {/* Score */}
        <div>
          <div className="font-mono text-[0.625rem] text-taupe tracking-label uppercase mb-3">
            — Score
          </div>
          <div className="flex items-baseline gap-3">
            <div className="font-display text-7xl md:text-8xl text-ink leading-none tabular-nums">
              {score}
            </div>
            <div className="font-display italic text-base text-taupe">
              / 100 pts
            </div>
          </div>

          {/* Mini bar */}
          <div className="mt-5 h-0.5 w-full bg-ink/10 overflow-hidden">
            <div
              className="h-full bg-accent-red transition-all duration-700"
              style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
            />
          </div>

          {/* Per-category mini rows — 모델이 평가한 항목만 */}
          <div className="border-t border-ink/12 mt-5 pt-1">
            {shownCats.map((c, i, arr) => {
              const v = result.cat_scores?.[c.key];
              return (
                <div
                  key={c.key}
                  className={`flex justify-between items-baseline py-1.5 ${
                    i < arr.length - 1 ? 'border-b border-ink/8' : ''
                  }`}
                >
                  <span className="font-mono text-[0.625rem] text-taupe tracking-meta uppercase">
                    {c.key}
                  </span>
                  <span className="font-display italic text-base tabular-nums text-ink">
                    {v != null ? v : <span className="text-hint">—</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Radar — 평가 카테고리가 3개 이상일 때만 (2개 이하면 찌그러져서 생략) */}
        {showRadar && (
        <div className="md:border-l md:border-ink/12 md:pl-8">
          <div className="font-mono text-[0.625rem] text-accent-gold tracking-label uppercase mb-3">
            — Performance chart
          </div>
          <div className="w-full h-[18.75rem] md:h-[21.25rem]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 12, right: 30, bottom: 12, left: 30 }}>
                <PolarGrid stroke="rgba(240, 232, 216, 0.12)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: '#aaa098', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                />
                <Radar
                  name="Score"
                  dataKey="A"
                  stroke="#c43c2f"
                  fill="#c43c2f"
                  fillOpacity={0.28}
                  strokeWidth={1.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}
      </section>

      {/* Diagnosis details */}
      {result.cat_details && Object.keys(result.cat_details).length > 0 && (
        <section className="border-t border-ink/15 py-6">
          <div className="flex items-baseline justify-between mb-4">
            <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
              — Detailed diagnosis
            </div>
            <div className="font-mono text-[0.5625rem] text-hint tracking-meta uppercase">
              {Object.keys(result.cat_details).length.toString().padStart(2, '0')} notes
            </div>
          </div>

          <div className="border-t border-ink/12">
            {Object.entries(result.cat_details).map(([cat, msg]) => {
              const catScore = result.cat_scores?.[cat];
              const tag = catScore != null ? verdictOf(catScore).tag : '—';
              const tagCls = catScore != null ? verdictOf(catScore).cls : 'text-hint';
              const frame = result.error_frames?.[cat];
              const hasFrame = !!frame?.image;
              const open = openCat === cat;
              return (
                <article key={cat} className="border-b border-ink/8 last:border-b-0">
                  <div
                    className={`grid grid-cols-1 md:grid-cols-[11.25rem_1fr] gap-3 md:gap-6 py-4 ${
                      hasFrame ? 'cursor-pointer group' : ''
                    }`}
                    onClick={hasFrame ? () => setOpenCat(open ? null : cat) : undefined}
                  >
                    <div>
                      <div className="font-mono text-[0.625rem] text-taupe tracking-label uppercase">
                        {cat}
                      </div>
                      <div className={`font-mono text-[0.5625rem] tracking-meta uppercase mt-1 ${tagCls}`}>
                        · {tag}
                        {catScore != null && (
                          <span className="text-hint normal-case tracking-normal"> ({catScore})</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="font-display italic text-[0.9375rem] text-body leading-relaxed m-0">
                        "{msg}"
                      </p>
                      {hasFrame && (
                        <div className="font-mono text-[0.5625rem] text-accent-red tracking-meta uppercase mt-2 group-hover:text-ink transition-colors">
                          {open ? '▾ Hide captured frame' : '▸ View captured frame'}
                        </div>
                      )}
                    </div>
                  </div>

                  {hasFrame && open && (
                    <figure className="m-0 pb-5 md:pl-[12.75rem] animate-in fade-in slide-in-from-top-1 duration-300">
                      <div className="border border-accent-red/30 bg-black overflow-hidden flex justify-center">
                        <img
                          src={frame.image}
                          alt={`${cat} — 문제 순간`}
                          className="max-h-[50vh] w-auto max-w-full object-contain"
                        />
                      </div>
                      <figcaption className="font-display italic text-xs text-taupe mt-2 leading-relaxed">
                        이 운동에서 해당 문제가 가장 두드러진 순간을 포착한 프레임입니다.
                      </figcaption>
                    </figure>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="border-t border-ink/15 pt-6 mt-2 flex flex-col md:flex-row gap-3">
        <button
          onClick={onReset}
          className="font-mono text-[0.6875rem] tracking-label uppercase px-5 py-3 border border-ink/20 text-taupe hover:text-ink hover:border-ink/40 transition-colors"
        >
          ↻ Analyze another
        </button>
        {onSaveToJournal && (
          <button
            onClick={onSaveToJournal}
            className="flex-1 font-mono text-[0.6875rem] tracking-label uppercase px-5 py-3 bg-accent-red text-ink hover:bg-accent-red/90 transition-colors"
          >
            → Save report to journal
          </button>
        )}
      </section>

      {/* Footer */}
      <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-mono text-[0.6875rem] text-hint tracking-meta">
        <span className="uppercase">— FITCOACH —</span>
        <span className="uppercase text-taupe">Form analysis · {exerciseName}</span>
      </div>
    </div>
  );
};

export default FeedbackDetail;
