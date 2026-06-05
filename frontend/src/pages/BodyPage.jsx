import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import { API_BASE_URL } from '../api/config';
import BodyEntryModal from '../components/BodyEntryModal';
import PageSurface from '../components/PageSurface';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmProvider';
import usePageTitle from '../hooks/usePageTitle';

/**
 * /body — InBody 추이 (Editorial Magazine 톤).
 *
 * Headline → Latest 4-col → 두 개 차트(kg / %) → History 리스트.
 */

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const METRICS = [
  { label: '체중',     short: 'Weight',      key: 'weight',            unit: 'kg', betterLower: false },
  { label: '골격근',   short: 'Muscle',      key: 'skeletal_muscle',   unit: 'kg', betterLower: false },
  { label: '체지방',   short: 'Fat mass',    key: 'body_fat_mass',     unit: 'kg', betterLower: true  },
  { label: '체지방률', short: 'Body fat %',  key: 'body_fat_percent',  unit: '%',  betterLower: true  },
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
  return improving ? 'text-accent-gold' : 'text-accent-red';
};

// Editorial palette 로 차트 stroke 매핑.
const STROKE = {
  weight:     '#f0e8d8', // ink (parchment)
  muscle:     '#d9a64a', // accent-gold
  fat:        '#c43c2f', // accent-red
  pct:        '#aaa098', // body grey
};

