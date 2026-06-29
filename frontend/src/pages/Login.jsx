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
 * /login — Gleap 라이트 톤 (standalone, TopNavbar 없음).
 */

const Login = () => {
  usePageTitle('Sign in · FitCoach');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [credError, setCredError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

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
      className="fixed inset-0 bg-surface overflow-y-auto [&::-webkit-scrollbar]:hidden flex items-center justify-center p-4"
      style={{
        scrollbarWidth: 'none',
        backgroundImage:
          'radial-gradient(48rem 38rem at 0% 0%, rgba(241,204,255,0.5), rgba(241,204,255,0) 55%), radial-gradient(44rem 36rem at 100% 100%, rgba(145,224,255,0.45), rgba(145,224,255,0) 55%)',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'scroll',
      }}
    >
      <div className="w-full max-w-[27rem] my-auto bg-paper rounded-[28px] border border-ink/8 shadow-[0_28px_70px_-28px_rgba(26,20,16,0.28)] p-8 md:p-10 font-sans animate-in fade-in zoom-in-95 duration-300">

        {/* Logo */}
        <Link to="/login" className="flex items-center gap-2 mb-8">
          <span
            className="w-[22px] h-[22px] rounded-full"
            style={{ background: 'radial-gradient(circle at 50% 38%, var(--color-lilac), var(--color-lilac-deep))' }}
          />
          <span className="font-semibold text-[1.05rem] tracking-tight text-ink">FitCoach</span>
        </Link>

        {/* Headline */}
        <div className="mb-8">
          <span className="inline-block bg-lilac/60 rounded-[10px] px-3 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-ink mb-3">
            Sign in
          </span>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.0] tracking-tight font-normal">
            Welcome <em className="italic text-lilac-deep">back.</em>
          </h1>
          <p className="font-sans text-[0.95rem] text-taupe mt-3 leading-relaxed">
            오늘의 기록을 이어가려면 먼저 자리에 앉아주세요.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 mb-8">
          <div>
            <label className="block font-sans text-[0.72rem] font-medium text-taupe tracking-wide uppercase mb-1.5">
              Username
            </label>
            <input
              value={username}
              onChange={onChange(setUsername)}
              placeholder="아이디"
              autoComplete="username"
              aria-invalid={!!credError}
              aria-describedby={credError ? 'login-err' : undefined}
              className="w-full px-4 py-3 bg-bone rounded-[12px] border border-ink/10 focus:border-lilac-deep focus:bg-paper outline-none font-sans text-[0.95rem] text-ink placeholder:text-hint transition-colors"
            />
          </div>

          <div>
            <label className="block font-sans text-[0.72rem] font-medium text-taupe tracking-wide uppercase mb-1.5">
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
              className="w-full px-4 py-3 bg-bone rounded-[12px] border border-ink/10 focus:border-lilac-deep focus:bg-paper outline-none font-sans text-[0.95rem] text-ink placeholder:text-hint transition-colors"
            />
            <FieldError id="login-err">{credError}</FieldError>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 mt-1 rounded-[12px] font-sans text-[0.85rem] font-medium bg-lilac text-ink hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? '로그인 중…' : '로그인'}
          </button>
        </form>

        {/* Bottom — register */}
        <div className="mt-7 pt-6 border-t border-ink/8 text-center">
          <p className="font-sans text-[0.9rem] text-taupe mb-3">
            아직 계정이 없으신가요?
          </p>
          <Link
            to="/signup"
            className="inline-block rounded-[12px] px-5 py-2.5 font-sans text-[0.85rem] font-medium text-ink border border-ink/15 hover:bg-ink/[0.04] transition-colors"
          >
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
