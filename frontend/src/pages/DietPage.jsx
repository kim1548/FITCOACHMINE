import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import NutritionProgressRow from '../components/NutritionProgressRow';
import PageSurface from '../components/PageSurface';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmProvider';
import usePageTitle from '../hooks/usePageTitle';

/**
 * /meals — Daily meals magazine (Editorial Magazine 톤).
 *
 * 헤드라인 → Daily target → Entries(아침·점심·저녁 + 간식) 타임라인 → Coach's note.
 * 한 entry 안에서 개별 항목 X 삭제 / Edit / Record.
 */

const MEAL_TYPES = [
  { type: '아침', label: 'Morning' },
  { type: '점심', label: 'Noon' },
  { type: '저녁', label: 'Evening' },
];

const todayMeta = () => {
  const d = new Date();
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${m} ${String(d.getDate()).padStart(2, '0')} · ${dow}`;
};

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ============================================================
// MealRow — 한 entry(아침/점심/저녁 또는 간식 그룹)
// ============================================================
const MealRow = ({ no, label, sublabel, items, onEdit, onReset, onDeleteItem }) => {
  const hasData = items.length > 0;
  return (
    <article className="py-5 border-b border-ink/8 last:border-b-0">
      <div className="flex items-baseline gap-3 flex-wrap mb-2">
        <span className="font-display italic text-2xl leading-none text-hint tabular-nums">
          {no}
        </span>
        <span className="font-display text-2xl text-ink leading-tight">
          {label}
        </span>
        <span className="font-mono text-[0.625rem] text-taupe tracking-meta uppercase">
          · {sublabel}
        </span>
        <span className="ml-auto font-mono text-[0.625rem] text-hint tracking-meta uppercase">
          {hasData ? `${items.length} item${items.length > 1 ? 's' : ''}` : 'Empty'}
        </span>
        {hasData && onReset && (
          <button
            onClick={onReset}
            className="font-mono text-[0.625rem] tracking-meta uppercase text-taupe hover:text-accent-red transition-colors"
            aria-label="초기화"
          >
            ↻ Reset
          </button>
        )}
      </div>

      {hasData ? (
        <ul className="space-y-1 my-3 border-t border-ink/10 pt-2">
          {items.map((m) => (
            <li
              key={m.id}
              className="flex justify-between items-center py-1.5 group"
            >
              <span className="font-display text-[0.9375rem] text-body leading-snug">
                · {m.food_name}
              </span>
              <button
                onClick={() => onDeleteItem(m.id)}
                className="font-mono text-[0.6875rem] text-hint hover:text-accent-red transition-colors opacity-60 md:opacity-0 md:group-hover:opacity-100"
                aria-label="삭제"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-display italic text-sm text-hint mb-3 mt-2">
          No data recorded.
        </p>
      )}

      <button
        onClick={onEdit}
        className="font-mono text-[0.6875rem] tracking-label uppercase text-accent-red hover:text-ink transition-colors"
      >
        {hasData ? '→ Edit entry' : '→ Record entry'}
      </button>
    </article>
  );
};

// ============================================================
// DietPage
// ============================================================
const DietPage = () => {
  usePageTitle('Meals · FitCoach');

  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [summary, setSummary] = useState({ total: { kcal: 0, carbs: 0, protein: 0, fat: 0 }, logs: [] });
  const [me, setMe] = useState(null);
  const [aiFeedback, setAiFeedback] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/diet/daily-summary`, { headers: authHeaders() });
      if (res.data) setSummary(res.data);
    } catch (err) {
      console.error('로드 실패', err);
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    axios
      .get(`${API_BASE_URL}/user/me`, { headers: authHeaders() })
      .then((res) => setMe(res.data))
      .catch(() => setMe(null));
  }, []);

  const getAiFeedback = useCallback(async () => {
    setAiLoading(true);
    try {
      const foodData = `칼로리 ${summary?.total?.kcal}kcal, 탄수화물 ${summary?.total?.carbs}g, 단백질 ${summary?.total?.protein}g, 지방 ${summary?.total?.fat}g`;
      const res = await axios.post(`${API_BASE_URL}/ai-feedback`, {
        type: 'TOTAL_DIET',
        food_data: foodData,
      });
      setAiFeedback(res.data.feedback);
    } catch (err) {
      console.error('AI 피드백 오류:', err);
      setAiFeedback('피드백을 가져오는데 실패했습니다.');
    }
    setAiLoading(false);
  }, [summary]);

  // 칼로리가 들어왔고 아직 피드백 없으면 자동 1회 호출.
  useEffect(() => {
    if (summary?.total?.kcal > 0 && !aiFeedback) {
      getAiFeedback();
    }
  }, [summary, aiFeedback, getAiFeedback]);

  const handleReset = async (mealType) => {
    const ok = await confirm({
      title: `${mealType} 기록을 초기화할까요?`,
      description: '해당 끼니에 기록된 항목이 모두 삭제됩니다.',
      confirmLabel: 'Reset',
      destructive: true,
    });
    if (!ok) return;
    try {
      await axios.post(
        `${API_BASE_URL}/diet/record-many`,
        { meal_type: mealType, items: [] },
        { headers: authHeaders() },
      );
      fetchSummary();
      toast.success(`${mealType} 기록을 초기화했습니다.`);
    } catch (err) {
      toast.error('초기화에 실패했습니다.');
    }
  };

  const handleDeleteItem = async (itemId) => {
    const ok = await confirm({
      title: '이 항목을 삭제할까요?',
      description: '삭제 후 되돌릴 수 없습니다.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await axios.delete(`${API_BASE_URL}/diet/log/${itemId}`, { headers: authHeaders() });
      fetchSummary();
    } catch (err) {
      toast.error('삭제에 실패했습니다.');
    }
  };

  // ---------- Derived ----------
  const mainMeals = useMemo(
    () => MEAL_TYPES.map(({ type, label }) => {
      const items = (summary?.logs || []).filter((l) => l.meal_type === type);
      return { type, label, items };
    }),
    [summary],
  );

  const snackGroups = useMemo(() => {
    const groups = (summary?.logs || [])
      .filter((l) => l.meal_type === '간식')
      .reduce((acc, log) => {
        const gid = log.entry_group_id || `snack_${log.id}`;
        if (!acc[gid]) acc[gid] = [];
        acc[gid].push(log);
        return acc;
      }, {});
    return Object.entries(groups);
  }, [summary]);

  const totalEntries =
    mainMeals.filter((m) => m.items.length > 0).length + snackGroups.length;

  const handleAddSnack = () => {
    const newGroupId = `snack_${Date.now()}`;
    navigate(`/meals/add?type=간식&group=${newGroupId}&mode=new`);
  };

  return (
    <div
      className="fixed inset-0 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in duration-300"
      style={{ scrollbarWidth: 'none' }}
    >
      <PageSurface maxWidth={1100}>
        <div className="w-full px-6 md:px-12 py-8">

          {/* Headline */}
          <div className="max-w-[40rem] pb-6">
            <div className="flex items-baseline justify-between mb-3">
              <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
                — Meals · Today
              </div>
              <div className="font-mono text-[0.625rem] text-hint tracking-meta uppercase">
                {totalEntries.toString().padStart(2, '0')} entries
              </div>
            </div>
            <h1 className="font-display text-4xl md:text-5xl leading-[1.0] tracking-tight font-normal">
              Macros, <em className="italic text-accent-gold">accounted for.</em>
            </h1>
            <p className="font-display italic text-sm text-taupe mt-3 leading-relaxed">
              한 끼씩 기록해 두면 일주일 뒤의 자신이 더 정확히 보입니다.
            </p>
          </div>

          {/* Daily target */}
          <section className="border-t border-b border-ink/12 py-6 mb-2">
            <div className="flex items-baseline justify-between mb-5">
              <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
                — Daily target
              </div>
              {me?.goal && (
                <span className="font-mono text-[0.625rem] text-hint tracking-meta uppercase">
                  Goal · {me.goal}
                </span>
              )}
            </div>

            {me?.nutrition ? (
              <div className="space-y-4">
                <NutritionProgressRow
                  label="Calories"
                  consumed={summary?.total?.kcal || 0}
                  target={me.nutrition.target_kcal}
                  unit=" kcal"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-3 border-t border-ink/10">
                  <NutritionProgressRow
                    label="Carbs"
                    consumed={summary?.total?.carbs || 0}
                    target={me.nutrition.target_carbs}
                    unit="g"
                  />
                  <NutritionProgressRow
                    label="Protein"
                    consumed={summary?.total?.protein || 0}
                    target={me.nutrition.target_protein}
                    unit="g"
                  />
                  <NutritionProgressRow
                    label="Fat"
                    consumed={summary?.total?.fat || 0}
                    target={me.nutrition.target_fat}
                    unit="g"
                  />
                </div>
                <p className="font-mono text-[0.5625rem] text-hint tracking-meta uppercase pt-2">
                  BMR {me.nutrition.bmr} · TDEE {me.nutrition.tdee} kcal
                </p>
              </div>
            ) : me ? (
              <p className="font-display italic text-sm text-body leading-relaxed">
                프로필에 <span className="not-italic text-accent-gold font-mono text-[0.6875rem] tracking-meta uppercase">나이</span>가
                비어있어 목표 계산이 안 돼요. 회원가입 시 나이를 입력하면 자동 계산됩니다.
              </p>
            ) : (
              <p className="font-display italic text-sm text-hint">
                로그인 후 영양 목표가 표시됩니다.
              </p>
            )}
          </section>

          {/* Entries timeline */}
          <section className="pt-8">
            <div className="flex items-baseline justify-between mb-3">
              <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
                — Entries
              </div>
              <div className="font-mono text-[0.625rem] text-hint tracking-meta uppercase">
                {todayMeta()}
              </div>
            </div>

            <div className="border-t border-ink/15">
              {mainMeals.map((meal, idx) => (
                <MealRow
                  key={meal.type}
                  no={String(idx + 1).padStart(2, '0')}
                  label={meal.type}
                  sublabel={meal.label}
                  items={meal.items}
                  onEdit={() => navigate(`/meals/add?type=${meal.type}`)}
                  onReset={() => handleReset(meal.type)}
                  onDeleteItem={handleDeleteItem}
                />
              ))}
            </div>

            {/* Snacks subsection */}
            <div className="flex items-baseline justify-between mt-10 mb-3">
              <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
                — Snacks
              </div>
              <div className="font-mono text-[0.625rem] text-hint tracking-meta uppercase">
                {snackGroups.length.toString().padStart(2, '0')} entries
              </div>
            </div>

            <div className="border-t border-ink/15">
              {snackGroups.map(([groupId, items], idx) => (
                <MealRow
                  key={groupId}
                  no={String(mainMeals.length + idx + 1).padStart(2, '0')}
                  label="간식"
                  sublabel={`Snack ${idx + 1}`}
                  items={items}
                  onEdit={() => navigate(`/meals/add?type=간식&group=${groupId}`)}
                  onDeleteItem={handleDeleteItem}
                />
              ))}

              {/* Add new snack */}
              <button
                onClick={handleAddSnack}
                className="w-full flex items-center justify-between py-5 border-b border-ink/8 last:border-b-0 hover:bg-ink/[0.03] transition-colors text-left"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-display italic text-2xl leading-none text-hint">
                    +
                  </span>
                  <span className="font-display text-xl text-taupe leading-tight">
                    Add new snack
                  </span>
                </div>
                <span className="font-mono text-[0.625rem] text-hint tracking-meta uppercase">
                  → New entry
                </span>
              </button>
            </div>
          </section>

          {/* Coach's note (AI feedback) */}
          <section className="-mx-6 md:-mx-12 px-6 md:px-12 py-6 mt-10 border-y border-ink/15 bg-accent-red/[0.04]">
            <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
              <div className="font-mono text-[0.625rem] text-accent-red tracking-label uppercase">
                — Coach's note · Today's macros
              </div>
              <button
                onClick={getAiFeedback}
                disabled={aiLoading}
                className="font-mono text-[0.625rem] tracking-label uppercase text-taupe hover:text-ink disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                {aiLoading && <Loader2 size={10} className="animate-spin" />}
                {aiLoading ? 'Analyzing…' : '↻ Refresh'}
              </button>
            </div>

            {aiFeedback ? (
              <blockquote className="font-display italic text-lg text-ink leading-relaxed m-0 max-w-[92%]">
                "{aiFeedback}"
              </blockquote>
            ) : aiLoading ? (
              <p className="font-display italic text-sm text-taupe">
                Gemma-3 이 오늘의 식단을 분석 중…
              </p>
            ) : (
              <p className="font-display italic text-sm text-hint">
                기록된 식단이 있으면 자동으로 코멘트가 생성됩니다.
              </p>
            )}
          </section>

          {/* Footer */}
          <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-mono text-[0.6875rem] text-hint tracking-meta">
            <span className="uppercase">— FITCOACH —</span>
            <span className="uppercase text-taupe">Daily · {todayMeta()}</span>
          </div>
        </div>
      </PageSurface>
    </div>
  );
};

export default DietPage;
