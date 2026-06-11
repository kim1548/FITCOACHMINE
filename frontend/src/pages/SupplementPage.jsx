import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2, Pill, Tablets, Fish, Sprout, Dumbbell, Sparkles, Bone, Leaf, Atom } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import PageSurface from '../components/PageSurface';
import { useToast } from '../components/ui/Toast';
import usePageTitle from '../hooks/usePageTitle';

/**
 * /supplement — 영양제 맞춤 추천 (Editorial Magazine 톤).
 *
 * 건강 프로필 입력 → 부족 영양소 레이더 → 추천 카드(점수·경고·AI 이유).
 * 추천 로직은 백엔드 휴리스틱 엔진(규칙 기반), AI 멘트는 Ollama gemma3:4b.
 */

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const splitCsv = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const joinCsv = (arr) => (arr || []).join(', ');

const SLOTS = ['아침', '점심', '저녁', '상관없음'];

const won = (n) => (n == null ? null : `${Math.round(n).toLocaleString('ko-KR')}원`);
// 직접 구매 링크가 없으면 쿠팡 검색으로 폴백.
const buyLink = (r) => r.buy_url || `https://www.coupang.com/np/search?q=${encodeURIComponent(`${r.brand || ''} ${r.name}`.trim())}`;

// 실제 사진(image_url)이 없을 때 보여줄 카테고리 아이콘.
const CAT_ICON = {
  '비타민': Pill, '미네랄': Tablets, '오메가': Fish,
  '유산균': Sprout, '단백질': Dumbbell, '복합': Sparkles,
  '콜라겐': Sparkles, '관절': Bone, '간건강': Leaf, '기능성': Atom,
};

const ProductThumb = ({ r }) => {
  if (r.image_url) {
    return <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" />;
  }
  const Icon = CAT_ICON[r.category] || Pill;
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-paper">
      <Icon size={24} strokeWidth={1.5} className="text-accent-gold/80" />
      <span className="font-mono text-[0.5rem] text-taupe tracking-meta uppercase">{r.category}</span>
    </div>
  );
};

const inputCls =
  'w-full px-3 py-2 outline-none text-sm font-display bg-paper border border-ink/15 focus:border-accent-red text-ink transition-colors';
const fieldLabelCls =
  'block font-mono text-[0.625rem] text-taupe tracking-meta uppercase mb-1';

