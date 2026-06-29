import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * AuthPromptModal — 미로그인 사용자가 보호된 액션(예: FITCOACH 워드마크 클릭)을
 * 시도했을 때 띄우는 로그인/회원가입 유도 모달 (Editorial Magazine 톤).
 *
 * props:
 *   open       boolean
 *   onClose    () => void
 *   title      string — serif 헤드라인 (옵션, 기본 "FITCOACH 시작하기")
 *   message    string — italic 본문 설명 (옵션)
 */
const AuthPromptModal = ({
  open,
  onClose,
  title = 'FITCOACH 를 시작하시겠어요?',
  message = '오늘의 운동 · 식단 · 체성분 기록을 시작하려면 먼저 자리에 앉아주세요.',
}) => {
  const navigate = useNavigate();

  // ESC 닫기.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const go = (path) => {
    onClose?.();
    navigate(path);
  };

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-paper text-ink rounded-[24px] shadow-[0_24px_60px_-20px_rgba(26,20,16,0.45)] overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 pt-5 pb-1">
          <span className="inline-block bg-lilac/60 rounded-[10px] px-3 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-ink">
            Welcome
          </span>
          <button
            onClick={onClose}
            className="font-sans text-[0.8rem] text-taupe hover:text-ink transition-colors"
            aria-label="닫기"
          >
            닫기 ×
          </button>
        </header>

        {/* Body */}
        <div className="px-6 py-5">
          <h3 className="font-display text-2xl md:text-3xl text-ink leading-[1.05] tracking-tight m-0 mb-3 font-normal">
            {title.split('FITCOACH').length > 1 ? (
              <>
                <em className="italic text-lilac-deep">FitCoach</em>
                {title.split('FITCOACH')[1]}
              </>
            ) : (
              title
            )}
          </h3>
          <p className="font-sans text-sm text-taupe leading-relaxed m-0">
            {message}
          </p>
        </div>

        {/* Actions */}
        <footer className="flex flex-col sm:flex-row gap-3 px-6 pb-6">
          <button
            onClick={() => go('/login')}
            className="flex-1 py-3 rounded-[12px] font-sans text-[0.85rem] font-medium text-taupe hover:text-ink hover:bg-ink/[0.04] transition-colors"
          >
            로그인
          </button>
          <button
            onClick={() => go('/signup')}
            className="flex-1 py-3 rounded-[12px] font-sans text-[0.85rem] font-medium bg-lilac text-ink hover:opacity-90 transition-opacity"
          >
            무료로 시작
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AuthPromptModal;
