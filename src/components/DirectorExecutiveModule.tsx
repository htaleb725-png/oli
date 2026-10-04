import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { OfficeRequest, Citizen } from '../types';
import { 
  UserPlus, 
  FolderKanban, 
  ShieldCheck, 
  Handshake, 
  Users2, 
  Search, 
  BarChart3, 
  MessageSquare, 
  Globe, 
  KeyRound, 
  ArrowLeft, 
  Briefcase, 
  Activity, 
  Users,
  CheckCircle2,
  XCircle,
  Sparkles,
  Phone,
  MapPin,
  Clock,
  Send,
  Eye,
  FileText,
  AlertTriangle,
  Building2,
  Check,
  X,
  Filter,
  Layers,
  ChevronLeft,
  LayoutGrid,
  Download,
  Printer
} from 'lucide-react';
import { OfficeIconTilesGrid } from './OfficeIconTilesGrid';
import { exportUnifiedSystemExcel } from '../services/unifiedExcelExporter';

// The Official Department Modules
import { ReceptionModule } from './ReceptionModule';
import { AdminModule } from './AdminModule';
import { AuditModule } from './AuditModule';
import { InterviewsModule } from './InterviewsModule';
import { OrganizationModule } from './OrganizationModule';
import { MachineModule } from './MachineModule';
import { GlobalSearchArchiveModule } from './GlobalSearchArchiveModule';
import { ReportsModule } from './ReportsModule';
import { WhatsAppModule } from './WhatsAppModule';
import { CitizenPublicPortal } from './CitizenPublicPortal';
import { MasterAdminModule } from './MasterAdminModule';

// Employee Performance Dashboard Module
import { DashboardModule } from './DashboardModule';

type DirectorDepartment = 
  | 'hub'
  | 'reception'
  | 'admin'
  | 'audit'
  | 'interviews'
  | 'organization'
  | 'machine'
  | 'search_archive'
  | 'reports'
  | 'whatsapp'
  | 'citizen_portal'
  | 'users_roles'
  | 'employee_stats';