const SupplementPage = () => {
  usePageTitle('Supplements · FitCoach');
  const toast = useToast();

  const [profile, setProfile] = useState({
    is_smoker: false, is_pregnant: false, allergies: [], conditions: [], medications: [],
  });
  const [allergyText, setAllergyText] = useState('');
  const [conditionText, setConditionText] = useState('');
  const [medicationText, setMedicationText] = useState('');
  const [concerns, setConcerns] = useState([]);
  const [concernOptions, setConcernOptions] = useState([]);
  const [concernPickerOpen, setConcernPickerOpen] = useState(false);

  const [recos, setRecos] = useState([]);
  const [radar, setRadar] = useState([]);
  const [mySupps, setMySupps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recommending, setRecommending] = useState(false);
  const [regenId, setRegenId] = useState(null);

  const fetchProfile = useCallback(() => {
    axios
      .get(`${API_BASE_URL}/supplement/profile`, { headers: authHeaders() })
      .then((res) => {
        const p = res.data || {};
        setProfile(p);
        setAllergyText(joinCsv(p.allergies));
        setConditionText(joinCsv(p.conditions));
        setMedicationText(joinCsv(p.medications));
        setConcerns(p.concerns || []);
      })
      .catch(() => {});
  }, []);

  const fetchConcernOptions = useCallback(() => {
    return axios
      .get(`${API_BASE_URL}/supplement/concerns`, { headers: authHeaders() })
      .then((res) => setConcernOptions(res.data?.concerns || []))
      .catch(() => setConcernOptions([]));
  }, []);

  const toggleConcern = (c) =>
    setConcerns((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const fetchRecommendations = useCallback(() => {
    return axios
      .get(`${API_BASE_URL}/supplement/recommendations`, { headers: authHeaders() })
      .then((res) => {
        setRecos(res.data?.recommendations || []);
        setRadar(res.data?.radar || []);
      })
      .catch(() => { setRecos([]); setRadar([]); });
  }, []);

  const fetchMy = useCallback(() => {
    return axios
      .get(`${API_BASE_URL}/supplement/my`, { headers: authHeaders() })
      .then((res) => setMySupps(res.data?.items || []))
      .catch(() => setMySupps([]));
  }, []);

  const mySet = useMemo(() => new Set(mySupps.map((s) => s.supplement_id)), [mySupps]);
  const checkedCount = useMemo(() => mySupps.filter((s) => s.checked_today).length, [mySupps]);

  const toggleMy = async (r) => {
    try {
      if (mySet.has(r.supplement_id)) {
        await axios.delete(`${API_BASE_URL}/supplement/my/${r.supplement_id}`, { headers: authHeaders() });
      } else {
        await axios.post(`${API_BASE_URL}/supplement/my`, { supplement_id: r.supplement_id }, { headers: authHeaders() });
      }
      await fetchMy();
    } catch {
      toast.error('처리에 실패했습니다.');
    }
  };

  const toggleIntake = async (sid) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/supplement/intake/toggle`, { supplement_id: sid }, { headers: authHeaders() });
      setMySupps((prev) => prev.map((s) => (s.supplement_id === sid ? { ...s, checked_today: res.data.checked } : s)));
    } catch {
      toast.error('체크에 실패했습니다.');
    }
  };

  const changeSlot = async (sid, slot) => {
    try {
      await axios.put(`${API_BASE_URL}/supplement/my/${sid}/slot`, { slot }, { headers: authHeaders() });
      setMySupps((prev) => prev.map((s) => (s.supplement_id === sid ? { ...s, slot } : s)));
    } catch {
      toast.error('시간대 변경에 실패했습니다.');
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchProfile(), fetchConcernOptions(), fetchRecommendations(), fetchMy()])
      .finally(() => setLoading(false));
  }, [fetchProfile, fetchConcernOptions, fetchRecommendations, fetchMy]);

  // 부족으로 판정된 영양소(점수 높은 순). 달성률 바의 대상.
  const deficientBars = useMemo(
    () => radar.filter((r) => r.deficient).sort((a, b) => b.score - a.score),
    [radar],
  );
  // 추천 영양제들이 해당 부족 영양소를 채우는 최대 커버리지(%) = 달성률.
  const coverageOf = (code) => {
    let best = 0;
    recos.forEach((r) => (r.covered || []).forEach((c) => {
      if (c.code === code) best = Math.max(best, c.coverage || 0);
    }));
    return Math.round(best * 100);
  };

  const handleRecommend = async () => {
    setRecommending(true);
    try {
      // 추천은 최신 프로필 기준 — 먼저 저장 후 산출.
      await axios.put(`${API_BASE_URL}/supplement/profile`, {
        is_smoker: profile.is_smoker,
        is_pregnant: profile.is_pregnant,
        allergies: splitCsv(allergyText),
        conditions: splitCsv(conditionText),
        medications: splitCsv(medicationText),
        concerns,
      }, { headers: authHeaders() });
      await axios.post(`${API_BASE_URL}/supplement/recommend`, {}, { headers: authHeaders() });
      await fetchRecommendations();
      setConcernPickerOpen(false);
      toast.success('맞춤 추천을 생성했습니다. AI 코멘트는 잠시 후 채워집니다.');
    } catch {
      toast.error('추천 생성에 실패했습니다.');
    } finally {
      setRecommending(false);
    }
  };

  const handleRegen = async (recoId) => {
    setRegenId(recoId);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/supplement/recommendations/${recoId}/regenerate`, {},
        { headers: authHeaders() },
      );
      setRecos((prev) => prev.map((r) =>
        r.recommendation_id === recoId ? { ...r, ai_comment: res.data.ai_comment } : r));
    } catch {
      toast.error('AI 코멘트 생성에 실패했습니다. (Ollama 서버가 켜져 있는지 확인하세요)');
    } finally {
      setRegenId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in duration-300"
      style={{ scrollbarWidth: 'none' }}
    >
      <PageSurface maxWidth={1100}>
        <div className="w-full px-6 md:px-12 py-8">

          {/* Headline */}
          <div className="pb-6">
            <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase mb-3">
              — Supplements · Personalized
            </div>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div className="max-w-[40rem]">
                <h1 className="font-display text-4xl md:text-5xl leading-[1.0] tracking-tight font-normal">
                  Fill the <em className="italic text-accent-gold">gaps.</em>
                </h1>
                <p className="font-display italic text-sm text-taupe mt-3 leading-relaxed">
                  고민을 고르면 그에 맞는 영양제를 추천해 드려요. 추가해두면 매일 챙길 수 있어요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConcernPickerOpen(true)}
                className="font-mono text-[0.6875rem] tracking-label uppercase px-5 py-3 border border-accent-red text-accent-red hover:bg-accent-red hover:text-ink transition-colors flex-shrink-0"
              >
                ✦ 맞춤 추천 받기
              </button>
            </div>
          </div>

          {/* 고민이 무엇인가요? — '맞춤 추천 받기'를 누르면 열리는 고민 선택 창 */}
          {concernPickerOpen && concernOptions.length > 0 && (
            <section className="border-t border-b border-ink/12 py-6 mb-2 animate-in fade-in duration-200">
              <div className="flex items-baseline justify-between mb-1">
                <h2 className="font-display text-2xl text-ink leading-tight">고민이 무엇인가요?</h2>
                <button
                  type="button"
                  onClick={() => setConcernPickerOpen(false)}
                  className="font-mono text-[0.625rem] text-hint hover:text-ink tracking-meta uppercase"
                >
                  닫기 ✕
                </button>
              </div>
              <p className="font-display italic text-sm text-taupe mb-4">
                고민을 고르면 그쪽 영양제를 추천해 드려요. (복수 선택 가능)
              </p>
              <div className="flex flex-wrap gap-2">
                {concernOptions.map((c) => {
                  const on = concerns.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleConcern(c)}
                      className={`font-mono text-[0.6875rem] tracking-label uppercase px-3 py-1.5 border transition-colors ${
                        on
                          ? 'border-accent-red bg-accent-red text-ink'
                          : 'border-ink/20 text-taupe hover:border-accent-red hover:text-accent-red'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>

              {/* 건강 정보 (안전 필터용) — 창 안에 내장 */}
              <div className="mt-6 pt-5 border-t border-ink/10">
                <div className="font-mono text-[0.625rem] text-taupe tracking-meta uppercase mb-3">
                  건강 정보 (선택) · 부작용 경고에 사용돼요
                </div>
                <div className="flex flex-wrap gap-6 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!profile.is_smoker}
                      onChange={(e) => setProfile((p) => ({ ...p, is_smoker: e.target.checked }))}
                      className="accent-accent-red w-4 h-4"
                    />
                    <span className="font-display text-sm text-ink">흡연</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!profile.is_pregnant}
                      onChange={(e) => setProfile((p) => ({ ...p, is_pregnant: e.target.checked }))}
                      className="accent-accent-red w-4 h-4"
                    />
                    <span className="font-display text-sm text-ink">임신 / 수유</span>
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={fieldLabelCls}>알러지 (쉼표로 구분)</label>
                    <input className={inputCls} value={allergyText}
                      onChange={(e) => setAllergyText(e.target.value)} placeholder="예: 갑각류" />
                  </div>
                  <div>
                    <label className={fieldLabelCls}>기저질환</label>
                    <input className={inputCls} value={conditionText}
                      onChange={(e) => setConditionText(e.target.value)} placeholder="예: 신장질환" />
                  </div>
                  <div>
                    <label className={fieldLabelCls}>복용 중인 약</label>
                    <input className={inputCls} value={medicationText}
                      onChange={(e) => setMedicationText(e.target.value)} placeholder="예: 와파린" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-6">
                <button
                  type="button"
                  onClick={handleRecommend}
                  disabled={recommending || concerns.length === 0}
                  className="font-mono text-[0.6875rem] tracking-label uppercase px-5 py-2.5 border border-accent-red text-accent-red hover:bg-accent-red hover:text-ink transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-accent-red"
                >
                  {recommending ? '분석 중…' : '이 고민으로 추천받기'}
                </button>
                {concerns.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConcerns([])}
                    className="font-mono text-[0.625rem] tracking-meta uppercase text-hint hover:text-accent-red transition-colors"
                  >
                    선택 초기화
                  </button>
                )}
              </div>
            </section>
          )}

          {loading && (
            <div className="border-y border-ink/15 py-16 text-center text-taupe">
              <Loader2 className="animate-spin mx-auto mb-3" size={18} />
              <p className="font-mono text-[0.625rem] tracking-meta uppercase">Loading…</p>
            </div>
          )}

          {!loading && (
            <>
              {/* 영양제 달성률 — 추천 영양제가 부족 영양소를 얼마나 채우는지 */}
              {deficientBars.length > 0 && (
                <section className="py-8">
                  <div className="flex items-baseline justify-between mb-4">
                    <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
                      — Nutrient gaps
                    </div>
                    <div className="font-mono text-[0.625rem] text-hint tracking-meta uppercase">
                      추천 영양제 기준 달성률
                    </div>
                  </div>
                  <div className="border-t border-ink/12 pt-5 flex flex-col gap-4">
                    {deficientBars.map((d) => {
                      const pct = coverageOf(d.code);
                      return (
                        <div key={d.code}>
                          <div className="flex items-baseline justify-between mb-1.5">
                            <span className="font-display text-sm text-ink">{d.name}</span>
                            <span className="font-mono text-[0.6875rem] text-taupe tabular-nums">{pct}%</span>
                          </div>
                          <div className="h-2 bg-ink/10 overflow-hidden">
                            <div
                              className="h-full bg-accent-gold transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {recos.length === 0 && (
                    <p className="font-mono text-[0.625rem] text-hint tracking-meta uppercase mt-4">
                      "맞춤 추천 받기"를 누르면 달성률이 채워집니다
                    </p>
                  )}
                </section>
              )}

              {/* 내 영양제 · 오늘 체크 (담은 영양제를 시간대별로 매일 체크) */}
              {mySupps.length > 0 && (
                <section className="border-t border-ink/12 py-8">
                  <div className="flex items-baseline justify-between mb-4">
                    <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
                      — 내 영양제 · 오늘
                    </div>
                    <div className="font-mono text-[0.625rem] text-hint tracking-meta uppercase tabular-nums">
                      {checkedCount}/{mySupps.length} 완료
                    </div>
                  </div>

                  {SLOTS.map((slot) => {
                    const items = mySupps.filter((s) => s.slot === slot);
                    if (!items.length) return null;
                    return (
                      <div key={slot} className="mb-4 last:mb-0">
                        <div className="font-mono text-[0.625rem] text-accent-gold tracking-meta uppercase mb-2">
                          {slot}
                        </div>
                        <div className="border-t border-ink/10">
                          {items.map((it) => (
                            <div key={it.supplement_id} className="flex items-start gap-3 py-2.5 border-b border-ink/8">
                              <button
                                type="button"
                                onClick={() => toggleIntake(it.supplement_id)}
                                aria-label="복용 체크"
                                className={`w-5 h-5 flex-shrink-0 mt-0.5 border flex items-center justify-center text-[0.75rem] leading-none transition-colors ${
                                  it.checked_today
                                    ? 'bg-accent-gold border-accent-gold text-surface'
                                    : 'border-ink/30 text-transparent hover:border-accent-gold'
                                }`}
                              >
                                ✓
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className={`font-display text-sm leading-tight truncate ${
                                  it.checked_today ? 'text-hint line-through' : 'text-ink'
                                }`}>
                                  {it.brand ? `${it.brand} ` : ''}{it.name}
                                </div>
                                {it.slot_reason && (
                                  <div className="font-mono text-[0.5625rem] text-hint tracking-tight leading-snug mt-0.5">
                                    🕑 {it.slot_reason}
                                  </div>
                                )}
                              </div>
                              <select
                                value={it.slot}
                                onChange={(e) => changeSlot(it.supplement_id, e.target.value)}
                                className="font-mono text-[0.625rem] bg-paper border border-ink/15 text-taupe px-1.5 py-1 mt-0.5 outline-none focus:border-accent-red flex-shrink-0"
                              >
                                {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <button
                                type="button"
                                onClick={() => toggleMy(it)}
                                aria-label="제거"
                                className="font-mono text-[0.6875rem] text-hint hover:text-accent-red transition-colors px-1 mt-1 flex-shrink-0"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}

              {/* 추천 카드 */}
              <section className="pt-2">
                <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase mb-4">
                  — Recommendations
                </div>

                {recos.length === 0 ? (
                  <div className="border-y border-ink/15 py-16 text-center">
                    <p className="font-display text-lg text-ink mb-2">아직 추천이 없습니다.</p>
                    <p className="font-display italic text-sm text-taupe">
                      "맞춤 추천 받기"를 눌러 고민을 고르면 추천이 시작됩니다.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-ink/10 border border-ink/10">
                    {recos.map((r) => (
                      <article
                        key={r.recommendation_id}
                        onClick={() => toggleMy(r)}
                        title={mySet.has(r.supplement_id) ? '눌러서 내 영양제에서 빼기' : '눌러서 내 영양제에 추가'}
                        className={`bg-surface p-5 flex flex-col gap-3 cursor-pointer transition-shadow ${
                          mySet.has(r.supplement_id)
                            ? 'ring-1 ring-inset ring-accent-gold'
                            : 'hover:ring-1 hover:ring-inset hover:ring-ink/20'
                        }`}
                      >
                        {/* 제품 헤더: 사진 + 브랜드/제품명 + 매치 점수 */}
                        <div className="flex items-start gap-3">
                          <div className="w-16 h-16 flex-shrink-0 border border-ink/15 overflow-hidden">
                            <ProductThumb r={r} />
                          </div>
                          <div className="flex-1 min-w-0">
                            {r.brand && (
                              <div className="font-mono text-[0.5625rem] text-accent-red tracking-meta uppercase mb-0.5">
                                {r.brand}
                              </div>
                            )}
                            <h3 className="font-display text-lg text-ink leading-tight">{r.name}</h3>
                            <div className="font-mono text-[0.5625rem] text-taupe tracking-meta uppercase mt-1">
                              {r.category} · {r.timing}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-display text-2xl text-accent-gold tabular-nums leading-none">
                              {Math.round(r.score)}
                            </div>
                            <div className="font-mono text-[0.5625rem] text-hint tracking-meta uppercase">match</div>
                          </div>
                        </div>

                        {/* 가격 · 평점 · 구매 */}
                        <div className="flex items-center justify-between gap-2 border-y border-ink/10 py-2">
                          <div className="flex items-baseline gap-3">
                            {won(r.price) && (
                              <span className="font-display text-base text-ink tabular-nums">{won(r.price)}</span>
                            )}
                            {r.rating != null && (
                              <span className="font-mono text-[0.6875rem] text-accent-gold tabular-nums">★ {r.rating}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`font-mono text-[0.625rem] tracking-label uppercase ${
                                mySet.has(r.supplement_id) ? 'text-accent-gold' : 'text-hint'
                              }`}
                            >
                              {mySet.has(r.supplement_id) ? '✓ 추가됨' : '눌러서 추가'}
                            </span>
                            <a
                              href={buyLink(r)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono text-[0.625rem] tracking-label uppercase px-3 py-1.5 border border-accent-red text-accent-red hover:bg-accent-red hover:text-ink transition-colors"
                            >
                              구매 →
                            </a>
                          </div>
                        </div>

                        {/* 커버하는 부족 영양소 */}
                        <div className="flex flex-wrap gap-1.5">
                          {(r.covered || []).map((c) => (
                            <span key={c.code}
                              className="font-mono text-[0.5625rem] tracking-meta uppercase px-2 py-1 border border-accent-red/40 text-accent-red">
                              {c.name} {c.amount}{c.unit}
                            </span>
                          ))}
                        </div>

                        {/* 경고 배지 */}
                        {(r.warnings || []).length > 0 && (
                          <div className="flex flex-col gap-1">
                            {r.warnings.map((w, i) => (
                              <div key={i}
                                className="font-display text-[0.8125rem] text-accent-red/90 leading-snug flex gap-1.5">
                                <span aria-hidden>⚠</span><span>{w}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* AI 추천 이유 */}
                        <div className="mt-auto pt-2 border-t border-ink/10">
                          {regenId === r.recommendation_id ? (
                            <div className="flex items-center gap-2 text-taupe">
                              <Loader2 className="animate-spin" size={14} />
                              <span className="font-display italic text-[0.8125rem]">AI가 추천 이유를 작성 중…</span>
                            </div>
                          ) : r.ai_comment ? (
                            <blockquote className="font-display italic text-[0.8125rem] text-body leading-relaxed border-l-2 border-accent-gold pl-3 m-0">
                              "{r.ai_comment}"
                            </blockquote>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRegen(r.recommendation_id); }}
                              className="font-mono text-[0.625rem] tracking-meta uppercase text-hint hover:text-ink transition-colors"
                            >
                              ✦ AI 추천 이유 생성
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {/* 면책 */}
              <p className="font-display italic text-[0.75rem] text-hint leading-relaxed mt-6">
                ※ 본 추천은 정보 제공 목적이며 의학적 진단·처방이 아닙니다. 복용 전 전문가 상담을 권장합니다.
              </p>
            </>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-mono text-[0.6875rem] text-hint tracking-meta">
            <span className="uppercase">— FITCOACH —</span>
            <span className="uppercase text-taupe">Supplements · {recos.length} picks</span>
          </div>
        </div>
      </PageSurface>
    </div>
  );
};

export default SupplementPage;
