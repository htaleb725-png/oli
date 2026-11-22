import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X, Plus, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface SearchableSelectProps {
  id?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  /** Optional AppContext dropdown category (e.g. 'District', 'ResidentialArea', 'Surname', 'Job', 'Education', 'Entity', 'ReferralSource') for permanent cloud & local persistence */
  category?: string;
  /** Optional callback triggered when the user adds a brand-new item permanently */
  onAddOption?: (newValue: string) => void;
  /** Optional localStorage key fallback when category is not specified */
  persistKey?: string;
  /** Optional custom placeholder inside the dropdown search box */
  searchPlaceholder?: string;
}

const LOCAL_CUSTOM_OPT_PREFIX = 'al_nashi_custom_select_opts_';

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  options,
  value,
  onChange,
  placeholder = 'اختر أو اكتب للبحث...',
  allowCustom = true,
  className = '',
  disabled = false,
  category,
  onAddOption,
  persistKey,
  searchPlaceholder,
}) => {
  const { addDropdownItem, getDropdownOptions } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isQuickAddMode, setIsQuickAddMode] = useState(false);
  const [quickAddValue, setQuickAddValue] = useState('');
  const [justAddedMsg, setJustAddedMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const quickAddInputRef = useRef<HTMLInputElement>(null);

  const storageKey = useMemo(() => {
    const rawKey = persistKey || category || id || placeholder || 'general';
    return `${LOCAL_CUSTOM_OPT_PREFIX}${rawKey.replace(/\s+/g, '_')}`;
  }, [persistKey, category, id, placeholder]);

  const [localPersistedOptions, setLocalPersistedOptions] = useState<string[]>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
      }
    } catch {}
    return [];
  });

  // Merge passed options + AppContext category options + localStorage persisted options + current value (deduplicated)
  const mergedOptions = useMemo(() => {
    const categoryOpts = category ? getDropdownOptions(category) : [];
    const seen = new Set<string>();
    const combined: string[] = [];
    const pushUnique = (item: string) => {
      const clean = (item || '').trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(clean);
      }
    };
    options.forEach(pushUnique);
    categoryOpts.forEach(pushUnique);
    localPersistedOptions.forEach(pushUnique);
    return combined;
  }, [options, category, getDropdownOptions, localPersistedOptions]);

  // Normalize Arabic letters for friendly searching
  const normalizeArabic = (text: string) => {
    return (text || '')
      .toLowerCase()
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[\u064B-\u065F]/g, '')
      .trim();
  };

  const stripAl = (text: string) => {
    const norm = normalizeArabic(text);
    return norm.startsWith('ال') ? norm.slice(2) : norm;
  };

  const filteredOptions = useMemo(() => {
    return mergedOptions.filter(opt => {
      if (!searchTerm.trim()) return true;
      const normOpt = normalizeArabic(opt);
      const normTerm = normalizeArabic(searchTerm);
      const cleanOpt = stripAl(opt);
      const cleanTerm = stripAl(searchTerm);

      if (
        normOpt.includes(normTerm) ||
        cleanOpt.includes(cleanTerm) ||
        normTerm.includes(normOpt) ||
        cleanTerm.includes(cleanOpt)
      ) {
        return true;
      }

      const collapsedTerm = normTerm.replace(/[\s.\-_/]/g, '');
      const collapsedOpt = normOpt.replace(/[\s.\-_/]/g, '');
      if (collapsedTerm.length >= 2 && collapsedOpt.includes(collapsedTerm)) {
        return true;
      }

      const termParts = normTerm.split(/\s+/).filter(p => p.length >= 2);
      if (termParts.length > 1 && termParts.every(part => normOpt.includes(part) || collapsedOpt.includes(part))) {
        return true;
      }

      return false;
    });
  }, [mergedOptions, searchTerm]);

  const hasExactMatch = useMemo(() => {
    const clean = searchTerm.trim();
    if (!clean) return true;
    const normTerm = normalizeArabic(clean);
    return mergedOptions.some(opt => normalizeArabic(opt) === normTerm);
  }, [mergedOptions, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setIsQuickAddMode(false);
        setQuickAddValue('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const persistAndSelectNewOption = (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) return;

    // 1. Persist permanently in AppContext (Firestore + Google Sheets + localStorage)
    const targetCategory = category || (persistKey ? `Custom_${persistKey}` : undefined);
    if (targetCategory) {
      addDropdownItem(targetCategory, trimmed);
    }

    // 2. Always persist locally for this selector so it immediately stays in the dropdown list
    setLocalPersistedOptions(prev => {
      if (prev.some(p => p.trim().toLowerCase() === trimmed.toLowerCase())) return prev;
      const next = [...prev, trimmed];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });

    // 3. Notify optional parent callback
    if (onAddOption) {
      onAddOption(trimmed);
    }

    // 4. Select it immediately and show brief confirmation
    onChange(trimmed);
    setJustAddedMsg(`تمت إضافة "${trimmed}" وحفظها في القائمة`);
    setTimeout(() => setJustAddedMsg(null), 2600);
    setSearchTerm('');
    setQuickAddValue('');
    setIsQuickAddMode(false);
    setIsOpen(false);
  };

  const handleSelect = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
    setSearchTerm('');
    setIsQuickAddMode(false);
  };

  return (
    <div ref={containerRef} className={`relative text-right ${className}`} id={id}>
      <div
        onClick={() => {
          if (disabled) return;
          setIsOpen(prev => !prev);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 40);
          }
        }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-all ${
          disabled
            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            : isOpen
            ? 'bg-white dark:bg-slate-900 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-slate-400 text-slate-800 dark:text-slate-100'
        }`}
      >
        <span className={`truncate flex-1 font-medium ${!value ? 'text-slate-400 dark:text-slate-500' : ''}`}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 text-slate-400 shrink-0">
          {value && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearchTerm('');
              }}
              className="p-0.5 hover:text-rose-500 rounded cursor-pointer"
              title="مسح الاختيار"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
        </div>
      </div>

      {justAddedMsg && (
        <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
          <Check className="w-3 h-3 shrink-0" />
          <span className="truncate">{justAddedMsg}</span>
        </div>
      )}

      {isOpen && !disabled && (
        <div className="absolute z-[80] right-0 left-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchTerm.trim()) {
                  e.preventDefault();
                  if (filteredOptions.length === 1 && normalizeArabic(filteredOptions[0]) === normalizeArabic(searchTerm)) {
                    handleSelect(filteredOptions[0]);
                  } else if (filteredOptions.length === 1) {
                    handleSelect(filteredOptions[0]);
                  } else if (allowCustom) {
                    persistAndSelectNewOption(searchTerm);
                  }
                }
              }}
              placeholder={searchPlaceholder || 'ابحث أو اكتب اسماً جديداً لإضافته...'}
              className="w-full bg-transparent border-none text-xs text-slate-800 dark:text-slate-100 focus:outline-none placeholder:text-slate-400"
              dir="rtl"
            />
          </div>

          {/* Instant add banner whenever typed term doesn't exist yet */}
          {allowCustom && searchTerm.trim().length > 0 && !hasExactMatch && (
            <button
              type="button"
              onClick={() => persistAndSelectNewOption(searchTerm)}
              className="w-full px-3 py-2 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border-b border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Plus className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">إضافة «{searchTerm.trim()}» وحفظه دائماً في القائمة</span>
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">حفظ فوري</span>
            </button>
          )}

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt === value;
                return (
                  <button
                    key={`${opt}-${idx}`}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`w-full text-right px-3 py-2 transition-colors cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-bold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="truncate">{opt}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-slate-400">
                {searchTerm.trim() ? 'غير موجود حالياً — اضغط زر الإضافة أعلاه لحفظه دائماً في القائمة' : 'لا توجد خيارات بعد'}
              </div>
            )}
          </div>

          {/* Permanent "+ إضافة خيار جديد للقائمة" footer */}
          {allowCustom && (
            <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/70 p-2">
              {!isQuickAddMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickAddMode(true);
                    setQuickAddValue(searchTerm.trim());
                    setTimeout(() => quickAddInputRef.current?.focus(), 40);
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-dashed border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة عنصر جديد غير موجود وتثبيته بالقائمة</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    ref={quickAddInputRef}
                    type="text"
                    value={quickAddValue}
                    onChange={(e) => setQuickAddValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && quickAddValue.trim()) {
                        e.preventDefault();
                        persistAndSelectNewOption(quickAddValue);
                      } else if (e.key === 'Escape') {
                        setIsQuickAddMode(false);
                      }
                    }}
                    placeholder="اكتب الاسم الجديد (منطقة، عشيرة، جهة...)"
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-blue-400 dark:border-blue-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none"
                    dir="rtl"
                  />
                  <button
                    type="button"
                    disabled={!quickAddValue.trim()}
                    onClick={() => persistAndSelectNewOption(quickAddValue)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer shrink-0"
                  >
                    حفظ
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsQuickAddMode(false)}
                    className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
