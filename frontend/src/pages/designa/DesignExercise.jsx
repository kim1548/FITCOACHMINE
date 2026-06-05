import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
// 기존: import ExerciseAnalyzer from "../features/exercise/ExerciseAnalyzer";
// 수정: 한 단계를 더 올라가야 합니다 (../../)
import ExerciseAnalyzer from "../../features/exercise/ExerciseAnalyzer";
import FeedbackDetail from "../FeedbackDetail";
import { ScanLine, Upload, Camera } from "lucide-react";
import squatImg from "../../assets/squat.jpg";
import { API_BASE_URL } from "../../api/config"; // API 주소 통일

const CAMERA_GUIDE = {
  "SQUAT": "측면에서 촬영하세요. 무릎·허리 라인이 한눈에 보이게 옆에서 찍어야 무릎 안쪽 꺾임과 척추 각도를 판정할 수 있습니다.",
  "DEAD": "측면에서 촬영하세요. 바·허리·무릎이 한 라인에 들어오도록 옆면을 잡으면 척추 중립 여부를 판정하기 좋습니다.",
  "BENCH": "정면에서 촬영하세요. 카메라를 발 아래쪽에 두고 바가 정면으로 보이도록 배치하면 그립 너비와 허리 아치를 판정하기 좋습니다.",
};

const ExercisePage = ({ theme }) => {
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [isStarted, setIsStarted] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [analysisResult, setAnalysisResult] = useState({ counter: 0, angle: 0 });
  const [finalResult, setFinalResult] = useState(null);
  const analyzerRef = useRef(null);

  const isDark = theme === "dark";

  const handleReset = () => {
    setShowDetail(false);
    setSelectedExercise(null);
    setIsStarted(false);
    // setFinalResult(null);
    setAnalysisResult({ counter: 0, angle: 0 });
  };

  const handleBackToGuide = () => {
    setIsStarted(false);
    setShowDetail(false);
  };

  return (
    <div className={`w-full h-full relative ${isDark ? "bg-[#0f0f12]" : "bg-slate-50"} overflow-hidden flex flex-col`}>
      
      {/* 상단 네비게이션 바 (수정 사항) */}
      {selectedExercise && (
        <div className="z-[110] px-8 py-4 flex items-center gap-2 text-lg font-bold border-b border-white/5 bg-black/20 backdrop-blur-md">
          <span 
            onClick={handleReset} 
            className="cursor-pointer hover:text-blue-500 transition-colors text-slate-400"
          >
            FITCOACH
          </span>
          <span className="text-slate-600">/</span>
          <span 
            onClick={handleBackToGuide} 
            className="cursor-pointer hover:text-blue-500 transition-colors text-white uppercase"
          >
            {selectedExercise}
          </span>
        </div>
      )}

      <div className="flex-1 relative">
        {!selectedExercise ? (
          /* [선택 창] - 수정된 구조 */
          <div className="absolute inset-0 overflow-y-auto"> 
            {/* items-center를 빼고 flex flex-col과 py-12(여백) 추가 */}
            <div className="min-h-full flex flex-col items-center justify-start md:justify-center p-6 py-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
                {["SQUAT", "DEAD", "BENCH"].map((ex) => (
                  <div 
                    key={ex} 
                    onClick={() => setSelectedExercise(ex)} 
                    className="relative aspect-square border border-white/10 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:scale-[1.05] transition-all shadow-lg overflow-hidden group bg-slate-900"
                  >
                    {ex === "SQUAT" && <img src={squatImg} alt="squat" className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-60 transition-opacity" />}
                    <div className="relative z-10 flex flex-col items-center">
                      <ScanLine size={48} className="text-blue-500 mb-4" />
                      <span className="text-2xl font-black text-white uppercase">{ex}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : showDetail ? (
          /* [상세 페이지] */
          <div className="absolute inset-0 overflow-y-auto p-6 pb-24">
          {/* <div className="h-full overflow-y-auto px-6 py-10"> */}
            <div className="max-w-6xl mx-auto">
              <FeedbackDetail result={finalResult} exerciseName={selectedExercise} theme={theme} onReset={handleReset} />
            </div>
          </div>
        ) : (
          /* [분석 화면] */
          <div className="absolute inset-0 bg-black">
            <ExerciseAnalyzer 
              ref={analyzerRef} 
              exercise={selectedExercise} 
              onResultUpdate={(data) => {
                setAnalysisResult(data);
                if (data.capture_url) setFinalResult(data);
              }} 
              onAnalysisComplete={(data) => {
                setFinalResult(prev => ({ ...data, capture_url: prev?.capture_url || data.capture_url }));
                setShowDetail(true);
              }}
              isStarted={isStarted}
            />
            
            {/* 가이드 오버레이 (상단 메시지 삭제됨) */}
            {!isStarted && (
              <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 text-center">
                <div className="max-w-xl w-full">
                  <h2 className="text-white text-3xl font-black mb-6 italic">{selectedExercise} 가이드</h2>
                  <div className="bg-white/10 p-8 rounded-[1.875rem] border border-white/20 mb-8">
                    <p className="text-white/80 text-lg leading-relaxed">{CAMERA_GUIDE[selectedExercise]}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setIsStarted(true)} className="py-5 bg-blue-600 text-white rounded-2xl font-black flex flex-col items-center gap-2 hover:bg-blue-500 transition-all shadow-xl">
                      <Camera size={24} /> 실시간 카메라
                    </button>
                    <label className="py-5 bg-white/10 text-white rounded-2xl font-black flex flex-col items-center gap-2 hover:bg-white/20 transition-all cursor-pointer border border-white/20">
                      <Upload size={24} /> 영상 업로드
                      <input type="file" className="hidden" onChange={(e) => { analyzerRef.current.handleFileUpload(e); setIsStarted(true); }} />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 실시간 UI (카운트/각도) */}
            {isStarted && (
              <div className="absolute inset-0 z-20 pointer-events-none p-10 flex flex-col justify-end">
                <div className="flex justify-between items-end mb-4">
                  <div className="flex flex-col">
                    <span className="text-blue-400 font-bold text-sm tracking-widest uppercase mb-2">Count</span>
                    <span className="text-[12rem] font-black text-white italic leading-[0.8] drop-shadow-2xl">
                      {String(analysisResult.counter || 0).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-slate-400 font-bold text-sm tracking-widest uppercase mb-2">Angle</span>
                    <span className="text-7xl font-black text-white drop-shadow-lg">{Math.round(analysisResult.angle)}°</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExercisePage;