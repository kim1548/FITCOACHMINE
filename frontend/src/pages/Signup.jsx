import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import { useToast } from '../components/ui/Toast';
import FieldError from '../components/ui/FieldError';
import usePageTitle from '../hooks/usePageTitle';

/**
 * /signup — Gleap 라이트 톤 (standalone, TopNavbar 없음).
 */

const GENDER_OPTIONS = ['남', '여'];
const LIFESTYLE_OPTIONS = ['학생', '사무직', '활동직', '기타'];
const EXPERIENCE_OPTIONS = ['입문자', '초보', '중급', '고급'];
const FREQUENCY_OPTIONS = ['주1회', '주2회', '주3회', '주4회 이상'];
const GOAL_OPTIONS = ['체중감소', '유지', '벌크업'];

const inputCls =
  'w-full bg-bone rounded-[12px] border border-ink/10 focus:border-lilac-deep focus:bg-paper outline-none font-sans text-[0.95rem] text-ink placeholder:text-hint px-4 py-3 transition-colors';
const selectCls = inputCls + ' appearance-none cursor-pointer';
const labelCls = 'block font-sans text-[0.72rem] font-medium text-taupe tracking-wide uppercase mb-1.5';
const sectionLabelCls =
  'inline-block bg-bone border border-ink/10 rounded-[10px] px-2.5 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-ink';

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

  return (
    <div
      className="fixed inset-0 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden flex items-start justify-center p-4 py-10"
      style={{
        scrollbarWidth: 'none',
        backgroundImage:
          'radial-gradient(48rem 38rem at 0% 0%, rgba(241,204,255,0.5), rgba(241,204,255,0) 55%), radial-gradient(44rem 36rem at 100% 100%, rgba(145,224,255,0.45), rgba(145,224,255,0) 55%)',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'scroll',
      }}
    >
      <div className="w-full max-w-[56rem] my-auto bg-paper rounded-[28px] border border-ink/8 shadow-[0_28px_70px_-28px_rgba(26,20,16,0.28)] p-8 md:p-12 font-sans animate-in fade-in zoom-in-95 duration-300">

        {/* Logo */}
        <Link to="/signup" className="flex items-center gap-2 mb-8">
          <span
            className="w-[22px] h-[22px] rounded-full"
            style={{ background: 'radial-gradient(circle at 50% 38%, var(--color-lilac), var(--color-lilac-deep))' }}
          />
          <span className="font-semibold text-[1.05rem] tracking-tight text-ink">FitCoach</span>
        </Link>

        {/* Headline */}
        <div className="mb-8">
          <span className="inline-block bg-lilac/60 rounded-[10px] px-3 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-ink mb-3">
            Register
          </span>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.0] tracking-tight font-normal">
            Begin, <em className="italic text-lilac-deep">on record.</em>
          </h1>
          <p className="font-sans text-[0.95rem] text-taupe mt-3 leading-relaxed">
            한 끼, 한 세트, 한 측정 — 작은 기록이 모이면 한 사람의 변화가 보입니다.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-7">

            {/* LEFT — Account + Body */}
            <div className="space-y-6">
              <section>
                <span className={sectionLabelCls}>Account</span>
                <div className="space-y-3 mt-4">
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

              <section>
                <span className={sectionLabelCls}>Body</span>
                <div className="grid grid-cols-2 gap-3 mt-4">
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
                <p className="font-sans text-[0.72rem] text-hint tracking-wide uppercase mt-2">
                  · age · cm · kg
                </p>
              </section>
            </div>

            {/* RIGHT — Lifestyle + Training + Goal */}
            <div className="space-y-6">
              <section>
                <span className={sectionLabelCls}>Lifestyle</span>
                <div className="mt-4">
                  <label className={labelCls}>Daily routine</label>
                  <select className={selectCls} value={form.lifestyle} onChange={set('lifestyle')}>
                    {LIFESTYLE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </section>

              <section>
                <span className={sectionLabelCls}>Training</span>
                <div className="space-y-3 mt-4">
                  <div>
                    <label className={labelCls}>Experience · 운동 경력</label>
                    <select className={selectCls} value={form.workout_experience} onChange={set('workout_experience')}>
                      {EXPERIENCE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Frequency · 빈도</label>
                    <select className={selectCls} value={form.workout_frequency} onChange={set('workout_frequency')}>
                      {FREQUENCY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <span className={sectionLabelCls}>Goal</span>
                <div className="mt-4">
                  <label className={labelCls}>이번 달의 목표</label>
                  <select className={selectCls} value={form.goal} onChange={set('goal')}>
                    {GOAL_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </section>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-lilac text-ink rounded-[12px] py-3.5 mt-8 font-sans text-[0.85rem] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? '회원가입 중…' : '회원가입'}
          </button>
        </form>

        {/* Bottom — login */}
        <div className="mt-8 pt-6 border-t border-ink/8 text-center">
          <p className="font-sans text-[0.95rem] text-taupe mb-3">
            이미 계정이 있으신가요?
          </p>
          <Link
            to="/login"
            className="inline-block font-sans text-[0.85rem] font-medium rounded-[12px] px-5 py-3 border border-ink/10 text-taupe hover:text-ink hover:bg-bone transition-colors"
          >
            로그인하기
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
