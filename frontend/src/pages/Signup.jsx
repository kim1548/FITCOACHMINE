import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import { useToast } from '../components/ui/Toast';
import FieldError from '../components/ui/FieldError';
import usePageTitle from '../hooks/usePageTitle';

/**
 * /signup — Editorial Magazine 톤 (standalone, TopNavbar 없음).
 */

const GENDER_OPTIONS = ['남', '여'];
const LIFESTYLE_OPTIONS = ['학생', '사무직', '활동직', '기타'];
const EXPERIENCE_OPTIONS = ['입문자', '초보', '중급', '고급'];
const FREQUENCY_OPTIONS = ['주1회', '주2회', '주3회', '주4회 이상'];
const FITNESS_OPTIONS = ['낮음', '보통', '높음'];
const GOAL_OPTIONS = ['체중감소', '유지', '벌크업'];

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const dayOfYear = () => {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
};

const inputCls =
  'w-full px-3 py-2.5 bg-paper border border-ink/15 focus:border-accent-red outline-none font-display text-[0.9375rem] text-ink placeholder:text-hint placeholder:italic tabular-nums transition-colors';
const selectCls = inputCls + ' appearance-none cursor-pointer';
const labelCls = 'block font-mono text-[0.625rem] text-taupe tracking-meta uppercase mb-1.5';

