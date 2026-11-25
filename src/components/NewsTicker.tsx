import React from 'react';
import { useApp } from '../context/AppContext';
import { Megaphone } from 'lucide-react';

export const NewsTicker: React.FC = () => {
  const { systemSettings } = useApp();

  const items = (systemSettings.tickerNews || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  if (items.length === 0) return null;

  // Dynamic duration proportional to content length so speed stays smooth & readable
  const totalChars = items.reduce((acc, s) => acc + s.length, 0);
  const durationSeconds = Math.max(22, Math.min(75, Math.round(totalChars * 0.28)));

  return (
    <div
      className="news-ticker-bar w-full bg-[#0F1E36] dark:bg-[#091121] border-b border-slate-800/90 dark:border-[#1E2E47] px-3 sm:px-4 py-1.5 flex items-center gap-3 overflow-hidden text-xs text-slate-100 dark:text-slate-200 shadow-xs z-30 select-none"
      dir="rtl"
    >
      {/* Badge */}
      <div className="flex items-center gap-1.5 font-bold text-amber-300 dark:text-amber-300 shrink-0 bg-amber-500/15 dark:bg-amber-500/15 px-2.5 py-0.5 rounded-md border border-amber-400/30 dark:border-amber-500/30 text-[11px] z-10">
        <Megaphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>شريط التعميمات</span>
      </div>

      {/* Smooth Continuous RTL Marquee Track */}
      <div className="relative flex-1 overflow-hidden" dir="ltr">
        {/* Soft edge fades matching light & dark surfaces */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#0F1E36] dark:from-[#091121] to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#0F1E36] dark:from-[#091121] to-transparent z-10" />

        <div
          className="news-ticker-track flex w-max items-center"
          style={{ animationDuration: `${durationSeconds}s` }}
        >
          {[0, 1].map((dupIdx) => (
            <div
              key={dupIdx}
              aria-hidden={dupIdx === 1}
              className="flex items-center shrink-0"
              dir="rtl"
            >
              {items.map((news, idx) => (
                <span
                  key={`${dupIdx}-${idx}`}
                  className="mx-7 inline-flex items-center gap-2.5 shrink-0 text-[12px] font-medium text-slate-100 dark:text-slate-200 whitespace-nowrap"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-400 shrink-0 shadow-[0_0_6px_rgba(251,191,36,0.65)]" />
                  <span>{news}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
