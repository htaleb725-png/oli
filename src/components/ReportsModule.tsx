import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import * as XLSX from 'xlsx';
import { BulkNameOperations } from './BulkNameOperations';
import { DepartmentWorkReportsModal } from './DepartmentWorkReportsModal';
import { OfficeIconTilesGrid } from './OfficeIconTilesGrid';
import { 
  BarChart3, 
  Printer, 
  FileSpreadsheet,
  ClipboardCheck,
  Search,
  Users,
  Handshake,
  FolderKanban,
  UserCheck,
  Download,
  Filter,
  Calendar
} from 'lucide-react';

export const ReportsModule: React.FC = () => {
  const { citizens, requests, interviews, organizationRecords, addAuditLog, currentUser } = useApp();

  // Role and Department Isolation: Developer & Director can access all reports; others can only access their department's reports
  const isSuperUser = ['developer', 'director', 'deputy'].includes(currentUser?.Role || '');
  const userRole = currentUser?.Role || '';
  const userDept = currentUser?.Department || '';

  const isReception = userRole === 'reception' || userRole === 'reception_officer' || userDept.includes('الاستعلامات');
  const isAdmin = userRole === 'admin' || userRole === 'admin_officer' || userDept.includes('الإدارة');
  const isInterviews = userRole === 'interviews_officer' || userDept.includes('المقابلات');
  const isOrganization = userRole === 'organization' || userRole === 'organization_officer' || userDept.includes('التنظيم');

  const departmentDisplayName = useMemo(() => {
    if (isSuperUser) return 'الإدارة العليا والمطور (شامل لكافة الأقسام)';
    if (isReception) return 'قسم الاستعلامات وشؤون المراجعين';
    if (isAdmin) return 'قسم الإدارة ومتابعة المعاملات الحكومية';
    if (isInterviews) return 'قسم مقابلات النائب';
    if (isOrganization) return 'قسم التنظيم والموقف الجماهيري';
    return 'قسم المكتب المعتمد';
  }, [isSuperUser, isReception, isAdmin, isInterviews, isOrganization]);

  // Compute available report tabs strictly by department
  const availableTabs = useMemo(() => {
    if (isSuperUser) {
      return [
        { id: 'requests' as const, label: `تقرير المعاملات الإدارية (${requests.length})`, icon: FolderKanban, deptName: 'قسم الإدارة والمعاملات' },
        { id: 'citizens' as const, label: `سجل المراجعين المركزي (${citizens.length})`, icon: Users, deptName: 'قسم الاستعلامات والمراجعين' },
        { id: 'interviews' as const, label: `تقرير مقابلات النائب (${interviews.length})`, icon: Handshake, deptName: 'قسم مقابلات النائب' },
        { id: 'organization' as const, label: `تقرير الموقف التنظيمي (${organizationRecords.length})`, icon: UserCheck, deptName: 'قسم التنظيم والجماهير' }
      ];
    }
    if (isReception) {
      return [
        { id: 'citizens' as const, label: `سجل وتقارير مراجعي قسم الاستعلامات (${citizens.length})`, icon: Users, deptName: 'قسم الاستعلامات والمراجعين' }
      ];
    }
    if (isAdmin) {
      return [
        { id: 'requests' as const, label: `تقرير المعاملات والكتب الإدارية (${requests.length})`, icon: FolderKanban, deptName: 'قسم الإدارة والمعاملات' }
      ];
    }
    if (isInterviews) {
      return [
        { id: 'interviews' as const, label: `تقرير سجل مقابلات النائب (${interviews.length})`, icon: Handshake, deptName: 'قسم مقابلات النائب' }
      ];
    }
    if (isOrganization) {
      return [
        { id: 'organization' as const, label: `تقرير الموقف التنظيمي والاستبيانات (${organizationRecords.length})`, icon: UserCheck, deptName: 'قسم التنظيم والجماهير' }
      ];
    }
    return [
      { id: 'citizens' as const, label: `سجل المراجعين (${citizens.length})`, icon: Users, deptName: 'قسم الاستعلامات' }
    ];
  }, [isSuperUser, isReception, isAdmin, isInterviews, isOrganization, requests.length, citizens.length, interviews.length, organizationRecords.length]);

  // RBAC for Bulk operations: strictly Admin / Director / Developer
  const canAccessBulkOperations = ['developer', 'director', 'admin', 'admin_officer'].includes(currentUser?.Role || '');

  const [activeModuleTab, setActiveModuleTab] = useState<'reports' | 'bulk'>('reports');
  const [reportType, setReportType] = useState<'requests' | 'citizens' | 'interviews' | 'organization'>(
    isReception ? 'citizens' : isAdmin ? 'requests' : isInterviews ? 'interviews' : isOrganization ? 'organization' : 'requests'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);

  // Synchronize reportType with authorized availableTabs
  React.useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(t => t.id === reportType)) {
      setReportType(availableTabs[0].id);
      setStatusFilter('all');
      setSearchQuery('');
    }
  }, [availableTabs, reportType]);

  // Compute breakdown by entity
  const entityCounts: { [entity: string]: number } = {};
  requests.forEach(r => {
    entityCounts[r.Entity] = (entityCounts[r.Entity] || 0) + 1;
  });

  // Compute breakdown by district
  const districtCounts: { [dist: string]: number } = {};
  citizens.forEach(c => {
    districtCounts[c.District] = (districtCounts[c.District] || 0) + 1;
  });

  // Compute breakdown by status
  const statusCounts: { [status: string]: number } = {};
  requests.forEach(r => {
    statusCounts[r.ProcessingStatus] = (statusCounts[r.ProcessingStatus] || 0) + 1;
  });

  // Filtered lists for each report tab
  const filteredRequests = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return requests.filter(r => {
      const matchesSearch = !q || (
        r.CitizenName.toLowerCase().includes(q) ||
        r.Request_ID.toLowerCase().includes(q) ||
        (r.CitizenPhone && r.CitizenPhone.includes(q)) ||
        r.Entity.toLowerCase().includes(q) ||
        r.Details.toLowerCase().includes(q)
      );
      const matchesStatus = statusFilter === 'all' || r.ProcessingStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchQuery, statusFilter]);

  const filteredCitizens = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return citizens.filter(c => {
      const matchesSearch = !q || (
        c.FullName.toLowerCase().includes(q) ||
        c.Citizen_ID.toLowerCase().includes(q) ||
        c.Phone1.includes(q) ||
        (c.Phone2 && c.Phone2.includes(q)) ||
        c.District.toLowerCase().includes(q) ||
        c.Job.toLowerCase().includes(q)
      );
      const matchesStatus = statusFilter === 'all' || c.Rating === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [citizens, searchQuery, statusFilter]);

  const filteredInterviews = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return interviews.filter(i => {
      const matchesSearch = !q || (
        i.FullName.toLowerCase().includes(q) ||
        i.Interview_ID.toLowerCase().includes(q) ||
        i.Phone1.includes(q) ||
        i.Subject.toLowerCase().includes(q) ||
        i.Address.toLowerCase().includes(q)
      );
      const matchesStatus = statusFilter === 'all' || i.Status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [interviews, searchQuery, statusFilter]);

  const filteredOrganization = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return organizationRecords.filter(o => {
      const matchesSearch = !q || (
        o.FullName.toLowerCase().includes(q) ||
        o.Citizen_ID.toLowerCase().includes(q) ||
        o.Phone1.includes(q) ||
        o.District.toLowerCase().includes(q) ||
        o.InfluenceType.toLowerCase().includes(q)
      );
      const matchesStatus = statusFilter === 'all' || o.OrgRating === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [organizationRecords, searchQuery, statusFilter]);

  // Excel Export
  const exportToExcel = () => {
    let dataToExport: any[] = [];
    let fileName = '';

    if (reportType === 'requests') {
      dataToExport = filteredRequests.map(r => ({
        'رقم الطلب': r.Request_ID,
        'الرقم التعريفي': r.Citizen_ID,
        'اسم المواطن': r.CitizenName,
        'الهاتف': r.CitizenPhone,
        'الجهة المعنية': r.Entity,
        'المسار الإداري': r.ProcessingStatus,
        'الأولوية': r.Priority,
        'تفاصيل المعاملة': r.Details,
        'توجيه النائب': r.DeputyNotes || '',
        'تاريخ التسجيل': r.CreatedAt,
        'الموظف المسجل': r.CreatedBy
      }));
      fileName = 'تقرير_المعاملات_مكتب_النائب_علا_الناشي.xlsx';
    } else if (reportType === 'citizens') {
      dataToExport = filteredCitizens.map(c => ({
        'الرقم التعريفي': c.Citizen_ID,
        'الاسم الرباعي واللقب': c.FullName,
        'الهاتف 1': c.Phone1,
        'الهاتف 2': c.Phone2 || '',
        'القضاء': c.District,
        'الناحية': c.SubDistrict,
        'المهنة': c.Job,
        'التحصيل': c.Education,
        'التقييم': c.Rating,
        'المعرف': c.ReferralSource || '',
        'تاريخ التسجيل': c.CreatedAt
      }));
      fileName = 'سجل_المراجعين_المركزي.xlsx';
    } else if (reportType === 'interviews') {
      dataToExport = filteredInterviews.map(i => ({
        'رقم المقابلة': i.Interview_ID,
        'الاسم': i.FullName,
        'الموضوع': i.Subject,
        'الهاتف': i.Phone1,
        'السكن': i.Address,
        'التاريخ': i.InterviewDate,
        'الوقت': i.InterviewTime || '',
        'الأهمية': i.Priority,
        'الموقف': i.Status,
        'توجيه النائب': i.DeputyNotes || ''
      }));
      fileName = 'جدول_مقابلات_النائب.xlsx';
    } else {
      dataToExport = filteredOrganization.map(o => ({
        'الرقم التعريفي': o.Citizen_ID,
        'الاسم': o.FullName,
        'القضاء': o.District,
        'الموقف التنظيمي': o.OrgRating,
        'الثقل الاجتماعي': o.InfluenceType,
        'التقييم': o.EvaluationPoints,
        'المركز الانتخابي': o.ElectionCenter || '',
        'المحطة': o.StationNumber || ''
      }));
      fileName = 'سجل_الموقف_التنظيمي_والجماهيري.xlsx';
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'البيانات');
    XLSX.writeFile(wb, fileName);

    addAuditLog(
      'تصدير تقرير Excel',
      'التقارير والإحصائيات',
      `تصدير ملف ${fileName} يحتوي على ${dataToExport.length} سجل`
    );
  };

  const handlePrintReport = () => {
    addAuditLog(
      'طباعة تقرير ورقي',
      'التقارير والإحصائيات',
      `طباعة تقرير ${reportType} لمكتب النائب علا الناشي`
    );
    window.print();
  };

  return (
    <div className="space-y-4 text-right font-['Tajawal',sans-serif]" dir="rtl">

      {/* Main Module Mode Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveModuleTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeModuleTab === 'reports'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>📊 التقارير الإحصائية والجداول الرسمية</span>
          </button>

          {/* Bulk Name Operations - STRICTLY ADMIN & DEVELOPER */}
          {canAccessBulkOperations && (
            <button
              onClick={() => setActiveModuleTab('bulk')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeModuleTab === 'bulk'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>⚡ المعالجة الجماعية وقوائم الأسماء (خاص بالإدارة)</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-500/30 text-[10px] text-white font-mono">1000 اسم</span>
            </button>
          )}
        </div>

        <button
          onClick={() => setIsReportsModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer transition-all active:scale-95"
        >
          <Calendar className="w-4 h-4" />
          <span>منظومة سحب التقارير التفصيلية (يومي / أسبوعي / شهري)</span>
        </button>
      </div>

      {/* When Bulk Mode Active */}
      {activeModuleTab === 'bulk' && canAccessBulkOperations && (
        <BulkNameOperations />
      )}

      {/* When Reports Mode Active */}
      {activeModuleTab === 'reports' && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-pink-600" />
                <h2 className="text-base font-bold text-slate-900">سجل التقارير والإحصائيات وتصدير البيانات</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-200">
                  تصدير فوري Excel / PDF / A4
                </span>
              </div>
              <p className="text-xs text-slate-500">
                استعراض كامل السجلات وتصفيتها، التوزيع الجغرافي للمراجعين، وجداول المقابلات والمعاملات الرسمية.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={exportToExcel}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تصدير ملف Excel (.xlsx)</span>
              </button>

              <button
                onClick={handlePrintReport}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة التقرير الحالي</span>
              </button>
            </div>
          </div>

          {/* 5-Column Desktop Icon Grid for Reports */}
          <OfficeIconTilesGrid
            title="أيقونات تقارير وإحصائيات أقسام المنظومة"
            subtitle="انقر على أي تقرير لاستعراض البيانات المفلترة وتصدير الجداول فورياً"
            columns={5}
            items={[
              {
                id: 'rep_requests',
                title: 'تقرير المعاملات الإدارية',
                subtitle: 'كشوفات طلبات المواطنين والوزارات',
                icon: FolderKanban,
                iconColor: 'text-amber-600 dark:text-amber-400',
                iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
                badge: requests.length,
                badgeColor: 'bg-amber-600 text-white',
                isActive: reportType === 'requests',
                onClick: () => {
                  setReportType('requests');
                  setStatusFilter('all');
                }
              },
              {
                id: 'rep_citizens',
                title: 'سجل المراجعين المركزي',
                subtitle: 'بيانات مراجعي الاستعلامات والمحافظة',
                icon: Users,
                iconColor: 'text-blue-600 dark:text-blue-400',
                iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
                badge: citizens.length,
                badgeColor: 'bg-blue-600 text-white',
                isActive: reportType === 'citizens',
                onClick: () => {
                  setReportType('citizens');
                  setStatusFilter('all');
                }
              },
              {
                id: 'rep_interviews',
                title: 'تقرير مقابلات النائب',
                subtitle: 'جلسات ولقاءات النائب الموثقة',
                icon: Handshake,
                iconColor: 'text-teal-600 dark:text-teal-400',
                iconBg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
                badge: interviews.length,
                badgeColor: 'bg-teal-600 text-white',
                isActive: reportType === 'interviews',
                onClick: () => {
                  setReportType('interviews');
                  setStatusFilter('all');
                }
              },
              {
                id: 'rep_org',
                title: 'تقرير الموقف التنظيمي',
                subtitle: 'تقييمات النتائج والكوادر الجماهيرية',
                icon: UserCheck,
                iconColor: 'text-purple-600 dark:text-purple-400',
                iconBg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
                badge: organizationRecords.length,
                badgeColor: 'bg-purple-600 text-white',
                isActive: reportType === 'organization',
                onClick: () => {
                  setReportType('organization');
                  setStatusFilter('all');
                }
              },
              {
                id: 'rep_export_all',
                title: 'تصدير إكسل الشامل (XLSX)',
                subtitle: 'سحب كشوفات الجداول الحالية فوراً',
                icon: FileSpreadsheet,
                iconColor: 'text-emerald-600 dark:text-emerald-400',
                iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
                onClick: exportToExcel
              }
            ]}
          />

          {/* Department RBAC Access & Protection Banner */}
          {isSuperUser ? (
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-bold text-xs text-white">نطاق التقارير: {departmentDisplayName}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  صلاحية كاملة للإدارة العليا
                </span>
              </div>
              <span className="text-[11px] text-blue-200">
                بإمكانك استعراض وسحب وتصدير كافة تقارير أقسام المكتب (الإدارة، الاستعلامات، المقابلات، والتنظيم).
              </span>
            </div>
          ) : (
            <div className="bg-amber-50/90 text-amber-950 p-3 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="font-bold text-xs text-amber-900">🔒 تقارير مقيدة ومخصصة لـ: {departmentDisplayName}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/60 text-amber-900 border border-amber-300">
                  قسمك المعتمد فقط
                </span>
              </div>
              <span className="text-[11px] text-amber-800 font-medium">
                تم قفل إمكانية سحب وتصدير تقارير الأقسام الأخرى تلقائياً لضمان الخصوصية وسرية المعاملات.
              </span>
            </div>
          )}

          {/* Report Selection Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-1.5">
              {availableTabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setReportType(tab.id as any);
                      setStatusFilter('all');
                      setSearchQuery('');
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      reportType === tab.id
                        ? 'bg-white text-blue-900 shadow-xs border border-blue-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5 text-blue-600" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث في الجدول الحالي..."
                className="w-full pr-8 pl-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* TAB 1: REQUESTS TABLE */}
          {reportType === 'requests' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">
                  جدول المعاملات الإدارية المسجلة ({filteredRequests.length} معاملة)
                </span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-2 py-1 rounded bg-white border border-slate-200 text-xs text-slate-700 outline-none"
                >
                  <option value="all">كافة الحالات</option>
                  <option value="منجز">منجز</option>
                  <option value="قيد التدقيق">قيد التدقيق</option>
                  <option value="متابعة ديوان المحافظة">متابعة ديوان المحافظة</option>
                  <option value="متابعة بغداد والوزارات">متابعة بغداد والوزارات</option>
                  <option value="قيد الإجراء">قيد الإجراء</option>
                  <option value="بانتظار الموافقة">بانتظار الموافقة</option>
                </select>
              </div>

              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="bg-slate-900 text-white sticky top-0 text-[11px]">
                    <tr>
                      <th className="p-2.5 text-center w-8">ت</th>
                      <th className="p-2.5">رقم المعاملة</th>
                      <th className="p-2.5">اسم المواطن</th>
                      <th className="p-2.5">الهاتف</th>
                      <th className="p-2.5">الجهة المعنية</th>
                      <th className="p-2.5">المسار الإداري</th>
                      <th className="p-2.5">الأولوية</th>
                      <th className="p-2.5">تفاصيل وموضوع الطلب</th>
                      <th className="p-2.5">توجيه النائب</th>
                      <th className="p-2.5 text-center">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRequests.map((req, idx) => (
                      <tr key={req.Request_ID} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-2 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-mono font-bold text-blue-700 whitespace-nowrap">{req.Request_ID}</td>
                        <td className="p-2 font-bold text-slate-900">{req.CitizenName}</td>
                        <td className="p-2 font-mono text-slate-600" dir="ltr">{req.CitizenPhone || '-'}</td>
                        <td className="p-2 text-slate-700">{req.Entity}</td>
                        <td className="p-2 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            {req.ProcessingStatus}
                          </span>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            req.Priority === 'خاص جداً' ? 'bg-purple-100 text-purple-800' :
                            req.Priority === 'عاجل' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {req.Priority}
                          </span>
                        </td>
                        <td className="p-2 text-slate-600 max-w-xs truncate">{req.Details}</td>
                        <td className="p-2 text-slate-600 max-w-xs truncate">{req.DeputyNotes || '-'}</td>
                        <td className="p-2 text-center font-mono text-slate-500 whitespace-nowrap">{req.CreatedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: CITIZENS RECORD TABLE (سجل المراجعين المركزي) */}
          {reportType === 'citizens' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">
                  سجل المراجعين المركزي ومواطني محافظة ذي قار ({filteredCitizens.length} مراجع)
                </span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-2 py-1 rounded bg-white border border-slate-200 text-xs text-slate-700 outline-none"
                >
                  <option value="all">كافة التقييمات</option>
                  <option value="مؤيد قوي">مؤيد قوي</option>
                  <option value="لائق">لائق</option>
                  <option value="حالة إنسانية">حالة إنسانية</option>
                  <option value="عائلة شهيد">عائلة شهيد</option>
                  <option value="جريح وطن">جريح وطن</option>
                </select>
              </div>

              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="bg-slate-900 text-white sticky top-0 text-[11px]">
                    <tr>
                      <th className="p-2.5 text-center w-8">ت</th>
                      <th className="p-2.5">الرقم التعريفي</th>
                      <th className="p-2.5">الاسم الكامل واللقب</th>
                      <th className="p-2.5">رقم الهاتف 1</th>
                      <th className="p-2.5">رقم الهاتف 2</th>
                      <th className="p-2.5">القضاء</th>
                      <th className="p-2.5">الناحية</th>
                      <th className="p-2.5">المهنة</th>
                      <th className="p-2.5">التحصيل</th>
                      <th className="p-2.5">التقييم</th>
                      <th className="p-2.5">جهة التزكية / المعرف</th>
                      <th className="p-2.5 text-center">تاريخ التسجيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCitizens.map((c, idx) => (
                      <tr key={c.Citizen_ID} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-2 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-mono font-bold text-emerald-700 whitespace-nowrap">{c.Citizen_ID}</td>
                        <td className="p-2 font-bold text-slate-900">{c.FullName}</td>
                        <td className="p-2 font-mono text-slate-700" dir="ltr">{c.Phone1}</td>
                        <td className="p-2 font-mono text-slate-500" dir="ltr">{c.Phone2 || '-'}</td>
                        <td className="p-2 text-slate-800">{c.District}</td>
                        <td className="p-2 text-slate-600">{c.SubDistrict}</td>
                        <td className="p-2 text-slate-600">{c.Job}</td>
                        <td className="p-2 text-slate-600">{c.Education}</td>
                        <td className="p-2 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {c.Rating || 'لائق'}
                          </span>
                        </td>
                        <td className="p-2 text-slate-700 font-semibold">{c.ReferralSource || 'مباشر بدون معرف'}</td>
                        <td className="p-2 text-center font-mono text-slate-500 whitespace-nowrap">{c.CreatedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: INTERVIEWS REPORT TABLE (تقرير المقابلات) */}
          {reportType === 'interviews' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">
                  تقرير جدول مقابلات النائب المهندسة علا الناشي ({filteredInterviews.length} مقابلة)
                </span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-2 py-1 rounded bg-white border border-slate-200 text-xs text-slate-700 outline-none"
                >
                  <option value="all">كافة الحالات</option>
                  <option value="مجدولة">مجدولة</option>
                  <option value="تمت المقابلة">تمت المقابلة</option>
                  <option value="تمت الإحالة">تمت الإحالة</option>
                  <option value="معتذرة">معتذرة</option>
                </select>
              </div>

              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="bg-slate-900 text-white sticky top-0 text-[11px]">
                    <tr>
                      <th className="p-2.5 text-center w-8">ت</th>
                      <th className="p-2.5">رمز المقابلة</th>
                      <th className="p-2.5">اسم المواطن</th>
                      <th className="p-2.5">موضوع المقابلة</th>
                      <th className="p-2.5">رقم الهاتف</th>
                      <th className="p-2.5">السكن / العنوان</th>
                      <th className="p-2.5 text-center">التاريخ والوقت</th>
                      <th className="p-2.5">الأهمية</th>
                      <th className="p-2.5">الموقف</th>
                      <th className="p-2.5">توجيه النائب</th>
                      <th className="p-2.5">النتيجة والإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInterviews.map((intv, idx) => (
                      <tr key={intv.Interview_ID} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-2 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-mono font-bold text-amber-700 whitespace-nowrap">{intv.Interview_ID}</td>
                        <td className="p-2 font-bold text-slate-900">{intv.FullName}</td>
                        <td className="p-2 font-semibold text-slate-800">{intv.Subject}</td>
                        <td className="p-2 font-mono text-slate-700" dir="ltr">{intv.Phone1}</td>
                        <td className="p-2 text-slate-600">{intv.Address}</td>
                        <td className="p-2 text-center font-mono text-slate-600 whitespace-nowrap">
                          {intv.InterviewDate} ({intv.InterviewTime || '10:30 ص'})
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            intv.Priority === 'خاص جداً' ? 'bg-purple-100 text-purple-800' :
                            intv.Priority === 'عاجل' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {intv.Priority}
                          </span>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {intv.Status}
                          </span>
                        </td>
                        <td className="p-2 text-blue-900 font-semibold">{intv.DeputyNotes || 'إحالة للإدارة'}</td>
                        <td className="p-2 text-slate-600">{intv.Outcome || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: ORGANIZATION REPORT TABLE (الموقف التنظيمي) */}
          {reportType === 'organization' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">
                  تقرير الموقف التنظيمي والانتخابي والجماهيري ({filteredOrganization.length} قيد)
                </span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-2 py-1 rounded bg-white border border-slate-200 text-xs text-slate-700 outline-none"
                >
                  <option value="all">كافة التقييمات</option>
                  <option value="مؤيد">مؤيد</option>
                  <option value="مؤيد قوي">مؤيد قوي</option>
                  <option value="محايد">محايد</option>
                </select>
              </div>

              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="bg-slate-900 text-white sticky top-0 text-[11px]">
                    <tr>
                      <th className="p-2.5 text-center w-8">ت</th>
                      <th className="p-2.5">الرقم التعريفي</th>
                      <th className="p-2.5">اسم المواطن</th>
                      <th className="p-2.5">القضاء</th>
                      <th className="p-2.5">الناحية</th>
                      <th className="p-2.5">الهاتف</th>
                      <th className="p-2.5">الموقف التنظيمي</th>
                      <th className="p-2.5">الثقل الاجتماعي</th>
                      <th className="p-2.5 text-center">النقاط</th>
                      <th className="p-2.5">المركز الانتخابي</th>
                      <th className="p-2.5">المحطة</th>
                      <th className="p-2.5">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrganization.map((org, idx) => (
                      <tr key={org.Org_ID || `${org.Citizen_ID}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-2 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-mono font-bold text-purple-700 whitespace-nowrap">{org.Citizen_ID}</td>
                        <td className="p-2 font-bold text-slate-900">{org.FullName}</td>
                        <td className="p-2 text-slate-800">{org.District}</td>
                        <td className="p-2 text-slate-600">{org.SubDistrict || '-'}</td>
                        <td className="p-2 font-mono text-slate-700" dir="ltr">{org.Phone1}</td>
                        <td className="p-2 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            {org.OrgRating}
                          </span>
                        </td>
                        <td className="p-2 text-slate-800 font-semibold">{org.InfluenceType}</td>
                        <td className="p-2 text-center font-mono font-bold text-blue-600">{org.EvaluationPoints}</td>
                        <td className="p-2 text-slate-600">{org.ElectionCenter || '-'}</td>
                        <td className="p-2 text-slate-600">{org.StationNumber || '-'}</td>
                        <td className="p-2 text-slate-600 max-w-xs truncate">{org.Notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Department-Aware Visual Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* 1. Entity Distribution (Admin & Super Users) */}
            {(isSuperUser || isAdmin) && (
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
                <h4 className="font-bold text-xs text-slate-800 border-r-2 border-blue-600 pr-2">
                  توزيع المعاملات حسب الوزارات والجهات ({requests.length} معاملة)
                </h4>
                <div className="space-y-2">
                  {Object.entries(entityCounts).slice(0, 5).map(([entity, count]) => {
                    const pct = Math.round((count / (requests.length || 1)) * 100) || 0;
                    return (
                      <div key={entity} className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-700">
                          <span className="truncate max-w-[180px]">{entity}</span>
                          <span className="font-mono font-bold text-blue-600">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. District Distribution (Reception & Super Users) */}
            {(isSuperUser || isReception) && (
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
                <h4 className="font-bold text-xs text-slate-800 border-r-2 border-amber-500 pr-2">
                  التوزيع الجغرافي لمراجعي الاستعلامات بأقضية ذي قار ({citizens.length} مراجع)
                </h4>
                <div className="space-y-2">
                  {Object.entries(districtCounts).slice(0, 5).map(([district, count]) => {
                    const pct = Math.round((count / (citizens.length || 1)) * 100) || 0;
                    return (
                      <div key={district} className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-700">
                          <span>{district}</span>
                          <span className="font-mono font-bold text-amber-600">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Processing Status Breakdown (Admin & Super Users) */}
            {(isSuperUser || isAdmin) && (
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
                <h4 className="font-bold text-xs text-slate-800 border-r-2 border-emerald-500 pr-2">
                  مؤشرات الإنجاز والمسار الإداري
                </h4>
                <div className="space-y-2">
                  {Object.entries(statusCounts).map(([status, count]) => {
                    const pct = Math.round((count / (requests.length || 1)) * 100) || 0;
                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-700">
                          <span>{status}</span>
                          <span className="font-mono font-bold text-emerald-600">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Reception Visitors Rating Breakdown (Reception Only) */}
            {isReception && !isSuperUser && (
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
                <h4 className="font-bold text-xs text-slate-800 border-r-2 border-cyan-500 pr-2">
                  تقييمات مراجعي الاستعلامات
                </h4>
                <div className="space-y-2">
                  {['لائق جداً', 'لائق', 'عادي', 'يحتاج متابعة'].map(rating => {
                    const count = citizens.filter(c => c.Rating === rating).length;
                    const pct = Math.round((count / (citizens.length || 1)) * 100) || 0;
                    return (
                      <div key={rating} className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-700">
                          <span>{rating}</span>
                          <span className="font-mono font-bold text-cyan-600">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. Interviews Breakdown (Interviews) */}
            {(isInterviews) && (
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
                <h4 className="font-bold text-xs text-slate-800 border-r-2 border-purple-500 pr-2">
                  موقف مقابلات النائب ({interviews.length} مقابلة)
                </h4>
                <div className="space-y-2">
                  {['تمت المقابلة', 'مجدولة', 'ملغاة', 'مؤجلة'].map(st => {
                    const count = interviews.filter(i => i.Status === st).length;
                    const pct = Math.round((count / (interviews.length || 1)) * 100) || 0;
                    return (
                      <div key={st} className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-700">
                          <span>{st}</span>
                          <span className="font-mono font-bold text-purple-600">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-purple-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. Organization Breakdown (Organization) */}
            {(isOrganization) && (
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
                <h4 className="font-bold text-xs text-slate-800 border-r-2 border-indigo-500 pr-2">
                  الموقف التنظيمي والانتخابي ({organizationRecords.length} قيد)
                </h4>
                <div className="space-y-2">
                  {['مؤيد قوي', 'مؤيد', 'محايد', 'غير محدد'].map(st => {
                    const count = organizationRecords.filter(o => o.OrgRating === st).length;
                    const pct = Math.round((count / (organizationRecords.length || 1)) * 100) || 0;
                    return (
                      <div key={st} className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-700">
                          <span>{st}</span>
                          <span className="font-mono font-bold text-indigo-600">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Reports and Work Export Modal */}
      <DepartmentWorkReportsModal
        isOpen={isReportsModalOpen}
        onClose={() => setIsReportsModalOpen(false)}
        defaultDepartment={
          isReception ? 'reception' :
          isAdmin ? 'admin' :
          isInterviews ? 'interviews' :
          isOrganization ? 'organization' : 'reception'
        }
      />

    </div>
  );
};
