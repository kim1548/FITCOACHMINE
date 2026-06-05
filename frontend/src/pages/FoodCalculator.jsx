import React, { useState } from "react";
import { Camera, Utensils, Trash2, Calculator, Loader2, CheckCircle } from "lucide-react";
import axios from "axios";
import { API_BASE_URL } from "../api/config";
import { useToast } from "../components/ui/Toast";

const FoodCalculator = () => {
  const toast = useToast();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [foods, setFoods] = useState([]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 초기화 및 미리보기 세팅
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setFoods([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // const host = window.location.hostname; 지울것
      // 백엔드 API 호출
      const res = await axios.post(`${API_BASE_URL}/diet/analyze`, formData);
      
      // 백엔드에서 받은 데이터 (결과가 없으면 빈 배열)
      const detectedData = Array.isArray(res.data) ? res.data : [];

      // 리액트 상태에 맞게 데이터 가공
      const formattedFoods = detectedData.map((item, index) => ({
        id: Date.now() + index + Math.random(), // 고유 ID 생성
        name: item.food_name || "알 수 없는 음식",
        weight: 50, // 기본 중량을 50g으로 세팅하여 칼로리 폭탄 방지
        kcalPer100g: item.calories || 0,
        feedback: item.feedback || "분석된 영양 정보를 확인하세요."
      }));

      setFoods(formattedFoods);

    } catch (err) {
      console.error("Analysis Error:", err);
      toast.error("분석 오류가 발생했습니다. 서버 상태를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const updateFood = (id, field, value) => {
    setFoods(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const removeFood = (id) => {
    setFoods(prev => prev.filter(f => f.id !== id));
  };

  // 총 칼로리 계산 로직
  const totalKcal = foods.reduce((sum, f) => {
    const kcal = (Number(f.kcalPer100g) * Number(f.weight)) / 100;
    return sum + (isNaN(kcal) ? 0 : kcal);
  }, 0);

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white p-4 pb-20 overflow-x-hidden">
      
      {/* 1. 이미지 프리뷰 섹션 */}
      <div className="relative w-full aspect-video bg-[#16161a] rounded-3xl border border-white/5 overflow-hidden shadow-2xl mb-6">
        {preview ? (
          <img src={preview} alt="food" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-700">
            <Utensils size={32} className="mb-2 opacity-20" />
            <p className="text-[0.625rem] font-black uppercase tracking-widest">Ready to scan</p>
          </div>
        )}
        
        {loading && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
            <Loader2 className="animate-spin text-blue-500 mb-2" size={32} />
            <p className="text-[0.625rem] font-black tracking-widest">ANALYZING...</p>
          </div>
        )}

        <label className="absolute bottom-4 right-4 p-4 bg-blue-600 rounded-2xl cursor-pointer shadow-2xl active:scale-90 transition-transform">
          <Camera size={20} className="text-white" />
          <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
        </label>
      </div>

      {/* 2. 음식 리스트 영역 */}
      <div className="mb-6">
        {foods.length > 0 ? (
          <div className="bg-[#16161a] rounded-3xl border border-white/5 overflow-hidden">
            <div className="flex px-5 py-3 bg-white/5 text-[0.5625rem] font-black text-slate-500 border-b border-white/5">
              <span className="flex-1">FOOD NAME</span>
              <span className="w-12 text-center mr-2">GRAM</span>
              <span className="w-12 text-right mr-8">KCAL</span>
            </div>
            <div>
              {foods.map((food) => (
                <div key={food.id} className="flex items-center px-5 py-4 border-b border-white/5 last:border-0">
                  <input 
                    value={food.name} 
                    onChange={(e) => updateFood(food.id, 'name', e.target.value)}
                    className="flex-1 bg-transparent text-sm font-bold text-white outline-none focus:text-blue-400 min-w-0"
                  />
                  <input 
                    type="number"
                    value={food.weight} 
                    onChange={(e) => updateFood(food.id, 'weight', e.target.value)}
                    className="w-12 bg-white/5 text-blue-500 text-xs font-black text-center py-2 rounded outline-none border border-white/5 mx-2"
                  />
                  <span className="w-12 text-right text-sm font-black italic text-slate-200">
                    {Math.round((food.kcalPer100g * food.weight) / 100)}
                  </span>
                  <button onClick={() => removeFood(food.id)} className="ml-4 text-slate-600 active:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          !loading && <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-3xl text-slate-700 text-[0.625rem] font-black uppercase">List is empty</div>
        )}
      </div>

      {/* 3. 총합 및 피드백 섹션 */}
      {foods.length > 0 && (
        <div className="flex flex-col gap-4 mt-4">
          {/* 총 칼로리 카드 */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-[0.625rem] font-black text-blue-100 uppercase opacity-70 mb-1">Total Intake</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black italic tracking-tighter">{Math.round(totalKcal)}</span>
                <span className="text-lg font-bold opacity-80">kcal</span>
              </div>
            </div>
            <Calculator size={80} className="absolute -bottom-4 -right-4 opacity-20 rotate-12" />
          </div>

          {/* 운동 맞춤형 AI 피드백 박스 */}
          <div className="bg-[#1b1b1f] p-6 rounded-[2.5rem] border border-white/5 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 rounded-2xl">
                <CheckCircle size={24} className="text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-[0.625rem] font-black text-blue-500 uppercase tracking-widest mb-1">Workout Strategy</p>
                <h4 className="text-[1rem] font-bold text-white mb-2">
                  {foods[0]?.name} 식단 분석
                </h4>
                <p className="text-[0.875rem] text-slate-300 leading-relaxed font-medium break-keep">
                  {/* 1. 개별 음식 피드백 노출 */}
                  {foods[0]?.feedback}
                </p>
                
                {/* 2. 전체 칼로리 기반 운동 조언 추가 */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-[0.8125rem] text-slate-400 italic">
                    {totalKcal > 1000 
                      ? "⚠️ 칼로리가 높습니다! 오늘 '스쿼트' 자세 교정 모드로 평소보다 2세트 더 진행하는 것을 추천합니다." 
                      : "✅ 적정 칼로리입니다. 지금의 식단을 유지하며 근력 운동 자세에 집중해보세요!"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button className="w-full py-5 bg-white text-black font-black uppercase text-xs rounded-2xl active:scale-95 transition-transform mt-2">
            Save Food Diary
          </button>
        </div>
      )}
    </div>
  );
};

export default FoodCalculator;