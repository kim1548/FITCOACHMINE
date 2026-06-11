import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { Loader2 } from 'lucide-react';

/**
 * Journal day 상세 모달 — Editorial Magazine 톤.
 *
 * 매거진 발행호처럼: Entry NNN / 날짜 → 큰 serif 헤드라인 → Workout/Macros 2단 →
 * Composition (InBody) → Coach's note (AI 코멘트) → Today's line (사용자 한 줄)
 * → 푸터.
 */

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// 폼체크 5축 카테고리 한글 라벨
const FORMCHECK_CAT_LABELS = {
  Stability: '안정성',
  ROM: '가동범위',
  'Movement Quality': '동작 품질',
  Posture: '자세',
  Core: '코어',
};

// 90점 미만인 카테고리 = 감점 요인. 그 피드백(cat_details)만 추려서 반환.
const deductedFeedback = (fc) => {
  if (!fc.cat_scores) return [];
  return Object.entries(fc.cat_scores)
    .filter(([, sc]) => sc != null && sc < 90)
    .sort((a, b) => a[1] - b[1]) // 많이 깎인 순
    .map(([cat, sc]) => ({
      cat,
      label: FORMCHECK_CAT_LABELS[cat] || cat,
      lost: Math.round(100 - sc),
      msg: fc.cat_details?.[cat] || '',
    }));
};

// 매거진 issue 번호 — day-of-year (예: 2026-05-27 → 147)
const dayOfYearOf = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
};

const formatHeaderDate = (iso) => iso.replace(/-/g, '.');

const formatDow = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
};

// 데이터에 따라 헤드라인 카피 분기. 운동 > 식단 > 휴식 순.
const buildHeadline = (data) => {
  if (data.workout?.sessions?.length) {
    return {
      main: data.workout.sessions[0].routine_name || 'A day of effort',
      em: 'session complete.',
    };
  }
  if (data.diet?.total?.kcal > 0) {
    return { main: 'A quiet day,', em: 'logged in macros.' };
  }
  return { main: 'Rest day,', em: 'between sessions.' };
};

