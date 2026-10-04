import React from 'react';
import { LucideIcon } from 'lucide-react';

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
        return 'grid-cols-2 sm:grid-cols-3';
      case 4:
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
      case 5:
      default:
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
    }
  };

  return (
    <div className={`space-y-3 font-['Tajawal',sans-serif] ${className}`} dir="rtl">
      {(title || subtitle) && (
        <div className="flex items-center justify-between pb-1">
          <div>
            {title && (
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                <span>{title}</span>
              </h3>
            )}
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {items.length} أيقونة عمل
          </span>
        </div>
      )}

      {/* The 5-Column Responsive Icon Grid inspired by Desktop ERP/POS layout */}
      <div className={`grid ${getGridColsClass()} gap-2.5 sm:gap-3`}>
        {items.map((item) => {
          const IconComp = item.icon;
          const isActive = item.isActive;

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`group relative text-center p-3.5 sm:p-4 rounded-xl border transition-all duration-150 flex flex-col items-center justify-center min-h-[110px] sm:min-h-[120px] cursor-pointer shadow-2xs hover:shadow-md select-none active:scale-[0.98] ${
                isActive
                  ? 'bg-gradient-to-b from-blue-50/90 to-indigo-50/70 dark:from-blue-950/60 dark:to-indigo-950/40 border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              {/* Optional Count Badge */}
              {item.badge !== undefined && item.badge !== null && item.badge !== '' && (
                <span
                  className={`absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs ${
                    item.badgeColor || 'bg-rose-500 text-white'
                  }`}
                >
                  {item.badge}
                </span>
              )}

              {/* Icon Container */}
              <div
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-2 transition-all duration-200 group-hover:scale-110 shadow-2xs border overflow-hidden ${
                  item.iconBg || 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                } ${item.iconColor || 'text-slate-700 dark:text-slate-300'}`}
              >
                {item.iconImgUrl ? (
                  <img src={item.iconImgUrl} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <IconComp className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2]" />
                )}
              </div>

              {/* Label */}
              <span
                className={`font-black text-xs sm:text-[13px] leading-tight transition-colors line-clamp-2 px-1 ${
                  isActive
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                }`}
              >
                {item.title}
              </span>

              {/* Optional Subtitle */}
              {item.subtitle && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">
                  {item.subtitle}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
