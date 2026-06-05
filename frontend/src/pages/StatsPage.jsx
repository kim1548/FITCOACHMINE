import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../api/config';
import { TrendingUp, Calendar, Trophy, ChevronRight } from 'lucide-react';

const StatsPage = ({ theme }) => {
  const [data, setData] = useState(null);
  const isDark = theme === 'dark' || theme === 'design';

  useEffect(() => {
    fetch(`${API_BASE_URL}/routine/stats`)
      .then(res => res.json())
      .then(d => setData(d));
  }, []);

  if (!data) return <div className="p-10 text-center font-black">ANALYZING DATA...</div>;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0c0c0e] text-white' : 'bg-slate-50 text-slate-900'} p-6 lg:p-12 pb-32 pt-[5rem]`}>
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* 헤더 섹션 */}
        <section>
          <h1 className="text-5xl font-black tracking-tighter mb-2">Performance Center</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[0.625rem]">Your Strength Progression Journey</p>
        </section>

        {/* 현재 능력치 카드 (M4 Mac mini에서는 가로로 배치) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(data.current_status).map(([name, val]) => (
            <div key={name} className={`${isDark ? 'bg-[#16161a]' : 'bg-white shadow-sm'} p-6 rounded-[2rem] border border-white/5`}>
              <p className="text-[0.625rem] font-black text-blue-500 uppercase mb-2">{name}</p>
              <h3 className="text-2xl font-black">{val.tm}kg</h3>
              <p className="text-[0.625rem] text-slate-500 font-bold uppercase mt-1">TM (90%)</p>
            </div>
          ))}
        </div>

        {/* 최근 기록 리스트 */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Calendar className="text-blue-500" size={20} />
            <h2 className="text-xl font-black uppercase tracking-tight">Recent Logs</h2>
          </div>
          
          <div className="space-y-3">
            {data.history.map((log, idx) => (
              <div key={idx} className={`${isDark ? 'bg-white/5' : 'bg-white shadow-sm'} p-5 rounded-2xl flex justify-between items-center border border-white/5`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${log.success ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                    <Trophy size={18} />
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase">{log.exercise}</p>
                    <p className="text-[0.625rem] text-slate-500 font-bold">{log.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-blue-500">{log.weight}kg</p>
                  <p className={`text-[0.5625rem] font-black uppercase ${log.success ? 'text-green-500' : 'text-red-500'}`}>
                    {log.success ? 'Success' : 'Failed'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default StatsPage;