import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from 'recharts';
import { API_BASE_URL } from '../api/config';
import BodyEntryModal from '../components/BodyEntryModal';
import PageSurface from '../components/PageSurface';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmProvider';
import usePageTitle from '../hooks/usePageTitle';
import Reveal from '../components/Reveal';

/**
 * /body — InBody 추이 (Editorial Magazine 톤).
 *
 * Headline → Latest 4-col → 두 개 차트(kg / %) → History 리스트.
 */

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Gleap palette 로 지표별 stroke 매핑 (small-multiples 차트가 각자 한 선씩 사용).
// 체중은 주(primary) 지표라 가장 대비 강한 ink 로 — 밝은 배경에서도 또렷하게.
const METRICS = [
  { label: '체중',     short: 'Weight',      key: 'weight',            chartKey: '체중',     color: '#1a1410', unit: 'kg', betterLower: false },
  { label: '골격근',   short: 'Muscle',      key: 'skeletal_muscle',   chartKey: '골격근',   color: '#5aa8d8', unit: 'kg', betterLower: false },
  { label: '체지방',   short: 'Fat mass',    key: 'body_fat_mass',     chartKey: '체지방',   color: '#c89cd9', unit: 'kg', betterLower: true  },
  { label: '체지방률', short: 'Body fat %',  key: 'body_fat_percent',  chartKey: '체지방률', color: '#aaa098', unit: '%',  betterLower: true  },
];

const computeDelta = (latest, prev, key) => {
  if (!latest || !prev) return null;
  const a = latest[key];
  const b = prev[key];
  if (a == null || b == null) return null;
  return +(a - b).toFixed(1);
};

const deltaCls = (d, betterLower) => {
  if (d == null || d === 0) return 'text-hint';
  const improving = betterLower ? d < 0 : d > 0;
  return improving ? 'text-lilac-deep' : 'text-ink';
};

const tooltipStyle = {
  background: '#ffffff',
  border: '1px solid rgba(26, 20, 16, 0.12)',
  borderRadius: 12,
  fontSize: 11,
  fontFamily: 'Inter, sans-serif',
  color: '#1a1410',
  padding: '8px 12px',
};

/**
 * 지표 하나만 그리는 작은 추이 차트 (small multiple).
 * 범례 대신 선 오른쪽 끝에 최신값을 직접 라벨링해 시선 왕복을 없앤다.
 */
