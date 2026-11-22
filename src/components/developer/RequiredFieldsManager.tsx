import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Check, RotateCcw, Save, AlertCircle, Sparkles, CheckSquare, Square } from 'lucide-react';

interface FieldSettingItem {
  id: string;
  nameArabic: string;
  sectionArabic: string;
  defaultRequired: boolean;
  hint: string;
}

const SYSTEM_FIELDS_CONFIG: FieldSettingItem[] = [
  { id: 'FullName', nameArabic: 'الاسم الرباعي واللقب للمواطن', sectionArabic: 'الاستعلامات والمراجعين', defaultRequired: true, hint: 'إلزامي للتحقق من هوية صاحب المعاملة' },
  { id: 'Phone1', nameArabic: 'رقم الهاتف الأساسي', sectionArabic: 'الاستعلامات والمراجعين', defaultRequired: true, hint: 'للتواصل وإرسال الإشعارات والرسائل' },
  { id: 'Phone2', nameArabic: 'رقم الهاتف الإضافي', sectionArabic: 'الاستعلامات والمراجعين', defaultRequired: false, hint: 'اختياري للطوارئ' },
  { id: 'District', nameArabic: 'القضاء', sectionArabic: 'الاستعلامات والمراجعين', defaultRequired: true, hint: 'تحديد قضاء السكن في ذي قار' },
  { id: 'ResidentialArea', nameArabic: 'منطقة السكن / الحي', sectionArabic: 'الاستعلامات والمراجعين', defaultRequired: false, hint: 'قائمة منسدلة مثل: الشهداء، أريدو، الإسكان...' },
  { id: 'NearestLandmark', nameArabic: 'أقرب نقطة دالة', sectionArabic: 'الاستعلامات والمراجعين', defaultRequired: false, hint: 'قرب جامع، مدرسة، مستشفى... غير مطلوبة' },
  { id: 'Job', nameArabic: 'المهنة / العمل', sectionArabic: 'الاستعلامات والمراجعين', defaultRequired: false, hint: 'كاسب، موظف، عاطل...' },
  { id: 'Education', nameArabic: 'التحصيل الدراسي', sectionArabic: 'الاستعلامات والمراجعين', defaultRequired: false, hint: 'ابتدائية، إعدادية، بكالوريوس...' },
  { id: 'ReferralSource', nameArabic: 'المعرف / جهة التزكية', sectionArabic: 'الاستعلامات والمراجعين', defaultRequired: false, hint: 'اسم المعرف أو مباشر' },
  { id: 'Entity', nameArabic: 'اسم الدائرة أو الوزارة المعنية', sectionArabic: 'إدارة الطلبات والمعاملات', defaultRequired: true, hint: 'الوزارة أو الدائرة الموجه لها الطلب' },
  { id: 'Subject', nameArabic: 'موضوع المعاملة والتفاصيل', sectionArabic: 'إدارة الطلبات والمعاملات', defaultRequired: true, hint: 'نص الطلب أو الغرض' },
  { id: 'OutgoingNumber', nameArabic: 'العدد / رقم الصادر', sectionArabic: 'إدارة الطلبات والمعاملات', defaultRequired: false, hint: 'يتولد تلقائياً حسب الفرع والسنة وقابل للتعديل' },
  { id: 'OutgoingDate', nameArabic: 'تاريخ الصادر', sectionArabic: 'إدارة الطلبات والمعاملات', defaultRequired: false, hint: 'تاريخ اليوم المباشر وقابل للتعديل' }
];

export interface RequiredFieldsManagerProps {
  currentConfig?: Record<string, boolean>;
  onSave?: (newConfig: Record<string, boolean>) => void | Promise<void>;
  onClose?: () => void;
}

export const RequiredFieldsManager: React.FC<RequiredFieldsManagerProps> = ({
  currentConfig: propConfig,
  onSave,
  onClose
}) => {
  const { systemSettings, updateSettings } = useApp();

  const initialConfig: Record<string, boolean> = {
    ...SYSTEM_FIELDS_CONFIG.reduce((acc, f) => ({ ...acc, [f.id]: f.defaultRequired }), {}),
    ...(systemSettings.requiredFieldsConfig || {}),
    ...(propConfig || {})
  };

  const [fieldSettings, setFieldSettings] = useState<Record<string, boolean>>(initialConfig);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const toggleField = (fieldId: string) => {
    setFieldSettings(prev => ({
      ...prev,
      [fieldId]: !prev[fieldId]
    }));
  };

  const handleSave = async () => {
    if (onSave) {
      await onSave(fieldSettings);
    } else {
      updateSettings({
        requiredFieldsConfig: fieldSettings
      });
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleResetDefaults = async () => {
    const defaults = SYSTEM_FIELDS_CONFIG.reduce((acc, f) => ({ ...acc, [f.id]: f.defaultRequired }), {});
    setFieldSettings(defaults);
    if (onSave) {
      await onSave(defaults);
    } else {
      updateSettings({
        requiredFieldsConfig: defaults
      });
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const content = (
    <div className="space-y-5 text-right font-['Tajawal',sans-serif]" dir="rtl">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-slate-900/40 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black border border-amber-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>صلاحيات المطور: التحكم بالحقول الضرورية والإلزامية (Required Fields)</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-300 dark:border-amber-800">
                خاص بالمطور ⚡
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              يمكنك هنا تحديد أي خانة أو مربع في الاستعلامات والإدارة يكون «إلزامي *» يمنع الحفظ بدونه أو «اختياري» يُسمح بتركه فارغاً.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الافتراضي</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>حفظ الصلاحيات والإعدادات</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition-colors"
            >
              إغلاق ✕
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>تم حفظ تخصيص الحقول الضرورية وتطبيقها فوراً على نماذج الاستعلامات والإدارة بنجاح!</span>
        </div>
      )}

      {/* Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SYSTEM_FIELDS_CONFIG.map(field => {
          const isReq = Boolean(fieldSettings[field.id]);
          return (
            <div
              key={field.id}
              onClick={() => toggleField(field.id)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                isReq 
                  ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60 shadow-xs' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className={`mt-0.5 shrink-0 ${isReq ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                  {isReq ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs text-slate-900 dark:text-white truncate">
                      {field.nameArabic}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isReq 
                        ? 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {isReq ? 'إلزامي *' : 'اختياري'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {field.hint}
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono text-slate-400 shrink-0 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                {field.sectionArabic}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <div className="bg-white dark:bg-slate-950 rounded-3xl border border-amber-400/50 shadow-2xl max-w-4xl w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
