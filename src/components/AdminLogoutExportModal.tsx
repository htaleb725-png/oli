import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { exportUnifiedSystemExcel } from '../services/unifiedExcelExporter';
import { 
  Download, 
  LogOut, 
  X, 
  FileSpreadsheet, 
  ShieldCheck, 
  Database,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirmLogout: () => void;
}

export const AdminLogoutExportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirmLogout
}) => {
  const {
    currentUser,
    systemSettings,
    citizens,
    requests,
    interviews,
    cheques,
    organizationRecords,
    officialLetters,
    customSections,
    customRecords,
    addAuditLog
  } = useApp();

  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleDownloadAndLogout = () => {
    setIsExporting(true);

    setTimeout(() => {
      exportUnifiedSystemExcel({
        citizens,
        requests,
        interviews,
        cheques,
        organizationRecords,
        officialLetters,
        customSections,
        customRecords,
        officeName: systemSettings.appName,
        exporterName: currentUser?.FullName || 'موظف الإدارة'
      });

      addAuditLog(
        'تنزيل قاعدة البيانات عند الخروج',
        'قسم الإدارة',
        `قام الموظف ${currentUser?.FullName} بتنزيل ملف Excel الشامل لكافة الأقسام عند إنهاء جلسة العمل`
      );

      setTimeout(() => {
        setIsExporting(false);
        onConfirmLogout();
      }, 500);
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 font-['Tajawal',sans-serif]" dir="rtl">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-right relative animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                تأكيد الخروج وتنزيل قاعدة البيانات
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                مكتب النائب المهندسة علا عودة الناشي • النسخة الاحتياطية
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Question & Notice */}
        <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-xs space-y-2">
          <div className="flex items-center gap-2 text-teal-900 dark:text-teal-200 font-black text-sm">
            <Database className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>هل تود تنزيل نسخة شاملة من قاعدة البيانات الآن؟</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            يقوم النظام بتصدير كافة سجلات المنظومة (المراجعين، المعاملات، الكتب الرسمية الصادرة، المقابلات، والتنظيم) في ملف Excel واحد مرتب ومصفى، بحيث يكون كل عمل في ورقة (Sheet) مستقلة بدون أي تداخل في البيانات.
          </p>
        </div>

        {/* Stats Preview */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 block">المراجعين</span>
            <strong className="text-slate-900 dark:text-white font-mono text-sm">{citizens.length}</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 block">المعاملات</span>
            <strong className="text-slate-900 dark:text-white font-mono text-sm">{requests.length}</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 block">الكتب والمقابلات</span>
            <strong className="text-slate-900 dark:text-white font-mono text-sm">{officialLetters.length + interviews.length}</strong>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-col gap-2">
          <button
            onClick={handleDownloadAndLogout}
            disabled={isExporting}
            className="w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm text-white bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-700 active:scale-98 shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Download className="w-4 h-4 text-teal-200 animate-bounce" />
            <span>{isExporting ? 'جاري تجهيز وتنزيل ملف Excel...' : 'نعم، تنزيل قاعدة البيانات وتسجيل الخروج'}</span>
          </button>

          <button
            onClick={onConfirmLogout}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج فقط دون تنزيل</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer text-center"
          >
            إلغاء والعودة إلى المنظومة
          </button>
        </div>

      </div>
    </div>
  );
};
