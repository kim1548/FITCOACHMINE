import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * 가이드 촬영 — 카메라를 띄우고 상단에 촬영 가이드 문구를 보여준다.
 * 녹화가 끝나면 영상 blob을 onRecorded로 넘긴다(서버 분석은 부모가 처리).
 */
export default function GuidedCapture({ exercise, guide, onRecorded, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [fatal, setFatal] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setFatal('이 환경에서는 카메라를 쓸 수 없습니다. 반드시 http://localhost 또는 https 로 접속하세요. (IP 주소로 접속하면 보안상 카메라가 차단됩니다)');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
      } catch (e) {
        console.error('getUserMedia 실패', e);
        const n = e?.name || '';
        let msg = '카메라에 접근하지 못했습니다.';
        if (n === 'NotAllowedError' || n === 'SecurityError') msg = '카메라 권한이 거부되었습니다. 주소창의 카메라 아이콘에서 "허용" 후 새로고침해 주세요.';
        else if (n === 'NotFoundError' || n === 'OverconstrainedError') msg = '사용 가능한 카메라를 찾지 못했습니다.';
        else if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') msg = '다른 앱이 카메라를 사용 중입니다. Zoom·Teams·카메라 앱 등을 닫고 새로고침해 주세요.';
        setFatal(msg + (n ? `  (${n})` : ''));
      }
    }
    init();
    return () => {
      cancelled = true;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch { /* noop */ }
      }
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  function pickMime() {
    const cands = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    return cands.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
  }

  function startRec() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const type = mime || 'video/webm';
      const blob = new Blob(chunksRef.current, { type });
      onRecorded(blob, type.includes('mp4') ? 'mp4' : 'webm');
    };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
    setElapsed(0);
  }

  function stopRec() {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    setRecording(false);
  }

  return createPortal(
    <div className="fixed inset-0 z-[300] bg-black overflow-hidden">
      {/* 휴대폰 카메라 앱처럼 화면 전체를 카메라로 채운다 */}
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />

      {/* 상단 가이드 문구 */}
      {!fatal && (
        <div
          className="absolute top-0 left-0 right-0 z-20 px-4 flex justify-center pointer-events-none"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
        >
          <div className="font-display italic text-sm text-white leading-relaxed bg-black/55 backdrop-blur-sm px-4 py-2.5 rounded-sm max-w-[90%] text-center">
            {recording
              ? `● REC  ${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
              : (guide || `${exercise} 자세가 잘 보이게 촬영해 주세요.`)}
          </div>
        </div>
      )}

      {/* 치명 오류 */}
      {fatal && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 px-6 text-center">
          <div>
            <p className="font-display italic text-sm text-taupe leading-relaxed mb-5">{fatal}</p>
            <button
              onClick={onCancel}
              className="font-mono text-[11px] tracking-label uppercase px-5 py-3 border border-white/30 text-white hover:bg-white/10 transition-colors"
            >
              ← 돌아가기
            </button>
          </div>
        </div>
      )}

      {/* 하단 컨트롤 */}
      {!fatal && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
        >
          {!recording ? (
            <>
              <button
                onClick={onCancel}
                className="font-mono text-[10px] tracking-label uppercase px-4 py-2.5 border border-white/40 text-white hover:bg-white/10 transition-colors bg-black/40"
              >
                취소
              </button>
              <button
                onClick={startRec}
                className="font-mono text-[11px] tracking-label uppercase px-6 py-3 border border-accent-red text-ink bg-accent-red hover:bg-accent-red/90 transition-colors cursor-pointer"
              >
                ● 촬영 시작
              </button>
            </>
          ) : (
            <button
              onClick={stopRec}
              className="font-mono text-[11px] tracking-label uppercase px-6 py-3 border border-accent-gold text-surface bg-accent-gold hover:bg-accent-gold/90 transition-colors"
            >
              ■ 촬영 종료 · 분석
            </button>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
