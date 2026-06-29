import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { Loader2 } from 'lucide-react';
import JournalDayModal from '../components/JournalDayModal';
import PageSurface from '../components/PageSurface';
import usePageTitle from '../hooks/usePageTitle';
import Reveal from '../components/Reveal';

const WEEK_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const toISO = (year, month, day) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const JournalPage = ({ theme }) => {
  usePageTitle('Journal · FitCoach');

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [nutrition, setNutrition] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [weeklyGenerating, setWeeklyGenerating] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState(null);

  const fetchCalendar = useCallback(() => {
    setLoading(true);
    axios.get(`${API_BASE_URL}/journal/calendar`, {
      params: { year, month },
      headers: authHeaders(),
    })
      .then(res => setCalendar(res.data))
      .catch(() => setCalendar({ year, month, days: [] }))
      .finally(() => setLoading(false));
  }, [year, month]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  // 월간 통계 카드(총 세트·볼륨·이달의 PR) — 보고 있는 달 기준으로 서버 집계.
  useEffect(() => {
    axios.get(`${API_BASE_URL}/report/monthly-stats`, {
      params: { year, month },
      headers: authHeaders(),
    })
      .then(res => setMonthlyStats(res.data))
      .catch(() => setMonthlyStats(null));
  }, [year, month]);

  // 주간 리포트 통계는 진입 시 즉시 로드 (AI 총평은 버튼으로 별도 생성)
  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/report/weekly`, { headers: authHeaders() })
      .then((res) => setWeekly(res.data))
      .catch(() => setWeekly(null));
  }, []);

  const generateWeekly = async () => {
    setWeeklyGenerating(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/report/weekly/ai`, {}, { headers: authHeaders() });
      setWeeklySummary(res.data.summary);
      setWeekly(res.data);
    } catch (err) {
      setWeeklySummary('AI 총평 생성에 실패했습니다. (Ollama 서버가 켜져 있는지 확인하세요)');
    } finally {
      setWeeklyGenerating(false);
    }
  };

  useEffect(() => {
    axios.get(`${API_BASE_URL}/user/me`, { headers: authHeaders() })
      .then(res => setNutrition(res.data?.nutrition || null))
      .catch(() => setNutrition(null));
  }, []);

  const goPrevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const goNextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayISO = toISO(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const dayMap = (calendar?.days || []).reduce((acc, d) => {
    acc[d.date] = d;
    return acc;
  }, {});

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ kind: 'pad', key: `pad-${i}` });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toISO(year, month, d);
    cells.push({ kind: 'day', key: iso, day: d, iso, info: dayMap[iso] });
  }
  // 마지막 주의 빈 칸을 채워(7의 배수) 그리드 배경이 회색 블록으로 비치지 않게 한다.
  while (cells.length % 7 !== 0) cells.push({ kind: 'pad', key: `padend-${cells.length}` });

  // 월간 요약 통계 — 보고 있는 달 기준.
  const stats = useMemo(() => {
    const days = calendar?.days || [];
    const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;

    const sessions = days.filter(d => d.has_workout).length;
    const daysSoFar = isCurrentMonth ? today.getDate() : daysInMonth;
    const rest = Math.max(0, daysSoFar - sessions);

    // current streak: 오늘부터 역순으로 연속 운동일 카운트.
    // 오늘은 아직 운동 전일 수 있으므로, 오늘 운동이 없어도 끊지 않고 어제까지의 연속을 유지한다.
    let streak = 0;
    if (isCurrentMonth) {
      const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
      const cutoff = todayISO;
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].date > cutoff) continue;            // 미래 스킵
        if (sorted[i].has_workout) streak++;
        else if (sorted[i].date === cutoff) continue;     // 오늘은 아직 안 했어도 유예(끊지 않음)
        else break;                                       // 그 외 빈 날에서 연속 종료
      }
    }

    return { sessions, rest, streak, isCurrentMonth };
  }, [calendar, year, month, daysInMonth, today, todayISO]);

  return (
    <div
      className="fixed inset-0 lg:left-[var(--sb-w,15rem)] transition-[left] duration-300 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in duration-300"
      style={{
        scrollbarWidth: 'none',
        backgroundImage:
          'radial-gradient(110% 70% at 50% -8%, #ffffff 0%, rgba(255,255,255,0) 55%)',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'scroll',
      }}
    >
      <PageSurface maxWidth={1200}>
      <div className="w-full px-6 md:px-12 py-10">

        {/* 텍스트 영역만 좁게 — 가독성 measure */}
        <Reveal className="max-w-[40rem] pb-8">
          <div className="mb-3">
            <span className="inline-block bg-lilac/60 rounded-[10px] px-3 py-1 font-sans text-[0.78rem] font-medium tracking-wide text-ink">
              Log · Calendar
            </span>
          </div>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.0] tracking-tight font-normal">
            Days, <em className="italic text-lilac-deep">accumulated.</em>
          </h1>
          <p className="font-sans text-sm text-taupe mt-3 leading-relaxed">
            날짜를 누르면 그 날의 entry — 운동, 식단, 체성분, coach's note 가 펼쳐집니다.
          </p>
        </Reveal>

        {/* 이번 주 리포트 카드 */}
        {weekly && (
          <Reveal delay={80}>
          <section className="border border-ink/10 rounded-[28px] p-6 mb-6 bg-gradient-to-br from-lilac/45 to-paper shadow-[0_8px_20px_-6px_rgba(120,80,160,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-10px_rgba(120,80,160,0.24)]">
            <div className="flex items-baseline justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="inline-block bg-bone border border-ink/10 rounded-[10px] px-2.5 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-ink">
                  지난주 리포트
                </span>
                <span className="font-sans text-[0.72rem] text-hint">{weekly.period}</span>
              </div>
              <button
                onClick={generateWeekly}
                disabled={weeklyGenerating}
                className="font-sans text-[0.72rem] tracking-meta uppercase text-hint hover:text-ink transition-colors disabled:opacity-50"
              >
                {weeklyGenerating ? '생성 중…' : weeklySummary ? '↻ 다시 생성' : '✦ AI 총평'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="font-sans text-[0.72rem] text-taupe tracking-meta uppercase mb-1">운동</div>
                <div className="font-display text-2xl text-ink tabular-nums leading-none">
                  {weekly.workout_count}<span className="font-sans text-base text-taupe ml-1">회</span>
                </div>
              </div>
              <div>
                <div className="font-sans text-[0.72rem] text-taupe tracking-meta uppercase mb-1">식단 기록</div>
                <div className="font-display text-2xl text-ink tabular-nums leading-none">
                  {weekly.diet_days}<span className="font-sans text-base text-taupe ml-1">일</span>
                </div>
              </div>
              <div>
                <div className="font-sans text-[0.72rem] text-taupe tracking-meta uppercase mb-1">체중 변화</div>
                <div className="font-display text-2xl text-ink tabular-nums leading-none">
                  {weekly.weight_change != null
                    ? `${weekly.weight_change > 0 ? '+' : ''}${weekly.weight_change}`
                    : '—'}
                  {weekly.weight_change != null && (
                    <span className="font-sans text-base text-taupe ml-1">kg</span>
                  )}
                </div>
              </div>
            </div>

            {weekly.avg_calories ? (
              <div className="font-sans text-[0.72rem] text-hint tracking-meta mt-3">
                일 평균 {weekly.avg_calories}kcal · 단백질 {weekly.avg_protein}g
                {weekly.total_volume ? ` · 총 볼륨 ${weekly.total_volume}kg` : ''}
              </div>
            ) : null}

            {weeklyGenerating ? (
              <div className="flex items-center gap-2 text-taupe mt-4 pt-4 border-t border-ink/8">
                <Loader2 className="animate-spin" size={15} />
                <span className="font-sans text-sm leading-relaxed">
                  AI가 지난주 기록을 요약 중입니다…
                </span>
              </div>
            ) : weeklySummary ? (
              <blockquote className="font-sans text-[0.875rem] text-body leading-relaxed border-l-2 border-lilac-deep pl-3 mt-4 m-0">
                "{weeklySummary}"
              </blockquote>
            ) : (
              <p className="font-sans text-[0.75rem] text-hint mt-4 leading-relaxed">
                "✦ AI 총평"을 누르면 지난주 기록을 바탕으로 코치 코멘트를 생성합니다.
              </p>
            )}
          </section>
          </Reveal>
        )}

        {/* 월 네비게이션 — 전체 폭 */}
        <div className="flex items-baseline justify-between py-3 mb-3">
          <button
            onClick={goPrevMonth}
            className="font-sans text-[0.78rem] text-taupe hover:text-ink tracking-meta uppercase transition-colors"
            aria-label="이전 달"
          >
            ← Prev
          </button>
          <div className="font-display text-2xl text-ink tabular-nums tracking-tight">
            {year}<span className="text-taupe"> · </span>{String(month).padStart(2, '0')}
          </div>
          <button
            onClick={goNextMonth}
            className="font-sans text-[0.78rem] text-taupe hover:text-ink tracking-meta uppercase transition-colors"
            aria-label="다음 달"
          >
            Next →
          </button>
        </div>

        {/* 2단 그리드: 캘린더 (1.7fr) + 사이드바 (1fr) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] rounded-[28px] bg-paper border border-ink/8 shadow-[0_10px_30px_-16px_rgba(26,20,16,0.18)] p-4 md:p-6 transition-all duration-300 hover:shadow-[0_18px_40px_-18px_rgba(26,20,16,0.26)]">

          {/* 캘린더 컬럼 */}
          <div className="lg:border-r border-ink/8 lg:pr-6 py-5">
            {/* Weekday header */}
            <div className="grid grid-cols-7 mb-2">
              {WEEK_LABELS.map((w, i) => (
                <div
                  key={`${w}-${i}`}
                  className={`text-center font-sans text-[0.66rem] tracking-meta py-1 ${
                    i === 0 ? 'text-ink' : 'text-taupe'
                  }`}
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Days grid — gap-px 대신 셀 테두리로(모니터 서브픽셀에서 선이 사라지지 않게) */}
            <div className="grid grid-cols-7 border-t border-l cal-grid-line">
              {cells.map(cell => {
                if (cell.kind === 'pad') {
                  return <div key={cell.key} className="bg-paper min-h-[3.125rem] md:min-h-[5rem] border-r border-b cal-grid-line" />;
                }
                const isToday = cell.iso === todayISO;
                const isFuture = cell.iso > todayISO;
                const info = cell.info;
                const hasWorkout = info?.has_workout;

                return (
                  <button
                    key={cell.key}
                    onClick={() => setSelectedDate(cell.iso)}
                    className={`relative min-h-[3.125rem] md:min-h-[5rem] p-2 text-left transition-colors group border-r border-b cal-grid-line ${
                      isToday
                        ? 'bg-lilac/40 outline outline-1 outline-lilac-deep -outline-offset-1'
                        : 'bg-paper hover:bg-ink/5'
                    }`}
                  >
                    <span
                      className={`font-sans text-[0.72rem] tabular-nums ${
                        isToday
                          ? 'text-lilac-deep'
                          : isFuture
                            ? 'text-hint'
                            : 'text-body'
                      }`}
                    >
                      {String(cell.day).padStart(2, '0')}
                    </span>
                    {isToday && (
                      <span className="absolute bottom-1.5 left-2 font-sans text-[0.4375rem] tracking-meta text-lilac-deep">
                        TODAY
                      </span>
                    )}
                    {hasWorkout && !isToday && (
                      <span
                        className="absolute bottom-1.5 left-2 w-[0.3125rem] h-[0.3125rem] rounded-full bg-lilac-deep"
                        aria-label="Session logged"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-5 mt-3 font-sans text-[0.66rem] text-hint tracking-meta uppercase">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-[0.3125rem] h-[0.3125rem] rounded-full bg-lilac-deep" />
                Session logged
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-[0.3125rem] h-[0.3125rem] rounded-full bg-hint" />
                Rest / upcoming
              </span>
            </div>

            {loading && (
              <div className="mt-4 flex items-center gap-2 text-taupe">
                <Loader2 className="animate-spin" size={12} />
                <span className="font-sans text-[0.72rem] tracking-meta uppercase">Loading…</span>
              </div>
            )}
          </div>

          {/* 월간 요약 사이드바 */}
          <aside className="border-t lg:border-t-0 border-ink/12 lg:pl-6 py-5">
            <div className="rounded-[20px] bg-sky p-5 mb-4 shadow-[0_10px_24px_-10px_rgba(60,140,190,0.5)]">
              <span className="inline-block bg-paper rounded-[10px] px-2.5 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-ink">
                This month
              </span>
              <div className="font-display text-6xl text-ink leading-none tabular-nums mt-3">
                {stats.sessions}
              </div>
              <div className="font-sans text-sm text-ink/65 mt-1">
                sessions logged
              </div>
            </div>

            {/* 통계 리스트 */}
            <div className="border-t border-ink/12 mt-5 pt-1">
              {[
                { label: 'Personal records', value: monthlyStats?.personal_records ?? '—', accent: 'text-lilac-deep' },
                { label: 'Rest days', value: stats.rest, accent: 'text-ink' },
                { label: 'Total sets', value: monthlyStats?.total_sets ?? '—', accent: 'text-ink' },
                {
                  label: 'Volume lifted',
                  value: monthlyStats?.volume_lifted != null
                    ? Math.round(monthlyStats.volume_lifted).toLocaleString()
                    : '—',
                  accent: 'text-ink',
                },
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
                  <span className={`font-sans text-base tabular-nums ${row.accent}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Current streak */}
            <div className="rounded-[20px] bg-gradient-to-br from-lilac/45 to-paper border border-ink/8 p-5 mt-4">
              <div className="mb-3">
                <span className="inline-block bg-paper/70 border border-ink/10 rounded-[10px] px-2.5 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-ink">
                  Current streak
                </span>
              </div>
              <div className="font-display text-3xl text-ink leading-none tabular-nums">
                {stats.isCurrentMonth ? stats.streak : '—'}
                {stats.isCurrentMonth && (
                  <span className="font-sans text-sm text-taupe ml-1">days</span>
                )}
              </div>
              <p className="font-sans text-xs text-hint mt-2 leading-relaxed">
                {!stats.isCurrentMonth
                  ? '지난 달 또는 다음 달을 보는 중.'
                  : stats.streak > 0
                    ? '연속으로 운동을 이어가는 중.'
                    : stats.sessions > 0
                      ? '연속 기록이 끊겼어요 — 오늘 운동으로 다시 이어가세요.'
                      : '이번 달 운동 기록이 아직 없어요.'}
              </p>
            </div>
          </aside>
        </div>

        {/* Footer — page-end mark */}
        <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-sans text-[0.78rem] text-hint tracking-meta">
          <span className="uppercase">— FITCOACH —</span>
          <span className="uppercase text-taupe">{MONTH_LABELS[month - 1]} {year}</span>
        </div>
      </div>
      </PageSurface>

      {selectedDate && (
        <JournalDayModal
          date={selectedDate}
          theme={theme}
          nutrition={nutrition}
          onClose={() => setSelectedDate(null)}
          onAfterChange={fetchCalendar}
        />
      )}
    </div>
  );
};

export default JournalPage;
