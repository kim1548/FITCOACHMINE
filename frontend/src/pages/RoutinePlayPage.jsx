import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FeedbackDetail from './RoutineLogPage';
import GuidedCapture from '../features/exercise/GuidedCapture';
import PageSurface from '../components/PageSurface';
import { CAMERA_GUIDE } from '../constants/exercise';
import { API_BASE_URL } from '../api/config';
import usePageTitle from '../hooks/usePageTitle';

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
      className="fixed inset-0 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in duration-300"
      style={{ scrollbarWidth: 'none' }}
    >
      <PageSurface maxWidth={1200}>
        <div className="w-full px-6 md:px-12 py-8">

          {/* Back link */}
          <button
            onClick={() => navigate('/formcheck')}
            className="font-mono text-[11px] text-taupe hover:text-ink tracking-meta uppercase mb-6 transition-colors"
          >
            ← Form Check library
          </button>

          {!finalData ? (
            <>
              {/* Header */}
              <header className="pb-6">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="font-mono text-[11px] text-accent-red tracking-label uppercase">
                    — Session · Form Check
                  </div>
                  <div className="font-mono text-[10px] text-hint tracking-meta uppercase">
                    {isAnalyzing ? 'Analyzing…' : 'Awaiting upload'}
                  </div>
                </div>

                <h1 className="font-display text-4xl md:text-5xl leading-[1.0] tracking-tight font-normal">
                  {exId}, <em className="italic text-accent-gold">analyzed.</em>
                </h1>
                {guideText && (
                  <p className="font-display italic text-sm text-taupe mt-3 leading-relaxed">
                    {guideText}
                  </p>
                )}
              </header>

              {/* Capture frame */}
              <div className="border-t border-ink/15 pt-4">
                <div className="font-mono text-[10px] text-taupe tracking-meta uppercase mb-2">
                  Capture
                </div>

                {isAnalyzing ? (
                  /* Analyzing overlay — 실시간 진행률 % */
                  <div className="relative w-full aspect-video bg-black border border-ink/15 overflow-hidden flex items-center justify-center">
                    <div className="text-center px-6 w-full max-w-[440px]">
                      <div className="font-mono text-[10px] text-accent-red tracking-label uppercase mb-5">
                        — Analyzing form
                      </div>
                      <div className="font-display text-7xl md:text-8xl text-ink tabular-nums leading-none mb-6">
                        {Math.round(progress)}
                        <span className="font-display italic text-2xl text-taupe align-top ml-1">%</span>
                      </div>
                      <div className="h-0.5 w-full bg-ink/10 overflow-hidden">
                        <div
                          className="h-full bg-accent-red transition-all duration-300"
                          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                        />
                      </div>
                      <p className="font-display italic text-sm text-taupe leading-relaxed mt-6">
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
                  /* 선택: 촬영 / 업로드 */
                  <div className="relative w-full aspect-video bg-black border border-ink/15 overflow-hidden flex items-center justify-center">
                    <div className="text-center px-6 max-w-[460px]">
                      <div className="font-mono text-[10px] text-accent-red tracking-label uppercase mb-4">
                        — Upload your evidence
                      </div>
                      <h2 className="font-display text-3xl md:text-4xl text-ink leading-[1.05] tracking-tight mb-3">
                        {exId},<br />
                        <em className="italic text-accent-gold">on record.</em>
                      </h2>
                      <p className="font-display italic text-sm text-taupe leading-relaxed mb-8">
                        가이드 촬영으로 정확한 각도를 잡거나, 가지고 있는 영상을 업로드하세요.
                      </p>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                          onClick={() => setMode('record')}
                          className="font-mono text-[11px] tracking-label uppercase px-6 py-3 border border-accent-red text-ink bg-accent-red hover:bg-accent-red/90 transition-colors"
                        >
                          ● 가이드 촬영
                        </button>
                        <label className="font-mono text-[11px] tracking-label uppercase px-6 py-3 border border-ink/25 text-taupe hover:text-ink hover:border-ink/45 transition-colors cursor-pointer">
                          → 영상 올리기
                          <input type="file" className="hidden" accept="video/*" onChange={handleFileSelected} />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-5 mt-3 font-mono text-[9px] text-hint tracking-meta uppercase">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-[5px] h-[5px] rounded-full bg-accent-red" />
                    Server-side AI analysis
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-[5px] h-[5px] rounded-full bg-accent-gold" />
                    mp4 · mov · avi
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-mono text-[11px] text-hint tracking-meta">
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
