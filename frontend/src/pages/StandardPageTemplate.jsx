import React from 'react';
import { Moon, Sun, Palette } from 'lucide-react';

const StandardPageTemplate = ({ theme, setTheme }) => {
  const isDark = theme === 'dark' || theme === 'design';
  const bgClass = isDark ? "bg-[#0c0c0e]" : "bg-slate-50";
  const cardClass = isDark ? "bg-[#16161a] border-white/5" : "bg-white border-slate-200 shadow-sm";
  const textClass = isDark ? "text-white" : "text-slate-900";

  return (
    // [1] 배경 고정 및 스크롤 바 안정화
    <div className={`fixed inset-0 ${bgClass} ${textClass} overflow-y-scroll`} style={{ scrollbarGutter: 'stable' }}>
      
      {/* [2] 중앙 정렬 컨테이너 (폭 고정: max-w-6xl) */}
      <div className="w-full max-w-6xl mx-auto min-h-screen flex flex-col">
        
        {/* [3] 상단 공통 헤더 (모든 페이지 동일 규격) */}
        <header className={`w-full flex justify-between items-center p-6 border-b ${isDark ? 'border-white/5 bg-[#0c0c0e]/80' : 'border-slate-200 bg-white/80'} backdrop-blur-md z-[100] sticky top-0`}>
          <div className="flex gap-2">
            <button onClick={() => setTheme('dark')} className="p-1"><Moon size={16} className={theme === 'dark' ? 'text-blue-500' : 'text-slate-400'} /></button>
            <button onClick={() => setTheme('light')} className="p-1"><Sun size={16} className={theme === 'light' ? 'text-blue-500' : 'text-slate-400'} /></button>
            <button onClick={() => setTheme('design')} className="p-1"><Palette size={16} className={theme === 'design' ? 'text-blue-500' : 'text-slate-400'} /></button>
          </div>
          <h2 className="text-[0.625rem] font-black text-blue-500 italic uppercase tracking-[0.3em]">
            {/* 여기에 페이지별 제목이 들어갑니다 */}
            Page Title
          </h2>
          <div className="w-6"></div>
        </header>

        {/* [4] 메인 본문 영역 (여백 고정) */}
        <main className="flex-1 p-6 lg:p-10 space-y-10">
          {/* 콘텐츠는 이 안에 자유롭게 구성하되, 
              카드 레이아웃은 ${cardClass}와 rounded-[2.5rem]~[3rem]을 유지합니다.
          */}
        </main>

        {/* [5] 푸터 하단 여백 (Navbar 높이 고려) */}
        <footer className="py-20 text-center">
          <p className="text-[0.625rem] font-black text-slate-800 uppercase tracking-[0.5em]">
            FITCOACH System Standard
          </p>
        </footer>
      </div>
    </div>
  );
};

export default StandardPageTemplate;