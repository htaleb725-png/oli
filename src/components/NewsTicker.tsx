import React from 'react';
import { useApp } from '../context/AppContext';
import { Megaphone } from 'lucide-react';

export const NewsTicker: React.FC = () => {
  const { systemSettings } = useApp();

  if (!systemSettings.tickerNews || systemSettings.tickerNews.length === 0) return null;

  return (
    <div className="w-full bg-[#0F172A] border-b border-slate-800 px-4 py-1.5 flex items-center gap-3 overflow-hidden text-xs text-slate-200 shadow-xs z-30">
      <div className="flex items-center gap-1.5 font-bold text-amber-400 shrink-0 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 text-[11px]">
        <Megaphone className="w-3 h-3 text-amber-400" />
        <span>شريط التعميمات:</span>
      </div>

      <div className="overflow-hidden relative w-full whitespace-nowrap">
        <div className="animate-ticker space-x-12 inline-block text-[12px] font-medium">
          {systemSettings.tickerNews.map((news, idx) => (
            <span key={idx} className="mx-6 inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span>{news}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
