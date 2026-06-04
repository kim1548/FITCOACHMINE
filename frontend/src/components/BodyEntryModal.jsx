import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import FieldError from './ui/FieldError';
import { useToast } from './ui/Toast';

/**
 * BodyEntryModal — InBody 측정 입력 모달 (Editorial Magazine 톤).
 * - 측정일 기본 오늘, date input 으로 변경 가능
 * - 체중만 필수 (FieldError 로 인라인 표시), 나머지 4개는 옵션
 * - 저장 성공 시 toast + onSaved 호출
 */

const FIELDS = [
  { key: 'weight',           label: 'Weight',     subLabel: '체중',       unit: 'kg',   required: true  },
  { key: 'skeletal_muscle',  label: 'Muscle',     subLabel: '골격근량',   unit: 'kg',   required: false },
  { key: 'body_fat_mass',    label: 'Fat mass',   subLabel: '체지방량',   unit: 'kg',   required: false },
  { key: 'body_fat_percent', label: 'Body fat %', subLabel: '체지방률',   unit: '%',    required: false },
  { key: 'bmr',              label: 'BMR',        subLabel: '기초대사량', unit: 'kcal', required: false },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

const BodyEntryModal = ({ isOpen, onClose, onSaved }) => {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [weightError, setWeightError] = useState('');
  const [serverError, setServerError] = useState('');

  // 모달이 열릴 때마다 상태 리셋 (안 닫고 새로 여는 경우 대비).
  useEffect(() => {
    if (isOpen) {
      setDate(todayISO());
      setValues({});
      setWeightError('');
      setServerError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!values.weight) {
      setWeightError('체중은 필수 항목입니다.');
      return;
    }
    setWeightError('');
    setServerError('');
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const payload = { measured_at: date, weight: Number(values.weight) };
      for (const f of FIELDS) {
        if (f.key !== 'weight' && values[f.key] !== undefined && values[f.key] !== '') {
          payload[f.key] = Number(values[f.key]);
        }
      }
      await axios.post(`${API_BASE_URL}/body`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('측정 기록을 저장했습니다.');
      onSaved?.();
      onClose();
    } catch (err) {
      setServerError(err?.response?.data?.detail || '저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (key === 'weight' && weightError) setWeightError('');
    if (serverError) setServerError('');
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full md:max-w-md max-h-[92vh] flex flex-col bg-paper text-ink border border-ink/20 shadow-2xl animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — 모바일은 타이틀 숨겨 공간 확보(폼이 위로 올라감), 데스크탑은 유지 */}
        <header className="flex-shrink-0 flex items-baseline justify-between px-6 py-3 md:py-4 border-b border-ink/15">
          <div className="hidden md:block">
            <div className="font-mono text-[10px] text-accent-red tracking-label uppercase mb-1">
              — New entry
            </div>
            <h2 className="font-display text-xl text-ink leading-tight font-normal tracking-tight m-0">
              InBody, <em className="italic text-accent-gold">on record.</em>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] tracking-meta uppercase text-taupe hover:text-ink transition-colors"
            aria-label="닫기"
          >
            Close ×
          </button>
        </header>

        {/* Body */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* Date */}
          <div>
            <label className="block font-mono text-[10px] text-taupe tracking-meta uppercase mb-1.5">
              Measured on
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-paper border border-ink/15 focus:border-accent-red outline-none font-display text-[15px] text-ink tabular-nums transition-colors"
            />
          </div>

          {/* Fields */}
          {FIELDS.map((f) => {
            const isWeight = f.key === 'weight';
            const showErr = isWeight && weightError;
            return (
              <div key={f.key}>
                <label className="flex items-baseline justify-between mb-1.5">
                  <span className="font-mono text-[10px] text-taupe tracking-meta uppercase">
                    {f.label}
                    {f.required && <span className="text-accent-red ml-1">*</span>}
                    <span className="text-hint normal-case tracking-normal ml-2 font-display italic">
                      {f.subLabel}
                    </span>
                  </span>
                  {!f.required && (
                    <span className="font-mono text-[9px] text-hint tracking-meta uppercase">
                      Optional
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={values[f.key] ?? ''}
                    onChange={handleChange(f.key)}
                    placeholder={f.required ? '필수' : '—'}
                    aria-invalid={!!showErr}
                    aria-describedby={showErr ? `${f.key}-err` : undefined}
                    className="w-full px-3 py-2.5 pr-12 bg-paper border border-ink/15 focus:border-accent-red outline-none font-display text-[15px] text-ink tabular-nums placeholder:text-hint placeholder:italic transition-colors [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    style={{ MozAppearance: 'textfield' }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-taupe tracking-meta uppercase pointer-events-none">
                    {f.unit}
                  </span>
                </div>
                {showErr && <FieldError id={`${f.key}-err`}>{weightError}</FieldError>}
              </div>
            );
          })}

          {serverError && (
            <div className="border border-accent-red/30 bg-accent-red/[0.05] px-3 py-2.5">
              <div className="font-mono text-[10px] text-accent-red tracking-label uppercase mb-1">
                — Failed
              </div>
              <p className="font-display italic text-[13px] text-body leading-snug m-0">
                {serverError}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex-shrink-0 border-t border-ink/15">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 font-mono text-[11px] tracking-label uppercase bg-accent-red text-ink hover:bg-accent-red/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="animate-spin" size={12} />}
            {submitting ? 'Saving…' : '→ Save entry'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

export default BodyEntryModal;
