import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { generatePwaPngIcons } from '../../utils/pwaIconHelper';
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
  Type,
  Building,
  User,
  Phone,
  MapPin,
  Megaphone,
  Image as ImageIcon,
  KeyRound,
  Plus,
  Trash2,
  Upload,
  Replace,
  Loader2,
  AlertCircle
} from 'lucide-react';

export const UiCustomizer: React.FC = () => {
  const { systemSettings, updateSettings, updateUiCustomizations } = useApp();

  const [activeTab, setActiveTab] = useState<'system_texts' | 'ui_dimensions'>('system_texts');

  // System Texts State (live-synced with Firestore systemSettings)
  const [appName, setAppName] = useState(systemSettings.appName || '');
  const [officeName, setOfficeName] = useState(systemSettings.officeName || '');
  const [deputyName, setDeputyName] = useState(systemSettings.deputyName || '');
  const [deputyTitle, setDeputyTitle] = useState(systemSettings.deputyTitle || '');
  const [province, setProvince] = useState(systemSettings.province || '');
  const [officeAddress, setOfficeAddress] = useState(systemSettings.officeAddress || '');
  const [hotline, setHotline] = useState(systemSettings.hotline || '');
  const [tickerNewsText, setTickerNewsText] = useState((systemSettings.tickerNews || []).join('\n'));
  const [tickerEnabled, setTickerEnabled] = useState<boolean>(systemSettings.tickerEnabled !== false);
  const [tickerSpeed, setTickerSpeed] = useState<'slow' | 'normal' | 'fast'>(systemSettings.tickerSpeed || 'normal');
  const [tickerColor, setTickerColor] = useState<'navy' | 'emerald' | 'amber' | 'rose' | 'indigo'>(systemSettings.tickerColor || 'navy');
  const [logoUrl, setLogoUrl] = useState(systemSettings.logoUrl || '');
  const [parliamentEmblemUrl, setParliamentEmblemUrl] = useState(systemSettings.parliamentEmblemUrl || '');
  const [footerText, setFooterText] = useState(systemSettings.footerText || '');
  const [loadingScreenTitle, setLoadingScreenTitle] = useState(systemSettings.loadingScreenTitle || '');
  const [loadingScreenSubtitle, setLoadingScreenSubtitle] = useState(systemSettings.loadingScreenSubtitle || '');
  const [loginWelcomeTitle, setLoginWelcomeTitle] = useState(systemSettings.loginWelcomeTitle || '');
  const [loginWelcomeSubtitle, setLoginWelcomeSubtitle] = useState(systemSettings.loginWelcomeSubtitle || '');
  const [loginHeaderBadgeText, setLoginHeaderBadgeText] = useState(systemSettings.loginHeaderBadgeText || '');
  const [loginBadgeText, setLoginBadgeText] = useState(systemSettings.loginBadgeText || '');
  const [loginButtonText, setLoginButtonText] = useState(systemSettings.loginButtonText || '');
  const [loginPasscodeTabText, setLoginPasscodeTabText] = useState(systemSettings.loginPasscodeTabText || '');
  const [loginCredentialsTabText, setLoginCredentialsTabText] = useState(systemSettings.loginCredentialsTabText || '');
  const [loginSecurityBadgeText, setLoginSecurityBadgeText] = useState(systemSettings.loginSecurityBadgeText || '');
  const [loginFooterCopyrightText, setLoginFooterCopyrightText] = useState(systemSettings.loginFooterCopyrightText || '');
  const [textReplacements, setTextReplacements] = useState<{ from: string; to: string }[]>(
    systemSettings.textReplacements || []
  );
  const [newReplaceFrom, setNewReplaceFrom] = useState('');
  const [newReplaceTo, setNewReplaceTo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync local form fields whenever Firestore onSnapshot updates systemSettings
  useEffect(() => {
    setAppName(systemSettings.appName || '');
    setOfficeName(systemSettings.officeName || '');
    setDeputyName(systemSettings.deputyName || '');
    setDeputyTitle(systemSettings.deputyTitle || '');
    setProvince(systemSettings.province || '');
    setOfficeAddress(systemSettings.officeAddress || '');
    setHotline(systemSettings.hotline || '');
    setTickerNewsText((systemSettings.tickerNews || []).join('\n'));
    setTickerEnabled(systemSettings.tickerEnabled !== false);
    setTickerSpeed(systemSettings.tickerSpeed || 'normal');
    setTickerColor(systemSettings.tickerColor || 'navy');
    setLogoUrl(systemSettings.logoUrl || '');
    setParliamentEmblemUrl(systemSettings.parliamentEmblemUrl || '');
    setFooterText(systemSettings.footerText || '');
    setLoadingScreenTitle(systemSettings.loadingScreenTitle || '');
    setLoadingScreenSubtitle(systemSettings.loadingScreenSubtitle || '');
    setLoginWelcomeTitle(systemSettings.loginWelcomeTitle || '');
    setLoginWelcomeSubtitle(systemSettings.loginWelcomeSubtitle || '');
    setLoginHeaderBadgeText(systemSettings.loginHeaderBadgeText || '');
    setLoginBadgeText(systemSettings.loginBadgeText || '');
    setLoginButtonText(systemSettings.loginButtonText || '');
    setLoginPasscodeTabText(systemSettings.loginPasscodeTabText || '');
    setLoginCredentialsTabText(systemSettings.loginCredentialsTabText || '');
    setLoginSecurityBadgeText(systemSettings.loginSecurityBadgeText || '');
    setLoginFooterCopyrightText(systemSettings.loginFooterCopyrightText || '');
    setTextReplacements(systemSettings.textReplacements || []);
  }, [
    systemSettings.settingsVersion,
    systemSettings.appName,
    systemSettings.officeName,
    systemSettings.deputyName,
    systemSettings.deputyTitle,
    systemSettings.tickerNews,
    systemSettings.tickerEnabled,
    systemSettings.tickerSpeed,
    systemSettings.tickerColor,
    systemSettings.footerText,
    systemSettings.loginWelcomeTitle,
    systemSettings.loginWelcomeSubtitle,
    systemSettings.loginHeaderBadgeText,
    systemSettings.loginBadgeText,
    systemSettings.loginButtonText,
    systemSettings.loginPasscodeTabText,
    systemSettings.loginCredentialsTabText,
    systemSettings.loginSecurityBadgeText,
    systemSettings.loginFooterCopyrightText,
    systemSettings.loadingScreenTitle,
    systemSettings.loadingScreenSubtitle,
    systemSettings.textReplacements
  ]);

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setter(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAddTextReplacement = async () => {
    const from = newReplaceFrom.trim();
    const to = newReplaceTo.trim();
    if (!from || from === to) return;
    const updated = [...textReplacements.filter(r => r.from !== from), { from, to }];
    setTextReplacements(updated);
    setIsSaving(true);
    const ok = await updateSettings({ textReplacements: updated });
    setIsSaving(false);
    setNewReplaceFrom('');
    setNewReplaceTo('');
    setSavedSuccess(ok);
    setSaveFeedback(
      ok
        ? {
            type: 'success',
            text: to
              ? `تم الحفظ في قاعدة البيانات بنجاح — تم تطبيق استبدال «${from}» إلى «${to}» فوراً!`
              : `تم الحفظ في قاعدة البيانات بنجاح — تم تطبيق إزالة عبارة «${from}» فوراً!`
          }
        : { type: 'error', text: 'تعذر تأكيد الحفظ في قاعدة البيانات. يرجى التحقق من الاتصال والمحاولة مجدداً.' }
    );
    setTimeout(() => {
      setSavedSuccess(false);
      setSaveFeedback(null);
    }, 3500);
  };

  const handleRemoveTextReplacement = async (from: string) => {
    const updated = textReplacements.filter(r => r.from !== from);
    setTextReplacements(updated);
    setIsSaving(true);
    const ok = await updateSettings({ textReplacements: updated });
    setIsSaving(false);
    setSaveFeedback(
      ok
        ? { type: 'success', text: `تم تحديث البيانات في قاعدة البيانات بنجاح — تم إلغاء قاعدة الاستبدال لـ «${from}».` }
        : { type: 'error', text: 'تعذر تحديث قاعدة الاستبدال في قاعدة البيانات.' }
    );
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  // UI Dimensions & Visual Style State
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

  // Save System Texts directly to Firebase Firestore and confirm
  const handleSaveSystemTexts = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      const cleanTicker = tickerNewsText
        .split('\n')
        .map(t => t.trim())
        .filter(Boolean);

      const cleanLogo = logoUrl.trim();
      const generatedIcons = cleanLogo ? await generatePwaPngIcons(cleanLogo) : null;

      const ok = await updateSettings({
        appName: appName.trim(),
        officeName: officeName.trim(),
        deputyName: deputyName.trim(),
        deputyTitle: deputyTitle.trim(),
        province: province.trim(),
        officeAddress: officeAddress.trim(),
        hotline: hotline.trim(),
        tickerNews: cleanTicker,
        tickerEnabled,
        tickerSpeed,
        tickerColor,
        logoUrl: cleanLogo,
        ...(generatedIcons
          ? { pwaIcon192: generatedIcons.icon192, pwaIcon512: generatedIcons.icon512 }
          : !cleanLogo
          ? { pwaIcon192: '', pwaIcon512: '' }
          : {}),
        parliamentEmblemUrl: parliamentEmblemUrl.trim(),
        footerText: footerText.trim(),
        loadingScreenTitle: loadingScreenTitle.trim(),
        loadingScreenSubtitle: loadingScreenSubtitle.trim(),
        loginWelcomeTitle: loginWelcomeTitle.trim(),
        loginWelcomeSubtitle: loginWelcomeSubtitle.trim(),
        loginHeaderBadgeText: loginHeaderBadgeText.trim(),
        loginBadgeText: loginBadgeText.trim(),
        loginButtonText: loginButtonText.trim(),
        loginPasscodeTabText: loginPasscodeTabText.trim(),
        loginCredentialsTabText: loginCredentialsTabText.trim(),
        loginSecurityBadgeText: loginSecurityBadgeText.trim(),
        loginFooterCopyrightText: loginFooterCopyrightText.trim(),
        textReplacements
      });

      setSavedSuccess(ok);
      setSaveFeedback(
        ok
          ? { type: 'success', text: 'تم تحديث البيانات في قاعدة البيانات بنجاح — تم تطبيق كافة التعديلات على جميع الحاسبات!' }
          : { type: 'error', text: 'تعذر حفظ الإعدادات في قاعدة البيانات. يرجى التحقق من الاتصال بالإنترنت وإعادة المحاولة.' }
      );
      setTimeout(() => {
        setSavedSuccess(false);
        setSaveFeedback(null);
      }, 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Save UI Dimensions & Styles
  const handleSaveDimensions = async () => {
    setIsSaving(true);
    try {
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
      const ok = await updateSettings({ primaryThemeColor: primaryColor, uiCustomizations: updated });
      setSavedSuccess(ok);
      setSaveFeedback(
        ok
          ? { type: 'success', text: 'تم تحديث البيانات في قاعدة البيانات بنجاح' }
          : { type: 'error', text: 'تعذر حفظ التخصيصات في قاعدة البيانات.' }
      );
      setTimeout(() => {
        setSavedSuccess(false);
        setSaveFeedback(null);
      }, 3500);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/5 border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>تخصيص المنظومة والمسميات والواجهات (بدون كود)</span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800">
                صلاحية حصرية للمطور 🎛️
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              تحكم كامل في كل حرف وعنوان ومسمى داخل النظام، اسم المكتب، اسم النائب، العناوين، الهواتف، وحجم الأزرار والحقول.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'system_texts' ? (
            <button
              type="button"
              onClick={handleSaveSystemTexts}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>حفظ كافة المسميات والنصوص</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveDimensions}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>حفظ تخصيصات الواجهة</span>
            </button>
          )}
        </div>
      </div>

      {(saveFeedback || savedSuccess) && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in border ${
          saveFeedback?.type === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
        }`}>
          <div className="flex items-center gap-2">
            {saveFeedback?.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>
              {saveFeedback?.text || 'تم حفظ وتطبيق كافة التعديلات والتخصيصات بنجاح وتعميمها على كامل المنظومة!'}
            </span>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('system_texts')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'system_texts'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Type className="w-4 h-4" />
          <span>تعديل نصوص ومسميات وعناوين المنظومة بالكامل (كل حرف وعنوان) 📝</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ui_dimensions')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'ui_dimensions'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>تخصيص الواجهات والتحكم بحجم الأزرار والحقول 🎛️</span>
        </button>
      </div>

      {/* TAB 1: System Texts Customizer (كل حرف وعنوان في المنظومة) */}
      {activeTab === 'system_texts' && (
        <form onSubmit={handleSaveSystemTexts} className="space-y-5 animate-in fade-in">
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs">
            <strong>ملاحظة للمطور:</strong> كل حقل تقوم بتعديله هنا ينعكس فورياً وبشكل دائم على شريط العنوان، الترويسات الرسمية، وصولات الطباعة، تقارير الصادر، شريط الأخبار، وكافة نوافذ الموظفين والمراجعين.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Box 1: الهوية والمسميات الرسمية */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
              <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Building className="w-4 h-4 text-indigo-600" />
                <span>مسميات المنظومة والمكتب الرسمي:</span>
              </h4>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم المنظومة العام (يظهر في أعلى النظام وشريط التبويب):
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="مثال: منظومة إدارة مكتب مجلس النواب"
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم المكتب الرسمي (المطبوع على الوصولات والكتب الرسمية):
                </label>
                <input
                  type="text"
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  placeholder="مثال: مكتب مجلس النواب العراقي"
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  المحافظة أو الدائرة الانتخابية:
                </label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="مثال: ذي قار / بغداد..."
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  عنوان ومقر المكتب الكامل:
                </label>
                <input
                  type="text"
                  value={officeAddress}
                  onChange={(e) => setOfficeAddress(e.target.value)}
                  placeholder="مثال: العراق - المحافظة - شارع..."
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Box 2: بيانات النائب والمسؤول والتواصل */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
              <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <User className="w-4 h-4 text-emerald-600" />
                <span>بيانات النائب والمسؤول وأرقام التواصل:</span>
              </h4>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم النائب / المسؤول (بدون أي اسم ثابت، اكتب ما تشاء):
                </label>
                <input
                  type="text"
                  value={deputyName}
                  onChange={(e) => setDeputyName(e.target.value)}
                  placeholder="اكتب اسم النائب أو المسؤول هنا..."
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  صفة ولقب النائب / المسؤول:
                </label>
                <input
                  type="text"
                  value={deputyTitle}
                  onChange={(e) => setDeputyTitle(e.target.value)}
                  placeholder="مثال: عضو مجلس النواب العراقي / رئيس المكتب"
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الخط الساخن وأرقام الهواتف والاستعلامات:
                </label>
                <input
                  type="text"
                  value={hotline}
                  onChange={(e) => setHotline(e.target.value)}
                  placeholder="مثال: 07800000000 / 07700000000"
                  dir="ltr"
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  رابط صورة الشعار الرسمي (Logo URL):
                </label>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  dir="ltr"
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left"
                />
              </div>
            </div>

            {/* Box 3: شريط الأخبار العاجل والتنبيهات */}
            <div className="md:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-500" />
                  <span>شريط الأخبار العاجل والتعميمات المتحركة (محفوظ في قاعدة البيانات لجميع الحاسبات):</span>
                </h4>
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tickerEnabled}
                    onChange={(e) => setTickerEnabled(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                  />
                  <span>{tickerEnabled ? 'الشريط مفعّل وظاهر' : 'إيقاف وإخفاء الشريط'}</span>
                </label>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                اكتب كل خبر أو تعميم في سطر منفصل، واختر اللون والسرعة. تُحفظ التعديلات مباشرة في قاعدة البيانات وتظهر فورياً على كافة الحاسبات.
              </p>
              <textarea
                rows={4}
                value={tickerNewsText}
                onChange={(e) => setTickerNewsText(e.target.value)}
                placeholder="أهلاً وسهلاً بكم في منظومة إدارة العمل والمعاملات الرسمية&#10;متابعة مستمرة لطلبات المواطنين وإنجاز المعاملات أولاً بأول"
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    لون خلفية شريط التعميمات:
                  </label>
                  <select
                    value={tickerColor}
                    onChange={(e) => setTickerColor(e.target.value as any)}
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="navy">كحلي رسمي (الافتراضي)</option>
                    <option value="emerald">زمردي أخضر</option>
                    <option value="amber">عنبري ذهبي</option>
                    <option value="rose">عنابي تنبيهي</option>
                    <option value="indigo">نيلي برلماني</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    سرعة حركة شريط التعميمات:
                  </label>
                  <select
                    value={tickerSpeed}
                    onChange={(e) => setTickerSpeed(e.target.value as any)}
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="slow">بطيء ومريح للقراءة</option>
                    <option value="normal">متوسط (قياسي)</option>
                    <option value="fast">سريع</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Box 4: نصوص شاشة الدخول وشاشة التحميل والتذييل */}
            <div className="md:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
              <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>تعديل نصوص شاشة التحميل، بوابة الدخول، وتذييل النظام (Footer):</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    العنوان الرئيسي في واجهة الدخول:
                  </label>
                  <input
                    type="text"
                    value={loginWelcomeTitle}
                    onChange={(e) => setLoginWelcomeTitle(e.target.value)}
                    placeholder="مثال: منظومة إدارة مكتب النائب"
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الوصف الفرعي في واجهة الدخول:
                  </label>
                  <input
                    type="text"
                    value={loginWelcomeSubtitle}
                    onChange={(e) => setLoginWelcomeSubtitle(e.target.value)}
                    placeholder="مثال: مجلس النواب العراقي • نظام إداري مشفر ومؤمن"
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    شارة الجهة العليا في واجهة الدخول:
                  </label>
                  <input
                    type="text"
                    value={loginHeaderBadgeText}
                    onChange={(e) => setLoginHeaderBadgeText(e.target.value)}
                    placeholder="مثال: مجلس النواب العراقي"
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    شارة بوابة الدخول:
                  </label>
                  <input
                    type="text"
                    value={loginBadgeText}
                    onChange={(e) => setLoginBadgeText(e.target.value)}
                    placeholder="مثال: بوابة الدخول الرسمية المعتمدة"
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نص زر الدخول الرئيسي في واجهة الدخول:
                  </label>
                  <input
                    type="text"
                    value={loginButtonText}
                    onChange={(e) => setLoginButtonText(e.target.value)}
                    placeholder="مثال: تسجيل الدخول وفتح المنظومة"
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نص تبويب الرمز السري / اسم المستخدم (واجهة الدخول):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={loginPasscodeTabText}
                      onChange={(e) => setLoginPasscodeTabText(e.target.value)}
                      placeholder="الرمز السري المعتمد"
                      className="w-full h-10 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={loginCredentialsTabText}
                      onChange={(e) => setLoginCredentialsTabText(e.target.value)}
                      placeholder="اسم المستخدم وكلمة السر"
                      className="w-full h-10 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نص شارة الأمان / حقوق النشر في واجهة الدخول:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={loginSecurityBadgeText}
                      onChange={(e) => setLoginSecurityBadgeText(e.target.value)}
                      placeholder="نظام إداري إلكتروني مشفر"
                      className="w-full h-10 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={loginFooterCopyrightText}
                      onChange={(e) => setLoginFooterCopyrightText(e.target.value)}
                      placeholder="الحقوق محفوظة © 2026"
                      className="w-full h-10 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    عنوان شاشة التحميل بعد الدخول:
                  </label>
                  <input
                    type="text"
                    value={loadingScreenTitle}
                    onChange={(e) => setLoadingScreenTitle(e.target.value)}
                    placeholder="مثال: جاري تهيئة ومزامنة بيانات المنظومة..."
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الوصف الفرعي لشاشة التحميل:
                  </label>
                  <input
                    type="text"
                    value={loadingScreenSubtitle}
                    onChange={(e) => setLoadingScreenSubtitle(e.target.value)}
                    placeholder="مثال: مكتب النائب — مجلس النواب العراقي"
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نص تذييل النظام وواجهة الدخول أسفل الشاشة (Footer):
                  </label>
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="مثال: مكتب النائب علا عودة الناشي"
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold cursor-pointer hover:bg-indigo-100">
                    <Upload className="w-3.5 h-3.5" />
                    <span>تغيير شعار المنظومة (صورة)</span>
                    <input type="file" accept="image/*" onChange={(e) => handleImageFileUpload(e, setLogoUrl)} className="hidden" />
                  </label>
                  <label className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold cursor-pointer hover:bg-amber-100">
                    <Upload className="w-3.5 h-3.5" />
                    <span>تغيير شعار البرلمان (صورة)</span>
                    <input type="file" accept="image/*" onChange={(e) => handleImageFileUpload(e, setParliamentEmblemUrl)} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            {/* Box 5: محرك استبدال أي نص أو كتابة في النظام بالكامل */}
            <div data-no-text-replace="true" className="md:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/80 space-y-4 shadow-xs">
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Replace className="w-4 h-4 text-indigo-600" />
                  <span>محرك تعديل أي كتابة أو عبارة أو زر في كامل النظام (استبدال فوري شامل)</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  أدخل أي كلمة أو جملة تظهر في أي مكان بالنظام (بما فيها واجهة الدخول والأزرار والقوائم، مثل كلمة «المهندسة») واكتب البديل الجديد — أو اترك حقل البديل فارغاً لإزالة الكلمة بالكامل — ليتم الحفظ في قاعدة البيانات وتطبيقه فوراً.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">النص الحالي في النظام:</label>
                  <input
                    type="text"
                    value={newReplaceFrom}
                    onChange={(e) => setNewReplaceFrom(e.target.value)}
                    placeholder="مثال: المهندسة أو قسم المكنة والطباعة"
                    className="w-full h-9 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">النص الجديد البديل (اتركه فارغاً للحذف):</label>
                  <input
                    type="text"
                    value={newReplaceTo}
                    onChange={(e) => setNewReplaceTo(e.target.value)}
                    placeholder="مثال: النائب (أو اتركه فارغاً لحذف الكلمة)"
                    className="w-full h-9 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddTextReplacement}
                    disabled={!newReplaceFrom.trim() || isSaving}
                    className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black text-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>تطبيق</span>
                  </button>
                </div>
              </div>

              {textReplacements.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {textReplacements.map((rule, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="line-through text-slate-500">{rule.from}</span>
                        <span className="text-indigo-500 font-black">←</span>
                        <span className="font-black text-emerald-700 dark:text-emerald-400">
                          {rule.to ? rule.to : '(محذوفة)'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTextReplacement(rule.from)}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                        title="إلغاء هذا الاستبدال"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end pt-3">
            <button
              type="submit"
              disabled={isSaving}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-60 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer active:scale-95"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'جاري الحفظ في قاعدة البيانات...' : 'اعتماد وتعميم كافة التعديلات على كامل المنظومة فورياً'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: UI Dimensions & Visual Style (حجم الأزرار والحقول) */}
      {activeTab === 'ui_dimensions' && (
        <div className="space-y-6 animate-in fade-in">
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
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-black' 
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
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-black' 
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
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-black' 
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm">كبير وواضح</span>
                    <span className="text-[10px] text-slate-400">سهل النقر ومريح</span>
                  </button>
                </div>
              </div>

              {/* Input Field Sizes */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
                <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Type className="w-4 h-4 text-emerald-600" />
                  <span>ارتفاع وحجم حقول الإدخال والكتابة (Input Size):</span>
                </h4>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setInputFieldSize('compact')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                      inputFieldSize === 'compact' 
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black' 
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm">صغير ومدمج</span>
                    <span className="text-[10px] text-slate-400">ارتفاع خفيف وسريع</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputFieldSize('standard')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                      inputFieldSize === 'standard' 
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black' 
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm">قياسي متوازن</span>
                    <span className="text-[10px] text-slate-400">الارتفاع المعتمد</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputFieldSize('large')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                      inputFieldSize === 'large' 
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black' 
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
                      borderRadius === 'sharp' ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-700 font-black' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>حواف حادة هندسية</span>
                    <span className="text-[10px] text-slate-400">Sharp (0px)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBorderRadius('standard')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                      borderRadius === 'standard' ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-700 font-black' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>حواف قياسية عصرية</span>
                    <span className="text-[10px] text-slate-400">Rounded-xl</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBorderRadius('rounded')}
                    className={`p-3 rounded-3xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                      borderRadius === 'rounded' ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-700 font-black' : 'border-slate-200 hover:bg-slate-50'
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
                  onClick={handleSaveDimensions}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>اعتماد وتطبيق هذه الإعدادات على المنظومة بالكامل</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