const MiniTrend = ({ metric, data }) => {
  const { chartKey, color, unit, short, betterLower, key: gid } = metric;
  const lastIndex = data.length - 1;
  // 마지막 포인트만 동그라미로 강조 (중간 점들은 숨겨 깔끔하게).
  const renderEndDot = ({ cx, cy, index, key }) => {
    if (index !== lastIndex || cx == null) return <g key={key} />;
    return <circle key={key} cx={cx} cy={cy} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />;
  };
  // 시작(가장 오래된) → 현재(최신) 누적 변화. data 는 시간순(과거→최신).
  const startVal = data[0]?.[chartKey];
  const endVal = data[lastIndex]?.[chartKey];
  const d = (startVal != null && endVal != null) ? +(endVal - startVal).toFixed(1) : null;

  // 마지막 데이터 포인트에만 값 라벨을 그린다 (그 외 인덱스는 null 반환).
  const renderEndLabel = ({ x, y, value, index }) => {
    if (index !== lastIndex || value == null) return null;
    return (
      <text
        x={x + 6} y={y} dy={4} textAnchor="start"
        fill={color} fontSize={11} fontFamily="JetBrains Mono, monospace"
      >
        {value}{unit}
      </text>
    );
  };

  return (
    <div className="py-4 border-b border-ink/8">
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-sans text-[0.72rem] text-taupe tracking-label uppercase">{short}</span>
        {d != null && d !== 0 && (
          <span className={`font-sans text-[0.72rem] tracking-meta ${deltaCls(d, betterLower)}`}>
            {d > 0 ? '+' : ''}{d}{unit} <span className="text-hint normal-case">vs start</span>
          </span>
        )}
      </div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 52, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.20} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(26, 20, 16, 0.05)" />
            <XAxis
              dataKey="date"
              interval="preserveStartEnd"
              tick={{ fontSize: 9, fill: '#8a8275', fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(26, 20, 16, 0.18)', strokeDasharray: '3 3' }} />
            <Area
              type="monotone"
              dataKey={chartKey}
              stroke={color}
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={`url(#grad-${gid})`}
              dot={renderEndDot}
              activeDot={{ r: 4, strokeWidth: 0 }}
              label={renderEndLabel}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const BodyPage = () => {
  usePageTitle('Body · FitCoach');

  const toast = useToast();
  const confirm = useConfirm();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [regenId, setRegenId] = useState(null); // AI 총평 생성 중인 측정 id

  const fetchLogs = useCallback(() => {
    setLoading(true);
    axios
      .get(`${API_BASE_URL}/body`, { headers: authHeaders() })
      .then((res) => setLogs(res.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // recharts 는 시간순(과거→최신)이 자연스러워서 뒤집어 사용.
  const chartData = useMemo(
    () =>
      [...logs].reverse().map((l) => ({
        date: (l.measured_at || '').slice(5), // MM-DD
        체중: l.weight,
        골격근: l.skeletal_muscle,
        체지방: l.body_fat_mass,
        체지방률: l.body_fat_percent,
      })),
    [logs],
  );

  const latest = logs[0];
  const prev = logs[1];

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: '이 측정 기록을 삭제할까요?',
      description: '삭제 후 되돌릴 수 없으며 추이 그래프에서 제외됩니다.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await axios.delete(`${API_BASE_URL}/body/${id}`, { headers: authHeaders() });
      fetchLogs();
    } catch (err) {
      toast.error('삭제에 실패했습니다.');
    }
  };

  // AI 총평을 동기로 생성/재생성 (직전 측정과 비교, 첫 측정이면 baseline). 수십 초 소요.
  const handleRegenerate = async (id) => {
    setRegenId(id);
    try {
      const res = await axios.post(`${API_BASE_URL}/body/${id}/regenerate`, {}, { headers: authHeaders() });
      setLogs((prev) => prev.map((l) => (l.id === id ? res.data : l)));
    } catch (err) {
      toast.error('AI 총평 생성에 실패했습니다. (Ollama 서버가 켜져 있는지 확인하세요)');
    } finally {
      setRegenId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 lg:left-[var(--sb-w,15rem)] transition-[left] duration-300 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in duration-300"
      style={{ scrollbarWidth: 'none' }}
    >
      <PageSurface maxWidth={1100}>
        <div className="w-full px-6 md:px-12 py-8">

          {/* Headline */}
          <Reveal className="pb-8">
            <div className="mb-3">
              <span className="inline-block bg-lilac/60 rounded-[10px] px-3 py-1 font-sans text-[0.78rem] font-medium tracking-wide text-ink">
                Body · Composition
              </span>
            </div>

            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div className="max-w-[40rem]">
                <h1 className="font-display text-5xl md:text-6xl leading-[1.0] tracking-tight font-normal">
                  Shape, <em className="italic text-lilac-deep">over time.</em>
                </h1>
                <p className="font-sans text-sm text-taupe mt-3 leading-relaxed">
                  InBody 측정값을 기록해 두면 한 달, 분기, 한 해의 흐름이 한 화면에 들어옵니다.
                </p>
              </div>

              <button
                onClick={() => setModalOpen(true)}
                className="font-sans text-[0.78rem] tracking-label uppercase px-5 py-3 border border-lilac-deep text-ink hover:bg-lilac hover:text-ink transition-colors flex-shrink-0"
              >
                + New entry
              </button>
            </div>
          </Reveal>

          {/* Loading / Empty */}
          {loading && (
            <div className="border-y border-ink/15 py-16 text-center text-taupe">
              <Loader2 className="animate-spin mx-auto mb-3" size={18} />
              <p className="font-sans text-[0.72rem] tracking-meta uppercase">Loading entries…</p>
            </div>
          )}

          {!loading && logs.length === 0 && (
            <div className="border-y border-ink/15 py-16 text-center">
              <p className="font-display text-lg text-ink mb-2">No measurements yet.</p>
              <p className="font-sans text-sm text-taupe">
                첫 측정을 기록하면 추이 그래프가 시작됩니다.
              </p>
            </div>
          )}

          {!loading && logs.length > 0 && (
            <>
              {/* Latest */}
              <Reveal delay={80}>
                <section className="bg-gradient-to-br from-lilac/45 to-paper rounded-[28px] border border-ink/10 shadow-[0_10px_28px_-10px_rgba(120,80,160,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-12px_rgba(120,80,160,0.28)] p-6 md:p-8 mb-2">
                  <div className="flex items-baseline justify-between mb-5">
                    <span className="inline-block bg-bone border border-ink/10 rounded-[10px] px-2.5 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-ink">
                      Latest
                    </span>
                    <div className="font-sans text-[0.72rem] text-hint tracking-meta uppercase">
                      {latest.measured_at}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {METRICS.map((m) => {
                      const v = latest[m.key];
                      const d = computeDelta(latest, prev, m.key);
                      const isPrimary = m.key === 'weight';
                      if (isPrimary) {
                        return (
                          <div
                            key={m.key}
                            className="bg-sky rounded-[20px] p-5 shadow-[0_10px_24px_-10px_rgba(60,140,190,0.5)]"
                          >
                            <div className="font-sans text-[0.72rem] text-ink/65 tracking-label uppercase mb-2">
                              {m.short}
                            </div>
                            <div className="font-display text-3xl text-ink tabular-nums leading-none">
                              {v != null ? v : <span className="text-ink/65">—</span>}
                              {v != null && (
                                <span className="font-sans text-base text-ink/65 ml-1.5">
                                  {m.unit}
                                </span>
                              )}
                            </div>
                            {d != null && d !== 0 && (
                              <div className="font-sans text-[0.72rem] tracking-meta mt-2 text-ink">
                                {d > 0 ? '+' : ''}{d}{m.unit} <span className="text-ink/65 normal-case">vs prev</span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div key={m.key}>
                          <div className="font-sans text-[0.72rem] text-taupe tracking-label uppercase mb-2">
                            {m.short}
                          </div>
                          <div className="font-display text-3xl text-ink tabular-nums leading-none">
                            {v != null ? v : <span className="text-hint">—</span>}
                            {v != null && (
                              <span className="font-sans text-base text-taupe ml-1.5">
                                {m.unit}
                              </span>
                            )}
                          </div>
                          {d != null && d !== 0 && (
                            <div className={`font-sans text-[0.72rem] tracking-meta mt-2 ${deltaCls(d, m.betterLower)}`}>
                              {d > 0 ? '+' : ''}{d}{m.unit} <span className="text-hint normal-case">vs prev</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </Reveal>

              {/* AI 총평 — 직전 측정 대비 변화 평가 (Ollama gemma3:4b) */}
              <Reveal delay={160}>
                <section className="bg-gradient-to-br from-sky/45 to-paper rounded-[28px] border border-ink/10 shadow-[0_10px_28px_-10px_rgba(120,80,160,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-12px_rgba(120,80,160,0.28)] p-6 md:p-8 mb-2">
                <div className="flex items-baseline justify-between mb-3">
                  <span className="inline-block bg-bone border border-ink/10 rounded-[10px] px-2.5 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-ink">
                    AI 총평
                  </span>
                  <button
                    onClick={() => handleRegenerate(latest.id)}
                    disabled={regenId === latest.id}
                    className="font-sans text-[0.72rem] tracking-meta uppercase text-hint hover:text-ink transition-colors disabled:opacity-50"
                  >
                    {regenId === latest.id ? '생성 중…' : latest.ai_comment ? '↻ 다시 생성' : '✦ 총평 생성'}
                  </button>
                </div>

                {regenId === latest.id ? (
                  <div className="flex items-center gap-2 text-taupe">
                    <Loader2 className="animate-spin" size={16} />
                    <span className="font-sans text-sm leading-relaxed">
                      AI가 직전 측정과 비교해 총평을 작성 중입니다…
                    </span>
                  </div>
                ) : latest.ai_comment ? (
                  <blockquote className="font-sans text-[0.9375rem] text-body leading-relaxed border-l-2 border-lilac-deep pl-3 m-0">
                    "{latest.ai_comment}"
                  </blockquote>
                ) : (
                  <p className="font-sans text-sm text-taupe leading-relaxed">
                    아직 총평이 없습니다. "총평 생성"을 누르면 직전 측정과 비교해 AI가 작성합니다.
                  </p>
                )}
                </section>
              </Reveal>

              {/* Trends — 지표별 small multiples (각자 스케일 + 끝 라벨) */}
              <section className="py-8">
                <div className="flex items-baseline justify-between mb-4">
                  <span className="inline-block bg-bone border border-ink/10 rounded-[10px] px-2.5 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-ink">
                    Trends · By metric
                  </span>
                  <div className="font-sans text-[0.72rem] text-hint tracking-meta uppercase">
                    {chartData.length} measurements
                  </div>
                </div>
                <div className="bg-gradient-to-br from-lilac/45 to-paper rounded-[28px] border border-ink/10 shadow-[0_10px_28px_-10px_rgba(120,80,160,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-12px_rgba(120,80,160,0.28)] p-6 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    {METRICS.map((m) => (
                      <MiniTrend key={m.key} metric={m} data={chartData} />
                    ))}
                  </div>
                </div>
              </section>

              {/* History */}
              <section className="pt-2">
                <div className="flex items-baseline justify-between mb-3">
                  <span className="inline-block bg-bone border border-ink/10 rounded-[10px] px-2.5 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-ink">
                    History
                  </span>
                </div>

                <div className="border-t border-ink/15">
                  {logs.map((l, idx) => (
                    <div
                      key={l.id}
                      className="grid grid-cols-[auto_1fr_auto] gap-4 items-center py-3 border-b border-ink/8 last:border-b-0 group"
                    >
                      <div className="flex items-baseline gap-2.5 min-w-[7.5rem]">
                        <span className="font-sans text-base text-hint tabular-nums">
                          {String(logs.length - idx).padStart(2, '0')}
                        </span>
                        <span className="font-display text-[0.9375rem] text-ink tabular-nums">
                          {l.measured_at}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 font-sans text-[0.78rem] tabular-nums">
                        <span className="text-ink">
                          {l.weight}<span className="text-hint">kg</span>
                        </span>
                        {l.skeletal_muscle != null && (
                          <span className="text-lilac-deep">
                            근 {l.skeletal_muscle}
                          </span>
                        )}
                        {l.body_fat_mass != null && (
                          <span className="text-ink">
                            지 {l.body_fat_mass}
                          </span>
                        )}
                        {l.body_fat_percent != null && (
                          <span className="text-taupe">
                            {l.body_fat_percent}%
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleDelete(l.id)}
                        className="font-sans text-[0.72rem] tracking-meta uppercase text-hint hover:text-ink transition-colors opacity-60 md:opacity-0 md:group-hover:opacity-100"
                        aria-label="삭제"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-sans text-[0.78rem] text-hint tracking-meta">
            <span className="uppercase">— FITCOACH —</span>
            <span className="uppercase text-taupe">Body · {logs.length} entries</span>
          </div>
        </div>
      </PageSurface>

      <BodyEntryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchLogs}
      />
    </div>
  );
};

export default BodyPage;