export const DirectorExecutiveModule: React.FC = () => {
  const { 
    citizens, 
    requests, 
    updateRequest,
    interviews, 
    organizationRecords, 
    cheques,
    officialLetters,
    customSections,
    customRecords,
    systemSettings,
    auditLogs, 
    users, 
    whatsappTemplates,
    currentUser,
    addAuditLog,
    setActiveSection
  } = useApp();

  const handleDirectorExportUnifiedExcel = () => {
    exportUnifiedSystemExcel({
      citizens,
      requests,
      interviews,
      cheques,
      organizationRecords,
      officialLetters,
      customSections,
      customRecords,
      officeName: systemSettings.officeName || systemSettings.appName,
      exporterName: currentUser?.FullName || 'مدير المكتب التنفيذي'
    });
  };

  // Navigation mode: 'inbox' (وارد الاستعلامات) | 'icon_hub' (شبكة الأيقونات) | individual department
  const [directorMainTab, setDirectorMainTab] = useState<'inbox' | 'icon_hub'>('inbox');
  const [activeDepartment, setActiveDepartment] = useState<DirectorDepartment>('hub');

  // Search & Filter state for Director Inbox: default to 'pending' so decided items disappear
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'special' | 'general' | 'rejected' | 'all'>('pending');
  const [decisionBanner, setDecisionBanner] = useState<{ id: string; name: string; decision: string } | null>(null);

  // Local state for Director notes input per request
  const [directorNotesMap, setDirectorNotesMap] = useState<Record<string, string>>({});
  const [savedFeedbackId, setSavedFeedbackId] = useState<string | null>(null);

  // Map of citizens for fast lookup
  const citizenMap = useMemo(() => {
    const map = new Map<string, Citizen>();
    citizens.forEach(c => map.set(c.Citizen_ID, c));
    return map;
  }, [citizens]);

  // Reception requests list (sorted with newest on top)
  const receptionRequests = useMemo(() => {
    return requests
      .filter(r => {
        // Match search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const cit = citizenMap.get(r.Citizen_ID);
        return (
          r.CitizenName?.toLowerCase().includes(q) ||
          r.Request_ID?.toLowerCase().includes(q) ||
          r.CitizenPhone?.toLowerCase().includes(q) ||
          r.Entity?.toLowerCase().includes(q) ||
          r.Details?.toLowerCase().includes(q) ||
          (cit?.District && cit.District.toLowerCase().includes(q))
        );
      })
      .filter(r => {
        if (statusFilter === 'pending') return !r.DirectorDecision;
        if (statusFilter === 'special') return r.DirectorDecision === 'خاص';
        if (statusFilter === 'general') return r.DirectorDecision === 'عام';
        if (statusFilter === 'rejected') return r.DirectorDecision === 'رفض';
        if (statusFilter === 'all') return true;
        return !r.DirectorDecision;
      });
  }, [requests, searchQuery, statusFilter, citizenMap]);

  // Statistics counters
  const stats = useMemo(() => {
    let pending = 0;
    let special = 0;
    let general = 0;
    let rejected = 0;

    requests.forEach(r => {
      if (!r.DirectorDecision) pending++;
      else if (r.DirectorDecision === 'خاص') special++;
      else if (r.DirectorDecision === 'عام') general++;
      else if (r.DirectorDecision === 'رفض') rejected++;
    });

    return { total: requests.length, pending, special, general, rejected };
  }, [requests]);

  // Handle Director Decision action: 'خاص' | 'عام' | 'رفض'
  const handleDirectorDecision = (request: OfficeRequest, decision: 'خاص' | 'عام' | 'رفض') => {
    const noteText = directorNotesMap[request.Request_ID] !== undefined 
      ? directorNotesMap[request.Request_ID] 
      : (request.DirectorNotes || '');

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const updatedRequest: OfficeRequest = {
      ...request,
      DirectorDecision: decision,
      DirectorNotes: noteText.trim() || undefined,
      DirectorDecisionDate: formattedDate,
      DirectorDecisionBy: currentUser ? `${currentUser.FullName} (مدير المكتب)` : 'مدير المكتب',
      CurrentStage: decision === 'رفض' ? 'مكتمل' : 'مدير الإدارة',
      ProcessingStatus: decision === 'رفض' ? 'مرفوض' : request.ProcessingStatus,
      DeputyNotes: noteText.trim() 
        ? `[توجيه المدير - ${decision}]: ${noteText.trim()}` 
        : `[قرار المدير]: ${decision}`
    };

    updateRequest(updatedRequest);
    addAuditLog(
      `قرار مدير المكتب (${decision})`,
      'قسم مدير المكتب',
      `تم اعتماد قرار (${decision}) للطلب رقم ${request.Request_ID} الخاص بالمواطن ${request.CitizenName}${noteText.trim() ? ` مع توجيه: ${noteText.trim()}` : ''}`
    );

    setDecisionBanner({
      id: request.Request_ID,
      name: request.CitizenName,
      decision: decision
    });

    setSavedFeedbackId(request.Request_ID);
    setTimeout(() => setSavedFeedbackId(null), 3000);
  };

  const handleSaveNotesOnly = (request: OfficeRequest) => {
    const noteText = directorNotesMap[request.Request_ID] !== undefined 
      ? directorNotesMap[request.Request_ID] 
      : (request.DirectorNotes || '');

    const updatedRequest: OfficeRequest = {
      ...request,
      DirectorNotes: noteText.trim() || undefined,
      DeputyNotes: noteText.trim() 
        ? `[توجيه المدير]: ${noteText.trim()}` 
        : request.DeputyNotes
    };

    updateRequest(updatedRequest);
    addAuditLog(
      'تحديث ملاحظات مدير المكتب',
      'قسم مدير المكتب',
      `تم حفظ وتحديث ملاحظات المدير للطلب رقم ${request.Request_ID}: ${noteText.trim()}`
    );

    setSavedFeedbackId(request.Request_ID);
    setTimeout(() => setSavedFeedbackId(null), 3000);
  };

  // Department metadata for top banner when a department is opened
  const currentDeptMeta = useMemo(() => {
    switch (activeDepartment) {
      case 'reception':
        return {
          title: 'قسم الاستعلامات والمراجعين',
          icon: UserPlus,
          iconBg: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
        };
      case 'admin':
        return {
          title: 'قسم الإدارة والمعاملات الحكومية',
          icon: FolderKanban,
          iconBg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
        };
      case 'audit':
        return {
          title: 'قسم الرقابة والتدقيق',
          icon: ShieldCheck,
          iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
        };
      case 'interviews':
        return {
          title: 'قسم مقابلات النائب',
          icon: Handshake,
          iconBg: 'bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800'
        };
      case 'organization':
        return {
          title: 'قسم التنظيم والموقف الجماهيري',
          icon: Users2,
          iconBg: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800'
        };
      case 'machine':
        return {
          title: 'قسم مدير المكنة والطباعة الرسمية',
          icon: Printer,
          iconBg: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
        };
      case 'search_archive':
        return {
          title: 'قسم البحث الشامل والأرشيف المركزي',
          icon: Search,
          iconBg: 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800'
        };
      case 'reports':
        return {
          title: 'قسم التقارير الشاملة والإحصاء',
          icon: BarChart3,
          iconBg: 'bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-800'
        };
      case 'whatsapp':
        return {
          title: 'مراسلات الواتساب والإشعارات',
          icon: MessageSquare,
          iconBg: 'bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
        };
      case 'citizen_portal':
        return {
          title: 'بوابة المواطن العامة',
          icon: Globe,
          iconBg: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
        };
      case 'users_roles':
        return {
          title: 'إدارة وصلاحيات المستخدمين',
          icon: KeyRound,
          iconBg: 'bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800'
        };
      case 'employee_stats':
        return {
          title: 'لوحة إحصائيات أداء وإنتاجية الموظفين (Recharts)',
          icon: Activity,
          iconBg: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
        };
      default:
        return null;
    }
  }, [activeDepartment]);

  return (
    <div className="space-y-4 text-right animate-in fade-in duration-200 font-['Tajawal',sans-serif]" dir="rtl">
      
      {/* ---------------- TOP EXECUTIVE HEADER ---------------- */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-amber-500/20 shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                الإدارة التنفيذية العليا
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                مكتب النائب علا عودة الناشي
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
              شاشة مدير المكتب التنفيذي • اعتماد وتوجيه وارد الاستعلامات
            </h2>
          </div>
        </div>

        {/* View Switcher: وارد الاستعلامات vs تصفح الأقسام بالأيقونات vs الخروج الكامل */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <button
            type="button"
            onClick={() => {
              setDirectorMainTab('inbox');
              setActiveDepartment('hub');
            }}
            className={`flex-1 md:flex-initial h-10 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              directorMainTab === 'inbox' && activeDepartment === 'hub'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 ring-2 ring-amber-400/40'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span>وارد الاستعلامات</span>
            {stats.pending > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-mono animate-pulse">
                {stats.pending}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setDirectorMainTab('icon_hub');
              setActiveDepartment('hub');
            }}
            className={`flex-1 md:flex-initial h-10 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              directorMainTab === 'icon_hub' && activeDepartment === 'hub'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-500/40'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>تصفح الأقسام (عرض داخلي)</span>
          </button>

          {/* Direct Exit to System Icon Hub */}
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className="flex-1 md:flex-initial h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/25 transition-all cursor-pointer active:scale-95"
            title="الخروج وتصفح كامل المنظومة عن طريق لوحة الأيقونات المركزية"
          >
            <LayoutGrid className="w-4 h-4 text-slate-950" />
            <span>الخروج للأيقونات المركزية 🌐</span>
          </button>

          {/* Comprehensive Excel Export */}
          <button
            type="button"
            onClick={handleDirectorExportUnifiedExcel}
            className="flex-1 md:flex-initial h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-teal-600/25 transition-all cursor-pointer active:scale-95"
            title="تصدير قاعدة بيانات المنظومة بالكامل بكافة الجداول والصور والمرفقات في ملف Excel واحد"
          >
            <Download className="w-4 h-4 text-white" />
            <span>تصدير Excel الشامل</span>
          </button>
        </div>
      </div>

      {/* ---------------- VIEW 1: DIRECTOR INBOX (وارد الاستعلامات بشريط واحد) ---------------- */}
      {directorMainTab === 'inbox' && activeDepartment === 'hub' && (
        <div className="space-y-4">
          
          {/* Quick Statistics Overview: أقسام وتصنيفات قرارات المدير */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* 1. إجمالي الوارد وبانتظار قرار المدير */}
            <div 
              onClick={() => setStatusFilter('pending')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                statusFilter === 'pending'
                  ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 border-amber-600 shadow-lg shadow-amber-500/25 ring-2 ring-amber-400'
                  : 'bg-white dark:bg-slate-900 border-amber-300/80 dark:border-amber-800/60 hover:border-amber-500 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-black block ${statusFilter === 'pending' ? 'text-slate-950' : 'text-amber-700 dark:text-amber-400'}`}>
                  📥 إجمالي الوارد (بانتظار القرار)
                </span>
                {stats.pending > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                )}
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${statusFilter === 'pending' ? 'text-slate-950' : 'text-slate-900 dark:text-white'}`}>
                  {stats.pending}
                </span>
                <span className={`text-[10px] font-bold ${statusFilter === 'pending' ? 'text-slate-950/80' : 'text-slate-400'}`}>
                  تختفي فور اتخاذ القرار
                </span>
              </div>
            </div>

            {/* 2. قسم معتمد (مسار خاص) */}
            <div 
              onClick={() => setStatusFilter('special')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                statusFilter === 'special'
                  ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white border-purple-700 shadow-lg shadow-purple-600/25 ring-2 ring-purple-400'
                  : 'bg-white dark:bg-slate-900 border-purple-200 dark:border-purple-800/60 hover:border-purple-400 hover:shadow-xs'
              }`}
            >
              <span className={`text-[11px] font-black block ${statusFilter === 'special' ? 'text-purple-100' : 'text-purple-700 dark:text-purple-400'}`}>
                🟣 قسم معتمد (مسار خاص)
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${statusFilter === 'special' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {stats.special}
                </span>
                <span className={`text-[10px] font-bold ${statusFilter === 'special' ? 'text-purple-200' : 'text-slate-400'}`}>
                  محفوظة بالمسار الخاص
                </span>
              </div>
            </div>

            {/* 3. قسم معتمد (مسار عام) */}
            <div 
              onClick={() => setStatusFilter('general')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                statusFilter === 'general'
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-emerald-700 shadow-lg shadow-emerald-600/25 ring-2 ring-emerald-400'
                  : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-400 hover:shadow-xs'
              }`}
            >
              <span className={`text-[11px] font-black block ${statusFilter === 'general' ? 'text-emerald-100' : 'text-emerald-700 dark:text-emerald-400'}`}>
                🟢 قسم معتمد (مسار عام)
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${statusFilter === 'general' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {stats.general}
                </span>
                <span className={`text-[10px] font-bold ${statusFilter === 'general' ? 'text-emerald-200' : 'text-slate-400'}`}>
                  محفوظة بالمسار العام
                </span>
              </div>
            </div>

            {/* 4. قسم المرفوض (رفض) */}
            <div 
              onClick={() => setStatusFilter('rejected')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                statusFilter === 'rejected'
                  ? 'bg-gradient-to-br from-red-600 to-red-700 text-white border-red-700 shadow-lg shadow-red-600/25 ring-2 ring-red-400'
                  : 'bg-white dark:bg-slate-900 border-red-200 dark:border-red-800/60 hover:border-red-400 hover:shadow-xs'
              }`}
            >
              <span className={`text-[11px] font-black block ${statusFilter === 'rejected' ? 'text-red-100' : 'text-red-700 dark:text-red-400'}`}>
                🔴 قسم المرفوض (رفض)
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${statusFilter === 'rejected' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {stats.rejected}
                </span>
                <span className={`text-[10px] font-bold ${statusFilter === 'rejected' ? 'text-red-200' : 'text-slate-400'}`}>
                  محفوظة ومميزة بالأحمر
                </span>
              </div>
            </div>

            {/* 5. الأرشيف الشامل (كافة الحالات) */}
            <div 
              onClick={() => setStatusFilter('all')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/25 ring-2 ring-slate-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 hover:shadow-xs'
              }`}
            >
              <span className={`text-[11px] font-black block ${statusFilter === 'all' ? 'text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                📁 الأرشيف الشامل (الكل)
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${statusFilter === 'all' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {stats.total}
                </span>
                <span className={`text-[10px] font-bold ${statusFilter === 'all' ? 'text-slate-400' : 'text-slate-400'}`}>
                  كافة الحالات المحفوظة
                </span>
              </div>
            </div>
          </div>

          {/* Decision Notification Toast Banner: يظهر فور اتخاذ القرار لتأكيد اختفائه من الوارد وحفظه في القسم المخصص */}
          {decisionBanner && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-purple-500/15 to-blue-500/15 border border-emerald-300 dark:border-emerald-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm">
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  ✓ تم بنجاح اعتماد قرار <span className="font-black underline">({decisionBanner.decision})</span> للطلب رقم <span className="font-mono font-black">{decisionBanner.id}</span> ({decisionBanner.name}) — اختفى من قائمة الوارد وبانتظار وتـم حفظه بنجاح في قسم <span className="font-black text-purple-700 dark:text-purple-300">({decisionBanner.decision === 'خاص' ? 'معتمد مسار خاص' : decisionBanner.decision === 'عام' ? 'معتمد مسار عام' : 'المرفوض'})</span>.
                </span>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter(
                      decisionBanner.decision === 'خاص' ? 'special' :
                      decisionBanner.decision === 'عام' ? 'general' : 'rejected'
                    );
                    setDecisionBanner(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
                >
                  <span>عرض في قسم ({decisionBanner.decision === 'خاص' ? 'مسار خاص' : decisionBanner.decision === 'عام' ? 'مسار عام' : 'المرفوض'})</span>
                  <span>⇦</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDecisionBanner(null)}
                  className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center cursor-pointer"
                  title="إغلاق الإشعار"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Active Section Description Banner */}
          <div className={`p-3 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 transition-all text-xs font-semibold shadow-xs ${
            statusFilter === 'pending'
              ? 'bg-amber-500/10 border-amber-300 dark:border-amber-700/80 text-amber-950 dark:text-amber-200'
              : statusFilter === 'special'
              ? 'bg-purple-500/10 border-purple-300 dark:border-purple-700/80 text-purple-950 dark:text-purple-200'
              : statusFilter === 'general'
              ? 'bg-emerald-500/10 border-emerald-300 dark:border-emerald-700/80 text-emerald-950 dark:text-emerald-200'
              : statusFilter === 'rejected'
              ? 'bg-red-500/10 border-red-300 dark:border-red-700/80 text-red-950 dark:text-red-200'
              : 'bg-slate-500/10 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                statusFilter === 'pending' ? 'bg-amber-500 animate-pulse' :
                statusFilter === 'special' ? 'bg-purple-600' :
                statusFilter === 'general' ? 'bg-emerald-600' :
                statusFilter === 'rejected' ? 'bg-red-600' : 'bg-slate-600'
              }`} />
              <span>
                {statusFilter === 'pending' && '📥 قسم إجمالي الوارد (بانتظار قرار المدير): بمجرد الضغط على (خاص) أو (عام) أو (رفض) يختفي الطلب فوراً من هنا ويُحفظ في القسم المخصص.'}
                {statusFilter === 'special' && '🟣 قسم معتمد (مسار خاص): المعاملات المحفوظة التي اعتمدها المدير كمسار خاص مع توجيهاته التي تنعكس للإدارة.'}
                {statusFilter === 'general' && '🟢 قسم معتمد (مسار عام): المعاملات المحفوظة التي اعتمدها المدير كمسار عام روتيني.'}
                {statusFilter === 'rejected' && '🔴 قسم المعاملات المرفوضة: المعاملات المحفوظة التي تم رفضها مع بيان السبب وتظهر لأبو الإدارة باللون الأحمر.'}
                {statusFilter === 'all' && '📁 الأرشيف الشامل: عرض ومتابعة كافة المعاملات المحفوظة لجميع المسارات والحالات.'}
              </span>
            </div>
            <div className="text-[11px] font-mono font-bold shrink-0 opacity-80">
              المعروض: {receptionRequests.length} معاملة
            </div>
          </div>

          {/* Search Bar & Instruction Notice */}
          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم المواطن، الهاتف، رقم الطلب، أو القضاء..."
                className="w-full h-10 pr-9 pl-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 self-start sm:self-auto font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>المعلومات الواردة من الاستعلامات تظهر هنا للإقرار وتنعكس فوراً لأبو الإدارة (برتقالي إذا لم تعدل، وأحمر عند الرفض).</span>
            </div>
          </div>

          {/* ---------------- SINGLE UNIFIED HORIZONTAL BARS LIST ---------------- */}
          <div className="space-y-3">
            {receptionRequests.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                  {statusFilter === 'pending'
                    ? '🎉 تم إنجاز واتخاذ القرار لكافة الطلبات الواردة! لا توجد طلبات بانتظار المدير حالياً.'
                    : statusFilter === 'special'
                    ? 'لا توجد معاملات محفوظة في قسم المسار الخاص حالياً.'
                    : statusFilter === 'general'
                    ? 'لا توجد معاملات محفوظة في قسم المسار العام حالياً.'
                    : statusFilter === 'rejected'
                    ? 'لا توجد معاملات مرفوضة محفوظة حالياً.'
                    : 'لا توجد معاملات مطابقة للبحث أو التصفية الحالية.'}
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  {statusFilter === 'pending'
                    ? 'عند إدخال أي طلب جديد في قسم الاستعلامات يظهر هنا في شريط موحد لاتخاذ القرار. يمكنك مراجعة المعاملات المحفوظة من الأقسام أعلاه (مسار خاص • مسار عام • مرفوض).'
                    : 'جميع القرارات التي يتخذها المدير يتم حفظها فوراً في أقسامها وتنعكس للإدارة.'}
                </p>
                {statusFilter !== 'pending' && (
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs cursor-pointer transition-all shadow-xs"
                  >
                    العودة إلى إجمالي الوارد وبانتظار القرار 📥
                  </button>
                )}
              </div>
            ) : (
              receptionRequests.map((req) => {
                const cit = citizenMap.get(req.Citizen_ID);
                const currentDecision = req.DirectorDecision;
                const isPending = !currentDecision;
                const currentNoteInput = directorNotesMap[req.Request_ID] !== undefined 
                  ? directorNotesMap[req.Request_ID] 
                  : (req.DirectorNotes || '');

                return (
                  <div
                    key={req.Request_ID}
                    className={`p-4 rounded-2xl border transition-all duration-200 ${
                      currentDecision === 'خاص'
                        ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800'
                        : currentDecision === 'عام'
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                        : currentDecision === 'رفض'
                        ? 'bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-800'
                        : 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700/80 shadow-xs'
                    }`}
                  >
                    {/* Unified Single Horizontal Bar Layout */}
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                      
                      {/* 1. RIGHT SEGMENT: Citizen Identity & Origin */}
                      <div className="lg:w-1/4 shrink-0 space-y-1 pr-1 border-b lg:border-b-0 lg:border-l border-slate-200 dark:border-slate-800 pb-3 lg:pb-0 lg:pl-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 dark:bg-slate-800 text-blue-700 dark:text-blue-300">
                            {req.Request_ID}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {req.CreatedAt}
                          </span>
                        </div>

                        <h3 className="font-black text-sm text-slate-900 dark:text-white leading-tight">
                          {req.CitizenName}
                        </h3>

                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-mono">{req.CitizenPhone || cit?.Phone1 || 'لا يوجد هاتف'}</span>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{cit?.District || 'ذي قار'}</span>
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {req.AttendanceType || 'شخصياً'}
                          </span>
                        </div>

                        {req.AttendanceType === 'بيد شخص آخر (معتمد)' && req.ProxyName && (
                          <div className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800 inline-block font-bold">
                            المعتمد: {req.ProxyName} ({req.ProxyPhone})
                          </div>
                        )}
                      </div>

                      {/* 2. MIDDLE SEGMENT: Details, Target Entity, Reception Input */}
                      <div className="flex-1 space-y-1.5 px-1 lg:px-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            الجهة: {req.Entity}
                          </span>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            req.Priority === 'عاجل' || req.Priority === 'خاص جداً'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            الأسبقية: {req.Priority}
                          </span>

                          {/* Decision Status Pill */}
                          {currentDecision === 'خاص' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white shadow-2xs flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-300" />
                              <span>معتمد مسار خاص</span>
                            </span>
                          )}
                          {currentDecision === 'عام' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-2xs flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>معتمد مسار عام</span>
                            </span>
                          )}
                          {currentDecision === 'رفض' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shadow-2xs flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              <span>مرفوض من قبل المدير</span>
                            </span>
                          )}
                          {isPending && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 shadow-2xs animate-pulse flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>بانتظار قرار المدير</span>
                            </span>
                          )}
                        </div>

                        {/* Request Content / Details */}
                        <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                          {req.Details}
                        </p>

                        {/* Reception Notes from الاستعلامات */}
                        {(req.ReceptionNotes || cit?.ReferralSource) && (
                          <div className="text-xs text-amber-900 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-800/60 flex items-start gap-1.5">
                            <span className="font-black shrink-0 text-amber-700 dark:text-amber-400">ملاحظات الاستعلامات:</span>
                            <span className="font-medium">{req.ReceptionNotes || cit?.ReferralSource}</span>
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          <span>المستلم في الاستعلامات: {req.CreatedBy || 'موظف الاستعلامات'}</span>
                          {req.DirectorDecisionDate && (
                            <span>• قرار المدير في: {req.DirectorDecisionDate}</span>
                          )}
                        </div>
                      </div>

                      {/* 3. LEFT SEGMENT: Director's 3 Decisions (خاص / عام / رفض) & Directive Notes */}
                      <div className="lg:w-1/3 shrink-0 flex flex-col justify-between gap-2.5 bg-slate-50/90 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        {/* Notes Input */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-black text-slate-700 dark:text-slate-200 block">
                              توجيه وملاحظات المدير (تظهر لأبو الإدارة):
                            </label>
                            <button
                              type="button"
                              onClick={() => handleSaveNotesOnly(req)}
                              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                              title="حفظ الملاحظة فقط دون تغيير نوع القرار"
                            >
                              حفظ الملاحظة 💾
                            </button>
                          </div>
                          <input
                            type="text"
                            value={currentNoteInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDirectorNotesMap(prev => ({ ...prev, [req.Request_ID]: val }));
                            }}
                            placeholder="اكتب التوجيه أو سبب القرار هنا..."
                            className="w-full h-8.5 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                          />
                        </div>

                        {/* 3 Decision Action Buttons: خاص / عام / رفض */}
                        <div className="flex items-center gap-2">
                          {/* 1. خاص */}
                          <button
                            type="button"
                            onClick={() => handleDirectorDecision(req, 'خاص')}
                            className={`flex-1 h-9 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                              currentDecision === 'خاص'
                                ? 'bg-purple-700 text-white ring-2 ring-purple-400 shadow-purple-600/30'
                                : 'bg-purple-600 hover:bg-purple-700 text-white'
                            }`}
                            title="اعتماد الطلب كمسار خاص"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>خاص</span>
                          </button>

                          {/* 2. عام */}
                          <button
                            type="button"
                            onClick={() => handleDirectorDecision(req, 'عام')}
                            className={`flex-1 h-9 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                              currentDecision === 'عام'
                                ? 'bg-emerald-700 text-white ring-2 ring-emerald-400 shadow-emerald-600/30'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                            title="اعتماد الطلب كمسار عام روتيني"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>عام</span>
                          </button>

                          {/* 3. رفض */}
                          <button
                            type="button"
                            onClick={() => handleDirectorDecision(req, 'رفض')}
                            className={`flex-1 h-9 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                              currentDecision === 'رفض'
                                ? 'bg-red-700 text-white ring-2 ring-red-400 shadow-red-600/30'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                            title="رفض الطلب وإشعار الإدارة باللون الأحمر"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>رفض</span>
                          </button>
                        </div>

                        {/* Confirmation Toast */}
                        {savedFeedbackId === req.Request_ID && (
                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 text-center animate-in fade-in">
                            ✓ تم حفظ القرار والتوجيه وإرساله للإدارة
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* ---------------- VIEW 2: ICON HUB (تصفح جميع أقسام النظام بالأيقونات) ---------------- */}
      {directorMainTab === 'icon_hub' && activeDepartment === 'hub' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-4 sm:p-5 rounded-2xl sm:rounded-3xl text-white flex items-center justify-between border border-blue-400/30 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20">
                <Layers className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h3 className="font-black text-base sm:text-lg">شبكة أيقونات أقسام المكتب المركزية</h3>
                <p className="text-xs text-blue-200 mt-0.5 font-medium">
                  انقر على أي أيقونة لاستعراض القسم بكامل محتوياته وصلاحياته الإشرافية
                </p>
              </div>
            </div>

            <button
              onClick={() => setDirectorMainTab('inbox')}
              className="h-9 px-4 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>الرجوع لوارد الاستعلامات</span>
              <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>

          <OfficeIconTilesGrid
            title="الأقسام الرسمية - الوصول الكامل بالأيقونات"
            subtitle="المدير يمتلك صلاحية التصفح الكامل لكل أقسام المنظومة بدون استثناء"
            columns={5}
            items={[
              {
                id: 'dept_reception',
                title: 'قسم الاستعلامات والمراجعين',
                subtitle: 'تسجيل، استعلام، وتوثيق المراجعين',
                icon: UserPlus,
                iconColor: 'text-blue-600 dark:text-blue-400',
                iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
                badge: citizens.length,
                badgeColor: 'bg-blue-600 text-white',
                onClick: () => setActiveDepartment('reception')
              },
              {
                id: 'dept_admin',
                title: 'قسم الإدارة والمعاملات',
                subtitle: 'المعاملات الحكومية، الكتب الرسمية، والقرارات',
                icon: FolderKanban,
                iconColor: 'text-amber-600 dark:text-amber-400',
                iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
                badge: requests.length,
                badgeColor: 'bg-amber-600 text-white',
                onClick: () => setActiveDepartment('admin')
              },
              {
                id: 'dept_audit',
                title: 'قسم الرقابة والتدقيق',
                subtitle: 'التدقيق المالي والإداري وسجل الحوكمة',
                icon: ShieldCheck,
                iconColor: 'text-emerald-600 dark:text-emerald-400',
                iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
                badge: auditLogs.length,
                badgeColor: 'bg-emerald-600 text-white',
                onClick: () => setActiveDepartment('audit')
              },
              {
                id: 'dept_interviews',
                title: 'قسم المقابلات',
                subtitle: 'جدول مواعيد النائب وتوثيق الهوامش',
                icon: Handshake,
                iconColor: 'text-teal-600 dark:text-teal-400',
                iconBg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
                badge: interviews.length,
                badgeColor: 'bg-teal-600 text-white',
                onClick: () => setActiveDepartment('interviews')
              },
              {
                id: 'dept_organization',
                title: 'قسم التنظيم',
                subtitle: 'شؤون العشائر والموقف الجماهيري',
                icon: Users2,
                iconColor: 'text-purple-600 dark:text-purple-400',
                iconBg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
                badge: organizationRecords.length,
                badgeColor: 'bg-purple-600 text-white',
                onClick: () => setActiveDepartment('organization')
              },
              {
                id: 'dept_machine',
                title: 'قسم المكنة والطباعة',
                subtitle: 'طباعة الكتب الرسمية والصادر والوارد',
                icon: Printer,
                iconColor: 'text-indigo-600 dark:text-indigo-400',
                iconBg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
                onClick: () => setActiveDepartment('machine')
              },
              {
                id: 'dept_search_archive',
                title: 'قسم البحث الشامل والأرشيف',
                subtitle: 'البحث الموحد في سجلات ومعاملات المكتب',
                icon: Search,
                iconColor: 'text-cyan-600 dark:text-cyan-400',
                iconBg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800',
                onClick: () => setActiveDepartment('search_archive')
              },
              {
                id: 'dept_reports',
                title: 'قسم التقارير والإحصاء',
                subtitle: 'مؤشرات الإنجاز، التحليلات، وسحب Excel',
                icon: BarChart3,
                iconColor: 'text-pink-600 dark:text-pink-400',
                iconBg: 'bg-pink-50 dark:bg-pink-950/50 border-pink-200 dark:border-pink-800',
                onClick: () => setActiveDepartment('reports')
              },
              {
                id: 'dept_whatsapp',
                title: 'مراسلات الواتساب',
                subtitle: 'إرسال التحديثات والإشعارات للمواطنين',
                icon: MessageSquare,
                iconColor: 'text-green-600 dark:text-green-400',
                iconBg: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800',
                badge: whatsappTemplates.length,
                badgeColor: 'bg-green-600 text-white',
                onClick: () => setActiveDepartment('whatsapp')
              },
              {
                id: 'dept_citizen_portal',
                title: 'بوابة المواطن',
                subtitle: 'بوابة استعلام ومتابعة المعاملات للجمهور',
                icon: Globe,
                iconColor: 'text-indigo-600 dark:text-indigo-400',
                iconBg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
                onClick: () => setActiveDepartment('citizen_portal')
              },
              {
                id: 'dept_users_roles',
                title: 'إدارة وصلاحيات المستخدمين',
                subtitle: 'حسابات الموظفين، الأدوار، ومراقبة الصلاحيات',
                icon: KeyRound,
                iconColor: 'text-orange-600 dark:text-orange-400',
                iconBg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800',
                badge: users.length,
                badgeColor: 'bg-orange-600 text-white',
                onClick: () => setActiveDepartment('users_roles')
              },
              {
                id: 'dept_employee_stats',
                title: 'إحصائيات أداء الموظفين',
                subtitle: 'تحليل بياني شامل ومؤشرات إنتاجية الكوادر (Recharts)',
                icon: Activity,
                iconColor: 'text-rose-600 dark:text-rose-400',
                iconBg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
                badge: `${users.length} موظف`,
                badgeColor: 'bg-rose-600 text-white shadow-2xs',
                onClick: () => setActiveDepartment('employee_stats')
              },
              {
                id: 'dept_export_excel',
                title: 'تصدير قاعدة البيانات الشاملة Excel',
                subtitle: 'سحب كشف كامل لكافة الجداول والأقسام والصور',
                icon: Download,
                iconColor: 'text-teal-600 dark:text-teal-400',
                iconBg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
                badge: 'Excel الشامل 📥',
                badgeColor: 'bg-teal-600 text-white shadow-2xs',
                onClick: handleDirectorExportUnifiedExcel
              }
            ]}
          />
        </div>
      )}

      {/* ---------------- VIEW 3: ACTIVE DEPARTMENT VIEW WITH TOP RETURN BAR ---------------- */}
      {activeDepartment !== 'hub' && currentDeptMeta && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Executive Top Banner with Return to Director Button */}
          <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white p-3.5 sm:p-4 rounded-2xl border border-amber-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sticky top-16 z-30 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold text-lg shadow-2xs shrink-0">
                <currentDeptMeta.icon className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/30">
                    بوابة مدير المكتب التنفيذي
                  </span>
                  <span className="text-[10px] text-slate-400">
                    تصفح القسم بكامل الصلاحيات
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-black text-white mt-0.5">
                  {currentDeptMeta.title}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveDepartment('hub')}
              className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95 self-start sm:self-auto"
            >
              <ArrowLeft className="w-4 h-4 rotate-180" />
              <span>الرجوع لشاشة المدير (الوارد والأيقونات)</span>
            </button>
          </div>

          {/* Department Viewport */}
          {activeDepartment === 'employee_stats' ? (
            <DashboardModule onBackToDirectorHub={() => setActiveDepartment('hub')} />
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-3.5 sm:p-5">
              {activeDepartment === 'reception' && <ReceptionModule />}
              {activeDepartment === 'admin' && <AdminModule />}
              {activeDepartment === 'audit' && <AuditModule />}
              {activeDepartment === 'interviews' && <InterviewsModule />}
              {activeDepartment === 'organization' && <OrganizationModule />}
              {activeDepartment === 'machine' && <MachineModule />}
              {activeDepartment === 'search_archive' && <GlobalSearchArchiveModule />}
              {activeDepartment === 'reports' && <ReportsModule />}
              {activeDepartment === 'whatsapp' && <WhatsAppModule />}
              {activeDepartment === 'citizen_portal' && (
                <CitizenPublicPortal onBackToStaffLogin={() => setActiveDepartment('hub')} />
              )}
              {activeDepartment === 'users_roles' && <MasterAdminModule />}
            </div>
          )}

        </div>
      )}

    </div>
  );
};