const JournalDayModal = ({ date, theme, nutrition, onClose, onAfterChange }) => {
  // theme prop 은 부모 호환성을 위해 받지만 다크 우선이라 사용 안 함.
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteEditing, setNoteEditing] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    axios.get(`${API_BASE_URL}/journal/${date}`, { headers: authHeaders() })
      .then(res => {
        if (!alive) return;
        setData(res.data);
        setNoteDraft(res.data.user_note || '');
        setNoteEditing(!res.data.user_note);
      })
      .catch(err => alive && setError(err?.response?.data?.detail || '불러오기에 실패했습니다.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [date]);

  const handleSaveNote = async () => {
    setSavingNote(true);
    try {
      const res = await axios.put(
        `${API_BASE_URL}/journal/${date}/note`,
        { note: noteDraft },
        { headers: authHeaders() },
      );
      setData(d => ({ ...d, user_note: res.data.user_note }));
      setNoteEditing(false);
      onAfterChange?.();
    } catch (err) {
      setError(err?.response?.data?.detail || '저장에 실패했습니다.');
    } finally {
      setSavingNote(false);
    }
  };

  const entryNo = String(dayOfYearOf(date)).padStart(3, '0');

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-2xl max-h-[92vh] overflow-y-auto bg-paper text-ink border border-ink/10 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Masthead */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-ink/15 bg-paper">
          <div className="font-display italic text-ink text-sm">FITCOACH</div>
          <button
            onClick={onClose}
            className="font-mono text-[0.6875rem] tracking-meta uppercase text-taupe hover:text-ink transition-colors"
            aria-label="닫기"
          >
            Close ×
          </button>
        </header>

        <div className="px-6 pt-8 pb-6">
          {loading && (
            <div className="flex items-center gap-2 text-taupe">
              <Loader2 className="animate-spin" size={16} />
              <span className="font-mono text-[0.6875rem] tracking-meta uppercase">Loading…</span>
            </div>
          )}

          {!loading && error && (
            <div className="font-mono text-xs text-accent-red tracking-meta uppercase">{error}</div>
          )}

          {!loading && data && (() => {
            const headline = buildHeadline(data);
            const dietPct = data.diet && nutrition?.target_kcal
              ? Math.round((data.diet.total.kcal / nutrition.target_kcal) * 100)
              : null;
            return (
              <>
                {/* Entry meta + headline */}
                <div className="mb-7">
                  <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase mb-3">
                    Entry {entryNo} / {formatHeaderDate(date)} ({formatDow(date)})
                  </div>
                  <h1 className="font-display text-[2.5rem] md:text-[3.25rem] leading-[0.98] tracking-tight m-0 font-normal">
                    {headline.main}<br />
                    <em className="italic text-accent-gold">{headline.em}</em>
                  </h1>
                </div>

                {/* Workout + Macros 2-col */}
                {(data.workout || data.diet) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 border-t border-ink/15">
                    {/* Workout */}
                    <div className="py-5 md:pr-6 md:border-r border-ink/10">
                      <div className="font-mono text-[0.625rem] text-taupe tracking-label uppercase mb-3">— Workout</div>
                      {data.workout ? (
                        <div className="space-y-4">
                          {data.workout.sessions.map(s => (
                            <div key={s.id}>
                              <div className="font-display text-2xl text-ink leading-tight mb-1">{s.routine_name}</div>
                              <div className="font-mono text-[0.6875rem] text-accent-gold tracking-meta mb-2">
                                {s.lifts.length} lifts · session complete
                              </div>
                              <ul className="font-mono text-[0.75rem] leading-[1.7] text-body">
                                {s.lifts.map((lift, i) => {
                                  const sets = Array.isArray(lift.sets) ? lift.sets : [];
                                  const reps = sets.map(x => x.reps);
                                  const allCompleted = sets.length > 0 && sets.every(x => x.completed);
                                  const allSame = sets.length > 0 && reps.every(r => r === reps[0]);
                                  const repsLabel = sets.length > 0
                                    ? (allSame && allCompleted ? `${sets.length}×${reps[0]}` : reps.join(','))
                                    : '';
                                  const inc = lift.weight > lift.prev_weight;
                                  return (
                                    <li key={i} className="flex items-baseline justify-between border-t border-ink/10 first:border-t-0 py-1.5">
                                      <span className="text-body">{lift.lift_id}</span>
                                      <span className="text-ink tabular-nums">
                                        {lift.weight}<span className="text-taupe"> kg</span>
                                        {repsLabel && <span className="text-taupe"> · {repsLabel}</span>}
                                        {inc && <span className="text-accent-gold ml-1.5">↑</span>}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="font-display text-sm italic text-hint">No training logged.</p>
                      )}
                    </div>

                    {/* Macros */}
                    <div className="py-5 md:pl-6 border-t md:border-t-0 border-ink/15">
                      <div className="font-mono text-[0.625rem] text-taupe tracking-label uppercase mb-3">— Macros</div>
                      {data.diet ? (
                        <>
                          <div className="font-display text-4xl text-ink leading-none mb-3 tabular-nums tracking-tight">
                            {Math.round(data.diet.total.kcal).toLocaleString()}{' '}
                            <span className="text-sm text-taupe italic font-normal">kcal</span>
                          </div>
                          <div className="font-mono text-[0.75rem] text-taupe space-y-1.5">
                            <div className="flex justify-between border-t border-ink/10 pt-1.5">
                              <span>Protein</span>
                              <span className="text-ink tabular-nums">
                                {Math.round(data.diet.total.protein)}
                                {nutrition?.target_protein && <span className="text-hint"> / {nutrition.target_protein}</span>} g
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Carbs</span>
                              <span className="text-ink tabular-nums">
                                {Math.round(data.diet.total.carbs)}
                                {nutrition?.target_carbs && <span className="text-hint"> / {nutrition.target_carbs}</span>} g
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Fat</span>
                              <span className="text-ink tabular-nums">
                                {Math.round(data.diet.total.fat)}
                                {nutrition?.target_fat && <span className="text-hint"> / {nutrition.target_fat}</span>} g
                              </span>
                            </div>
                          </div>
                          {dietPct !== null && (
                            <div className="mt-3 pt-3 border-t border-ink/10 flex items-baseline justify-between font-mono text-[0.625rem] text-taupe tracking-meta uppercase">
                              <span>vs target</span>
                              <span className={`tabular-nums ${dietPct >= 80 && dietPct <= 110 ? 'text-accent-gold' : 'text-ink'}`}>
                                {dietPct}%
                              </span>
                            </div>
                          )}
                          {Object.keys(data.diet.by_meal).length > 0 && (
                            <div className="mt-3 pt-3 border-t border-ink/10 font-mono text-[0.625rem] tracking-meta uppercase text-taupe space-y-1">
                              {Object.entries(data.diet.by_meal).map(([meal, foods]) => (
                                <div key={meal} className="flex gap-2">
                                  <span className="text-hint min-w-[2.625rem]">{meal}</span>
                                  <span className="text-body truncate">{foods.map(f => f.food_name).join(', ')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="font-display text-sm italic text-hint">No meals logged.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Composition (InBody) */}
                {data.body && (
                  <div className="border-t border-ink/15 py-5">
                    <div className="font-mono text-[0.625rem] text-taupe tracking-label uppercase mb-3">— Composition</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: '체중', key: 'weight', unit: 'kg', betterLower: false },
                        { label: '골격근', key: 'skeletal_muscle', unit: 'kg', betterLower: false },
                        { label: '체지방', key: 'body_fat_mass', unit: 'kg', betterLower: true },
                        { label: '체지방률', key: 'body_fat_percent', unit: '%', betterLower: true },
                      ].map(m => {
                        const v = data.body.values?.[m.key];
                        const d = data.body.deltas?.[m.key];
                        const improving = d != null && d !== 0 && (m.betterLower ? d < 0 : d > 0);
                        const declining = d != null && d !== 0 && (m.betterLower ? d > 0 : d < 0);
                        const deltaCls = d == null || d === 0
                          ? 'text-hint'
                          : improving ? 'text-accent-gold' : declining ? 'text-accent-red' : 'text-hint';
                        return (
                          <div key={m.key}>
                            <div className="font-mono text-[0.5625rem] text-taupe tracking-label uppercase mb-1">{m.label}</div>
                            <div className="font-display text-2xl text-ink tabular-nums leading-none">
                              {v != null ? v : <span className="text-hint">—</span>}
                              {v != null && <span className="text-[0.625rem] text-taupe italic ml-1">{m.unit}</span>}
                            </div>
                            {d != null && (
                              <div className={`font-mono text-[0.625rem] tracking-meta mt-1 ${deltaCls}`}>
                                {d > 0 ? '+' : ''}{d}{m.unit}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Form Check — 교정 피드백이 있는 운동만 노출.
                    같은 운동을 여러 번 분석해도 운동별로 묶고, 같은 문구는 한 번만. */}
                {(() => {
                  const byExercise = new Map();
                  for (const fc of (data.formcheck || [])) {
                    const tips = deductedFeedback(fc).filter(d => d.msg);
                    if (tips.length === 0) continue;
                    if (!byExercise.has(fc.exercise_type)) byExercise.set(fc.exercise_type, new Set());
                    const msgs = byExercise.get(fc.exercise_type);
                    tips.forEach(d => msgs.add(d.msg));
                  }
                  if (byExercise.size === 0) return null;
                  return (
                    <div className="border-t border-ink/15 py-5">
                      <div className="font-mono text-[0.625rem] text-taupe tracking-label uppercase mb-3">— Form Check</div>
                      <div className="space-y-5">
                        {[...byExercise.entries()].map(([exercise, msgs]) => (
                          <div key={exercise}>
                            <div className="font-mono text-[0.6875rem] text-ink tracking-meta uppercase">
                              {exercise}
                            </div>
                            <ul className="mt-2 space-y-2">
                              {[...msgs].map(m => (
                                <li
                                  key={m}
                                  className="font-display italic text-[0.95rem] text-body leading-relaxed pl-3 border-l-2 border-accent-red/40"
                                >
                                  {m}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Coach's note (AI 코멘트) */}
                {data.body?.ai_comment && (
                  <div className="-mx-6 px-6 py-5 border-t border-ink/15 bg-accent-red/5">
                    <div className="font-mono text-[0.625rem] text-accent-red tracking-label uppercase mb-3">
                      — Coach's note · {data.body.deltas ? 'Body composition shift' : 'Baseline reading'}
                    </div>
                    <blockquote className="font-display italic text-lg text-ink leading-relaxed m-0 max-w-[92%]">
                      "{data.body.ai_comment}"
                    </blockquote>
                  </div>
                )}

                {/* Today's line (한 줄 평) */}
                <div className="border-t border-ink/15 py-5">
                  <div className="font-mono text-[0.625rem] text-taupe tracking-label uppercase mb-3">— Today's line</div>
                  {noteEditing ? (
                    <div className="space-y-3">
                      <textarea
                        value={noteDraft}
                        onChange={e => setNoteDraft(e.target.value)}
                        placeholder="오늘 어땠나요?"
                        rows={2}
                        className="w-full bg-transparent outline-none resize-none font-display text-base italic text-ink border-b border-ink/15 focus:border-accent-red pb-1.5"
                      />
                      <div className="flex justify-end gap-4">
                        {data.user_note && (
                          <button
                            onClick={() => { setNoteDraft(data.user_note); setNoteEditing(false); }}
                            className="font-mono text-[0.6875rem] tracking-meta uppercase text-taupe hover:text-ink"
                          >
                            취소
                          </button>
                        )}
                        <button
                          onClick={handleSaveNote}
                          disabled={savingNote || !noteDraft.trim()}
                          className="font-mono text-[0.6875rem] tracking-meta uppercase text-accent-red hover:text-ink disabled:opacity-40 flex items-center gap-1.5"
                        >
                          {savingNote && <Loader2 size={11} className="animate-spin" />}
                          → Save entry
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <blockquote className="font-display italic text-base text-ink leading-relaxed m-0 border-l-2 border-accent-gold pl-3 flex-1">
                        "{data.user_note}"
                      </blockquote>
                      <button
                        onClick={() => setNoteEditing(true)}
                        className="font-mono text-[0.625rem] tracking-meta uppercase text-taupe hover:text-accent-red flex-shrink-0"
                        aria-label="수정"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center pt-4 border-t border-ink/15 font-mono text-[0.6875rem] text-hint tracking-meta">
                  <span className="uppercase">— FITCOACH —</span>
                  <span className="uppercase text-taupe">Entry {entryNo}</span>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default JournalDayModal;
