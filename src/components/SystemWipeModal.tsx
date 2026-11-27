import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  AlertTriangle,
  Trash2,
  Download,
  RotateCcw,
  CheckCircle,
  X,
  Users,
  FileText,
  Calendar,
  ShieldAlert,
  HardDrive,
  HeartHandshake,
  Layers,
  CheckSquare,
  Square
} from 'lucide-react';

interface SystemWipeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemWipeModal: React.FC<SystemWipeModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    citizens,
    requests,
    interviews,
    cheques,
    organizationRecords,
    documents,
    officialLetters,
    customSections,
    customRecords,
    exportToExcel,
    wipeAllSystemData,
    wipeSelectedSections,
    resetToDefaultData,
    setActiveSection
  } = useApp();

  const [wipeMode, setWipeMode] = useState<'all' | 'selected'>('all');
  const [selectedSectionKeys, setSelectedSectionKeys] = useState<string[]>([]);
  const [confirmInput, setConfirmInput] = useState('');
  const [exportBackupFirst, setExportBackupFirst] = useState(true);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeSuccess, setWipeSuccess] = useState(false);
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const sectionItems = useMemo(() => {
    const socialRecordsCount = customRecords.filter(
      r => !r.sectionId || r.sectionId === 'sec_social_welfare'
    ).length;

    const base = [
      { key: 'citizens', label: 'قسم الاستعلامات والمراجعين', count: citizens.length, icon: 'users' },
      { key: 'requests', label: 'قسم الإدارة والمعاملات', count: requests.length, icon: 'requests' },
      { key: 'interviews', label: 'قسم مقابلات النائب', count: interviews.length, icon: 'interviews' },
      { key: 'organization', label: 'قسم التنظيم والجماهير', count: organizationRecords.length, icon: 'org' },
      { key: 'letters', label: 'قسم المكنة والكتب الرسمية', count: officialLetters.length + documents.length, icon: 'letters' },
      { key: 'cheques', label: 'قسم المساعدات والصكوك', count: cheques.length, icon: 'cheques' },
      { key: 'sec_social_welfare', label: 'قسم الرعاية الاجتماعية', count: socialRecordsCount, icon: 'social' }
    ];

    const dynamic = (customSections || [])
      .filter(sec => sec && sec.id && sec.id !== 'sec_social_welfare')
      .map(sec => ({
        key: sec.id,
        label: sec.title || sec.id,
        count: customRecords.filter(r => r.sectionId === sec.id).length,
        icon: 'custom'
      }));

    return [...base, ...dynamic];
  }, [
    citizens.length,
    requests.length,
    interviews.length,
    organizationRecords.length,
    officialLetters.length,
    documents.length,
    cheques.length,
    customSections,
    customRecords
  ]);

  if (!isOpen) return null;

  // STRICT ACCESS CONTROL: Only Developer can open or perform system wipe
  if (currentUser?.Role !== 'developer') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn" dir="rtl">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-red-200 dark:border-red-900 shadow-2xl max-w-md w-full p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">صلاحية تصفير النظام مقفلة</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            عذراً، صلاحية تصفير وتفريغ بيانات النظام محصورة حصرياً بالمطور البرمجي للنظام لحماية السجلات من الحذف غير المقصود.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    );
  }

  const totalRecords =
    citizens.length +
    requests.length +
    interviews.length +
    cheques.length +
    organizationRecords.length +
    documents.length +
    officialLetters.length +
    customRecords.length;

  const selectedRecordsCount = sectionItems
    .filter(item => selectedSectionKeys.includes(item.key))
    .reduce((acc, item) => acc + item.count, 0);

  const toggleSectionKey = (key: string) => {
    setInlineNotice(null);
    setSelectedSectionKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleExecuteWipe = async () => {
    setInlineNotice(null);

    if (currentUser?.Role !== 'developer') {
      setInlineNotice('عذراً، صلاحية تصفير النظام مقتصرة حصرياً على حساب المطور.');
      return;
    }

    if (wipeMode === 'selected' && selectedSectionKeys.length === 0) {
      setInlineNotice('يرجى تحديد قسم واحد على الأقل لتصفيره.');
      return;
    }

    setIsWiping(true);

    try {
      // 1. Export safety backup if selected
      const countToExport = wipeMode === 'all' ? totalRecords : selectedRecordsCount;
      if (exportBackupFirst && countToExport > 0) {
        const backupData = [
          ...citizens.map(c => ({ 'النوع': 'مراجع', 'المعرف': c.Citizen_ID, 'الاسم': c.FullName, 'الهاتف': c.Phone1, 'القضاء': c.District })),
          ...requests.map(r => ({ 'النوع': 'طلب', 'رقم الطلب': r.Request_ID, 'المراجع': r.CitizenName, 'الجهة': r.Entity, 'الحالة': r.ProcessingStatus })),
          ...customRecords.map(cr => ({ 'النوع': 'قسم مخصص/رعاية', 'المعرف': cr.id, 'القسم': cr.sectionId, 'البيانات': JSON.stringify(cr.data || {}) }))
        ];
        exportToExcel(backupData, wipeMode === 'all' ? 'نسخة_أمان_احتياطية_قبل_التصفير_الشامل' : 'نسخة_أمان_احتياطية_قبل_تصفير_الأقسام');
      }

      // 2. Execute instant full or selective wipe across UI + Firebase Firestore + Google Sheets (keeping Row 1 headers!)
      if (wipeMode === 'all') {
        await wipeAllSystemData();
      } else {
        await wipeSelectedSections(selectedSectionKeys);
      }

      setWipeSuccess(true);
      setTimeout(() => {
        setIsWiping(false);
        setWipeSuccess(false);
        setConfirmInput('');
        setSelectedSectionKeys([]);
        onClose();
        if (wipeMode === 'all') setActiveSection('dashboard');
      }, 1500);
    } catch (err) {
      console.error(err);
      setIsWiping(false);
      setInlineNotice('حدث خطأ أثناء تنفيذ التصفير. يرجى التحقق من الاتصال وإعادة المحاولة.');
    }
  };

  const handleExecuteDefaultRestore = () => {
    resetToDefaultData();
    setShowRestoreConfirm(false);
    onClose();
    setActiveSection('dashboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn" dir="rtl">
      <div className="bg-white rounded-3xl border border-red-200 shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto text-right">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-5 text-white flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <span>تصفير النظام وحذف البيانات (سحابياً ومحلياً)</span>
              </h3>
              <p className="text-xs text-red-100 font-medium">
                تصفير فوري ومتزامن للواجهة وقاعدة البيانات والأرشيف الاحتياطي مع الإبقاء على صف العناوين (Headers)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {wipeSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-9 h-9" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">
                {wipeMode === 'all' ? 'تم تصفير المنظومة بالكامل بنجاح!' : 'تم تصفير الأقسام المحددة بنجاح!'}
              </h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                تم مسح البيانات فوراً من الواجهة وقاعدة البيانات والأرشيف الاحتياطي مع الإبقاء التام على صف العناوين (Headers) وحسابات الموظفين وإعدادات النظام.
              </p>
            </div>
          ) : (
            <>
              {/* Mode Selector: Full Wipe vs Selective Sections Wipe */}
              <div className="grid grid-cols-2 gap-2.5 p-1.5 rounded-2xl bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setWipeMode('all');
                    setInlineNotice(null);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    wipeMode === 'all'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>تصفير النظام بالكامل ({totalRecords})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWipeMode('selected');
                    setInlineNotice(null);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    wipeMode === 'selected'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>تصفير أقسام محددة</span>
                </button>
              </div>

              {/* Warning Notice */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold">حماية ذكية للبنية السحابية:</p>
                  <p className="text-amber-800 leading-relaxed">
                    يتم حذف صفوف البيانات فقط من الواجهة و <strong>قاعدة البيانات الرئيسية</strong> و <strong>الأرشيف الاحتياطي</strong> مع <strong>الإبقاء التام على صف العناوين (Headers)</strong> وحسابات الموظفين والأيقونات وهيكل الأقسام.
                  </p>
                </div>
              </div>

              {/* Data Summary OR Selective Checkboxes */}
              {wipeMode === 'all' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>إحصائية السجلات التي سيتم تصفيرها بالكامل:</span>
                    <span className="text-rose-600 font-mono tabular-nums">إجمالي: {totalRecords} سجل</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="text-xs text-slate-600 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>المراجعين</span>
                      </span>
                      <span className="text-xs font-black text-slate-800 font-mono tabular-nums">{citizens.length}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="text-xs text-slate-600 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-600" />
                        <span>الطلبات</span>
                      </span>
                      <span className="text-xs font-black text-slate-800 font-mono tabular-nums">{requests.length}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="text-xs text-slate-600 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-teal-600" />
                        <span>المقابلات</span>
                      </span>
                      <span className="text-xs font-black text-slate-800 font-mono tabular-nums">{interviews.length}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="text-xs text-slate-600 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                        <span>التنظيم والصكوك</span>
                      </span>
                      <span className="text-xs font-black text-slate-800 font-mono tabular-nums">{cheques.length + organizationRecords.length}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="text-xs text-slate-600 flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                        <span>الكتب والوثائق</span>
                      </span>
                      <span className="text-xs font-black text-slate-800 font-mono tabular-nums">{documents.length + officialLetters.length}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="text-xs text-slate-600 flex items-center gap-1.5">
                        <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
                        <span>الرعاية والمخصصة</span>
                      </span>
                      <span className="text-xs font-black text-slate-800 font-mono tabular-nums">{customRecords.length}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>اختر الأقسام المطلوب تصفير بياناتها فقط:</span>
                    <span className="text-amber-700 font-mono tabular-nums">
                      المحدد: {selectedSectionKeys.length} قسم ({selectedRecordsCount} سجل)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                    {sectionItems.map(item => {
                      const checked = selectedSectionKeys.includes(item.key);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => toggleSectionKey(item.key)}
                          className={`p-2.5 rounded-xl border text-right flex items-center justify-between gap-2 transition-all cursor-pointer ${
                            checked
                              ? 'bg-amber-50 border-amber-400 text-amber-950'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2 text-xs font-bold truncate">
                            {checked ? (
                              <CheckSquare className="w-4 h-4 text-amber-600 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span className="truncate">{item.label}</span>
                          </span>
                          <span className="text-xs font-black font-mono tabular-nums shrink-0 px-1.5 py-0.5 rounded bg-white border border-slate-200">
                            {item.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Safety Option: Export Backup First */}
              <label className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 cursor-pointer text-xs font-medium">
                <input
                  type="checkbox"
                  checked={exportBackupFirst}
                  onChange={(e) => setExportBackupFirst(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1.5 font-bold">
                  <Download className="w-3.5 h-3.5 text-blue-700" />
                  <span>تصدير نسخة احتياطية إكسيل (Excel) تلقائياً قبل التصفير للأمان</span>
                </span>
              </label>

              {/* Safety Confirmation Input */}
              <div className="space-y-1.5 p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200">
                <label className="block text-xs font-bold text-rose-900">
                  لتأكيد التنفيذ (اختياري للمطور)، اكتب كلمة <span className="text-rose-600 underline font-black font-mono px-1">تصفير</span>:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="اكتب هنا: تصفير"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-rose-300 text-slate-900 text-center font-bold text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {inlineNotice && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold text-center">
                  {inlineNotice}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleExecuteWipe}
                  disabled={isWiping || (wipeMode === 'selected' && selectedSectionKeys.length === 0)}
                  className={`w-full py-3 px-4 rounded-xl text-white text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md ${
                    !isWiping && !(wipeMode === 'selected' && selectedSectionKeys.length === 0)
                      ? wipeMode === 'all'
                        ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer active:scale-[0.99]'
                        : 'bg-amber-600 hover:bg-amber-700 cursor-pointer active:scale-[0.99]'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {isWiping
                      ? 'جاري التصفير المتزامن في قاعدة البيانات والأرشيف الاحتياطي...'
                      : wipeMode === 'all'
                      ? 'تأكيد تصفير المنظومة بالكامل (مع بقاء العناوين)'
                      : `تأكيد تصفير (${selectedSectionKeys.length}) قسم محدد فقط`}
                  </span>
                </button>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  {showRestoreConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-700">تأكيد استعادة البيانات التجريبية؟</span>
                      <button
                        type="button"
                        onClick={handleExecuteDefaultRestore}
                        className="py-1 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        نعم، استعادة
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRestoreConfirm(false)}
                        className="py-1 px-2 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowRestoreConfirm(true)}
                      className="py-1.5 px-3 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      <span>أو استعادة البيانات التجريبية الافتراضية</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className="py-1.5 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