const Signup = () => {
  usePageTitle('Register · FitCoach');

  const navigate = useNavigate();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [credError, setCredError] = useState('');
  const [form, setForm] = useState({
    username: '',
    password: '',
    nickname: '',
    gender: GENDER_OPTIONS[0],
    age: 25,
    height: 170,
    weight: 70,
    lifestyle: LIFESTYLE_OPTIONS[0],
    workout_experience: EXPERIENCE_OPTIONS[0],
    workout_frequency: FREQUENCY_OPTIONS[2],
    fitness_level: FITNESS_OPTIONS[1],
    goal: GOAL_OPTIONS[0],
  });

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (credError && (k === 'username' || k === 'password')) setCredError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setCredError('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }
    setCredError('');
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE_URL}/auth/signup`, {
        ...form,
        age: Number(form.age),
        height: Number(form.height),
        weight: Number(form.weight),
      });
      toast.success('회원가입 성공! 로그인해주세요.');
      navigate('/login');
    } catch (err) {
      toast.error('가입 실패: ' + (err?.response?.data?.detail || '알 수 없는 오류'));
    } finally {
      setSubmitting(false);
    }
  };

  const issueNo = String(dayOfYear()).padStart(3, '0');
  const now = new Date();
  const monthLabel = MONTH_LABELS[now.getMonth()];

  return (
    <div
      className="fixed inset-0 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none' }}
    >
      <div className="w-full max-w-[35rem] mx-auto min-h-full flex flex-col px-6 md:px-8 py-10">

        {/* Masthead */}
        <header className="flex items-baseline justify-between border-b border-ink/15 pb-4 mb-10">
          <Link to="/login" className="font-display italic text-lg text-ink tracking-tight">
            FITCOACH
          </Link>
          <span className="font-mono text-[0.625rem] text-taupe tracking-meta uppercase">
            No. {issueNo} — {monthLabel}
          </span>
        </header>

        {/* Headline */}
        <div className="mb-8">
          <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase mb-3">
            — Register · Begin your journey
          </div>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.0] tracking-tight font-normal">
            Begin, <em className="italic text-accent-gold">on record.</em>
          </h1>
          <p className="font-display italic text-sm text-taupe mt-3 leading-relaxed">
            한 끼, 한 세트, 한 측정 — 작은 기록이 모이면 한 사람의 변화가 보입니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-7">

          {/* 1) Credentials */}
          <section>
            <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase mb-3">
              — Account
            </div>
            <div className="space-y-3 border-t border-ink/12 pt-4">
              <div>
                <label className={labelCls}>Username</label>
                <input
                  className={inputCls}
                  placeholder="아이디"
                  value={form.username}
                  onChange={set('username')}
                  autoComplete="username"
                  aria-invalid={!!credError}
                  aria-describedby={credError ? 'cred-error' : undefined}
                />
              </div>
              <div>
                <label className={labelCls}>Nickname · 닉네임</label>
                <input
                  className={inputCls}
                  placeholder="커뮤니티에 표시될 이름 (선택)"
                  value={form.nickname}
                  onChange={set('nickname')}
                  maxLength={20}
                />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input
                  className={inputCls}
                  type="password"
                  placeholder="비밀번호"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                  aria-invalid={!!credError}
                  aria-describedby={credError ? 'cred-error' : undefined}
                />
                <FieldError id="cred-error">{credError}</FieldError>
              </div>
            </div>
          </section>

          {/* 2) Body */}
          <section>
            <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase mb-3">
              — Body
            </div>
            <div className="grid grid-cols-4 gap-3 border-t border-ink/12 pt-4">
              <div>
                <label className={labelCls}>Gender</label>
                <select className={selectCls} value={form.gender} onChange={set('gender')}>
                  {GENDER_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Age</label>
                <input
                  className={inputCls + ' [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'}
                  style={{ MozAppearance: 'textfield' }}
                  type="number" min="10" max="100"
                  value={form.age} onChange={set('age')}
                />
              </div>
              <div>
                <label className={labelCls}>Height</label>
                <input
                  className={inputCls + ' [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'}
                  style={{ MozAppearance: 'textfield' }}
                  type="number" min="100" max="250"
                  value={form.height} onChange={set('height')}
                />
              </div>
              <div>
                <label className={labelCls}>Weight</label>
                <input
                  className={inputCls + ' [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'}
                  style={{ MozAppearance: 'textfield' }}
                  type="number" min="30" max="250"
                  value={form.weight} onChange={set('weight')}
                />
              </div>
            </div>
            <p className="font-mono text-[0.5625rem] text-hint tracking-meta uppercase mt-2">
              · age · cm · kg
            </p>
          </section>

          {/* 3) Lifestyle */}
          <section>
            <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase mb-3">
              — Lifestyle
            </div>
            <div className="border-t border-ink/12 pt-4">
              <label className={labelCls}>Daily routine</label>
              <select className={selectCls} value={form.lifestyle} onChange={set('lifestyle')}>
                {LIFESTYLE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </section>

          {/* 4) Training */}
          <section>
            <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase mb-3">
              — Training
            </div>
            <div className="space-y-3 border-t border-ink/12 pt-4">
              <div>
                <label className={labelCls}>Experience · 운동 경력</label>
                <select className={selectCls} value={form.workout_experience} onChange={set('workout_experience')}>
                  {EXPERIENCE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Frequency · 빈도</label>
                  <select className={selectCls} value={form.workout_frequency} onChange={set('workout_frequency')}>
                    {FREQUENCY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Fitness · 체력</label>
                  <select className={selectCls} value={form.fitness_level} onChange={set('fitness_level')}>
                    {FITNESS_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* 5) Goal */}
          <section>
            <div className="font-mono text-[0.6875rem] text-accent-gold tracking-label uppercase mb-3">
              — Goal
            </div>
            <div className="border-t border-ink/12 pt-4">
              <label className={labelCls}>이번 달의 목표</label>
              <select className={selectCls} value={form.goal} onChange={set('goal')}>
                {GOAL_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </section>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 mt-2 font-mono text-[0.6875rem] tracking-label uppercase bg-accent-red text-ink hover:bg-accent-red/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            {submitting ? 'Creating account…' : '→ Create account'}
          </button>
        </form>

        {/* Bottom — login */}
        <div className="border-t border-ink/15 mt-10 pt-6 text-center">
          <p className="font-display italic text-sm text-taupe mb-3">
            이미 계정이 있으신가요?
          </p>
          <Link
            to="/login"
            className="inline-block font-mono text-[0.6875rem] tracking-label uppercase px-5 py-3 border border-ink/20 text-taupe hover:text-ink hover:border-ink/40 transition-colors"
          >
            → Sign in instead
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-10 border-t border-ink/15 mt-10 flex justify-between items-center font-mono text-[0.625rem] text-hint tracking-meta uppercase">
          <span>— FITCOACH —</span>
          <span className="text-taupe">Register</span>
        </div>
      </div>
    </div>
  );
};

export default Signup;
