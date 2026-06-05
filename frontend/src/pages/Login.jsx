import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import { useToast } from '../components/ui/Toast';
import FieldError from '../components/ui/FieldError';
import usePageTitle from '../hooks/usePageTitle';

/**
 * /login — Editorial Magazine 톤 (standalone, TopNavbar 없음).
 */

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const dayOfYear = () => {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
};

const Login = () => {
  usePageTitle('Sign in · FitCoach');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [credError, setCredError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const issueNo = String(dayOfYear()).padStart(3, '0');
  const now = new Date();
  const monthLabel = MONTH_LABELS[now.getMonth()];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setCredError('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }
    setCredError('');
    setSubmitting(true);
    try {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);
      const res = await axios.post(`${API_BASE_URL}/auth/login`, params);
      toast.success('로그인 성공!');
      login(res.data.access_token, res.data.username);
      navigate('/');
    } catch (err) {
      toast.error('로그인 실패! 아이디나 비밀번호를 확인하세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const onChange = (setter) => (e) => {
    setter(e.target.value);
    if (credError) setCredError('');
  };

  return (
    <div
      className="fixed inset-0 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none' }}
    >
      <div className="w-full max-w-[30rem] mx-auto min-h-full flex flex-col px-6 md:px-8 py-10">

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
            — Sign in · Welcome back
          </div>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.0] tracking-tight font-normal">
            Welcome <em className="italic text-accent-gold">back.</em>
          </h1>
          <p className="font-display italic text-sm text-taupe mt-3 leading-relaxed">
            오늘의 기록을 이어가려면 먼저 자리에 앉아주세요.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 mb-8">
          <div>
            <label className="block font-mono text-[0.625rem] text-taupe tracking-meta uppercase mb-1.5">
              Username
            </label>
            <input
              value={username}
              onChange={onChange(setUsername)}
              placeholder="아이디"
              autoComplete="username"
              aria-invalid={!!credError}
              aria-describedby={credError ? 'login-err' : undefined}
              className="w-full px-3 py-2.5 bg-paper border border-ink/15 focus:border-accent-red outline-none font-display text-[0.9375rem] text-ink placeholder:text-hint placeholder:italic transition-colors"
            />
          </div>

          <div>
            <label className="block font-mono text-[0.625rem] text-taupe tracking-meta uppercase mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={onChange(setPassword)}
              placeholder="비밀번호"
              autoComplete="current-password"
              aria-invalid={!!credError}
              aria-describedby={credError ? 'login-err' : undefined}
              className="w-full px-3 py-2.5 bg-paper border border-ink/15 focus:border-accent-red outline-none font-display text-[0.9375rem] text-ink placeholder:text-hint placeholder:italic transition-colors"
            />
            <FieldError id="login-err">{credError}</FieldError>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 mt-2 font-mono text-[0.6875rem] tracking-label uppercase bg-accent-red text-ink hover:bg-accent-red/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            {submitting ? 'Signing in…' : '→ Sign in'}
          </button>
        </form>

        {/* Bottom — register */}
        <div className="border-t border-ink/15 pt-6 text-center">
          <p className="font-display italic text-sm text-taupe mb-3">
            아직 계정이 없으신가요?
          </p>
          <Link
            to="/signup"
            className="inline-block font-mono text-[0.6875rem] tracking-label uppercase px-5 py-3 border border-ink/20 text-taupe hover:text-ink hover:border-ink/40 transition-colors"
          >
            → Register an account
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-10 border-t border-ink/15 mt-10 flex justify-between items-center font-mono text-[0.625rem] text-hint tracking-meta uppercase">
          <span>— FITCOACH —</span>
          <span className="text-taupe">Sign in</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
