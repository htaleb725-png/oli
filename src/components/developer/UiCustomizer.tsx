import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UiCustomizationSettings } from '../../types';
import { 
  Palette, 
  Sliders, 
  Eye, 
  Check, 
  Maximize2, 
  Minimize2, 
  Sparkles, 
  Save, 
  CheckCircle2,
  Layout,
  Type
} from 'lucide-react';

export const UiCustomizer: React.FC = () => {
  const { systemSettings, updateSettings, updateUiCustomizations } = useApp();

  const currentUi = systemSettings.uiCustomizations || {
    buttonSize: 'standard',
    inputFieldSize: 'standard',
    borderRadius: 'standard',
    showSecondaryPhone: true,
    showClanSurname: true,
    showAcademicEducation: true,
    showCitizenRating: true,
    showDependencyStatus: true,
    tableDensity: 'standard'
  };

  const [buttonSize, setButtonSize] = useState<'compact' | 'standard' | 'large'>(currentUi.buttonSize || 'standard');
  const [inputFieldSize, setInputFieldSize] = useState<'compact' | 'standard' | 'large'>(currentUi.inputFieldSize || 'standard');
  const [borderRadius, setBorderRadius] = useState<'sharp' | 'standard' | 'rounded'>(currentUi.borderRadius || 'standard');
  const [primaryColor, setPrimaryColor] = useState<string>(systemSettings.primaryThemeColor || 'amber');
  
  const [showSecondaryPhone, setShowSecondaryPhone] = useState(currentUi.showSecondaryPhone !== false);
  const [showClanSurname, setShowClanSurname] = useState(currentUi.showClanSurname !== false);
  const [showAcademicEducation, setShowAcademicEducation] = useState(currentUi.showAcademicEducation !== false);
  const [showCitizenRating, setShowCitizenRating] = useState(currentUi.showCitizenRating !== false);
  const [showDependencyStatus, setShowDependencyStatus] = useState(currentUi.showDependencyStatus !== false);
  const [tableDensity, setTableDensity] = useState<'compact' | 'standard' | 'spacious'>(currentUi.tableDensity || 'standard');

  const [savedSuccess, setSavedSuccess] = useState(false);

  const themeColors = [
    { id: 'amber', name: 'عنبري ذهبي (الرسمي الملكي)', class: 'bg-amber-500 text-slate-950', border: 'border-amber-500' },
    { id: 'blue', name: 'أزرق كحلي (الحكومي الرئاسي)', class: 'bg-blue-600 text-white', border: 'border-blue-600' },
    { id: 'emerald', name: 'زمردي أخضر (المؤسسي المعتمد)', class: 'bg-emerald-600 text-white', border: 'border-emerald-600' },
    { id: 'indigo', name: 'نيلي حديث (التكنولوجي الفخم)', class: 'bg-indigo-600 text-white', border: 'border-indigo-600' },
    { id: 'purple', name: 'بنفسجي ملكي (التشريعي الموقر)', class: 'bg-purple-600 text-white', border: 'border-purple-600' },
    { id: 'rose', name: 'وردي ياقوتي (الأنيق)', class: 'bg-rose-600 text-white', border: 'border-rose-600' },
    { id: 'slate', name: 'فحمي صناعي (الهندسي الداكن)', class: 'bg-slate-700 text-white', border: 'border-slate-700' },
  ];

  const handleSave = () => {
    const updated: UiCustomizationSettings = {
      buttonSize,
      inputFieldSize,
      borderRadius,
      showSecondaryPhone,
      showClanSurname,
      showAcademicEducation,
      showCitizenRating,
      showDependencyStatus,
      tableDensity
    };

    updateUiCustomizations(updated);
    updateSettings({ primaryThemeColor: primaryColor });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/5 border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>تخصيص الواجهات والتحكم بحجم الأزرار والحقول (بدون كود)</span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold border border-indigo-200">
                صلاحية حصرية للمطور 🎛️
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              تحكم كامل بحجم أزرار النظام، تكبير أو تصغير حقول الإدخال، زوايا الحواف، إخفاء أو إظهار الحقول، وتغيير السمة اللونية لكافة مستخدمي المنظومة.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>حفظ التخصيصات فورياً</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>تم حفظ وتطبيق كافة تخصيصات الواجهة بنجاح على المنظومة!</span>
          </div>
        </div>
      )}

      {/* Grid of Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Controls Column */}
        <div className="space-y-5">
          {/* Button Sizes */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
            <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-indigo-600" />
              <span>مقياس حجم أزرار النظام (Button Size):</span>
            </h4>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setButtonSize('compact')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  buttonSize === 'compact' 
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300' 
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="text-sm">صغير (Compact)</span>
                <span className="text-[10px] text-slate-400">لشاشات الكثافة العالية</span>
              </button>

              <button
                type="button"
                onClick={() => setButtonSize('standard')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  buttonSize === 'standard' 
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300' 
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="text-sm">قياسي (Standard)</span>
                <span className="text-[10px] text-slate-400">المقاس المتوازن المعتمد</span>
              </button>

              <button
                type="button"
                onClick={() => setButtonSize('large')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  buttonSize === 'large' 
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300' 
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="text-sm">كبير (Large)</span>
                <span className="text-[10px] text-slate-400">أزرار ضخمة وسهلة النقر</span>
              </button>
            </div>
          </div>

          {/* Input Fields Size */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
            <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Type className="w-4 h-4 text-emerald-600" />
              <span>مقياس حجم حقول الإدخال والنصوص (Input Fields):</span>
            </h4>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setInputFieldSize('compact')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  inputFieldSize === 'compact' 
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' 
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="text-sm">مدمج وصغير</span>
                <span className="text-[10px] text-slate-400">ارتفاع ضيق وموجز</span>
              </button>

              <button
                type="button"
                onClick={() => setInputFieldSize('standard')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  inputFieldSize === 'standard' 
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' 
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="text-sm">قياسي ومريح</span>
                <span className="text-[10px] text-slate-400">الارتفاع الموصى به</span>
              </button>

              <button
                type="button"
                onClick={() => setInputFieldSize('large')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  inputFieldSize === 'large' 
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' 
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="text-sm">كبير وواضح</span>
                <span className="text-[10px] text-slate-400">خط وأيقونات كبيرة</span>
              </button>
            </div>
          </div>

          {/* Border Radius */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
            <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layout className="w-4 h-4 text-purple-600" />
              <span>استدارة الحواف والزوايا (Border Radius):</span>
            </h4>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setBorderRadius('sharp')}
                className={`p-3 rounded-none border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  borderRadius === 'sharp' ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-700' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>حواف حادة هندسية</span>
                <span className="text-[10px] text-slate-400">Sharp (0px)</span>
              </button>

              <button
                type="button"
                onClick={() => setBorderRadius('standard')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  borderRadius === 'standard' ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-700' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>حواف قياسية عصرية</span>
                <span className="text-[10px] text-slate-400">Rounded-xl</span>
              </button>

              <button
                type="button"
                onClick={() => setBorderRadius('rounded')}
                className={`p-3 rounded-3xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  borderRadius === 'rounded' ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-700' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>حواف ناعمة جداً</span>
                <span className="text-[10px] text-slate-400">Soft (Rounded-3xl)</span>
              </button>
            </div>
          </div>

          {/* Theme Palette */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
            <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-500" />
              <span>السمة اللونية الرئيسية للنظام (Primary Color):</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {themeColors.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setPrimaryColor(color.id)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    primaryColor === color.id 
                      ? `${color.border} bg-slate-50 dark:bg-slate-800 shadow-xs font-black` 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full ${color.class} shrink-0`}></span>
                  <span className="text-[11px] truncate">{color.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Toggles & Live Interactive Preview Column */}
        <div className="space-y-5">
          {/* Field Visibility Toggles */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
            <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              <span>إظهار أو إخفاء حقول تسجيل المراجعين والمعاملات:</span>
            </h4>
            <div className="space-y-2 pt-1 text-xs">
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 cursor-pointer">
                <span className="font-bold text-slate-800 dark:text-slate-200">حقل رقم الهاتف الإضافي (هاتف 2)</span>
                <input
                  type="checkbox"
                  checked={showSecondaryPhone}
                  onChange={(e) => setShowSecondaryPhone(e.target.checked)}
                  className="rounded text-indigo-600 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 cursor-pointer">
                <span className="font-bold text-slate-800 dark:text-slate-200">حقل العشيرة واللقب</span>
                <input
                  type="checkbox"
                  checked={showClanSurname}
                  onChange={(e) => setShowClanSurname(e.target.checked)}
                  className="rounded text-indigo-600 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 cursor-pointer">
                <span className="font-bold text-slate-800 dark:text-slate-200">حقل التحصيل الدراسي والوظيفة</span>
                <input
                  type="checkbox"
                  checked={showAcademicEducation}
                  onChange={(e) => setShowAcademicEducation(e.target.checked)}
                  className="rounded text-indigo-600 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 cursor-pointer">
                <span className="font-bold text-slate-800 dark:text-slate-200">حقل تقييم المراجع الشعبي</span>
                <input
                  type="checkbox"
                  checked={showCitizenRating}
                  onChange={(e) => setShowCitizenRating(e.target.checked)}
                  className="rounded text-indigo-600 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 cursor-pointer">
                <span className="font-bold text-slate-800 dark:text-slate-200">حقل حالة التبعية (مستقل / غير مستقل / وكيل)</span>
                <input
                  type="checkbox"
                  checked={showDependencyStatus}
                  onChange={(e) => setShowDependencyStatus(e.target.checked)}
                  className="rounded text-indigo-600 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Interactive Live Preview Box */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>معاينة حية وتفاعلية للمظهر قبل الحفظ:</span>
              </h4>
              <span className="text-[10px] text-slate-400">Live Preview</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  نموذج حقل إدخال بالقياس المختار:
                </label>
                <input
                  type="text"
                  placeholder="اكتب هنا لتجربة ارتفاع الحقل والخط..."
                  className={`w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-all ${
                    borderRadius === 'sharp' ? 'rounded-none' : borderRadius === 'rounded' ? 'rounded-2xl' : 'rounded-xl'
                  } ${
                    inputFieldSize === 'compact' ? 'px-3 py-1.5 text-xs' : inputFieldSize === 'large' ? 'px-4 py-3.5 text-sm' : 'px-3.5 py-2.5 text-xs'
                  }`}
                />
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`font-black text-white transition-all shadow-xs ${
                    primaryColor === 'amber' ? 'bg-amber-500 text-slate-950' :
                    primaryColor === 'blue' ? 'bg-blue-600' :
                    primaryColor === 'emerald' ? 'bg-emerald-600' :
                    primaryColor === 'indigo' ? 'bg-indigo-600' :
                    primaryColor === 'purple' ? 'bg-purple-600' :
                    primaryColor === 'rose' ? 'bg-rose-600' : 'bg-slate-700'
                  } ${
                    borderRadius === 'sharp' ? 'rounded-none' : borderRadius === 'rounded' ? 'rounded-2xl' : 'rounded-xl'
                  } ${
                    buttonSize === 'compact' ? 'px-3 py-1.5 text-xs' : buttonSize === 'large' ? 'px-6 py-3.5 text-sm' : 'px-4 py-2.5 text-xs'
                  }`}
                >
                  زر رئيسي بالحجم والسمة المختارة
                </button>

                <button
                  type="button"
                  className={`font-bold bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 transition-all ${
                    borderRadius === 'sharp' ? 'rounded-none' : borderRadius === 'rounded' ? 'rounded-2xl' : 'rounded-xl'
                  } ${
                    buttonSize === 'compact' ? 'px-3 py-1.5 text-xs' : buttonSize === 'large' ? 'px-6 py-3.5 text-sm' : 'px-4 py-2.5 text-xs'
                  }`}
                >
                  زر ثانوي
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>اعتماد وتطبيق هذه الإعدادات على المنظومة بالكامل</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
