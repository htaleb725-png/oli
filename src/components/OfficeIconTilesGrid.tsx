import React from 'react';
import { LucideIcon, ArrowUpLeft } from 'lucide-react';

export interface OfficeTileItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  iconImgUrl?: string; // صورة مخصصة للأيقونة تم رفعها بواسطة المطور
  iconColor?: string; // e.g. 'text-blue-600 dark:text-blue-400'
  iconBg?: string;    // e.g. 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
  badge?: string | number | null;
  badgeColor?: string; // e.g. 'bg-rose-500 text-white'
  isActive?: boolean;
  onClick: () => void;
}

interface OfficeIconTilesGridProps {
  items: OfficeTileItem[];
  columns?: 3 | 4 | 5;
  title?: string;
  subtitle?: string;
  className?: string;
}

export const OfficeIconTilesGrid: React.FC<OfficeIconTilesGridProps> = ({
  items,
  columns = 5,
  title,
  subtitle,
  className = ''
}) => {
  const getGridColsClass = () => {
    switch (columns) {
      case 3:
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';
      case 4:
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
      case 5:
      default:
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
    }
  };

  return (
    <div className={`space-y-4 font-['Tajawal',sans-serif] ${className}`} dir="rtl">
      {(title || subtitle) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            {title && (
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm animate-pulse"></span>
                <span>{title}</span>
              </h3>
            )}
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
              {items.length} أيقونة عمل مباشرة
            </span>
          </div>
        </div>
      )}

      {/* The Responsive 3D Interactive Touch Icon Grid */}
      <div className={`grid ${getGridColsClass()} gap-3 sm:gap-4`}>
        {items.map((item) => {
          const IconComp = item.icon;
          const isActive = item.isActive;

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`group relative text-center p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-between min-h-[125px] sm:min-h-[140px] cursor-pointer shadow-xs hover:shadow-xl select-none transform hover:-translate-y-1.5 active:scale-95 overflow-hidden ${
                isActive
                  ? 'bg-gradient-to-b from-blue-50/90 via-indigo-50/70 to-blue-100/40 dark:from-blue-950/70 dark:via-indigo-950/50 dark:to-slate-900 border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/30 shadow-md'
                  : 'bg-white dark:bg-slate-900/90 hover:bg-gradient-to-b hover:from-white hover:to-slate-50 dark:hover:from-slate-850 dark:hover:to-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500'
              }`}
            >
              {/* Subtle top ambient glow on hover */}
              <div className="absolute inset-x-0 -top-px h-1 bg-gradient-to-r from-transparent via-blue-500/0 to-transparent group-hover:via-blue-500 transition-all duration-300" />

              {/* Optional Count Badge */}
              {item.badge !== undefined && item.badge !== null && item.badge !== '' && (
                <div className="absolute top-2.5 left-2.5 z-10">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 border border-white/20 ${
                      item.badgeColor || 'bg-rose-500 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                </div>
              )}

              {/* Enter hint pill (shows on hover) */}
              <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span className="flex items-center gap-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 shadow-2xs">
                  <span>دخول</span>
                  <ArrowUpLeft className="w-2.5 h-2.5" />
                </span>
              </div>

              {/* Icon Container with vibrant elevation */}
              <div className="flex-1 flex flex-col items-center justify-center w-full">
                <div
                  className={`w-13 h-13 sm:w-15 sm:h-15 rounded-2xl flex items-center justify-center mb-2.5 transition-all duration-300 group-hover:scale-110 group-hover:rotate-1 shadow-sm border overflow-hidden ${
                    item.iconBg || 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } ${item.iconColor || 'text-slate-700 dark:text-slate-300'}`}
                >
                  {item.iconImgUrl ? (
                    <img src={item.iconImgUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <IconComp className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2] transition-transform duration-300 group-hover:stroke-[2.5]" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={`font-black text-xs sm:text-[13px] leading-tight transition-colors line-clamp-2 px-1 text-center ${
                    isActive
                      ? 'text-blue-700 dark:text-blue-300 font-extrabold'
                      : 'text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                  }`}
                >
                  {item.title}
                </span>

                {/* Optional Subtitle */}
                {item.subtitle && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 line-clamp-1 max-w-[95%]">
                    {item.subtitle}
                  </span>
                )}
              </div>

              {/* Bottom interactive progress/entry bar indicator */}
              <div className="w-8 h-1 rounded-full bg-slate-200 dark:bg-slate-800 mt-2 group-hover:w-16 group-hover:bg-blue-600 transition-all duration-300" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
