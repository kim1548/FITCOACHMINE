import React, { useEffect } from 'react';

/**
 * <Modal> — 확정/취소 컨펌 모달 (Editorial Magazine 톤).
 *
 * 단독 사용도 가능하지만, 대부분 useConfirm 훅을 통해 imperatively 호출:
 *   const ok = await confirm({ title: '삭제할까요?', destructive: true });
 *
 * props:
 *   open           bool  — 모달 표시 여부
 *   title          string — serif 헤드라인 (필수)
 *   description    string — italic 설명 (옵션)
 *   confirmLabel   string — 확정 버튼 라벨 (기본 "Confirm")
 *   cancelLabel    string — 취소 버튼 라벨 (기본 "Cancel")
 *   destructive    bool  — 확정 액션이 파괴적이면 accent-red 강조
 *   tone           string — 상단 라벨 텍스트 (기본 "Confirm")
 *   onConfirm      () => void
 *   onCancel       () => void
 */
const Modal = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  tone = 'Confirm',
  onConfirm,
  onCancel,
}) => {
  // ESC 키로 취소.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') onCancel?.();
      if (e.key === 'Enter') onConfirm?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-paper text-ink rounded-[24px] shadow-[0_24px_60px_-20px_rgba(26,20,16,0.45)] overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <header className="px-6 pt-6 pb-2">
          <div className="font-sans text-[0.7rem] font-medium tracking-wide uppercase text-taupe mb-2">
            {tone}
          </div>
          <h3 className="font-display text-2xl text-ink leading-snug m-0 font-normal tracking-tight whitespace-pre-line">
            {title}
          </h3>
        </header>

        {/* Description */}
        {description && (
          <div className="px-6 pb-2">
            <p className="font-sans text-sm text-body leading-relaxed m-0 whitespace-pre-line">
              {description}
            </p>
          </div>
        )}

        {/* Footer */}
        <footer className="flex gap-3 px-6 py-5">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-[12px] font-sans text-[0.85rem] font-medium text-taupe hover:text-ink hover:bg-ink/[0.04] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`flex-1 py-3 rounded-[12px] font-sans text-[0.85rem] font-medium transition-opacity hover:opacity-90 ${
              destructive ? 'bg-[#c43c2f] text-paper' : 'bg-lilac text-ink'
            }`}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default Modal;
