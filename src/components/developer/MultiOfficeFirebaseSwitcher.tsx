import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Building2, 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  RefreshCw, 
  Plus, 
  Layers, 
  ExternalLink,
  ShieldCheck,
  Copy,
  Check,
  Database,
  Radio,
  Zap,
  Info
} from 'lucide-react';
import firebaseConfig from '../../../firebase-applet-config.json';
import { setActiveOfficePartition } from '../../services/firebaseFirestoreService';

interface PresetOffice {
  id: string;
  name: string;
  partitionKey: string;
  province: string;
}

const PRESET_OFFICES: PresetOffice[] = [
  { id: 'office_main', name: 'مكتب النائب المهندسة علا الناشي (المقر الرئيسي - ذي قار)', partitionKey: 'office_alnashi_main', province: 'ذي قار' },
  { id: 'office_baghdad', name: 'مكتب بغداد التشريعي - الكرخ والرصافة', partitionKey: 'office_baghdad_branch', province: 'بغداد' },
  { id: 'office_basra', name: 'مكتب الجنوب والفرات الأوسط', partitionKey: 'office_south_branch', province: 'البصرة' },
];

export const MultiOfficeFirebaseSwitcher: React.FC = () => {
  const { systemSettings, updateSettings, syncAllToFirestoreNow, fetchAllFromFirestoreNow } = useApp();

  const currentPartition = systemSettings.officeWorkspaceId || 'office_alnashi_main';
  const currentOfficeName = systemSettings.officeName || systemSettings.appName;

  const [officeName, setOfficeName] = useState(currentOfficeName);
  const [workspaceId, setWorkspaceId] = useState(currentPartition);
  
  // Custom external Firebase project credentials (optional for separate cloud projects)
  const [customProjectId, setCustomProjectId] = useState(systemSettings.customFirebaseConfig?.projectId || firebaseConfig.projectId || '');
  const [customDatabaseId, setCustomDatabaseId] = useState(systemSettings.customFirebaseConfig?.firestoreDatabaseId || (firebaseConfig as any).firestoreDatabaseId || '(default)');
  const [customApiKey, setCustomApiKey] = useState(systemSettings.customFirebaseConfig?.apiKey || firebaseConfig.apiKey || '');
  
  const [copiedKey, setCopiedKey] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const [isTesting, setIsTesting] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setStatusMsg({ type: 'info', text: 'جاري فحص الاتصال بقاعدة بيانات Firebase والمكتب المحدد...' });
    try {
      const res = await fetchAllFromFirestoreNow();
      if (res.success) {
        setStatusMsg({
          type: 'success',
          text: `الاتصال السحابي بـ Firebase ناجح ومستقر 100%! قاعدة بيانات المكتب [${workspaceId}] متصلة وجاهزة للعمل.`
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: `فشل الاتصال: ${res.error || 'تعذر القراءة من قاعدة البيانات'}`
        });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: `خطأ في الاتصال: ${e.message || 'حدث خطأ أثناء الفحص'}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSelectPreset = (preset: PresetOffice) => {
    setOfficeName(preset.name);
    setWorkspaceId(preset.partitionKey);
  };

  const handleApplySwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId.trim()) {
      setStatusMsg({ type: 'error', text: 'يرجى تحديد مفتاح عزل المكتب (Partition Key).' });
      return;
    }

    setIsSwitching(true);
    setStatusMsg({ type: 'info', text: 'جاري تبديل الارتباط وتحميل قاعدة بيانات المكتب الجديد...' });

    try {
      const cleanWorkspace = workspaceId.trim();
      setActiveOfficePartition(cleanWorkspace);

      updateSettings({
        officeWorkspaceId: cleanWorkspace,
        officeName: officeName.trim(),
        customFirebaseConfig: {
          projectId: customProjectId.trim(),
          firestoreDatabaseId: customDatabaseId.trim(),
          apiKey: customApiKey.trim()
        }
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem('al_nashi_office_partition', cleanWorkspace);
      }

      await fetchAllFromFirestoreNow();

      setStatusMsg({
        type: 'success',
        text: `تم بنجاح التبديل إلى قاعدة بيانات (${officeName.trim()}) بمفتاح العزل [${cleanWorkspace}]. تم عزل البيانات بالكامل ولن تتداخل سجلات هذا المكتب مع أي مكتب آخر!`
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `فشل التبديل: ${err.message || 'حدث خطأ'}` });
    } finally {
      setIsSwitching(false);
    }
  };

  const handleCopyPartitionKey = () => {
    navigator.clipboard.writeText(workspaceId);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Explanation Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-blue-500/5 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>إدارة وتشغيل المنظومة لعدة مكاتب (Multi-Office Database Manager)</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                عزل بيانات كامل 100% 🔒
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              يمكنك تشغيل هذا البرنامج نفسه لأي عدد من المكاتب أو الفروع. بمجرد تغيير معرف أو رابط المكتب، 
              تتغير قاعدة البيانات بالكامل وتصبح مستقلة تماماً بدون أي تداخل في السجلات.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/40 shadow-xs shrink-0 text-center">
          <span className="text-[10px] text-slate-400 font-bold block">المكتب النشط حالياً:</span>
          <span className="text-xs font-black text-amber-600 dark:text-amber-400 block mt-0.5 font-mono">
            {currentPartition}
          </span>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
            : statusMsg.type === 'error'
            ? 'bg-rose-50 border border-rose-200 text-rose-900'
            : 'bg-blue-50 border border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Server className="w-4 h-4 text-blue-600 animate-spin" />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Method 1: Ready Office Presets */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-500" />
          <span>التبديل السريع بين المكاتب المجهزة (One-Click Office Switch):</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PRESET_OFFICES.map((p) => {
            const isSelected = workspaceId === p.partitionKey;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  isSelected 
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 shadow-xs' 
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {p.province}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] text-amber-600 font-black flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>محدد</span>
                      </span>
                    )}
                  </div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white mt-1.5 leading-snug">
                    {p.name}
                  </h5>
                </div>
                <span className="text-[10px] text-slate-400 font-mono block">
                  مفتاح العزل: {p.partitionKey}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Switcher Form */}
      <form onSubmit={handleApplySwitch} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs">
        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <Database className="w-4 h-4 text-emerald-600" />
          <span>تخصيص مكتب جديد وتحديد مفتاح قاعدة البيانات السحابية:</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              اسم المكتب المعتمد (Office Title) *
            </label>
            <input
              type="text"
              value={officeName}
              onChange={(e) => setOfficeName(e.target.value)}
              placeholder="مثال: مكتب النائب علا الناشي - ذي قار"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-amber-500"
              required
            />
            <span className="text-[10px] text-slate-400 block">
              الاسم الرسمي الذي يظهر في أعلى المنظومة وتقارير هذا المكتب.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              مفتاح عزل قاعدة البيانات (Office Partition / Workspace Key) *
            </label>
            <div className="relative">
              <input
                type="text"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="office_alnashi_main"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-left"
                dir="ltr"
                required
              />
              <button
                type="button"
                onClick={handleCopyPartitionKey}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-1"
                title="نسخ المفتاح"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <span className="text-[10px] text-slate-400 block">
              رمز باللغة الإنجليزية يفصل مستودع بيانات هذا المكتب عن غيره (تلقائياً في Firebase).
            </span>
          </div>
        </div>

        {/* Optional External Firebase Cloud Project */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-500" />
              <span>ربط مشروع Firebase سحابي مستقل تماماً (اختياري لمشاريع Cloud أخرى):</span>
            </h5>
            <span className="text-[10px] text-slate-400">Default Cloud: {firebaseConfig.projectId}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">معرف مشروع Firebase (Project ID)</label>
              <input
                type="text"
                value={customProjectId}
                onChange={(e) => setCustomProjectId(e.target.value)}
                placeholder={firebaseConfig.projectId}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-left"
                dir="ltr"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">معرف قاعدة بيانات Firestore (Database ID)</label>
              <input
                type="text"
                value={customDatabaseId}
                onChange={(e) => setCustomDatabaseId(e.target.value)}
                placeholder="(default)"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-left"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            🔒 عند الحفظ، سيبدأ النظام فورياً بحفظ واسترجاع البيانات الخاصة بهذا المكتب فقط.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-500 ${isTesting ? 'animate-bounce' : ''}`} />
              <span>{isTesting ? 'جاري الفحص...' : 'فحص الاتصال بقاعدة البيانات'}</span>
            </button>

            <button
              type="submit"
              disabled={isSwitching}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-slate-950" />
              <span>{isSwitching ? 'جاري تطبيق الإعدادات...' : 'تأكيد وحفظ ارتباط قاعدة بيانات هذا المكتب'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Developer Multi-Office Practical Guide Card */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs space-y-3">
        <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2 text-xs">
          <Info className="w-4 h-4 text-blue-500" />
          <span>دليل المطور: كيفية تشغيل واستنساخ المنظومة لعدة مكاتب مستقلة بدون تداخل:</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-600 dark:text-slate-300">
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-750 space-y-1">
            <span className="font-bold text-slate-900 dark:text-white block">1. تخصيص اسم ومفتاح المكتب</span>
            <p>عند تسليم البرنامج لمكتب فرعي أو محافظة أخرى، قم فقط بإدخال اسم المكتب ومفتاح عزل إنجليزي فريد مثل (office_basra أو office_kut).</p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-750 space-y-1">
            <span className="font-bold text-slate-900 dark:text-white block">2. عزل البيانات التلقائي</span>
            <p>يقوم النظام آلياً بإنشاء جداول ومجموعات خاصة بهذا الفرع، بحيث لا يرى موظف هذا المكتب سجلات أي مكتب آخر أبداً.</p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-750 space-y-1">
            <span className="font-bold text-slate-900 dark:text-white block">3. تبديل مشروع Firebase</span>
            <p>إذا رغبت بربط حساب أو مشروع Firebase مستقل كلياً، الصق معرف المشروع (Project ID) ومعرف قاعدة البيانات واضغط حفظ مباشرة.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
