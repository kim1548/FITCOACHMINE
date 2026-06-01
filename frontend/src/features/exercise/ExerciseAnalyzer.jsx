import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../api/config';

const Pose = window.Pose;

const ExerciseAnalyzer = forwardRef(({ exercise, onResultUpdate, onAnalysisComplete, onReady, onProgress }, ref) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseInstance = useRef(null);
  const latestData = useRef(null);
  const workoutImage = useRef(null); // 운동 확인용 대표 사진 (journal 썸네일/폴백)
  const errorFrames = useRef({});    // 에러 카테고리별 '가장 심한 순간' 스크린샷 { Stability: { severity, image }, ... }
  
  // 🔥 실시간 피드백을 프레임마다 유지하기 위한 Ref
  const feedbackRef = useRef(null);

  useImperativeHandle(ref, () => ({
    handleFileUpload: async (e) => {
      const file = e.target.files[0];
      if (!file || !videoRef.current) return;
      // 분석 시작 전 서버 누적 상태(카운터·방향 통계) 초기화 — 이전 영상 값이 섞이지 않게
      try { await axios.post(`${API_BASE_URL}/exercise/reset`); }
      catch (err) { console.error('exercise reset 실패', err); }
      videoRef.current.src = URL.createObjectURL(file);
      videoRef.current.onloadedmetadata = () => videoRef.current.play();
    }
  }));

  useEffect(() => {
    if (!Pose) return;
    poseInstance.current = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    poseInstance.current.setOptions({ modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    poseInstance.current.onResults(onResults);

    // 미리 워밍업: WASM 런타임 + Pose 모델을 업로드 전에 백그라운드로 로딩한다.
    // 이게 없으면 첫 send() 시점(=업로드 직후)에 CDN 콜드 다운로드가 일어나 ~5초 멈춤.
    const warmup = poseInstance.current.initialize?.();
    if (warmup && typeof warmup.then === 'function') {
      warmup
        .then(() => onReady?.())
        .catch((err) => { console.error('Pose 초기화 실패', err); onReady?.(); }); // 실패해도 UI는 잠그지 않음
    } else {
      onReady?.(); // initialize 미지원 버전 → 기존 지연 로딩으로 폴백, UI는 잠그지 않음
    }
  }, []);

  async function onResults(results) {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // 캔버스 크기 맞춤 (영상이 꽉 차게 보이도록 설정)
    if (videoRef.current.videoWidth > 0 && canvas.width !== videoRef.current.videoWidth) {
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
    }

    // 1. 영상 그리기 — 인지 화질 보정(대비·채도·밝기 약간)을 영상에만 적용하고,
    //    오버레이(원·문구)는 보정 없이 선명하게. 오버레이는 서버 응답 후 현재 프레임
    //    좌표로만 한 번 그린다(이전 프레임 덧칠 시 원이 이중으로 찍힘).
    ctx.save();
    ctx.filter = 'contrast(1.08) saturate(1.06) brightness(1.02)';
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (results.poseLandmarks) {
      const landmarks = results.poseLandmarks.flatMap((l) => [l.x, l.y, l.z, l.visibility]);
      try {
        const res = await axios.post(`${API_BASE_URL}/exercise/analyze`, { landmarks, exercise_type: exercise });
        const data = res.data; 

        // 백엔드의 'feedback_points'를 'feedbackRef'에 연결
        if (data.feedback_points && data.feedback_points.length > 0) {
          feedbackRef.current = {
            points: data.feedback_points,
            msg: data.overlay_message || "자세 주의!"
          };
          // 캡처에 빨간 원이 포함되도록, 현재 프레임의 피드백을 지금 캔버스에 그린다
          drawErrorOverlay(ctx, feedbackRef.current.points, feedbackRef.current.msg, canvas.width, canvas.height);
        } else {
          feedbackRef.current = null; // 에러 없으면 지우기
        }

        // 에러 카테고리별 '가장 심한 순간' 스크린샷 — severity가 더 큰 프레임으로 교체
        if (data.error_category && data.error_key) {
          const severity = data.error_severity || 0;
          const prev = errorFrames.current[data.error_category];
          if (!prev || severity > prev.severity) {
            errorFrames.current[data.error_category] = {
              severity,
              error_key: data.error_key,
              image: canvas.toDataURL("image/jpeg", 0.92), // 결과 페이지 노출용 — 고품질
            };
          }
        }

        if (!workoutImage.current && (data.counter > 0 || videoRef.current.currentTime > 2)) {
          workoutImage.current = canvas.toDataURL("image/jpeg", 0.85); // journal 썸네일/폴백
        }
        
        latestData.current = data; // 마지막 결과값 업데이트
        onResultUpdate(data);
        
        // 영상이 끝나면 결과를 넘김 (에러 프레임 포함)
        if (videoRef.current.ended) {
          onAnalysisComplete(buildFinalResult(data));
        }

        onResultUpdate(data);
      } catch (err) { console.error(err); }
    }
  }

  // 마지막 결과에 대표 사진 + 에러 카테고리별 스크린샷을 합쳐 최종 페이로드 구성
  const buildFinalResult = (base) => ({
    ...base,
    capture_url: workoutImage.current || base?.capture_url,
    error_frames: errorFrames.current,
  });

  const handleFinalize = () => {
    onProgress?.(100);
    if (latestData.current) {
      onAnalysisComplete(buildFinalResult(latestData.current));
    }
  };

  // 문제 부위는 '속이 빈 링'으로 표시(부위가 가려지지 않게), 메시지는 상단 중앙에
  // 에디토리얼 톤(JetBrains Mono 키커 + Playfair 메시지, surface 패널)으로 한 번만 그린다.
  function drawErrorOverlay(ctx, points, msg, w, h) {
    const radius = Math.max(30, Math.round(w * 0.03));

    // 픽셀 좌표로 변환 후, 서로 겹치는(중심 거리 < 지름) 원은 무게중심으로 하나로 병합
    const merged = [];
    points.forEach((p) => {
      const px = p.x * w, py = p.y * h;
      const near = merged.find((m) => Math.hypot(m.x - px, m.y - py) < radius * 2);
      if (near) {
        near.x = (near.x * near.n + px) / (near.n + 1); // 누적 평균
        near.y = (near.y * near.n + py) / (near.n + 1);
        near.n += 1;
      } else {
        merged.push({ x: px, y: py, n: 1 });
      }
    });

    merged.forEach((p) => {
      ctx.save();
      // 어두운 외곽 글로우 — 밝은/붉은 배경에서도 링이 떠 보이게
      ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
      ctx.shadowBlur = radius * 0.25;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = "#c43c2f"; // accent-red — 속은 비워 부위가 보이게
      ctx.lineWidth = Math.max(3, Math.round(radius * 0.13));
      ctx.stroke();
      // 안쪽 얇은 양피지 라인 (대비 보강)
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius - ctx.lineWidth, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(240, 232, 216, 0.55)"; // parchment
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    });

    if (!msg) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const baseFont = Math.max(20, Math.round(w * 0.026));      // 메시지
    const kickerFont = Math.max(11, Math.round(baseFont * 0.6)); // 키커
    const kicker = "— FORM ALERT";
    const tracking = Math.round(kickerFont * 0.2);

    // 폭 측정
    ctx.font = `${baseFont}px "Playfair Display", Georgia, serif`;
    const msgW = ctx.measureText(msg).width;
    ctx.font = `bold ${kickerFont}px "JetBrains Mono", monospace`;
    try { ctx.letterSpacing = `${tracking}px`; } catch { /* 미지원 브라우저 무시 */ }
    const kickW = ctx.measureText(kicker).width;
    try { ctx.letterSpacing = "0px"; } catch { /* noop */ }

    const padX = baseFont * 1.1;
    const padY = baseFont * 0.65;
    const gap = baseFont * 0.4;
    const boxW = Math.max(msgW, kickW) + padX * 2;
    const boxH = padY * 2 + kickerFont + gap + baseFont;
    const cx = w / 2;
    const top = Math.round(h * 0.035);

    // surface 패널 + 양피지 헤어라인 (테마 토큰과 동일 색)
    roundRect(ctx, cx - boxW / 2, top, boxW, boxH, baseFont * 0.28);
    ctx.fillStyle = "rgba(16, 12, 8, 0.85)";        // --color-surface
    ctx.fill();
    ctx.strokeStyle = "rgba(240, 232, 216, 0.18)";  // --color-page-edge 계열
    ctx.lineWidth = 1;
    ctx.stroke();

    // 키커 — 모노 대문자 + accent-red
    const kickerY = top + padY + kickerFont / 2;
    ctx.font = `bold ${kickerFont}px "JetBrains Mono", monospace`;
    try { ctx.letterSpacing = `${tracking}px`; } catch { /* noop */ }
    ctx.fillStyle = "#c43c2f";
    ctx.fillText(kicker, cx, kickerY);
    try { ctx.letterSpacing = "0px"; } catch { /* noop */ }

    // 메시지 — Playfair/serif + parchment ink
    const msgY = kickerY + kickerFont / 2 + gap + baseFont / 2;
    ctx.font = `${baseFont}px "Playfair Display", Georgia, serif`;
    ctx.fillStyle = "#f0e8d8";                       // --color-ink
    ctx.fillText(msg, cx, msgY);

    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const onFrame = async () => {
    if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended && videoRef.current.readyState >= 2) {
      const { currentTime, duration } = videoRef.current;
      if (duration) onProgress?.(Math.min(99, (currentTime / duration) * 100)); // 100%는 종료 시점에만
      await poseInstance.current.send({ image: videoRef.current });
      requestAnimationFrame(onFrame);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-black overflow-hidden">
      <canvas 
        ref={canvasRef} 
        // object-cover 대신 아래 스타일 적용
        className="h-full w-auto object-contain" 
        style={{ 
          maxHeight: '100%', 
          maxWidth: '100%',
          margin: '0 auto' // 가로 중앙 정렬
        }}
      />
      <video 
        ref={videoRef} 
        onPlay={onFrame} 
        onEnded={handleFinalize} 
        className="hidden" 
        muted 
        playsInline 
      />
    </div>
  );
});

export default ExerciseAnalyzer;