const tooltipStyle = {
  background: '#14110d',
  border: '1px solid rgba(240, 232, 216, 0.18)',
  borderRadius: 0,
  fontSize: 11,
  fontFamily: 'JetBrains Mono, monospace',
  color: '#f0e8d8',
  padding: '8px 12px',
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
      className="fixed inset-0 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in duration-300"
      style={{ scrollbarWidth: 'none' }}
    >
      <PageSurface maxWidth={1100}>
        <div className="w-full px-6 md:px-12 py-8">

          {/* Headline */}
          <div className="pb-6">
            <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
              <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
                — Body · Composition
              </div>
              <div className="font-mono text-[0.625rem] text-hint tracking-meta uppercase">
                {logs.length.toString().padStart(2, '0')} entries
              </div>
            </div>

            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div className="max-w-[40rem]">
                <h1 className="font-display text-4xl md:text-5xl leading-[1.0] tracking-tight font-normal">
                  Shape, <em className="italic text-accent-gold">over time.</em>
                </h1>
                <p className="font-display italic text-sm text-taupe mt-3 leading-relaxed">
                  InBody 측정값을 기록해 두면 한 달, 분기, 한 해의 흐름이 한 화면에 들어옵니다.
                </p>
              </div>

              <button
                onClick={() => setModalOpen(true)}
                className="font-mono text-[0.6875rem] tracking-label uppercase px-5 py-3 border border-accent-red text-accent-red hover:bg-accent-red hover:text-ink transition-colors flex-shrink-0"
              >
                + New entry
              </button>
            </div>
          </div>

          {/* Loading / Empty */}
          {loading && (
            <div className="border-y border-ink/15 py-16 text-center text-taupe">
              <Loader2 className="animate-spin mx-auto mb-3" size={18} />
              <p className="font-mono text-[0.625rem] tracking-meta uppercase">Loading entries…</p>
            </div>
          )}

          {!loading && logs.length === 0 && (
            <div className="border-y border-ink/15 py-16 text-center">
              <p className="font-display text-lg text-ink mb-2">No measurements yet.</p>
              <p className="font-display italic text-sm text-taupe">
                첫 측정을 기록하면 추이 그래프가 시작됩니다.
              </p>
            </div>
          )}

          {!loading && logs.length > 0 && (
            <>
              {/* Latest */}
              <section className="border-t border-b border-ink/12 py-6 mb-2">
                <div className="flex items-baseline justify-between mb-5">
                  <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
                    — Latest
                  </div>
                  <div className="font-mono text-[0.625rem] text-hint tracking-meta uppercase">
                    {latest.measured_at}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  {METRICS.map((m) => {
                    const v = latest[m.key];
                    const d = computeDelta(latest, prev, m.key);
                    return (
                      <div key={m.key}>
                        <div className="font-mono text-[0.625rem] text-taupe tracking-label uppercase mb-2">
                          {m.short}
                        </div>
                        <div className="font-display text-3xl text-ink tabular-nums leading-none">
                          {v != null ? v : <span className="text-hint">—</span>}
                          {v != null && (
                            <span className="font-display italic text-base text-taupe ml-1.5">
                              {m.unit}
                            </span>
                          )}
                        </div>
                        {d != null && d !== 0 && (
                          <div className={`font-mono text-[0.625rem] tracking-meta mt-2 ${deltaCls(d, m.betterLower)}`}>
                            {d > 0 ? '+' : ''}{d}{m.unit} <span className="text-hint normal-case">vs prev</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* AI 총평 — 직전 측정 대비 변화 평가 (Ollama gemma3:4b) */}
              <section className="border-b border-ink/12 py-6 mb-2">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="font-mono text-[0.6875rem] text-accent-gold tracking-label uppercase">
                    — AI 총평
                  </div>
                  <button
                    onClick={() => handleRegenerate(latest.id)}
                    disabled={regenId === latest.id}
                    className="font-mono text-[0.625rem] tracking-meta uppercase text-hint hover:text-ink transition-colors disabled:opacity-50"
                  >
                    {regenId === latest.id ? '생성 중…' : latest.ai_comment ? '↻ 다시 생성' : '✦ 총평 생성'}
                  </button>
                </div>

                {regenId === latest.id ? (
                  <div className="flex items-center gap-2 text-taupe">
                    <Loader2 className="animate-spin" size={16} />
                    <span className="font-display italic text-sm leading-relaxed">
                      AI가 직전 측정과 비교해 총평을 작성 중입니다… (수십 초 걸릴 수 있어요)
                    </span>
                  </div>
                ) : latest.ai_comment ? (
                  <blockquote className="font-display italic text-[0.9375rem] text-body leading-relaxed border-l-2 border-accent-gold pl-3 m-0">
                    "{latest.ai_comment}"
                  </blockquote>
                ) : (
                  <p className="font-display italic text-sm text-taupe leading-relaxed">
                    아직 총평이 없습니다. "총평 생성"을 누르면 직전 측정과 비교해 AI가 작성합니다.
                  </p>
                )}
              </section>

              {/* Chart 1: Weight / Muscle / Fat (kg) */}
              <section className="py-8">
                <div className="flex items-baseline justify-between mb-4">
                  <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
                    — Mass · Weight · Muscle · Fat
                  </div>
                  <div className="font-mono text-[0.625rem] text-hint tracking-meta uppercase">
                    kg
                  </div>
                </div>
                <div className="h-64 border-t border-ink/12 pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(240, 232, 216, 0.08)" strokeDasharray="2 4" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#8a8275', fontFamily: 'JetBrains Mono, monospace' }}
                        axisLine={{ stroke: 'rgba(240, 232, 216, 0.15)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#8a8275', fontFamily: 'JetBrains Mono, monospace' }}
                        axisLine={{ stroke: 'rgba(240, 232, 216, 0.15)' }}
                        tickLine={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(240, 232, 216, 0.2)' }} />
                      <Legend
                        wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8a8275' }}
                        iconType="plainline"
                      />
                      <Line type="monotone" dataKey="체중"   stroke={STROKE.weight} strokeWidth={1.5} dot={{ r: 2.5, fill: STROKE.weight }} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="골격근" stroke={STROKE.muscle} strokeWidth={1.5} dot={{ r: 2.5, fill: STROKE.muscle }} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="체지방" stroke={STROKE.fat}    strokeWidth={1.5} dot={{ r: 2.5, fill: STROKE.fat }}    activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Chart 2: Body fat % */}
              <section className="py-6 border-t border-ink/12">
                <div className="flex items-baseline justify-between mb-4">
                  <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
                    — Composition · Fat ratio
                  </div>
                  <div className="font-mono text-[0.625rem] text-hint tracking-meta uppercase">
                    %
                  </div>
                </div>
                <div className="h-48 border-t border-ink/12 pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(240, 232, 216, 0.08)" strokeDasharray="2 4" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#8a8275', fontFamily: 'JetBrains Mono, monospace' }}
                        axisLine={{ stroke: 'rgba(240, 232, 216, 0.15)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#8a8275', fontFamily: 'JetBrains Mono, monospace' }}
                        axisLine={{ stroke: 'rgba(240, 232, 216, 0.15)' }}
                        tickLine={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(240, 232, 216, 0.2)' }} />
                      <Line type="monotone" dataKey="체지방률" stroke={STROKE.pct} strokeWidth={1.5} dot={{ r: 2.5, fill: STROKE.pct }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* History */}
              <section className="pt-2">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
                    — History
                  </div>
                  <div className="font-mono text-[0.625rem] text-hint tracking-meta uppercase">
                    {logs.length.toString().padStart(2, '0')} entries
                  </div>
                </div>

                <div className="border-t border-ink/15">
                  {logs.map((l, idx) => (
                    <div
                      key={l.id}
                      className="grid grid-cols-[auto_1fr_auto] gap-4 items-center py-3 border-b border-ink/8 last:border-b-0 group"
                    >
                      <div className="flex items-baseline gap-2.5 min-w-[7.5rem]">
                        <span className="font-display italic text-base text-hint tabular-nums">
                          {String(logs.length - idx).padStart(2, '0')}
                        </span>
                        <span className="font-display text-[0.9375rem] text-ink tabular-nums">
                          {l.measured_at}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.6875rem] tabular-nums">
                        <span className="text-ink">
                          {l.weight}<span className="text-hint">kg</span>
                        </span>
                        {l.skeletal_muscle != null && (
                          <span className="text-accent-gold">
                            근 {l.skeletal_muscle}
                          </span>
                        )}
                        {l.body_fat_mass != null && (
                          <span className="text-accent-red">
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
                        className="font-mono text-[0.625rem] tracking-meta uppercase text-hint hover:text-accent-red transition-colors opacity-60 md:opacity-0 md:group-hover:opacity-100"
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
          <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-mono text-[0.6875rem] text-hint tracking-meta">
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
