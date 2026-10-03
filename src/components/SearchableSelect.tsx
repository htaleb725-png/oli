import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

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
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  options,
  value,
  onChange,
  placeholder = 'اختر أو اكتب للبحث...',
  allowCustom = true,
  className = '',
  required = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize Arabic letters for friendly searching
  const normalizeArabic = (text: string) => {
    return (text || '')
      .toLowerCase()
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[\u064B-\u065F]/g, '') // strip tashkeel
      .trim();
  };

  const stripAl = (text: string) => {
    const norm = normalizeArabic(text);
    return norm.startsWith('ال') ? norm.slice(2) : norm;
  };

  const filteredOptions = options.filter(opt => {
    if (!searchTerm.trim()) return true;
    const normOpt = normalizeArabic(opt);
    const normTerm = normalizeArabic(searchTerm);
    const cleanOpt = stripAl(opt);
    const cleanTerm = stripAl(searchTerm);

    // 1. Direct substring checks
    if (
      normOpt.includes(normTerm) ||
      cleanOpt.includes(cleanTerm) ||
      normTerm.includes(normOpt) ||
      cleanTerm.includes(cleanOpt)
    ) {
      return true;
    }

    // 2. Space-insensitive & punctuation-insensitive matching (e.g. "د ك" or "د.ك" -> "دك" matching "دكتوراة" or "دكتور")
    const collapsedTerm = normTerm.replace(/[\s\.\-_/]/g, '');
    const collapsedOpt = normOpt.replace(/[\s\.\-_/]/g, '');
    if (collapsedTerm.length >= 2 && collapsedOpt.includes(collapsedTerm)) {
      return true;
    }

    // 3. Multi-word component check (e.g. typing "دكتور جامعي" or "معلم مدرسة")
    const termParts = normTerm.split(/\s+/).filter(p => p.length >= 2);
    if (termParts.length > 1 && termParts.every(part => normOpt.includes(part) || collapsedOpt.includes(part))) {
      return true;
    }

    return false;
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleCustomInput = (text: string) => {
    setSearchTerm(text);
    if (allowCustom) {
      onChange(text);
    }
  };

  return (
    <div ref={containerRef} className={`relative text-right ${className}`} id={id}>
      <div
        onClick={() => {
          if (disabled) return;
          setIsOpen(prev => !prev);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
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
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 right-0 left-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => handleCustomInput(e.target.value)}
              placeholder="اكتب اسم أو أحرف للبحث المباشر..."
              className="w-full bg-transparent border-none text-xs text-slate-800 dark:text-slate-100 focus:outline-none placeholder:text-slate-400"
              dir="rtl"
            />
          </div>

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
                    {isSelected && <span className="text-[10px] text-blue-500">✓</span>}
                  </button>
                );
              })
            ) : allowCustom && searchTerm ? (
              <div className="p-3 text-center space-y-2">
                <p className="text-[11px] text-slate-500">لا توجد خيارات مطابقة تماماً</p>
                <button
                  type="button"
                  onClick={() => handleSelect(searchTerm)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  استخدام "{searchTerm}" كقيمة جديدة
                </button>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">
                لا توجد نتائج مطابقة
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
