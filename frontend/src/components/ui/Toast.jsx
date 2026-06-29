import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Toast 시스템 — 잠깐 떠올랐다 사라지는 알림 (Editorial Magazine 톤).
 *
 * 사용 예:
 *   const toast = useToast();
 *   toast.success('기록을 저장했습니다');
 *   toast.error('저장에 실패했습니다');
 *   toast.info('곧 새 운동이 추가됩니다');
 *
 * App.jsx 에서 <ToastProvider> 로 트리를 감싸야 동작한다.
 */

const ToastContext = createContext(null);

const DEFAULT_DURATION = 3500;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toast) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, ...toast }]);
    return id;
  }, []);

  const api = useMemo(
    () => ({
      success: (msg, opts) => push({ variant: 'success', msg, ...opts }),
      error:   (msg, opts) => push({ variant: 'error',   msg, ...opts }),
      info:    (msg, opts) => push({ variant: 'info',    msg, ...opts }),
      dismiss: remove,
    }),
    [push, remove],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
};

// ============================================================
// Container + Item
// ============================================================
const ToastContainer = ({ toasts, onDismiss }) => (
  <div className="fixed top-[5.5rem] right-4 md:right-8 z-[500] flex flex-col gap-2 pointer-events-none w-[calc(100%-2rem)] md:w-auto max-w-[26.25rem]">
    {toasts.map((t) => (
      <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
    ))}
  </div>
);

const VARIANT_META = {
  success: { label: 'Done',   barCls: 'bg-lilac-deep', accentCls: 'text-lilac-deep' },
  error:   { label: 'Failed', barCls: 'bg-[#c43c2f]',  accentCls: 'text-[#c43c2f]'  },
  info:    { label: 'Note',   barCls: 'bg-sky',        accentCls: 'text-ink'        },
};

const ToastItem = ({ toast, onDismiss }) => {
  const { id, variant = 'info', msg, duration = DEFAULT_DURATION } = toast;
  const meta = VARIANT_META[variant] || VARIANT_META.info;

  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <div
      role="status"
      className="pointer-events-auto relative overflow-hidden bg-paper rounded-[14px] border border-ink/10 pl-5 pr-4 py-3 min-w-[16.25rem] shadow-[0_12px_30px_-12px_rgba(26,20,16,0.3)] animate-in slide-in-from-right-4 fade-in duration-200"
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${meta.barCls}`} aria-hidden="true" />
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className={`font-sans text-[0.625rem] tracking-label uppercase ${meta.accentCls}`}>
          {meta.label}
        </div>
        <button
          onClick={() => onDismiss(id)}
          className="font-sans text-[0.625rem] tracking-meta uppercase text-hint hover:text-ink transition-colors"
          aria-label="닫기"
        >
          ×
        </button>
      </div>
      <p className="font-sans text-[0.875rem] text-ink leading-snug m-0 whitespace-pre-line">
        {msg}
      </p>
    </div>
  );
};
