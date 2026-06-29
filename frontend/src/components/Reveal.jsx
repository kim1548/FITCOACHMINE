import React, { useEffect, useRef, useState } from "react";

/**
 * 스크롤 진입 시 페이드업 리빌. 재사용 공통 컴포넌트.
 * prefers-reduced-motion 시 모션 없이 즉시 표시.
 *
 * @param {number} delay  - ms 단위 stagger 지연
 * @param {string} className - 래퍼에 추가할 클래스
 */
const Reveal = ({ children, className = "", delay = 0 }) => {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
      } ${className}`}
    >
      {children}
    </div>
  );
};

export default Reveal;
