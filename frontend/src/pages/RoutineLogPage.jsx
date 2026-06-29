import React, { useState } from 'react';
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import Reveal from '../components/Reveal';

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
  if (score >= 85) return { tag: 'Excellent', cls: 'text-lilac-deep' };
  if (score >= 70) return { tag: 'Solid',     cls: 'text-ink' };
  if (score >= 50) return { tag: 'Needs work', cls: 'text-taupe' };
  return { tag: 'Critical', cls: 'text-ink' };
};

const FeedbackDetail = ({ result, exerciseName, onReset, onSaveToJournal }) => {
  const [openCat, setOpenCat] = useState(null);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[25rem] text-taupe gap-3">
        <Loader2 className="animate-spin" size={20} />
        <p className="font-sans text-[0.6875rem] tracking-meta uppercase">Loading report…</p>
      </div>
    );
  }

  // 운동-종류 불일치 — 점수를 주지 않고 명확히 거절
  if (result.exercise_match === false) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Reveal className="pb-8">
          <div className="mb-3"><span className="inline-block bg-lilac/60 rounded-[10px] px-3 py-1 font-sans text-[0.78rem] font-medium tracking-wide text-ink">Mismatch detected</span></div>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.0] tracking-tight font-normal">
            이 영상은 <em className="text-lilac-deep">{exerciseName}</em><br />
            동작으로 보이지 않습니다.
          </h1>
          <p className="font-sans text-[0.9375rem] text-taupe leading-relaxed border-l-2 border-lilac pl-3 mt-5 m-0">
            "선택한 운동과 영상 속 자세가 일치하지 않아 정확한 분석을 진행하지 않았습니다.
            올바른 운동을 선택했는지, 전신이 화면에 들어오는지 확인해 주세요."
          </p>
        </Reveal>
        <section className="border-t border-ink/10 pt-6 mt-2">
          <button
            onClick={onReset}
            className="bg-lilac text-ink rounded-[12px] px-5 py-3 font-sans text-[0.78rem] font-medium hover:opacity-90 transition-opacity"
          >
            ↻ 다시 분석하기
          </button>
        </section>
        <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/10 font-sans text-[0.6875rem] text-hint tracking-meta">
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
        <Reveal className="pb-8">
          <div className="mb-3"><span className="inline-block bg-lilac/60 rounded-[10px] px-3 py-1 font-sans text-[0.78rem] font-medium tracking-wide text-ink">Analysis unavailable</span></div>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.0] tracking-tight font-normal">
            분석을 <em className="text-lilac-deep">완료하지 못했습니다.</em>
          </h1>
          <p className="font-sans text-[0.9375rem] text-taupe leading-relaxed border-l-2 border-lilac pl-3 mt-5 m-0">
            "{result.overall || '분석 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'}"
          </p>
        </Reveal>
        <section className="border-t border-ink/10 pt-6 mt-2">
          <button onClick={onReset} className="bg-lilac text-ink rounded-[12px] px-5 py-3 font-sans text-[0.78rem] font-medium hover:opacity-90 transition-opacity">
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
        <Reveal className="pb-8">
          <div className="mb-3"><span className="inline-block bg-lilac/60 rounded-[10px] px-3 py-1 font-sans text-[0.78rem] font-medium tracking-wide text-ink">Coming soon</span></div>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.0] tracking-tight font-normal">
            <em className="text-lilac-deep">{exerciseName}</em> 정밀 분석은<br />
            준비 중입니다.
          </h1>
          <p className="font-sans text-[0.9375rem] text-taupe leading-relaxed border-l-2 border-lilac pl-3 mt-5 m-0">
            "현재 스쿼트·벤치프레스·데드리프트(및 그 변형)에 대해 AI 자세 분석을 제공합니다.
            이 운동은 곧 추가될 예정입니다."
          </p>
        </Reveal>
        <section className="border-t border-ink/10 pt-6 mt-2">
          <button onClick={onReset} className="bg-lilac text-ink rounded-[12px] px-5 py-3 font-sans text-[0.78rem] font-medium hover:opacity-90 transition-opacity">
            ↻ 다른 운동 분석
          </button>
        </section>
        <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/10 font-sans text-[0.6875rem] text-hint tracking-meta">
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
      <Reveal className="pb-8">
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-block bg-lilac/60 rounded-[10px] px-3 py-1 font-sans text-[0.78rem] font-medium tracking-wide text-ink">
              Entry · Form analysis
            </span>
            {result.approx && <span className="font-sans text-[0.78rem] text-taupe">· 근사 분석</span>}
          </div>
          <div className={`font-sans text-[0.625rem] tracking-label uppercase ${verdict.cls}`}>
            {verdict.tag}
          </div>
        </div>

        <h1 className="font-display text-5xl md:text-6xl leading-[1.0] tracking-tight font-normal">
          {exerciseName}, <em className="text-lilac-deep">analyzed.</em>
        </h1>

        {result.overall && (
          <blockquote className="font-sans text-[0.9375rem] text-taupe leading-relaxed border-l-2 border-lilac pl-3 mt-4 m-0">
            "{result.overall}"
          </blockquote>
        )}
      </Reveal>

      {/* Score + Radar */}
      <Reveal delay={80}>
      <section className={`border-t border-ink/10 py-6 ${showRadar ? 'grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-6 md:gap-8' : ''}`}>

        {/* Score */}
        <div>
          <div className="mb-3"><span className="inline-block bg-bone rounded-[10px] px-3 py-1 font-sans text-[0.7rem] font-medium tracking-wide text-taupe">Score</span></div>

          {/* Score card — solid sky */}
          <div className="bg-sky rounded-[24px] p-6 shadow-[0_10px_24px_-10px_rgba(60,140,190,0.5)]">
            <div className="flex items-baseline gap-3">
              <div className="font-display text-7xl md:text-8xl text-ink leading-none tabular-nums">
                {score}
              </div>
              <div className="font-sans text-base text-ink/65">
                / 100
              </div>
            </div>

            {/* Mini bar */}
            <div className="mt-5 h-0.5 w-full bg-ink/10 overflow-hidden rounded-full">
              <div
                className="h-full bg-gradient-to-r from-lilac to-lilac-deep transition-all duration-700"
                style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
              />
            </div>
          </div>

          {/* 5-axis score card — 모델이 평가한 항목만 */}
          <div className="mt-5 rounded-[28px] bg-gradient-to-br from-lilac/45 to-paper border border-ink/10 shadow-[0_10px_28px_-10px_rgba(120,80,160,0.2)] p-5">
            {shownCats.map((c, i, arr) => {
              const v = result.cat_scores?.[c.key];
              return (
                <div
                  key={c.key}
                  className={`py-2.5 ${
                    i < arr.length - 1 ? 'border-b border-ink/8' : ''
                  }`}
                >
                  <div className="flex justify-between items-baseline">
                    <span className="font-sans text-[0.78rem] text-taupe">
                      {c.label}
                    </span>
                    <span className="font-display text-base tabular-nums text-ink">
                      {v != null ? v : <span className="text-hint">—</span>}
                    </span>
                  </div>
                  {v != null && (
                    <div className="mt-2 h-1.5 w-full bg-ink/10 overflow-hidden rounded-full">
                      <div
                        className="h-full bg-gradient-to-r from-lilac to-lilac-deep transition-all duration-700"
                        style={{ width: `${Math.max(0, Math.min(100, v))}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Radar — 평가 카테고리가 3개 이상일 때만 (2개 이하면 찌그러져서 생략) */}
        {showRadar && (
        <div className="md:border-l md:border-ink/10 md:pl-8">
          <div className="mb-3"><span className="inline-block bg-bone rounded-[10px] px-3 py-1 font-sans text-[0.7rem] font-medium tracking-wide text-lilac-deep">Performance chart</span></div>
          <div className="w-full h-[18.75rem] md:h-[21.25rem]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 12, right: 30, bottom: 12, left: 30 }}>
                <PolarGrid stroke="rgba(26, 20, 16, 0.1)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: '#7b7b7b', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                />
                <Radar
                  name="Score"
                  dataKey="A"
                  stroke="#c89cd9"
                  fill="#c89cd9"
                  fillOpacity={0.4}
                  strokeWidth={1.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}
      </section>
      </Reveal>

      {/* Diagnosis details */}
      {result.cat_details && Object.keys(result.cat_details).length > 0 && (
        <Reveal delay={160}>
        <section className="border-t border-ink/10 py-6">
          <div className="flex items-baseline justify-between mb-4">
            <div className="mb-1"><span className="inline-block bg-bone rounded-[10px] px-3 py-1 font-sans text-[0.7rem] font-medium tracking-wide text-ink">Detailed diagnosis</span></div>
            <div className="font-sans text-[0.5625rem] text-hint tracking-meta uppercase">
              {Object.keys(result.cat_details).length.toString().padStart(2, '0')} notes
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {Object.entries(result.cat_details).map(([cat, msg]) => {
              const catScore = result.cat_scores?.[cat];
              const tag = catScore != null ? verdictOf(catScore).tag : '—';
              const tagCls = catScore != null ? verdictOf(catScore).cls : 'text-hint';
              const frame = result.error_frames?.[cat];
              const hasFrame = !!frame?.image;
              const open = openCat === cat;
              return (
                <article key={cat} className="rounded-[16px] border border-ink/10 overflow-hidden">
                  <div
                    className={`grid grid-cols-1 md:grid-cols-[11.25rem_1fr] gap-3 md:gap-6 p-4 ${
                      hasFrame ? 'cursor-pointer group' : ''
                    }`}
                    onClick={hasFrame ? () => setOpenCat(open ? null : cat) : undefined}
                  >
                    <div>
                      <div className="font-sans text-[0.625rem] text-taupe tracking-label uppercase">
                        {cat}
                      </div>
                      <div className={`font-sans text-[0.5625rem] tracking-meta uppercase mt-1 ${tagCls}`}>
                        · {tag}
                        {catScore != null && (
                          <span className="text-hint normal-case tracking-normal"> ({catScore})</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="font-sans text-[0.9375rem] text-taupe leading-relaxed m-0">
                        "{msg}"
                      </p>
                      {hasFrame && (
                        <div className="font-sans text-[0.5625rem] text-lilac-deep tracking-meta uppercase mt-2 group-hover:text-ink transition-colors">
                          {open ? '▾ Hide captured frame' : '▸ View captured frame'}
                        </div>
                      )}
                    </div>
                  </div>

                  {hasFrame && open && (
                    <figure className="m-0 px-4 pb-5 md:pl-[12.75rem] animate-in fade-in slide-in-from-top-1 duration-300">
                      <div className="rounded-[12px] border border-ink/10 bg-black overflow-hidden flex justify-center">
                        <img
                          src={frame.image}
                          alt={`${cat} — 문제 순간`}
                          className="max-h-[50vh] w-auto max-w-full object-contain"
                        />
                      </div>
                      <figcaption className="font-sans text-xs text-taupe mt-2 leading-relaxed">
                        이 운동에서 해당 문제가 가장 두드러진 순간을 포착한 프레임입니다.
                      </figcaption>
                    </figure>
                  )}
                </article>
              );
            })}
          </div>
        </section>
        </Reveal>
      )}

      {/* Actions */}
      <section className="border-t border-ink/10 pt-6 mt-2 flex flex-col md:flex-row gap-3">
        <button
          onClick={onReset}
          className="rounded-[12px] px-5 py-3 border border-ink/10 font-sans text-[0.78rem] font-medium text-taupe hover:text-ink hover:border-ink/40 transition-colors"
        >
          ↻ Analyze another
        </button>
        {onSaveToJournal && (
          <button
            onClick={onSaveToJournal}
            className="flex-1 bg-lilac text-ink rounded-[12px] px-5 py-3 font-sans text-[0.78rem] font-medium hover:opacity-90 transition-opacity"
          >
            → Save report to journal
          </button>
        )}
      </section>

      {/* Footer */}
      <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/10 font-sans text-[0.6875rem] text-hint tracking-meta">
        <span className="uppercase">— FITCOACH —</span>
        <span className="uppercase text-taupe">Form analysis · {exerciseName}</span>
      </div>
    </div>
  );
};

export default FeedbackDetail;
