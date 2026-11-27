import React from 'react';
import { useApp } from '../context/AppContext';
import { Megaphone } from 'lucide-react';

const TICKER_THEME_MAP: Record<
  string,
  { bar: string; fadeLeft: string; fadeRight: string; badge: string; dot: string }
> = {
  navy: {
    bar: 'bg-[#0F1E36] dark:bg-[#091121] border-slate-800/90 dark:border-[#1E2E47] text-slate-100',
    fadeLeft: 'from-[#0F1E36] dark:from-[#091121]',
    fadeRight: 'from-[#0F1E36] dark:from-[#091121]',
    badge: 'text-amber-300 bg-amber-500/15 border-amber-400/30',
    dot: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.65)]'
  },
  emerald: {
    bar: 'bg-emerald-950 border-emerald-800/90 text-emerald-50',
    fadeLeft: 'from-emerald-950',
    fadeRight: 'from-emerald-950',
    badge: 'text-emerald-200 bg-emerald-500/20 border-emerald-400/30',
    dot: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.65)]'
  },
  amber: {
    bar: 'bg-amber-950 border-amber-800/90 text-amber-50',
    fadeLeft: 'from-amber-950',
    fadeRight: 'from-amber-950',
    badge: 'text-amber-200 bg-amber-500/20 border-amber-400/40',
    dot: 'bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.75)]'
  },
  rose: {
    bar: 'bg-rose-950 border-rose-800/90 text-rose-50',
    fadeLeft: 'from-rose-950',
    fadeRight: 'from-rose-950',
    badge: 'text-rose-200 bg-rose-500/20 border-rose-400/30',
    dot: 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.65)]'
  },
  indigo: {
    bar: 'bg-indigo-950 border-indigo-800/90 text-indigo-50',
    fadeLeft: 'from-indigo-950',
    fadeRight: 'from-indigo-950',
    badge: 'text-indigo-200 bg-indigo-500/20 border-indigo-400/30',
    dot: 'bg-indigo-300 shadow-[0_0_6px_rgba(165,180,252,0.65)]'
  }
};

export const NewsTicker: React.FC = () => {
  const { systemSettings } = useApp();

  if (systemSettings.tickerEnabled === false) return null;

  const items = (systemSettings.tickerNews || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  if (items.length === 0) return null;

  const speedFactor =
    systemSettings.tickerSpeed === 'fast'
      ? 0.16
      : systemSettings.tickerSpeed === 'slow'
      ? 0.44
      : 0.28;

  const totalChars = items.reduce((acc, s) => acc + s.length, 0);
  const durationSeconds = Math.max(14, Math.min(95, Math.round(totalChars * speedFactor)));

  const theme = TICKER_THEME_MAP[systemSettings.tickerColor || 'navy'] || TICKER_THEME_MAP.navy;

  return (
    <div
      className={`news-ticker-bar w-full border-b px-3 sm:px-4 py-1.5 flex items-center gap-3 overflow-hidden text-xs shadow-xs z-30 select-none transition-colors duration-200 ${theme.bar}`}
      dir="rtl"
    >
      {/* Badge */}
      <div
        className={`flex items-center gap-1.5 font-bold shrink-0 px-2.5 py-0.5 rounded-md border text-[11px] z-10 ${theme.badge}`}
      >
        <Megaphone className="w-3.5 h-3.5 shrink-0" />
        <span>شريط التعميمات</span>
      </div>

      {/* Smooth Continuous RTL Marquee Track */}
      <div className="relative flex-1 overflow-hidden" dir="ltr">
        <div className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r ${theme.fadeLeft} to-transparent z-10`} />
        <div className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l ${theme.fadeRight} to-transparent z-10`} />

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
                  className="mx-7 inline-flex items-center gap-2.5 shrink-0 text-[12px] font-medium whitespace-nowrap"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${theme.dot}`} />
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
