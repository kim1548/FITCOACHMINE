import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CAMERA_GUIDE, EXERCISE_CATEGORIES } from '../constants/exercise';
import PageSurface from '../components/PageSurface';
import usePageTitle from '../hooks/usePageTitle';

/**
 * /formcheck — AI 자세 분석 라이브러리 (Editorial Magazine 톤).
 *
 * 패턴: Program library 와 동일.
 * 상단 부위 chips → Featured (현재 선택된 운동, 큰 카드) → Other exercises 컴팩트 리스트.
 */

const BODY_PARTS = Object.keys(EXERCISE_CATEGORIES);

// CAMERA_GUIDE 첫 단어로 촬영 각도 추출 ("정면에서…" / "측면에서…").
const angleOf = (name) => {
  const g = CAMERA_GUIDE[name];
  if (!g) return null;
  if (g.startsWith('정면')) return 'Front view';
  if (g.startsWith('측면')) return 'Side view';
  return null;
};

const getGuideImage = (name) => {
  try {
    return new URL(`../assets/guide_images/${name}.png`, import.meta.url).href;
  } catch {
    return null;
  }
};

const ExerciseCover = ({ name, size = 'sm' }) => {
  const [broken, setBroken] = useState(false);
  const src = getGuideImage(name);
  const dims = size === 'featured'
    ? 'w-full aspect-[4/5] md:aspect-[3/4]'
    : 'w-[4.75rem] h-[6.625rem]';
  const fs = size === 'featured' ? '22px' : '11px';

  return (
    <div className={`${dims} photo-frame flex-shrink-0 border border-ink/15 bg-paper-soft`}>
      {src && !broken ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-contain"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
          <span
            className="font-poster text-ink uppercase tracking-tight leading-[0.92]"
            style={{ fontSize: fs }}
          >
            {name}
          </span>
        </div>
      )}
    </div>
  );
};

