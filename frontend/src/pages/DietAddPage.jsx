import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import PageSurface from '../components/PageSurface';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmProvider';
import FieldError from '../components/ui/FieldError';
import Reveal from '../components/Reveal';
import usePageTitle from '../hooks/usePageTitle';

/**
 * /meals/add — 한 끼(아침·점심·저녁·간식) 기록 / 수정 (Editorial Magazine 톤).
 *
 * 상단 search → 좌(이미지·총칼로리) + 우(음식 테이블·저장) 2-col → 즐겨찾기 탭.
 */

const generateId = () => `row-${Math.random().toString(36).slice(2, 11)}`;

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const MEAL_SUBLABEL = {
  '아침': 'Morning',
  '점심': 'Noon',
  '저녁': 'Evening',
  '간식': 'Snack',
};

const DietAddPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const mealType = searchParams.get('type') || '간식';
  usePageTitle(`${mealType} · FitCoach`);

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [foods, setFoods] = useState([]);
  const [isFavSet, setIsFavSet] = useState(false);
  const [favorites, setFavorites] = useState({ meal: [], snack: [] });
  const [activeTab, setActiveTab] = useState(mealType === '간식' ? 'snack' : 'meal');
  const [dropdownList, setDropdownList] = useState({ index: null, results: [] });
  const [topQuery, setTopQuery] = useState('');
  const [topResults, setTopResults] = useState([]);
  const [saveError, setSaveError] = useState('');

  // 메모리 누수 방지 — blob URL 정리.
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  // 페이지 진입 시: 즐겨찾기 + 기존 식단 로드.
  useEffect(() => {
    const initPage = async () => {
      try {
        const favRes = await axios.get(`${API_BASE_URL}/diet/favorites`, { headers: authHeaders() });
        setFavorites(favRes.data || { meal: [], snack: [] });

        const type = searchParams.get('type');
        const group = searchParams.get('group');
        const mode = searchParams.get('mode');

        if (mode !== 'new') {
          const res = await axios.get(`${API_BASE_URL}/diet/daily-summary`, { headers: authHeaders() });
          const allLogs = res.data.logs || [];
          let targetItems = [];

          if (type === '간식' && group) {
            targetItems = allLogs.filter((l) => l.meal_type === '간식' && l.entry_group_id === group);
          } else {
            targetItems = allLogs.filter((l) => l.meal_type === type);
          }

          if (targetItems.length > 0) {
            // 불러온 기존 이미지 경로에도 백엔드 도메인을 붙여서 preview에 세팅합니다.
            if (targetItems[0].image_url) {
              setPreview(getFullImageUrl(targetItems[0].image_url));
            }
            
            setFoods(targetItems.map((item) => ({
              id: generateId(),
              food_name: item.food_name,
              calories: item.calories,
              carbs: item.carbs,
              protein: item.protein,
              fat: item.fat,
              weight: item.weight || 100,
            })));
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    initPage();
  }, [searchParams]);

  // 빈 줄 자동 추가 — 마지막 행이 채워지면 새 빈 행을 추가.
  useEffect(() => {
    const lastRow = foods[foods.length - 1];
    if (!lastRow || (lastRow.food_name && lastRow.food_name.trim() !== '')) {
      setFoods((prev) => [
        ...prev,
        { id: generateId(), food_name: '', calories: 0, carbs: 0, protein: 0, fat: 0, weight: 100 },
      ]);
    }
  }, [foods]);

  // 음식이 한 개라도 입력되면 검증 에러 해제.
  useEffect(() => {
    if (saveError && foods.some((f) => f.food_name?.trim())) {
      setSaveError('');
    }
  }, [foods, saveError]);

  // 백엔드가 준 상대경로(/static/...)를 절대경로(http://localhost:8001/static/...)로 만들어주는 함수
  // const getFullImageUrl = (url) => {
  //   if (!url) return null;
  //   // 이미 완벽한 주소(http://... 나 blob:...) 형태라면 그대로 리턴
  //   if (url.startsWith('http') || url.startsWith('blob:')) return url;
    
  //   // API_BASE_URL이 'http://localhost:8001/api' 라면 'http://localhost:8001'만 쏙 발라냅니다.
  //   const origin = new URL(API_BASE_URL).origin; 
  //   return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
  // };
  const getFullImageUrl = (url) => {
    if (!url) return null;
    
    // 1. 이미 http:// 나 blob: 으로 시작하는 완성형 주소면 그대로 통과
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    
    // 2. 백엔드 포트 주소를 수동으로 안전하게 결합 (가장 확실한 방법)
    // 현재 백엔드가 8001 포트를 쓰고 계시므로, 프로토콜과 호스트를 조합합니다.
    const backendPort = '8001'; 
    const hostname = window.location.hostname; // localhost 혹은 실제 IP
    const protocol = window.location.protocol; // http: 혹은 https:
    
    // 만약 url이 '/static/...' 이 아니라 'static/...' 일 수 있으니 슬래시 체크
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    
    return `${protocol}//${hostname}:${backendPort}${cleanUrl}`;
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await axios.post(`${API_BASE_URL}/diet/analyze`, formData, { headers: authHeaders() });
      
      // 백엔드 도메인(http://localhost:8001)을 붙여서 preview 상태에 넣기!
      if (res.data && res.data.main_image_url) {
        const fullUrl = getFullImageUrl(res.data.main_image_url);
        setPreview(fullUrl); 
        console.log("변환된 메인 이미지 주소:", fullUrl); // 잘 바뀌었는지 콘솔로 확인해보세요!
      }
      
      const targetItems = res.data.items || [];
      const mapped = targetItems.map((item, i) => ({ 
        ...item, 
        id: generateId() + i, 
        weight: item.weight || 100 
      }));
      
      setFoods((prev) => [...prev.filter((f) => f.food_name !== ''), ...mapped]);
      toast.success('사진 분석이 완료되었습니다.');
      
    } catch (err) {
      console.error(err);
      toast.error('사진 분석에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchNutrition = async (index, name) => {
    if (!name.trim()) {
      setDropdownList({ index: null, results: [] });
      return;
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/diet/search-nutrition`, {
        params: { name },
        headers: authHeaders(),
      });
      setDropdownList({ index, results: res.data || [] });
    } catch (err) {
      console.error(err);
    }
  };

  // 상단 검색 디바운스 (250ms).
  useEffect(() => {
    const q = topQuery.trim();
    if (!q) {
      setTopResults([]);
      return;
    }
    const timer = setTimeout(() => {
      axios
        .get(`${API_BASE_URL}/diet/search-nutrition`, {
          params: { name: q },
          headers: authHeaders(),
        })
        .then((res) => setTopResults(res.data || []))
        .catch(() => setTopResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [topQuery]);

  const addFoodFromSearch = (item) => {
    setFoods((prev) => {
      const filled = prev.filter((f) => f.food_name?.trim());
      return [
        ...filled,
        {
          id: generateId(),
          food_name: item.food_name,
          calories: item.kcal,
          carbs: item.carbs,
          protein: item.protein,
          fat: item.fat,
          weight: 100,
        },
      ];
    });
    setTopQuery('');
    setTopResults([]);
  };

  const selectFood = (index, foodData) => {
    const newFoods = [...foods];
    newFoods[index] = {
      ...newFoods[index],
      food_name: foodData.food_name,
      calories: foodData.kcal,
      carbs: foodData.carbs,
      protein: foodData.protein,
      fat: foodData.fat,
      weight: 100,
    };
    setFoods(newFoods);
    setDropdownList({ index: null, results: [] });
  };

  const applyMealSet = async (selectedSet) => {
    const ok = await confirm({
      title: '선택한 세트로 식단을 교체할까요?',
      description: '현재 작성 중인 항목이 사라집니다.',
      confirmLabel: 'Replace',
      destructive: true,
    });
    if (!ok) return;
    
    setFoods(selectedSet.items.map((item) => ({ ...item, id: generateId() })));
    
    // 🎯 [수정] 즐겨찾기 이미지 주소에도 백엔드 도메인을 안전하게 바인딩!
    if (selectedSet.image_url) {
      setPreview(getFullImageUrl(selectedSet.image_url));
    } else {
      setPreview(null);
    }
  };

  const handleSave = async () => {
    const finalFoods = foods.filter((f) => f.food_name && f.food_name.trim() !== '');
    if (finalFoods.length === 0) {
      setSaveError('음식을 한 가지 이상 입력해주세요.');
      return;
    }
    setSaveError('');
    try {
      await axios.post(
        `${API_BASE_URL}/diet/record-many`,
        {
          meal_type: mealType,
          group_id: searchParams.get('group'),
          items: finalFoods,
          image_url: preview,
          save_as_favorite: isFavSet,
        },
        { headers: authHeaders() },
      );
      toast.success('식단을 기록했습니다.');
      navigate('/meals');
    } catch (err) {
      toast.error('저장에 실패했습니다.');
    }
  };

  // ---------- Derived totals ----------
  const totals = useMemo(() => {
    const t = { kcal: 0, carbs: 0, protein: 0, fat: 0 };
    foods.forEach((f) => {
      const ratio = (Number(f.weight) || 100) / 100;
      t.kcal += (Number(f.calories) || 0) * ratio;
      t.carbs += (Number(f.carbs) || 0) * ratio;
      t.protein += (Number(f.protein) || 0) * ratio;
      t.fat += (Number(f.fat) || 0) * ratio;
    });
    return t;
  }, [foods]);

  const filledCount = foods.filter((f) => f.food_name?.trim()).length;

  return (
    <div
      className="fixed inset-0 lg:left-[var(--sb-w,15rem)] transition-[left] duration-300 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in duration-300"
      style={{ scrollbarWidth: 'none' }}
    >
      <PageSurface maxWidth={1200}>
        <div className="w-full px-6 md:px-12 py-8">

          {/* Back link */}
          <button
            onClick={() => navigate(-1)}
            className="font-sans text-[0.78rem] text-taupe hover:text-ink tracking-meta uppercase mb-6 transition-colors"
          >
            ← Back to meals
          </button>

          {/* Headline */}
          <Reveal className="pb-8">
            <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
              <div className="mb-0">
                <span className="inline-block bg-lilac/60 rounded-[10px] px-3 py-1 font-sans text-[0.78rem] font-medium tracking-wide text-ink">
                  Entry · Recording {mealType}
                </span>
              </div>
              <div className="font-sans text-[0.72rem] text-hint tracking-meta uppercase">
                {filledCount.toString().padStart(2, '0')} item{filledCount !== 1 ? 's' : ''}
              </div>
            </div>

            <h1 className="font-display text-5xl md:text-6xl leading-[1.0] tracking-tight font-normal">
              {mealType}, <em className="italic text-lilac-deep">{MEAL_SUBLABEL[mealType] || 'on record'}.</em>
            </h1>
            <p className="font-sans text-sm text-taupe mt-3 leading-relaxed">
              사진을 올리거나 이름으로 검색해서 한 끼 매크로를 정리합니다.
            </p>
          </Reveal>

          {/* Top search */}
          <Reveal delay={80} className="mb-8 relative z-30">
          <section className="relative rounded-[28px] bg-paper border border-ink/10 shadow-[0_10px_28px_-10px_rgba(26,20,16,0.12)] transition-all duration-300 hover:shadow-[0_18px_38px_-12px_rgba(26,20,16,0.2)] p-6">
            <div className="mb-3">
              <span className="inline-block bg-bone rounded-[10px] px-3 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-taupe uppercase">
                Search by name
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={topQuery}
                onChange={(e) => setTopQuery(e.target.value)}
                placeholder="예: 닭가슴살, 현미밥…"
                className="w-full px-3 py-2.5 rounded-[10px] bg-paper border border-ink/15 focus:border-lilac-deep outline-none font-sans text-base text-ink placeholder:text-hint transition-colors"
              />
              {topQuery && (
                <button
                  onClick={() => { setTopQuery(''); setTopResults([]); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 font-sans text-[0.78rem] text-taupe hover:text-ink tracking-meta uppercase"
                  aria-label="검색어 지우기"
                >
                  Clear ×
                </button>
              )}
            </div>

            {topResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-[120] bg-paper border border-ink/10 rounded-[18px] mt-2 shadow-[0_16px_44px_-12px_rgba(26,20,16,0.22)] max-h-[26rem] overflow-y-auto py-1.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', backgroundColor: '#ffffff' }}>
                {topResults.map((item, idx) => (
                  <button
                    key={`top-${idx}`}
                    onClick={() => addFoodFromSearch(item)}
                    className="w-full text-left mx-1.5 px-3 py-2.5 rounded-[12px] hover:bg-lilac/[0.08] transition-colors"
                    style={{ width: 'calc(100% - 0.75rem)' }}
                  >
                    <div className="font-display text-[0.9375rem] text-ink leading-snug">
                      {item.food_name}
                    </div>
                    <div className="font-sans text-[0.72rem] text-taupe tracking-meta uppercase mt-1 tabular-nums">
                      {Math.round(item.kcal)} kcal · 100 g · C {Math.round(item.carbs)} · P {Math.round(item.protein)} · F {Math.round(item.fat)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
          </Reveal>

          {/* Main 2-col */}
          <Reveal delay={160} className="relative z-0">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-8 items-start">

            {/* Left: Image + Totals */}
            <div className="space-y-6">
              {/* Image plate */}
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="mb-0">
                    <span className="inline-block bg-bone rounded-[10px] px-3 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-taupe uppercase">
                      Plate
                    </span>
                  </div>
                  {loading && (
                    <span className="font-sans text-[0.72rem] text-lilac-deep tracking-meta uppercase flex items-center gap-1.5">
                      <Loader2 size={10} className="animate-spin" />
                      Analyzing…
                    </span>
                  )}
                </div>

                <div className="relative aspect-square rounded-[28px] bg-gradient-to-br from-lilac/40 to-paper border border-ink/10 overflow-hidden shadow-[0_10px_28px_-10px_rgba(26,20,16,0.12)] transition-all duration-300 hover:shadow-[0_18px_38px_-12px_rgba(26,20,16,0.2)]">
                  {preview ? (
                    <img
                      src={preview}
                      alt="food"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.src = '/default_food.png'; }}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-hint gap-2">
                      <span className="font-poster text-3xl tracking-tight uppercase">No image</span>
                      <span className="font-sans text-[0.72rem] tracking-meta uppercase">Capture or upload</span>
                    </div>
                  )}

                  {loading && (
                    <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center z-20">
                      <Loader2 className="animate-spin text-ink mb-3" size={22} />
                      <p className="font-sans text-[0.72rem] text-ink tracking-label uppercase">
                        Analyzing image
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-3">
                  <label className="font-sans text-[0.78rem] tracking-label uppercase px-4 py-2.5 border border-lilac-deep text-ink hover:bg-lilac hover:text-ink transition-colors cursor-pointer">
                    → Upload photo
                    <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
                  </label>
                  <button
                    onClick={() => setIsFavSet(!isFavSet)}
                    className={`font-sans text-[0.78rem] tracking-label uppercase px-4 py-2.5 border transition-colors ${
                      isFavSet
                        ? 'bg-lilac/20 border-lilac-deep text-lilac-deep'
                        : 'border-ink/20 text-taupe hover:text-ink hover:border-ink/40'
                    }`}
                  >
                    {isFavSet ? '★ Save as set' : '☆ Save as set'}
                  </button>
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-ink/15 pt-5">
                <div className="mb-3">
                  <span className="inline-block bg-bone rounded-[10px] px-3 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-taupe uppercase">
                    Total
                  </span>
                </div>

                <div className="bg-sky rounded-[20px] p-5 shadow-[0_10px_24px_-10px_rgba(60,140,190,0.5)] mb-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-6xl text-ink tabular-nums leading-none">
                      {Math.round(totals.kcal).toLocaleString()}
                    </span>
                    <span className="font-sans text-base text-ink/65">kcal</span>
                  </div>
                </div>

                <div className="border-t border-ink/10 mt-5 pt-1">
                  {[
                    { label: 'Carbs', value: totals.carbs },
                    { label: 'Protein', value: totals.protein },
                    { label: 'Fat', value: totals.fat },
                  ].map((row, i, arr) => (
                    <div
                      key={row.label}
                      className={`flex justify-between items-baseline py-2 ${
                        i < arr.length - 1 ? 'border-b border-ink/8' : ''
                      }`}
                    >
                      <span className="font-sans text-[0.72rem] text-taupe tracking-meta uppercase">
                        {row.label}
                      </span>
                      <span className="font-sans text-base tabular-nums text-ink">
                        {Math.round(row.value)}<span className="text-hint not-italic font-sans text-xs ml-1">g</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Food list + Save */}
            <div className="space-y-6">
              <div className="rounded-[28px] bg-paper border border-ink/10 shadow-[0_10px_28px_-10px_rgba(26,20,16,0.12)] transition-all duration-300 hover:shadow-[0_18px_38px_-12px_rgba(26,20,16,0.2)] p-6">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="mb-0">
                    <span className="inline-block bg-bone rounded-[10px] px-3 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-taupe uppercase">
                      Items
                    </span>
                  </div>
                  <div className="font-sans text-[0.66rem] text-hint tracking-meta uppercase">
                    C · P · F · kcal per 100g × weight
                  </div>
                </div>

                <div className="border-t border-ink/15">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_auto_4rem_1.5rem] gap-3 items-baseline py-2 border-b border-ink/8 font-sans text-[0.66rem] text-hint tracking-meta uppercase">
                    <span>Name</span>
                    <span className="text-right">C / P / F / kcal</span>
                    <span className="text-right">Weight</span>
                    <span></span>
                  </div>

                  {/* Rows */}
                  <div className="max-h-[27.5rem] overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                    {foods.map((f, i) => (
                      <div
                        key={f.id}
                        className="grid grid-cols-[1fr_auto_4rem_1.5rem] gap-3 items-center py-3 border-b border-ink/8 group relative"
                      >
                        <div className="relative">
                          <input
                            className="w-full bg-transparent font-display text-[0.9375rem] text-ink placeholder:text-hint outline-none border-b border-transparent focus:border-lilac-deep/40 transition-colors py-0.5"
                            value={f.food_name}
                            onChange={(e) => {
                              const n = [...foods];
                              n[i].food_name = e.target.value;
                              setFoods(n);
                              fetchNutrition(i, e.target.value);
                            }}
                            placeholder="음식 이름…"
                          />
                          {dropdownList.index === i && dropdownList.results.length > 0 && (
                            <div className="absolute left-0 right-0 top-full z-[150] bg-paper border border-ink/10 rounded-[16px] mt-2 shadow-[0_16px_44px_-12px_rgba(26,20,16,0.22)] max-h-80 overflow-y-auto py-1.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', backgroundColor: '#ffffff' }}>
                              {dropdownList.results.map((item, idx) => (
                                <button
                                  key={`drop-${idx}`}
                                  type="button"
                                  className="w-full text-left mx-1.5 px-3 py-2.5 rounded-[12px] hover:bg-lilac/[0.08] transition-colors"
                                  style={{ width: 'calc(100% - 0.75rem)' }}
                                  onClick={() => selectFood(i, item)}
                                >
                                  <div className="font-display text-[0.875rem] text-ink">
                                    {item.food_name}
                                  </div>
                                  <div className="font-sans text-[0.72rem] text-taupe tracking-meta uppercase mt-0.5 tabular-nums">
                                    {Math.round(item.kcal)} kcal · 100 g
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-baseline gap-2 font-sans text-[0.78rem] tabular-nums whitespace-nowrap">
                          <span className="text-taupe">{Math.round((f.carbs * f.weight) / 100)}</span>
                          <span className="text-hint">·</span>
                          <span className="text-taupe">{Math.round((f.protein * f.weight) / 100)}</span>
                          <span className="text-hint">·</span>
                          <span className="text-taupe">{Math.round((f.fat * f.weight) / 100)}</span>
                          <span className="text-hint">·</span>
                          <span className="text-ink font-sans text-[0.8125rem]">
                            {Math.round((f.calories * f.weight) / 100)}
                          </span>
                        </div>

                        <input
                          type="number"
                          className="w-16 bg-transparent text-right font-sans text-[0.75rem] tabular-nums text-ink border-b border-ink/15 focus:border-lilac-deep outline-none py-0.5 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          style={{ MozAppearance: 'textfield' }}
                          value={f.weight}
                          onChange={(e) => {
                            const n = [...foods];
                            n[i].weight = Number(e.target.value);
                            setFoods(n);
                          }}
                        />

                        <button
                          onClick={() => setFoods(foods.filter((it) => it.id !== f.id))}
                          className="font-sans text-[0.75rem] text-hint hover:text-ink transition-colors opacity-60 md:opacity-0 md:group-hover:opacity-100"
                          aria-label="삭제"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Save */}
              <div>
                <button
                  onClick={handleSave}
                  aria-invalid={!!saveError}
                  aria-describedby={saveError ? 'save-error' : undefined}
                  className="w-full bg-lilac text-ink rounded-[12px] px-5 py-4 font-sans text-[0.78rem] font-medium tracking-label uppercase hover:opacity-90 transition-opacity"
                >
                  → Complete recording
                </button>
                <FieldError id="save-error">{saveError}</FieldError>
              </div>
            </div>
          </div>
          </Reveal>

          {/* Favorites */}
          <section className="border-t border-ink/15 pt-8 mt-10">
            <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
              <div className="mb-0">
                <span className="inline-block bg-bone rounded-[10px] px-3 py-1 font-sans text-[0.78rem] font-medium tracking-wide text-taupe uppercase">
                  Saved sets
                </span>
              </div>
              <div className="flex gap-3">
                {[
                  { id: 'meal', label: 'Meal sets' },
                  { id: 'snack', label: 'Snack sets' },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`font-sans text-[0.78rem] tracking-meta uppercase transition-colors ${
                        active
                          ? 'bg-lilac text-ink rounded-[10px] px-3 py-1.5'
                          : 'text-taupe hover:text-ink px-3 py-1.5'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {favorites[activeTab] && favorites[activeTab].length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                {favorites[activeTab].map((set, idx) => (
                  <button
                    key={`fav-${idx}`}
                    onClick={() => applyMealSet(set)}
                    className="text-left group"
                  >
                    <div className="aspect-square photo-frame border border-ink/15 bg-paper-soft">
                      <img
                        // 🎯 [수정] 목록에 뿌려질 때도 백엔드 도메인 주소를 붙여서 가져옵니다.
                        src={getFullImageUrl(set.image_url) || '/default_food.png'}
                        alt="favorite"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        onError={(e) => { e.target.src = '/default_food.png'; }}
                      />
                    </div>
                    <p className="font-sans text-[0.8125rem] text-body mt-2 leading-snug line-clamp-2 group-hover:text-ink transition-colors">
                      {set.items.map((it) => it.food_name).join(', ')}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-ink/15 py-12 text-center">
                <p className="font-sans text-sm text-hint">
                  저장된 세트가 없습니다.
                </p>
                <p className="font-sans text-[0.72rem] text-hint tracking-meta uppercase mt-2">
                  · Save current as set 로 만들기
                </p>
              </div>
            )}
          </section>

          {/* Footer */}
          <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-sans text-[0.78rem] text-hint tracking-meta">
            <span className="uppercase">— FITCOACH —</span>
            <span className="uppercase text-taupe">Entry · {mealType}</span>
          </div>
        </div>
      </PageSurface>
    </div>
  );
};

export default DietAddPage;
