import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import { 
  Users, 
  TrendingUp, 
  CheckCircle2, 
  UserCheck, 
  Activity, 
  ArrowLeft, 
  FileSpreadsheet, 
  Printer, 
  Search, 
  ShieldCheck, 
  Award,
  Filter,
  Layers,
  Sparkles,
  Zap,
  BarChart3,
  Calendar,
  UserPlus,
  FolderKanban,
  Briefcase,
  Handshake,
  Users2,
  CloudDownload,
  MessageSquare,
  Settings,
  LayoutGrid,
  Globe
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { OfficeIconTilesGrid, OfficeTileItem } from './OfficeIconTilesGrid';

export interface DashboardModuleProps {
  onBackToDirectorHub?: () => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  onBackToDirectorHub
}) => {
  const { 
    users, 
    citizens, 
    requests, 
    interviews, 
    auditLogs, 
    organizationRecords,
    currentUser,
    setActiveSection,
    customSections,
    customRecords,
    systemSettings
  } = useApp();

  const [activeMainTab, setActiveMainTab] = useState<'icon_tiles' | 'performance_stats'>('icon_tiles');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [activeChartTab, setActiveChartTab] = useState<'comparison' | 'timeline'>('comparison');

  // Compute live employee productivity statistics
  const employeeStats = useMemo(() => {
    return users.map(user => {
      // Reception output: Citizens registered by this user
      const registeredCitizensCount = citizens.filter(c => 
        (c.CreatedBy && c.CreatedBy.includes(user.FullName)) || 
        (c.CreatedBy && c.CreatedBy.includes(user.Username))
      ).length;

      // Admin output: Requests created or updated by this user
      const handledRequestsCount = requests.filter(r => 
        (r.CreatedBy && r.CreatedBy.includes(user.FullName)) || 
        (r.DeputyNotes && r.DeputyNotes.includes(user.FullName))
      ).length;

      const completedRequestsCount = requests.filter(r => 
        ((r.CreatedBy && r.CreatedBy.includes(user.FullName)) || (r.DeputyNotes && r.DeputyNotes.includes(user.FullName))) &&
        r.ProcessingStatus === 'منجز'
      ).length;

      // Interviews output
      const scheduledInterviewsCount = interviews.filter(i => 
        (i.DeputyNotes && i.DeputyNotes.includes(user.FullName)) || 
        user.Role === 'interviews_officer'
      ).length;

      // Audit logs count for this user
      const userLogs = auditLogs.filter(l => 
        (l.UserName && l.UserName.includes(user.FullName)) || 
        (l.User && l.User.includes(user.FullName))
      );
      const userLogsCount = userLogs.length;

      const lastActiveLog = userLogs[0]?.Timestamp || user.CreatedAt || 'اليوم';

      // Total weighted performance score
      const performanceScore = (completedRequestsCount * 3) + (handledRequestsCount * 2) + (registeredCitizensCount * 2) + userLogsCount;

      return {
        userId: user.User_ID,
        fullName: user.FullName,
        username: user.Username,
        role: user.Role,
        roleArabic: user.RoleArabic,
        department: user.Department,
        status: user.Status || 'active',
        registeredCitizensCount,
        handledRequestsCount,
        completedRequestsCount,
        scheduledInterviewsCount,
        userLogsCount,
        totalActionsCount: userLogsCount + handledRequestsCount + registeredCitizensCount,
        performanceScore,
        lastActive: lastActiveLog
      };
    }).sort((a, b) => b.performanceScore - a.performanceScore);
  }, [users, citizens, requests, interviews, auditLogs]);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employeeStats.filter(emp => {
      const matchesSearch = 
        emp.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        emp.roleArabic.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        emp.department.toLowerCase().includes(searchQuery.toLowerCase().trim());

      const matchesDept = 
        selectedDeptFilter === 'all' || 
        emp.role === selectedDeptFilter ||
        emp.department.includes(selectedDeptFilter);

      return matchesSearch && matchesDept;
    });
  }, [employeeStats, searchQuery, selectedDeptFilter]);

  // Recharts Data: Comparison Bar Chart (Top 7 Staff)
  const barChartData = useMemo(() => {
    return employeeStats.slice(0, 7).map(emp => ({
      name: emp.fullName.split(' ').slice(0, 2).join(' '),
      معاملات_منجزة: emp.completedRequestsCount,
      مراجعين_مسجلين: emp.registeredCitizensCount,
      إجمالي_العمليات: emp.totalActionsCount
    }));
  }, [employeeStats]);

  // Recharts Data: Department Distribution Pie Chart
  const departmentPieData = useMemo(() => {
    const deptCounts: { [dept: string]: number } = {
      'الاستعلامات': citizens.length,
      'الإدارة والمعاملات': requests.length,
      'المقابلات': interviews.length,
      'الرقابة والتدقيق': auditLogs.length
    };

    const COLORS = ['#3B82F6', '#F59E0B', '#14B8A6', '#8B5CF6'];

    return Object.entries(deptCounts).map(([name, value], index) => ({
      name,
      value: value || 1,
      color: COLORS[index % COLORS.length]
    }));
  }, [citizens, requests, interviews, auditLogs]);

  // Recharts Data: Activity Timeline / Velocity
  const timelineActivityData = useMemo(() => {
    // Generate synthetic last 6 periods based on real data counts for visualization
    const totalOps = auditLogs.length + requests.length + citizens.length;
    return [
      { period: 'السبت', إنجاز: Math.round(totalOps * 0.12), تسجيل: Math.round(citizens.length * 0.14) },
      { period: 'الأحد', إنجاز: Math.round(totalOps * 0.18), تسجيل: Math.round(citizens.length * 0.20) },
      { period: 'الإثنين', إنجاز: Math.round(totalOps * 0.22), تسجيل: Math.round(citizens.length * 0.25) },
      { period: 'الثلاثاء', إنجاز: Math.round(totalOps * 0.20), تسجيل: Math.round(citizens.length * 0.18) },
      { period: 'الأربعاء', إنجاز: Math.round(totalOps * 0.16), تسجيل: Math.round(citizens.length * 0.15) },
      { period: 'الخميس', إنجاز: Math.round(totalOps * 0.12), تسجيل: Math.round(citizens.length * 0.08) }
    ];
  }, [auditLogs, requests, citizens]);

  // Overall metric totals
  const totalCompleted = useMemo(() => {
    return requests.filter(r => r.ProcessingStatus === 'منجز').length;
  }, [requests]);

  const topPerformer = useMemo(() => {
    return employeeStats[0] || null;
  }, [employeeStats]);

  const pendingDirectorReviewCount = useMemo(() => {
    return requests.filter(r => !r.DirectorDecision).length;
  }, [requests]);

  const urgentRequestsCount = useMemo(() => {
    return requests.filter(r => r.Priority === 'عاجل' || r.Priority === 'خاص جداً').length;
  }, [requests]);

  const isDeveloper = currentUser?.Role === 'developer';

  const departmentTiles: OfficeTileItem[] = useMemo(() => {
    const getMeta = (id: string, defTitle: string, defSubtitle: string) => {
      const conf = systemSettings?.customTilesConfig?.[id];
      return {
        title: conf?.title?.trim() || defTitle,
        subtitle: conf?.subtitle?.trim() || defSubtitle,
        iconImgUrl: conf?.iconUrl?.trim() || undefined
      };
    };

    const list: OfficeTileItem[] = [
      {
        id: 'tile_reception',
        ...getMeta('tile_reception', 'قسم الاستعلامات والمراجعين', 'تسجيل واستعلام وتوثيق المراجعين'),
        icon: UserPlus,
        iconColor: 'text-blue-600 dark:text-blue-400',
        iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
        badge: citizens.length,
        badgeColor: 'bg-blue-600 text-white',
        onClick: () => setActiveSection('reception')
      },
      {
        id: 'tile_admin',
        ...getMeta('tile_admin', 'قسم الإدارة والمعاملات', 'المعاملات الحكومية والمخاطبات والكتب'),
        icon: FolderKanban,
        iconColor: 'text-amber-600 dark:text-amber-400',
        iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
        badge: urgentRequestsCount > 0 ? `${urgentRequestsCount} عاجل` : `${requests.length}`,
        badgeColor: urgentRequestsCount > 0 ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white',
        onClick: () => setActiveSection('admin')
      },
      {
        id: 'tile_director',
        ...getMeta('tile_director', 'قسم مدير المكتب التنفيذي', 'اعتماد وتوجيه وارد الاستعلامات والإشراف'),
        icon: Briefcase,
        iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
        iconBg: 'bg-fuchsia-50 dark:bg-fuchsia-950/50 border-fuchsia-200 dark:border-fuchsia-800',
        badge: pendingDirectorReviewCount > 0 ? `${pendingDirectorReviewCount} بانتظار القرار` : 'وارد',
        badgeColor: pendingDirectorReviewCount > 0 ? 'bg-amber-500 text-slate-950 font-black animate-pulse' : 'bg-fuchsia-600 text-white',
        onClick: () => setActiveSection('director')
      },
      {
        id: 'tile_interviews',
        ...getMeta('tile_interviews', 'قسم مقابلات النائب', 'جدول مواعيد النائب وتوثيق الهوامش'),
        icon: Handshake,
        iconColor: 'text-teal-600 dark:text-teal-400',
        iconBg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
        badge: interviews.length,
        badgeColor: 'bg-teal-600 text-white',
        onClick: () => setActiveSection('interviews')
      },
      {
        id: 'tile_organization',
        ...getMeta('tile_organization', 'قسم التنظيم والجماهير', 'شؤون العشائر والموقف الجماهيري'),
        icon: Users2,
        iconColor: 'text-purple-600 dark:text-purple-400',
        iconBg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
        badge: organizationRecords.length,
        badgeColor: 'bg-purple-600 text-white',
        onClick: () => setActiveSection('organization')
      },
      {
        id: 'tile_machine',
        ...getMeta('tile_machine', 'قسم المكنة والطباعة', 'طباعة الكتب الرسمية والصادر والوارد'),
        icon: Printer,
        iconColor: 'text-indigo-600 dark:text-indigo-400',
        iconBg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
        onClick: () => setActiveSection('machine')
      },
      {
        id: 'tile_search_archive',
        ...getMeta('tile_search_archive', 'قسم البحث الشامل والأرشيف', 'البحث الفوري واستخراج السجلات وطباعة الهوية'),
        icon: Search,
        iconColor: 'text-cyan-600 dark:text-cyan-400',
        iconBg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800',
        onClick: () => setActiveSection('search_archive')
      },
      {
        id: 'tile_drive_requests',
        ...getMeta('tile_drive_requests', 'أرشيف طلبات Google Drive', 'مزامنة وتنزيل وأرشفة المستندات السحابية'),
        icon: CloudDownload,
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
        badge: 'Drive',
        badgeColor: 'bg-emerald-600 text-white',
        onClick: () => setActiveSection('drive_requests')
      },
      {
        id: 'tile_reports',
        ...getMeta('tile_reports', 'قسم التقارير والإحصائيات', 'مؤشرات الإنجاز، التحليلات، وسحب Excel'),
        icon: BarChart3,
        iconColor: 'text-pink-600 dark:text-pink-400',
        iconBg: 'bg-pink-50 dark:bg-pink-950/50 border-pink-200 dark:border-pink-800',
        onClick: () => setActiveSection('reports')
      },
      {
        id: 'tile_audit',
        ...getMeta('tile_audit', 'قسم الرقابة والتدقيق والمتابعة', 'الحوكمة وسجل النشاطات والمتابعة الميدانية'),
        icon: ShieldCheck,
        iconColor: 'text-rose-600 dark:text-rose-400',
        iconBg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
        badge: auditLogs.length,
        badgeColor: 'bg-rose-600 text-white',
        onClick: () => setActiveSection('audit')
      },
      {
        id: 'tile_whatsapp',
        ...getMeta('tile_whatsapp', 'مراسلات الواتساب التلقائية', 'إشعار وتحديث المراجعين فورياً بالرسائل'),
        icon: MessageSquare,
        iconColor: 'text-green-600 dark:text-green-400',
        iconBg: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800',
        badge: 'فوري',
        badgeColor: 'bg-green-600 text-white',
        onClick: () => setActiveSection('whatsapp')
      }
    ];

    // Add Custom Dynamic Sections configured by Developer
    customSections.forEach((sec) => {
      const secRecs = customRecords.filter(r => r.sectionId === sec.id);
      list.push({
        id: `tile_custom_${sec.id}`,
        title: sec.title,
        subtitle: sec.description || 'قسم مخصص تم إنشاؤه عبر لوحة المطور',
        icon: Layers,
        iconColor: 'text-indigo-600 dark:text-indigo-400',
        iconBg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
        badge: `${secRecs.length} سجل`,
        badgeColor: 'bg-indigo-600 text-white',
        onClick: () => setActiveSection(`custom_section_${sec.id}`)
      });
    });

    if (isDeveloper) {
      list.push(
        {
          id: 'tile_master_admin',
          title: 'لوحة تحكم المطور والإعدادات',
          subtitle: 'إدارة المستخدمين وقواعد البيانات والصلاحيات',
          icon: Settings,
          iconColor: 'text-orange-600 dark:text-orange-400',
          iconBg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800',
          badge: 'مطور',
          badgeColor: 'bg-orange-600 text-white',
          onClick: () => setActiveSection('master_admin')
        },
        {
          id: 'tile_apps_script',
          title: 'مزامنة Google Sheets السحابية',
          subtitle: 'ربط ومزامنة الجداول الخارجية',
          icon: CloudDownload,
          iconColor: 'text-blue-600 dark:text-blue-400',
          iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
          badge: 'سحابي',
          badgeColor: 'bg-blue-600 text-white',
          onClick: () => setActiveSection('apps_script')
        }
      );
    }

    return list;
  }, [citizens.length, requests.length, urgentRequestsCount, pendingDirectorReviewCount, interviews.length, organizationRecords.length, auditLogs.length, isDeveloper, setActiveSection, customSections, customRecords.length, systemSettings?.customTilesConfig]);

  const handleExportToExcel = () => {
    const data = employeeStats.map((emp, index) => ({
      'المرتبة': index + 1,
      'اسم الموظف': emp.fullName,
      'الدور والصفة': emp.roleArabic,
      'القسم': emp.department,
      'المعاملات المنجزة': emp.completedRequestsCount,
      'إجمالي المعاملات المتابعة': emp.handledRequestsCount,
      'المراجعين المسجلين': emp.registeredCitizensCount,
      'المقابلات المجدولة': emp.scheduledInterviewsCount,
      'عمليات الرقابة': emp.userLogsCount,
      'إجمالي النشاط': emp.totalActionsCount,
      'نقاط الأداء': emp.performanceScore,
      'آخر نشاط': emp.lastActive
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'إحصائيات أداء الموظفين');
    XLSX.writeFile(wb, `Staff_Performance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-4 sm:space-y-5 text-right font-['Tajawal',sans-serif] animate-in fade-in duration-200" dir="rtl">
      
      {/* Executive Header & Navigation Switcher */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shadow-2xs shrink-0">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                لوحة الأيقونات المركزية
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                مكتب النائب علا عودة الناشي
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
              شبكة أيقونات أقسام المنظومة • نظام العمل بالأيقونات المباشرة
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Main View Tabs Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveMainTab('icon_tiles')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeMainTab === 'icon_tiles'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>أيقونات الأقسام ({departmentTiles.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMainTab('performance_stats')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeMainTab === 'performance_stats'
                  ? 'bg-amber-500 text-slate-950 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>إحصائيات الأداء (Recharts)</span>
            </button>
          </div>

          {activeMainTab === 'performance_stats' && (
            <>
              <button
                onClick={handleExportToExcel}
                className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer active:scale-95"
                title="تصدير كشف الأداء إلى Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel</span>
              </button>

              <button
                onClick={() => window.print()}
                className="h-9 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer active:scale-95"
                title="طباعة التقرير"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة</span>
              </button>
            </>
          )}

          {onBackToDirectorHub && (
            <button
              onClick={onBackToDirectorHub}
              className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 rotate-180" />
              <span>الرجوع إلى شاشة المدير</span>
            </button>
          )}
        </div>
      </div>

      {/* ---------------- 1. ICON TILES GRID (شبكة الأيقونات المركزية لكامل النظام) ---------------- */}
      {activeMainTab === 'icon_tiles' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Quick Notice Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 rounded-2xl border border-blue-400/30 shadow-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-lg border border-blue-400/30 shrink-0">
                ✨
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  منظومة العمل بالأيقونات المباشرة
                </h3>
                <p className="text-xs text-blue-200/90 mt-0.5">
                  انقر على أي قسم للانتقال الفوري إليه والبدء بالعمل بدون قوائم جانبية
                </p>
              </div>
            </div>

            {pendingDirectorReviewCount > 0 && (
              <button
                onClick={() => setActiveSection('director')}
                className="h-8.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer animate-pulse shrink-0"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>{pendingDirectorReviewCount} طلب استعلامات بانتظار قرار المدير ⚡</span>
              </button>
            )}
          </div>

          {/* Master 5-Column Icon Tiles Grid */}
          <OfficeIconTilesGrid
            title="أقسام المنظومة الرسمية"
            subtitle="جميع المهام والأقسام متاحة عبر الأيقونات المباشرة"
            columns={5}
            items={departmentTiles}
          />
        </div>
      )}

      {/* ---------------- 2. PERFORMANCE & KPI STATS (إحصائيات الأداء والرسوم البيانية) ---------------- */}
      {activeMainTab === 'performance_stats' && (
        <div className="space-y-4 animate-in fade-in duration-200">

      {/* Top Performer Ribbon (if exists) */}
      {topPerformer && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-sm shadow-md shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                <span>الموظف الأعلى إنتاجية في المنظومة</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                {topPerformer.fullName} — <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{topPerformer.roleArabic} ({topPerformer.department})</span>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs font-mono font-bold">
            <div className="text-right">
              <div className="text-[10px] text-slate-400">معاملات منجزة</div>
              <div className="text-emerald-600 dark:text-emerald-400 text-base">{topPerformer.completedRequestsCount}</div>
            </div>
            <div className="text-right border-r border-amber-500/20 pr-4">
              <div className="text-[10px] text-slate-400">نقاط الأداء</div>
              <div className="text-amber-600 dark:text-amber-400 text-base">{topPerformer.performanceScore}</div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Performance Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-right">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
            <span>إجمالي الموظفين</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{users.length}</div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">كوادر مكاتب المحافظة</div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 shadow-2xs text-right">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
            <span>المعاملات المنجزة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{totalCompleted}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">معاملة مكتملة ومحققة</div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 shadow-2xs text-right">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
            <span>المراجعين الموثقين</span>
            <UserCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{citizens.length}</div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-0.5">مسجلين برقم تعريفي ONA</div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/50 shadow-2xs text-right">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
            <span>عمليات الحوكمة والرصد</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{auditLogs.length}</div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold mt-0.5">حركة موثقة في النظام</div>
        </div>
      </div>

      {/* Visual Recharts Section with Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        
        {/* 1. Bar Chart / Area Chart: Staff Productivity Comparison */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                مقارنة إنتاجية الموظفين الأعلى نشاطاً (Recharts)
              </h3>
            </div>
            
            {/* Interactive chart toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto text-xs">
              <button
                type="button"
                onClick={() => setActiveChartTab('comparison')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  activeChartTab === 'comparison'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                مقارنة الموظفين
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('timeline')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  activeChartTab === 'timeline'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                معدل النشاط الأسبوعي
              </button>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {activeChartTab === 'comparison' ? (
                <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: '#64748B' }} 
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0F172A', 
                      borderRadius: '12px', 
                      borderColor: '#334155',
                      color: '#F8FAFC',
                      fontSize: '11px',
                      direction: 'rtl',
                      textAlign: 'right'
                    }} 
                  />
                  <Legend 
                    verticalAlign="top" 
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} 
                  />
                  <Bar dataKey="معاملات_منجزة" fill="#10B981" radius={[4, 4, 0, 0]} name="معاملات منجزة" />
                  <Bar dataKey="مراجعين_مسجلين" fill="#3B82F6" radius={[4, 4, 0, 0]} name="مراجعين مسجلين" />
                  <Bar dataKey="إجمالي_العمليات" fill="#F59E0B" radius={[4, 4, 0, 0]} name="إجمالي النشاط" />
                </BarChart>
              ) : (
                <AreaChart data={timelineActivityData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0F172A', 
                      borderRadius: '12px', 
                      borderColor: '#334155',
                      color: '#F8FAFC',
                      fontSize: '11px',
                      direction: 'rtl',
                      textAlign: 'right'
                    }} 
                  />
                  <Legend verticalAlign="top" wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} />
                  <Area type="monotone" dataKey="إنجاز" stroke="#10B981" fill="#10B981" fillOpacity={0.2} name="مؤشر الإنجاز اليومي" />
                  <Area type="monotone" dataKey="تسجيل" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.15} name="مؤشر استقبال المواطنين" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Pie Chart: Workload by Department */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                توزيع ضغط العمل بين الأقسام
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              نسبة السجلات
            </span>
          </div>

          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={departmentPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {departmentPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0F172A', 
                    borderRadius: '12px', 
                    borderColor: '#334155',
                    color: '#F8FAFC',
                    fontSize: '11px',
                    direction: 'rtl',
                    textAlign: 'right'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
            {departmentPieData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }}></span>
                <span className="text-slate-600 dark:text-slate-300 truncate">{d.name}</span>
                <strong className="font-mono text-slate-900 dark:text-white ml-auto">({d.value})</strong>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Staff Leaderboard & Detailed Productivity Table */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        
        {/* Table Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث باسم الموظف، الدور، أو القسم..."
              className="w-full h-9 pr-9 pl-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-right"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">تصفية القسم:</span>
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="h-8.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none text-right"
            >
              <option value="all">-- كافة الأقسام ({users.length}) --</option>
              <option value="reception">قسم الاستعلامات</option>
              <option value="admin">قسم الإدارة والمعاملات</option>
              <option value="interviews_officer">قسم المقابلات</option>
              <option value="audit">قسم الرقابة والتدقيق</option>
              <option value="organization">قسم التنظيم والجماهير</option>
              <option value="machine">قسم المكنة والطباعة</option>
            </select>
          </div>
        </div>

        {/* Detailed Responsive Table - Hidden on very small screens, visible on md+ */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3">المرتبة</th>
                <th className="p-3">اسم الموظف</th>
                <th className="p-3">الدور والصفة</th>
                <th className="p-3">القسم المعتمد</th>
                <th className="p-3 text-center">المعاملات المنجزة</th>
                <th className="p-3 text-center">المراجعين المسجلين</th>
                <th className="p-3 text-center">المقابلات</th>
                <th className="p-3 text-center">حركات الرقابة</th>
                <th className="p-3 text-center">إجمالي النشاط</th>
                <th className="p-3">آخر حركة</th>
                <th className="p-3 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400 text-xs">
                    لا يوجد موظفون مطابقون للبحث.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, index) => (
                  <tr key={emp.userId} className="hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-500">
                      {index === 0 ? (
                        <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-2xs">
                          🥇 1
                        </span>
                      ) : index === 1 ? (
                        <span className="w-6 h-6 rounded-full bg-slate-300 text-slate-900 flex items-center justify-center font-black text-xs shadow-2xs">
                          🥈 2
                        </span>
                      ) : index === 2 ? (
                        <span className="w-6 h-6 rounded-full bg-amber-700 text-amber-100 flex items-center justify-center font-black text-xs shadow-2xs">
                          🥉 3
                        </span>
                      ) : (
                        `#${index + 1}`
                      )}
                    </td>

                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-xs shrink-0 border border-slate-200 dark:border-slate-700">
                          {emp.fullName.slice(0, 1)}
                        </div>
                        <div>
                          <span>{emp.fullName}</span>
                          <span className="block text-[10px] text-slate-400 font-mono font-normal">@{emp.username}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        {emp.roleArabic}
                      </span>
                    </td>

                    <td className="p-3 text-slate-600 dark:text-slate-300">
                      {emp.department}
                    </td>

                    <td className="p-3 text-center">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        {emp.completedRequestsCount}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                        {emp.registeredCitizensCount}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <span className="font-mono font-bold text-teal-600 dark:text-teal-400 text-sm">
                        {emp.scheduledInterviewsCount}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                        {emp.userLogsCount}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <span className="font-mono font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        {emp.totalActionsCount}
                      </span>
                    </td>

                    <td className="p-3 text-[11px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {emp.lastActive}
                    </td>

                    <td className="p-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>نشط</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Adaptive Cards View - visible on small screens */}
        <div className="block md:hidden space-y-3">
          {filteredEmployees.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              لا يوجد موظفون مطابقون للبحث.
            </div>
          ) : (
            filteredEmployees.map((emp, index) => (
              <div 
                key={emp.userId}
                className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 flex items-center justify-center font-bold text-xs">
                      #{index + 1}
                    </span>
                    <div>
                      <h4 className="font-black text-xs text-slate-900 dark:text-white">{emp.fullName}</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{emp.roleArabic} • {emp.department}</p>
                    </div>
                  </div>
                  <span className="font-mono font-black text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                    {emp.totalActionsCount} نشاط
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-center text-[10px]">
                  <div className="bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-400">معاملات منجزة</div>
                    <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">{emp.completedRequestsCount}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-400">مراجعين مسجلين</div>
                    <div className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs mt-0.5">{emp.registeredCitizensCount}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-400">نقاط الأداء</div>
                    <div className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs mt-0.5">{emp.performanceScore}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      </div>
      )}

    </div>
  );
};