const RoutinePlaySelectPage = () => {
  usePageTitle('Form Check · FitCoach');

  const navigate = useNavigate();
  const [selectedCat, setSelectedCat] = useState(BODY_PARTS[0]);
  const [selectedEx, setSelectedEx] = useState(EXERCISE_CATEGORIES[BODY_PARTS[0]][0]);

  const exercisesInCat = EXERCISE_CATEGORIES[selectedCat];
  const featured = selectedEx;
  const others = useMemo(
    () => exercisesInCat.filter((ex) => ex !== featured),
    [exercisesInCat, featured],
  );

  const totalCount = useMemo(
    () => Object.values(EXERCISE_CATEGORIES).reduce((acc, arr) => acc + arr.length, 0),
    [],
  );

  const featuredIdx = exercisesInCat.indexOf(featured);
  const featuredVol = String(featuredIdx + 1).padStart(2, '0');
  const featuredAngle = angleOf(featured);

  const handleCatChange = (cat) => {
    setSelectedCat(cat);
    setSelectedEx(EXERCISE_CATEGORIES[cat][0]);
  };

  const handleStart = () => {
    navigate(`/formcheck/${encodeURIComponent(featured)}`);
  };

  return (
    <div
      className="fixed inset-0 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in duration-300"
      style={{ scrollbarWidth: 'none' }}
    >
      <PageSurface maxWidth={1200}>
        <div className="w-full px-6 md:px-12 py-8">

          {/* Headline */}
          <div className="max-w-[40rem] pb-6">
            <div className="flex items-baseline justify-between mb-3">
              <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
                — Form Check · Library
              </div>
              <div className="font-mono text-[0.625rem] text-hint tracking-meta uppercase">
                {totalCount.toString().padStart(2, '0')} exercises
              </div>
            </div>
            <h1 className="font-display text-4xl md:text-5xl leading-[1.0] tracking-tight font-normal">
              Choose your <em className="italic text-accent-gold">form,<br />perfected.</em>
            </h1>
            <p className="font-display italic text-sm text-taupe mt-3 leading-relaxed">
              영상 한 편을 업로드하면 AI 가 자세를 분석해 안정성·가동범위·코어·자세 다섯 축으로 진단합니다.
            </p>
          </div>

          {/* Body part filter */}
          <div className="flex items-center justify-between border-t border-b border-ink/12 py-3 mb-0">
            <span className="font-mono text-[0.625rem] text-hint tracking-meta uppercase">
              Target
            </span>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 justify-end">
              {BODY_PARTS.map((cat) => {
                const active = cat === selectedCat;
                return (
                  <button
                    key={cat}
                    onClick={() => handleCatChange(cat)}
                    className={`font-mono text-[0.6875rem] tracking-meta uppercase transition-colors ${
                      active ? 'text-accent-red' : 'text-taupe hover:text-ink'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Featured */}
          <section className="pt-8 pb-2">
            <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase mb-4">
              — Featured · {selectedCat}
            </div>

            <div className="grid grid-cols-[6rem_1fr] md:grid-cols-[16.25rem_1fr] gap-4 md:gap-8 p-5 md:p-7 border border-accent-gold/30 bg-accent-gold/[0.05]">
              <ExerciseCover name={featured} size="featured" />

              <div className="min-w-0 flex flex-col">
                <div className="flex items-baseline gap-3 flex-wrap mb-1">
                  <span className="font-display italic text-2xl md:text-3xl leading-none text-hint">
                    {featuredVol}
                  </span>
                  <span className="font-display text-2xl md:text-4xl text-ink leading-tight">
                    {featured}
                  </span>
                </div>
                <div className="font-mono text-[0.625rem] text-taupe tracking-meta uppercase mb-3">
                  {selectedCat}
                  {featuredAngle && <> · {featuredAngle}</>}
                </div>

                {featuredAngle && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    <span className="font-mono text-[0.5625rem] text-taupe tracking-meta uppercase border border-ink/15 px-2 py-1">
                      {featuredAngle}
                    </span>
                    <span className="font-mono text-[0.5625rem] text-taupe tracking-meta uppercase border border-ink/15 px-2 py-1">
                      MediaPipe Pose
                    </span>
                    <span className="font-mono text-[0.5625rem] text-taupe tracking-meta uppercase border border-ink/15 px-2 py-1">
                      5-axis report
                    </span>
                  </div>
                )}

                <div className="hidden md:block font-mono text-[0.625rem] text-accent-gold tracking-label uppercase mb-2">
                  — Recommended setup
                </div>
                <blockquote className="font-display italic text-[0.8125rem] md:text-[0.9375rem] text-body leading-relaxed border-l-2 border-accent-red pl-3 mb-4 md:mb-6 m-0 line-clamp-2 md:line-clamp-none">
                  "{CAMERA_GUIDE[featured] || '상세 가이드를 준비 중입니다.'}"
                </blockquote>

                <div className="mt-auto">
                  <button
                    onClick={handleStart}
                    className="w-full md:w-auto whitespace-nowrap font-mono text-[0.6875rem] tracking-normal md:tracking-label uppercase px-3 md:px-5 py-3 border border-accent-red text-accent-red hover:bg-accent-red hover:text-ink transition-colors"
                  >
                    → Start AI analysis
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Other exercises in category */}
          {others.length > 0 && (
            <section className="pt-8">
              <div className="flex items-baseline justify-between mb-3">
                <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
                  — Other in {selectedCat}
                </div>
                <div className="font-mono text-[0.625rem] text-hint tracking-meta uppercase">
                  {others.length.toString().padStart(2, '0')} more
                </div>
              </div>

              <div className="border-t border-ink/15">
                {others.map((name) => {
                  const idx = exercisesInCat.indexOf(name);
                  const vol = String(idx + 1).padStart(2, '0');
                  const angle = angleOf(name);
                  return (
                    <button
                      key={name}
                      onClick={() => setSelectedEx(name)}
                      className="grid grid-cols-[4.75rem_1fr_auto] gap-5 py-4 border-b border-ink/8 w-full text-left hover:bg-ink/[0.03] transition-colors items-center"
                    >
                      <ExerciseCover name={name} size="compact" />

                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2.5 flex-wrap mb-1">
                          <span className="font-display italic text-lg leading-none text-hint">
                            {vol}
                          </span>
                          <span className="font-display text-lg text-ink leading-tight">
                            {name}
                          </span>
                          {angle && (
                            <span className="font-mono text-[0.625rem] text-taupe tracking-meta uppercase">
                              · {angle}
                            </span>
                          )}
                        </div>
                        <p className="font-display italic text-[0.8125rem] text-body leading-snug line-clamp-1">
                          {CAMERA_GUIDE[name] || '상세 가이드를 준비 중입니다.'}
                        </p>
                      </div>

                      <span className="self-center flex-shrink-0 font-mono text-lg text-taupe">›</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-mono text-[0.6875rem] text-hint tracking-meta">
            <span className="uppercase">— FITCOACH —</span>
            <span className="uppercase text-taupe">Form Check · {totalCount} exercises</span>
          </div>
        </div>
      </PageSurface>
    </div>
  );
};

export default RoutinePlaySelectPage;
