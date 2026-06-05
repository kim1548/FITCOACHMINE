import React from 'react';

/**
 * 인라인 필드 에러 — 입력 필드 아래 한 줄 오류 메시지.
 * 폼 검증(예: "음식을 입력해주세요") 전용. 모달이나 토스트보다 가벼움.
 *
 * 사용 예:
 *   <input ... aria-invalid={!!error} aria-describedby="foo-err" />
 *   <FieldError id="foo-err">{error}</FieldError>
 *
 * children 이 falsy 면 아무것도 렌더하지 않음 → 조건부 없이 그냥 깔아둬도 됨.
 */
const FieldError = ({ id, children, className = '' }) => {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className={`font-mono text-[0.625rem] text-accent-red tracking-meta uppercase mt-1.5 ${className}`}
    >
      · {children}
    </p>
  );
};

export default FieldError;
