import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ExerciseAnalyzer from '../features/exercise/ExerciseAnalyzer';
import FeedbackDetail from './RoutineLogPage';
import PageSurface from '../components/PageSurface';
import { CAMERA_GUIDE } from '../constants/exercise';
import usePageTitle from '../hooks/usePageTitle';

/**
 * /formcheck/:exId — AI 자세 분석 세션 (Editorial Magazine 톤).
 *
 * 흐름: 영상 업로드 안내 → MediaPipe Pose 실시간 분석(카운터·각도 오버레이) →
 *      종료 시 FeedbackDetail 매거진 리포트.
 */

const RoutinePlayPage = () => {
  const { exId } = useParams();
  usePageTitle(`${exId || 'Form Check'} · FitCoach`);

  const navigate = useNavigate();

  const [isStarted, setIsStarted] = useState(false);
  const [analysisResult, setAnalysisResult] = useState({ counter: 0, angle: 0 });
  const [finalData, setFinalData] = useState(null);
  const [modelReady, setModelReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const analyzerRef = useRef(null);

  const handleAnalysisComplete = (data) => {
    if (data) setFinalData(data);
  };

  const handleReset = () => {
    setFinalData(null);
    setIsStarted(false);
    setProgress(0);
    setAnalysisResult({ counter: 0, angle: 0 });
  };

  const guideText = CAMERA_GUIDE[exId];

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
                    {isStarted ? 'Analyzing…' : (modelReady ? 'Awaiting upload' : 'Preparing engine…')}
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

              {/* Video frame */}
              <div className="border-t border-ink/15 pt-4">
                <div className="font-mono text-[10px] text-taupe tracking-meta uppercase mb-2">
                  Capture
                </div>

                <div className="relative w-full aspect-video bg-black border border-ink/15 overflow-hidden">
                  <ExerciseAnalyzer
                    ref={analyzerRef}
                    exercise={exId}
                    onResultUpdate={setAnalysisResult}
                    onAnalysisComplete={handleAnalysisComplete}
                    onReady={() => setModelReady(true)}
                    onProgress={setProgress}
                  />

                  {/* Upload overlay */}
                  {!isStarted && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-sm">
                      <div className="text-center px-6 max-w-[420px]">
                        <div className="font-mono text-[10px] text-accent-red tracking-label uppercase mb-4">
                          — Upload your evidence
                        </div>
                        <h2 className="font-display text-3xl md:text-4xl text-ink leading-[1.05] tracking-tight mb-3">
                          {exId},<br />
                          <em className="italic text-accent-gold">on record.</em>
                        </h2>
                        <p className="font-display italic text-sm text-taupe leading-relaxed mb-8">
                          영상을 업로드하면 분석이 즉시 시작됩니다.
                          한 세트 분량을 끊김 없이 담는 것을 권장합니다.
                        </p>

                        {modelReady ? (
                          <label className="inline-block font-mono text-[11px] tracking-label uppercase px-6 py-3 border border-accent-red text-accent-red hover:bg-accent-red hover:text-ink transition-colors cursor-pointer">
                            → Upload video
                            <input
                              type="file"
                              className="hidden"
                              accept="video/*"
                              onChange={(e) => {
                                if (analyzerRef.current && e.target.files?.[0]) {
                                  analyzerRef.current.handleFileUpload(e);
                                  setIsStarted(true);
                                }
                              }}
                            />
                          </label>
                        ) : (
                          <div className="inline-flex items-center gap-2.5 font-mono text-[11px] tracking-label uppercase px-6 py-3 border border-ink/20 text-taupe cursor-wait">
                            <span className="w-3 h-3 rounded-full border border-taupe border-t-transparent animate-spin" />
                            AI 모델 준비 중…
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Processing overlay — 재생 화면을 가리고 진행률만 보여준다 */}
                  {isStarted && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/90 backdrop-blur-sm">
                      <div className="text-center px-6 w-full max-w-[420px]">
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
                          프레임별 자세를 분석하고 있습니다.<br />
                          분석이 끝나면 진단 리포트로 이동합니다.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-5 mt-3 font-mono text-[9px] text-hint tracking-meta uppercase">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-[5px] h-[5px] rounded-full bg-accent-red" />
                    Detected error
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-[5px] h-[5px] rounded-full bg-accent-gold" />
                    Live metric
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
