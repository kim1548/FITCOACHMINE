import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL, PROGRAM_LS_KEY, pushProgramState } from '../api/config';
import {
  LIFT_NAMES_KO, getProgram, resolveSession, resolveExercises,
  computeSetWeight, computeProgression, initialAnchor,
} from '../programs';
import PageSurface from '../components/PageSurface';
import Reveal from '../components/Reveal';
import usePageTitle from '../hooks/usePageTitle';

/**
 * /program/play — 운동 세션 실행 (Editorial Magazine 톤).
 *
 * 데이터 / 핸들러 / 진행 로직 / localStorage / 백엔드 POST 그대로 보존.
 * 시각만 매거진 톤으로 통합 — 큰 serif 세션 라벨 + 모노 라벨 섹션 + hairline 셋 리스트
 * + accent-red 완료 표시 + accent-gold AMRAP/PR 강조.
 */

const REST_DEFAULTS_SEC = {
  squat: 180, deadlift: 180,
  bench: 120, ohp: 120, row: 120,
};

const formatElapsed = (sec) => {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatRest = (sec) => {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '+' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
};

const ProgramPlayPage = ({ theme }) => {
  usePageTitle('Session · FitCoach');

  const navigate = useNavigate();
  const location = useLocation();
  const [programState, setProgramState] = useState(null);
  const [setData, setSetData] = useState({});
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [sessionPausedAt, setSessionPausedAt] = useState(null);
  const [sessionPauseAccumMs, setSessionPauseAccumMs] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState(null);

  useEffect(() => {
    const fromNav = location.state;
    const fromStorage = (() => {
      try { return JSON.parse(localStorage.getItem('fiteating.program') || 'null'); }
      catch { return null; }
    })();
    const state = fromNav || fromStorage;

    if (!state || !state.selectedId) {
      navigate('/program', { replace: true });
      return;
    }
    setProgramState(state);
    setSessionStartedAt(Date.now());
    if (fromNav) {
      localStorage.setItem(PROGRAM_LS_KEY, JSON.stringify(state));
      pushProgramState(state);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const startRest = (liftId) => {
    const total = REST_DEFAULTS_SEC[liftId] ?? 120;
    setRest({ liftId, endsAt: Date.now() + total * 1000, paused: false });
  };

  const adjustRest = (deltaSec) => {
    setRest(r => {
      if (!r) return r;
      if (r.paused) return { ...r, pausedRemaining: r.pausedRemaining + deltaSec };
      return { ...r, endsAt: r.endsAt + deltaSec * 1000 };
    });
  };

  const pauseRest = () => {
    setRest(r => {
      if (!r || r.paused) return r;
      const remaining = Math.ceil((r.endsAt - Date.now()) / 1000);
      return { ...r, paused: true, pausedRemaining: remaining };
    });
  };

  const resumeRest = () => {
    setRest(r => {
      if (!r || !r.paused) return r;
      return { ...r, paused: false, endsAt: Date.now() + r.pausedRemaining * 1000, pausedRemaining: undefined };
    });
  };

  const skipRest = () => setRest(null);

  const pauseSession = () => {
    if (!sessionStartedAt || sessionPausedAt) return;
    setSessionPausedAt(Date.now());
  };

  const resumeSession = () => {
    if (!sessionPausedAt) return;
    setSessionPauseAccumMs(prev => prev + (Date.now() - sessionPausedAt));
    setSessionPausedAt(null);
  };

  const elapsedSec = sessionStartedAt
    ? Math.floor((((sessionPausedAt ?? now) - sessionStartedAt - sessionPauseAccumMs)) / 1000)
    : 0;
  const restRemaining = rest
    ? (rest.paused ? rest.pausedRemaining : Math.ceil((rest.endsAt - now) / 1000))
    : 0;

  if (!programState) return null;

  const program = getProgram(programState);

  // 세션 구현이 없는 프로그램용 안내
  if (!program) {
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
              <div className="font-sans text-[0.78rem] text-ink tracking-label uppercase mb-3">
                {programState.selectedId}
              </div>
              <h1 className="font-display text-3xl md:text-4xl text-ink mb-2 tracking-tight">
                Session not yet authored.
              </h1>
              <p className="font-sans text-sm text-taupe">
                선택한 프로그램은 아직 세션 정의가 없습니다. 라이브러리에서 다른 프로그램을 골라주세요.
              </p>
            </div>
          </div>
        </PageSurface>
      </div>
    );
  }

  const session = resolveSession(program, programState.lastCompletedWorkout);
  const nextSession = resolveSession(program, session.id);
  const exercises = resolveExercises(session, programState);

  const anchorOf = (ex) => {
    const saved = programState.workingWeights?.[ex.anchorKey];
    if (saved !== undefined) return saved;
    const orm = programState.weights?.[ex.liftId] || 0;
    if (ex.prog === 'gzclp') {
      const pct = ex.tier === 'T1' ? 0.7 : ex.tier === 'T2' ? 0.5 : 0.45;
      return orm > 0 ? Math.max(20, Math.round(orm * pct / 2.5) * 2.5) : 20;
    }
    if (ex.role === 'P' || ex.role === 'H') {
      const pct = ex.role === 'P' ? 0.6 : 0.45;
      return orm > 0 ? Math.max(20, Math.round(orm * pct / 2.5) * 2.5) : 20;
    }
    return initialAnchor(programState.selectedId, orm);
  };

  const toggleSet = (anchorKey, idx, targetReps, liftId) => {
    const key = `${anchorKey}-${idx}`;
    const wasCompleted = setData[key]?.completed === true;
    setSetData(prev => {
      const current = prev[key] || { reps: targetReps, completed: false };
      return { ...prev, [key]: { ...current, completed: !current.completed } };
    });
    if (!wasCompleted) startRest(liftId);
  };

  const updateReps = (anchorKey, idx, reps, targetReps) => {
    const key = `${anchorKey}-${idx}`;
    setSetData(prev => {
      const current = prev[key] || { reps: targetReps, completed: false };
      return { ...prev, [key]: { ...current, reps } };
    });
  };

  const completeAllAutoSets = () => {
    setSetData(prev => {
      const next = { ...prev };
      exercises.forEach(ex => {
        ex.sets.forEach((spec, i) => {
          if (spec.kind === 'amrap' || spec.kind === 'top' || spec.kind === 'plus') return;
          const key = `${ex.anchorKey}-${i}`;
          if (next[key]?.completed) return;
          next[key] = { reps: next[key]?.reps ?? spec.reps, completed: true };
        });
      });
      return next;
    });
  };

  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const doneSets = Object.values(setData).filter(d => d.completed).length;
  const progress = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;

  const handleFinish = () => {
    const newWW = { ...(programState.workingWeights || {}) };
    const newFails = { ...(programState.consecutiveFails || {}) };
    const newStages = { ...(programState.stages || {}) };
    const liftResults = [];

    exercises.forEach(ex => {
      const anchor = anchorOf(ex);
      const setStates = ex.sets.map((spec, i) => {
        const d = setData[`${ex.anchorKey}-${i}`];
        return { reps: d?.reps ?? 0, completed: !!d?.completed };
      });
      const { nextAnchor, nextFails, nextStage, outcome } = computeProgression(
        program, ex, anchor, newFails[ex.anchorKey] || 0, setStates,
      );
      newWW[ex.anchorKey] = nextAnchor;
      newFails[ex.anchorKey] = nextFails;
      if (ex.prog === 'gzclp') newStages[ex.anchorKey] = nextStage;
      liftResults.push({
        liftId: ex.liftId,
        anchorKey: ex.anchorKey,
        role: ex.role || null,
        prevWeight: anchor,
        nextWeight: nextAnchor,
        outcome,
        sets: setStates,
      });
    });

    const finishedAt = Date.now();
    const totalPausedMs = sessionPauseAccumMs + (sessionPausedAt ? finishedAt - sessionPausedAt : 0);
    const durationSec = sessionStartedAt
      ? Math.round((finishedAt - sessionStartedAt - totalPausedMs) / 1000)
      : 0;

    const historyEntry = {
      date: new Date(finishedAt).toISOString(),
      workout: session.id,
      workoutLabel: session.label,
      durationSec,
      lifts: liftResults.map(r => ({
        liftId: r.liftId,
        anchorKey: r.anchorKey,
        weight: r.nextWeight,
        prevWeight: r.prevWeight,
        outcome: r.outcome,
        sets: r.sets,
      })),
    };

    let history = [];
    try { history = JSON.parse(localStorage.getItem('fiteating.program.history') || '[]'); }
    catch { history = []; }
    history.push(historyEntry);
    localStorage.setItem('fiteating.program.history', JSON.stringify(history));

    const token = localStorage.getItem('token');
    if (token) {
      axios.post(
        `${API_BASE_URL}/routine/log`,
        {
          date: historyEntry.date,
          workout: historyEntry.workout,
          workout_label: historyEntry.workoutLabel,
          duration_sec: historyEntry.durationSec,
          lifts: historyEntry.lifts.map(l => ({
            lift_id: l.liftId,
            anchor_key: l.anchorKey,
            weight: l.weight,
            prev_weight: l.prevWeight,
            outcome: l.outcome,
            sets: l.sets || [],
          })),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      ).catch(() => {});
    }

    const updated = {
      ...programState,
      workingWeights: newWW,
      consecutiveFails: newFails,
      stages: newStages,
      lastCompletedWorkout: session.id,
    };
    localStorage.setItem(PROGRAM_LS_KEY, JSON.stringify(updated));
    pushProgramState(updated);

    navigate('/program/summary', {
      state: {
        programId: programState.selectedId,
        workout: session.id,
        workoutLabel: session.label,
        durationSec,
        liftResults,
      },
    });
  };

  return (
    <div
      className="fixed inset-0 lg:left-[var(--sb-w,15rem)] transition-[left] duration-300 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in duration-300"
      style={{ scrollbarWidth: 'none' }}
    >
      <PageSurface maxWidth={1200}>
      <div className="w-full px-6 md:px-12 py-8">

        {/* Back link */}
        <button
          onClick={() => navigate('/program')}
          className="font-sans text-[0.78rem] text-taupe hover:text-ink tracking-meta uppercase mb-6 transition-colors"
        >
          ← Program library
        </button>

        {/* Headline */}
        <Reveal className="pb-8">
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <div className="mb-1">
              <span className="inline-block bg-lilac/60 rounded-[10px] px-3 py-1 font-sans text-[0.78rem] font-medium tracking-wide text-ink">
                Session · {session.id}
              </span>
            </div>
            <div className="font-sans text-[0.72rem] text-hint tracking-meta uppercase">
              {program.label}{program.variantLabel ? ` · ${program.variantLabel}` : ''}
            </div>
          </div>

          <div className="flex items-end justify-between gap-4 flex-wrap">
            <h1 className="font-display text-5xl md:text-6xl leading-[1.0] tracking-tight font-normal">
              {session.label}
            </h1>
            <button
              type="button"
              onClick={sessionPausedAt ? resumeSession : pauseSession}
              className={`font-sans text-base tabular-nums tracking-meta px-3 py-1.5 border transition-colors ${
                sessionPausedAt
                  ? 'border-ink/15 text-taupe hover:text-ink'
                  : 'border-lilac-deep/40 text-ink'
              }`}
              aria-label={sessionPausedAt ? '운동 재개' : '운동 일시정지'}
            >
              {sessionPausedAt ? '▶' : '⏸'} {formatElapsed(elapsedSec)}
            </button>
          </div>

          <p className="font-sans text-sm text-taupe mt-3 leading-relaxed">
            {program.desc} <span className="text-ink not-italic font-sans text-xs tracking-meta uppercase">
              Next — {nextSession.label}
            </span>
          </p>
        </Reveal>

        {/* Progress */}
        <Reveal delay={80} className="border-t border-ink/15 pt-4 pb-2">
          <div className="flex items-baseline justify-between mb-2">
            <div className="mb-0">
              <span className="inline-block bg-bone rounded-[10px] px-3 py-1 font-sans text-[0.72rem] tracking-meta uppercase text-taupe">
                — Progress
              </span>
            </div>
            <button
              onClick={completeAllAutoSets}
              className="font-sans text-[0.78rem] text-lilac-deep hover:text-ink tracking-meta uppercase transition-colors"
            >
              → Complete autos
            </button>
          </div>
          <div className="h-0.5 w-full bg-ink/10 overflow-hidden">
            <div
              className="h-full bg-lilac transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="font-sans text-[0.72rem] text-hint tracking-meta uppercase mt-2 tabular-nums">
            {doneSets} / {totalSets} sets · {progress}%
          </div>
        </Reveal>

        {/* Exercises */}
        <Reveal delay={160} className="mt-6 block">
        <section className="border-t border-ink/15">
          {exercises.map((ex, exIdx) => {
            const anchor = anchorOf(ex);
            const setWeights = ex.sets.map(spec => computeSetWeight(anchor, spec.pct));
            const topWeight = Math.max(...setWeights);
            const first = ex.sets[0];
            const uniform = ex.sets.every(x => x.pct === first.pct && x.reps === first.reps);
            const schemeText = uniform
              ? `${ex.sets.length} × ${first.reps} · ${topWeight} kg`
              : `${ex.sets.length} sets · max ${topWeight} kg`;
            return (
              <div
                key={ex.anchorKey}
                className={`mt-6 p-6 rounded-[28px] border border-ink/10 shadow-[0_10px_28px_-10px_rgba(26,20,16,0.12)] transition-all duration-300 hover:shadow-[0_18px_38px_-12px_rgba(26,20,16,0.2)] ${
                  exIdx === 0 ? 'bg-gradient-to-br from-lilac/40 to-paper' : 'bg-paper'
                }`}
              >
                {/* Exercise header */}
                <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
                  <div className="flex items-baseline gap-3 min-w-0">
                    <h2 className="font-display text-2xl md:text-3xl text-ink leading-tight truncate">
                      {LIFT_NAMES_KO[ex.liftId]}
                    </h2>
                    {ex.role && (
                      <span className={`font-sans text-[0.66rem] tracking-label uppercase border px-1.5 py-0.5 flex-shrink-0 ${
                        ex.role === 'T1'
                          ? 'text-lilac-deep border-lilac-deep/40'
                          : 'text-taupe border-ink/15'
                      }`}>
                        {ex.role}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-4 flex-shrink-0">
                    <span className="font-sans text-[0.78rem] text-taupe tracking-meta uppercase tabular-nums whitespace-nowrap">
                      {schemeText}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(`/formcheck/${encodeURIComponent(LIFT_NAMES_KO[ex.liftId])}`, '_blank', 'noopener')
                      }
                      className="font-sans text-[0.72rem] text-lilac-deep hover:text-ink tracking-meta uppercase transition-colors"
                      title="자세 분석 (새 탭)"
                    >
                      → Form
                    </button>
                  </div>
                </div>

                {/* Set rows */}
                <div className="rounded-[16px] border border-ink/10 overflow-hidden bg-paper/70">
                  {ex.sets.map((spec, i, arr) => {
                    const key = `${ex.anchorKey}-${i}`;
                    const data = setData[key] || { reps: spec.reps, completed: false };
                    const w = setWeights[i];
                    const isAmrap = spec.kind === 'amrap';
                    const isTop = spec.kind === 'top';
                    const isPlus = spec.kind === 'plus';
                    const allowsExtra = isAmrap || isPlus;
                    const isDone = data.completed;
                    const isShort = isDone && !allowsExtra && data.reps < spec.reps;
                    const isHighlight = isDone && (isAmrap || isTop);

                    let rowBg = '';
                    let circleCls = 'border-ink/20 text-taupe';
                    let checkBtnCls = 'border-ink/15 text-taupe hover:border-ink/40 hover:text-ink';
                    let repsTextCls = 'text-ink';

                    if (isDone && isShort) {
                      rowBg = 'bg-lilac/[0.06]';
                      circleCls = 'border-lilac-deep text-ink';
                      checkBtnCls = 'border-lilac-deep bg-lilac text-ink';
                      repsTextCls = 'text-ink';
                    } else if (isHighlight) {
                      rowBg = 'bg-lilac/[0.06]';
                      circleCls = 'border-lilac-deep text-lilac-deep';
                      checkBtnCls = 'border-lilac-deep bg-lilac text-paper';
                      repsTextCls = 'text-lilac-deep';
                    } else if (isDone) {
                      rowBg = 'bg-lilac/[0.04]';
                      circleCls = 'border-lilac-deep text-ink';
                      checkBtnCls = 'border-lilac-deep bg-lilac text-ink';
                      repsTextCls = 'text-ink';
                    }

                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 px-4 py-2.5 ${rowBg} ${
                          i < arr.length - 1 ? 'border-b border-ink/8' : ''
                        } transition-colors`}
                      >
                        {/* Set number */}
                        <span className={`w-6 h-6 flex items-center justify-center border font-sans text-[0.72rem] tabular-nums flex-shrink-0 ${circleCls}`}>
                          {i + 1}
                        </span>

                        {/* Weight × Reps */}
                        <div className="flex-1 flex items-baseline gap-2 text-sm min-w-0 flex-wrap">
                          <span className="font-display text-lg text-ink tabular-nums">{w}</span>
                          <span className="font-sans text-[0.72rem] text-taupe tracking-meta">kg</span>
                          <span className="font-sans text-[0.78rem] text-hint mx-1">×</span>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            step="1"
                            value={data.reps}
                            onChange={(e) =>
                              updateReps(ex.anchorKey, i, parseInt(e.target.value, 10) || 0, spec.reps)
                            }
                            style={{ MozAppearance: 'textfield' }}
                            className={`w-12 px-1 py-0.5 text-center font-display text-base tabular-nums bg-paper border border-ink/15 focus:border-lilac-deep outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${repsTextCls}`}
                          />
                          <span className="font-sans text-[0.72rem] text-taupe tracking-meta">reps</span>

                          {isAmrap && (
                            <span className="font-sans text-[0.66rem] text-lilac-deep tracking-meta uppercase ml-1">
                              · AMRAP
                            </span>
                          )}
                          {isTop && (
                            <span className="font-sans text-[0.66rem] text-lilac-deep tracking-meta uppercase ml-1">
                              · PR
                            </span>
                          )}
                        </div>

                        {/* Target */}
                        <span className="font-sans text-[0.66rem] text-hint tracking-meta uppercase whitespace-nowrap">
                          target {spec.reps}{allowsExtra ? '+' : ''}
                        </span>

                        {/* Check button */}
                        <button
                          onClick={() => toggleSet(ex.anchorKey, i, spec.reps, ex.liftId)}
                          aria-label={isDone ? '완료 취소' : '완료'}
                          className={`w-7 h-7 flex items-center justify-center border font-sans text-sm flex-shrink-0 transition-colors ${checkBtnCls}`}
                        >
                          {isDone ? '✓' : ''}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
        </Reveal>

        {/* Rest timer */}
        {rest && (
          <div className="mt-8 bg-sky rounded-[20px] p-5 shadow-[0_10px_24px_-10px_rgba(60,140,190,0.5)]">
            <div className="flex items-baseline justify-between mb-4">
              <div className="font-sans text-[0.72rem] tracking-label uppercase text-ink/65">
                — Rest · {LIFT_NAMES_KO[rest.liftId] || rest.liftId}
              </div>
              <div className="font-display text-5xl tabular-nums leading-none text-ink">
                {formatRest(restRemaining)}
              </div>
            </div>
            <div className="flex gap-5 flex-wrap font-sans text-[0.78rem] tracking-meta uppercase">
              <button
                onClick={() => adjustRest(-30)}
                className="text-ink/65 hover:text-ink transition-colors"
              >
                − 30s
              </button>
              <button
                onClick={() => adjustRest(30)}
                className="text-ink/65 hover:text-ink transition-colors"
              >
                + 30s
              </button>
              <button
                onClick={rest.paused ? resumeRest : pauseRest}
                className="text-ink hover:opacity-70 transition-opacity"
              >
                {rest.paused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button
                onClick={skipRest}
                className="ml-auto text-ink/65 hover:text-ink transition-colors"
              >
                → Skip
              </button>
            </div>
          </div>
        )}

        {/* Finish */}
        <button
          onClick={handleFinish}
          className="w-full mt-8 bg-lilac text-ink rounded-[12px] px-5 py-4 font-sans text-sm tracking-label uppercase hover:opacity-90 transition-opacity"
        >
          → Complete session
        </button>

        {/* Footer */}
        <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-sans text-[0.78rem] text-hint tracking-meta">
          <span className="uppercase">— FITCOACH —</span>
          <span className="uppercase text-taupe">
            {program.label} · {session.label}
          </span>
        </div>
      </div>
      </PageSurface>
    </div>
  );
};

export default ProgramPlayPage;
