import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FeedbackDetail from './RoutineLogPage';
import GuidedCapture from '../features/exercise/GuidedCapture';
import PageSurface from '../components/PageSurface';
import { CAMERA_GUIDE } from '../constants/exercise';
import { API_BASE_URL } from '../api/config';
import usePageTitle from '../hooks/usePageTitle';
import Reveal from '../components/Reveal';

/**
 * /formcheck/:exId — AI 자세 분석 세션 (Editorial Magazine 톤).
 *
 * 흐름: 영상 업로드 → 서버(YOLO 크롭 + MediaPipe + 모델/룰 + 이벤트 점수) 분석 →
 *      FeedbackDetail 매거진 리포트. 포즈 추출은 전부 서버에서 수행한다.
 */

const RoutinePlayPage = () => {
  const { exId } = useParams();
  usePageTitle(`${exId || 'Form Check'} · FitCoach`);

  const navigate = useNavigate();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [finalData, setFinalData] = useState(null);
  const [mode, setMode] = useState('choose'); // 'choose' | 'record'

  const guideText = CAMERA_GUIDE[exId];

  const handleReset = () => {
    setFinalData(null);
    setIsAnalyzing(false);
    setMode('choose');
  };

  // 분석 성공 시, 로그인 상태라면 결과를 내 계정의 그날 기록으로 저장한다.
  // 비로그인이거나 저장 실패해도 화면 분석엔 영향 없음(조용히 무시).
  const saveFormCheckLog = (data) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    if (!data || data.analysis_error || typeof data.score !== 'number') return;

    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    fetch(`${API_BASE_URL}/exercise/formcheck/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        exercise_type: exId,
        score: data.score,
        rep_count: data.rep_count ?? null,
        cat_scores: data.cat_scores ?? null,
        cat_details: data.cat_details ?? null,
        overall: data.overall ?? null,
        date: localDate,
      }),
    }).catch(() => { /* 저장 실패는 무시 */ });
  };

  // 업로드/녹화 공통 — 영상 파일을 서버로 보내 분석(진행률 폴링 포함)
  const runAnalyze = async (file) => {
    const jobId = (window.crypto?.randomUUID?.() || String(Date.now()) + Math.random());
    setIsAnalyzing(true);
    setFinalData(null);
    setProgress(0);

    const poll = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/exercise/analyze_progress?job_id=${jobId}`);
        const d = await r.json();
        if (typeof d.percent === 'number') setProgress((p) => Math.max(p, d.percent));
      } catch { /* 폴링 실패는 무시 */ }
    }, 400);

    try {
      const form = new FormData();
      form.append('exercise_type', exId);
      form.append('job_id', jobId);
      form.append('file', file);
      const res = await fetch(`${API_BASE_URL}/exercise/analyze_video`, { method: 'POST', body: form });
      const data = await res.json();
      setProgress(100);
      setFinalData(data);
      saveFormCheckLog(data);
    } catch (err) {
      console.error('영상 분석 실패', err);
      setFinalData({
        analysis_error: true,
        exercise_supported: true,
        overall: '분석 요청에 실패했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요.',
      });
    } finally {
      clearInterval(poll);
      setIsAnalyzing(false);
    }
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // 같은 파일 재선택 허용
    runAnalyze(file);
  };

  const handleRecorded = (blob, ext) => {
    setMode('choose');
    const file = new File([blob], `capture.${ext || 'webm'}`, { type: blob.type || 'video/webm' });
    runAnalyze(file);
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
            onClick={() => navigate('/formcheck')}
            className="font-sans text-[0.78rem] text-taupe hover:text-ink tracking-meta uppercase mb-6 transition-colors"
          >
            ← Form Check library
          </button>

          {!finalData ? (
            <>
              {/* Header */}
              <Reveal className="pb-8">
                <header>
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="mb-3">
                      <span className="inline-block bg-lilac/60 rounded-[10px] px-3 py-1 font-sans text-[0.78rem] font-medium tracking-wide text-ink">
                        Session · Form Check
                      </span>
                    </div>
                    <div className="font-sans text-[0.72rem] text-hint tracking-meta uppercase">
                      {isAnalyzing ? 'Analyzing…' : 'Awaiting upload'}
                    </div>
                  </div>

                  <h1 className="font-display text-5xl md:text-6xl leading-[1.0] tracking-tight font-normal">
                    {exId}, <em className="italic text-lilac-deep">analyzed.</em>
                  </h1>
                  {guideText && (
                    <p className="font-sans text-sm text-taupe mt-3 leading-relaxed">
                      {guideText}
                    </p>
                  )}
                </header>
              </Reveal>

              {/* Capture frame */}
              <Reveal delay={80} className="border-t border-ink/15 pt-4">
                <div className="mb-2">
                  <span className="inline-block bg-bone rounded-[10px] px-3 py-1 font-sans text-[0.72rem] tracking-meta uppercase text-taupe">
                    Capture
                  </span>
                </div>

                {isAnalyzing ? (
                  /* Analyzing overlay — 실시간 진행률 % */
                  <div className="relative w-full max-w-[40rem] mx-auto rounded-[24px] bg-bone border border-ink/10 overflow-hidden flex items-center justify-center min-h-[20rem] py-10">
                    <div className="text-center px-6 w-full max-w-[27.5rem]">
                      <div className="mb-5">
                        <span className="inline-block bg-lilac/60 rounded-[10px] px-3 py-1 font-sans text-[0.72rem] font-medium text-ink tracking-wide uppercase">
                          Analyzing form
                        </span>
                      </div>
                      <div className="font-display text-7xl md:text-8xl text-ink tabular-nums leading-none mb-6">
                        {Math.round(progress)}
                        <span className="font-sans text-2xl text-taupe align-top ml-1">%</span>
                      </div>
                      <div className="h-0.5 w-full bg-ink/10 overflow-hidden">
                        <div
                          className="h-full bg-lilac transition-all duration-300"
                          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                        />
                      </div>
                      <p className="font-sans text-sm text-taupe leading-relaxed mt-6">
                        AI가 영상 속 자세를 프레임별로 분석하고 있습니다.<br />
                        분석이 끝나면 진단 리포트로 이동합니다.
                      </p>
                    </div>
                  </div>
                ) : mode === 'record' ? (
                  /* 가이드 촬영 */
                  <GuidedCapture
                    exercise={exId}
                    guide={guideText}
                    onRecorded={handleRecorded}
                    onCancel={() => setMode('choose')}
                  />
                ) : (
                  /* 가이드 촬영 / 영상 올리기 — 대사 제거, 버튼만 */
                  <div className="relative w-full max-w-[40rem] mx-auto rounded-[24px] bg-bone border border-ink/10 overflow-hidden flex items-center justify-center min-h-[20rem] py-10">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-6">
                      <button
                        onClick={() => setMode('record')}
                        className="bg-lilac text-ink rounded-[12px] px-5 py-3 font-sans text-[0.78rem] font-medium hover:opacity-90 transition-opacity"
                      >
                        ● 가이드 촬영
                      </button>
                      <label className="font-sans text-[0.78rem] font-medium tracking-wide px-6 py-3 rounded-[12px] border border-ink/15 text-taupe hover:text-ink hover:bg-bone transition-colors cursor-pointer">
                        → 영상 올리기
                        <input type="file" className="hidden" accept="video/*" onChange={handleFileSelected} />
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex gap-5 mt-3 font-sans text-[0.66rem] text-hint tracking-meta uppercase">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-[0.3125rem] h-[0.3125rem] rounded-full bg-lilac" />
                    Server-side AI analysis
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-[0.3125rem] h-[0.3125rem] rounded-full bg-lilac" />
                    mp4 · mov · avi
                  </span>
                </div>
              </Reveal>

              {/* Footer */}
              <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-sans text-[0.78rem] text-hint tracking-meta">
                <span className="uppercase">— FITCOACH —</span>
                <span className="uppercase text-taupe">Form Check · {exId}</span>
              </div>
            </>
          ) : (
            <FeedbackDetail
              result={finalData}
              exerciseName={exId}
              onReset={handleReset}
            />
          )}
        </div>
      </PageSurface>
    </div>
  );
};

export default RoutinePlayPage;
