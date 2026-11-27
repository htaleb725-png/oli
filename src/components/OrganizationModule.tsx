import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { OrganizationRecord, OrgTeamMember, Citizen, OfficeRequest } from '../types';
import {
  Users,
  BarChart3,
  Briefcase,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  UserCheck,
  UserPlus,
  Plus,
  Eye,
  Trash2,
  X,
  Phone,
  MapPin,
  Printer,
  ClipboardCheck,
  Award,
  Sparkles,
  FileSpreadsheet,
  Archive,
  RotateCcw
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { OrgFinalEvaluationModal } from './OrgFinalEvaluationModal';
import { OfficeIconTilesGrid, OfficeTileItem } from './OfficeIconTilesGrid';
import { DepartmentAnalyticsDashboard } from './DepartmentAnalyticsDashboard';
import { exportUnifiedSystemExcel } from '../services/unifiedExcelExporter';
import { isCitizenArchivedInSection, isRequestArchivedInSection } from '../utils/archiveHelper';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

const parseTimestamp = (raw?: string): number => {
  const s = String(raw || '').trim();
  if (!s) return 0;
  let t = Date.parse(s);
  if (Number.isNaN(t) && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) {
    t = Date.parse(s.replace(' ', 'T'));
  }
  return Number.isNaN(t) ? 0 : t;
};

export const OrganizationModule: React.FC = () => {
  const {
    citizens,
    requests,
    interviews,
    cheques,
    officialLetters,
    customSections,
    customRecords,
    systemSettings,
    currentUser,
    organizationRecords,
    addOrganizationRecord,
    updateOrganizationRecord,
    setSelectedCitizenForHistory,
    archiveDailyWorkItems,
    restoreDailyWorkItem,
    restoreDailyWorkItems,
    addAuditLog
  } = useApp();

  // Strictly 3 main icons in the Organization Hub:
  // 1) سجل فريق العمل (team_members)
  // 2) إحصائيات (reports)
  // 3) العمل اليومي (daily_work)
  const [activeTab, setActiveTab] = useState<'hub' | 'team_members' | 'reports' | 'daily_work'>('hub');

  // Daily Work (العمل اليومي) search, filter & lightweight pagination (prevents Chrome Crashpad on large datasets)
  const [dailySearch, setDailySearch] = useState('');
  const [dailyFilter, setDailyFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [orgViewMode, setOrgViewMode] = useState<'daily' | 'section_archive'>('daily');
  const [confirmArchiveOrgDaily, setConfirmArchiveOrgDaily] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(40);

  // Team Members (سجل فريق العمل) search & add modal
  const [teamSearch, setTeamSearch] = useState('');
  const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
  const [selectedCitizenForTeam, setSelectedCitizenForTeam] = useState('');
  const [newTeamRole, setNewTeamRole] = useState('مفتاح نهائي');
  const [newTeamNotes, setNewTeamNotes] = useState('');
  const [confirmRemoveTeamId, setConfirmRemoveTeamId] = useState<string | null>(null);

  // Evaluation / Complete Request Modal ("إكمال الطلب")
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  const [evalTargetCitizen, setEvalTargetCitizen] = useState<Citizen | null>(null);
  const [evalTargetRecord, setEvalTargetRecord] = useState<OrganizationRecord | null>(null);
  const [evalTargetRequestId, setEvalTargetRequestId] = useState<string>('');

  // In-app toast banner (zero window.alert / window.confirm)
  const [toastBanner, setToastBanner] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastBanner({ type, text });
    window.setTimeout(() => {
      setToastBanner(prev => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Fast lookup maps
  const orgRecordByCitizenId = useMemo(() => {
    const map = new Map<string, OrganizationRecord>();
    (organizationRecords || []).forEach(rec => {
      if (rec?.Citizen_ID) map.set(rec.Citizen_ID, rec);
    });
    return map;
  }, [organizationRecords]);

  const requestsByCitizenId = useMemo(() => {
    const map = new Map<string, OfficeRequest[]>();
    (requests || []).forEach(r => {
      if (!r?.Citizen_ID) return;
      const list = map.get(r.Citizen_ID) || [];
      list.push(r);
      map.set(r.Citizen_ID, list);
    });
    map.forEach(list => {
      list.sort((a, b) => parseTimestamp(b.UpdatedAt || b.CreatedAt) - parseTimestamp(a.UpdatedAt || a.CreatedAt));
    });
    return map;
  }, [requests]);

  // Daily Work Queue: active citizens with requests or organization presence, sorted newest-first
  // Mirrors DirectorExecutiveModule's exclusion of Excel historical/archived imports for crisp daily workflow
  interface DailyWorkEntry {
    citizen: Citizen;
    latestRequest?: OfficeRequest;
    requestCount: number;
    orgRecord?: OrganizationRecord;
    isCompleted: boolean;
    sortTs: number;
  }

  const { allDailyWorkEntries, archivedOrgWorkEntries } = useMemo(() => {
    const activeEntries: DailyWorkEntry[] = [];
    const archivedEntries: DailyWorkEntry[] = [];
    const seen = new Set<string>();

    const isDeliveredAndReferredToOrg = (r?: OfficeRequest): boolean => {
      if (!r) return false;
      const isDelivered = r.DeliveryStatus === 'مستلم' || r.RequestStatus === 'مستلم';
      const isReferred = Boolean(r.referredToOrganization) || r.CurrentStage === 'مدير التنظيم';
      return isDelivered && isReferred;
    };

    (citizens || []).forEach(cit => {
      if (!cit?.Citizen_ID || seen.has(cit.Citizen_ID)) return;
      seen.add(cit.Citizen_ID);

      const allCitReqs = requestsByCitizenId.get(cit.Citizen_ID) || [];
      const orgRec = orgRecordByCitizenId.get(cit.Citizen_ID);

      // Strict isolation: NEVER auto-show Reception or Director->Admin records in Organization!
      // Only show when a request is explicitly marked "مستلم" AND referred to Organization (or already has an explicit Organization record).
      const referredDeliveredReqs = allCitReqs.filter(isDeliveredAndReferredToOrg);
      if (referredDeliveredReqs.length === 0 && !orgRec) {
        return;
      }

      const relevantReqs = referredDeliveredReqs.length > 0 ? referredDeliveredReqs : allCitReqs;
      const isArchivedInOrg = isCitizenArchivedInSection(cit, 'organization', relevantReqs);
      const citReqs = isArchivedInOrg
        ? relevantReqs
        : relevantReqs.filter(r => !isRequestArchivedInSection(r, 'organization'));

      const latestReq = citReqs[0] || relevantReqs[0];
      const sortTs = Math.max(
        parseTimestamp(latestReq?.ReferredToOrganizationAt || latestReq?.UpdatedAt || latestReq?.CreatedAt),
        parseTimestamp(cit.ReferredToOrganizationAt || cit.UpdatedAt || cit.CreatedAt),
        parseTimestamp(orgRec?.finalEvaluation?.evaluatedAt)
      );

      const entry: DailyWorkEntry = {
        citizen: cit,
        latestRequest: latestReq,
        requestCount: citReqs.length,
        orgRecord: orgRec,
        isCompleted: Boolean(orgRec?.finalEvaluation?.finalResult),
        sortTs
      };

      if (isArchivedInOrg) {
        archivedEntries.push(entry);
      } else {
        activeEntries.push(entry);
      }
    });

    activeEntries.sort((a, b) => b.sortTs - a.sortTs);
    archivedEntries.sort((a, b) => b.sortTs - a.sortTs);
    return { allDailyWorkEntries: activeEntries, archivedOrgWorkEntries: archivedEntries };
  }, [citizens, requestsByCitizenId, orgRecordByCitizenId]);

  const archivedOrgDailyCount = archivedOrgWorkEntries.length;

  const dailyStats = useMemo(() => {
    let pending = 0;
    let completed = 0;
    allDailyWorkEntries.forEach(e => {
      if (e.isCompleted) completed++;
      else pending++;
    });
    return { total: allDailyWorkEntries.length, pending, completed };
  }, [allDailyWorkEntries]);

  const filteredDailyWork = useMemo(() => {
    const q = dailySearch.trim().toLowerCase();
    const sourceList = orgViewMode === 'section_archive' ? archivedOrgWorkEntries : allDailyWorkEntries;
    return sourceList.filter(entry => {
      if (orgViewMode === 'daily') {
        if (dailyFilter === 'pending' && entry.isCompleted) return false;
        if (dailyFilter === 'completed' && !entry.isCompleted) return false;
      }
      if (!q) return true;
      const c = entry.citizen;
      const req = entry.latestRequest;
      return (
        c.FullName?.toLowerCase().includes(q) ||
        c.Citizen_ID?.toLowerCase().includes(q) ||
        c.Phone1?.toLowerCase().includes(q) ||
        c.District?.toLowerCase().includes(q) ||
        c.SubDistrict?.toLowerCase().includes(q) ||
        req?.Entity?.toLowerCase().includes(q) ||
        req?.Request_ID?.toLowerCase().includes(q)
      );
    });
  }, [allDailyWorkEntries, archivedOrgWorkEntries, orgViewMode, dailyFilter, dailySearch]);

  // Team Members derived directly from cloud-synced organizationRecords (no mock localStorage!)
  const teamMembersList = useMemo(() => {
    const citizenMap = new Map<string, Citizen>();
    (citizens || []).forEach(c => {
      if (c?.Citizen_ID) citizenMap.set(c.Citizen_ID, c);
    });

    const list = (organizationRecords || [])
      .filter(r => r && r.isTeamMember)
      .map(r => {
        const cit = citizenMap.get(r.Citizen_ID);
        return {
          record: r,
          citizen: cit,
          fullName: cit?.FullName || r.FullName || 'عضو فريق',
          phone: cit?.Phone1 || r.Phone1 || '',
          district: cit?.District || r.District || '',
          subDistrict: cit?.SubDistrict || r.SubDistrict || '',
          role: r.teamMemberRole || r.finalEvaluation?.case3_teamRole || 'مفتاح نهائي',
          joinedDate: r.finalEvaluation?.evaluatedAt || cit?.CreatedAt || '',
          visitCount: r.finalEvaluation?.case3_officeVisitFrequency || 'متردد على المكتب',
          notes: r.finalEvaluation?.case3_officerNotes || r.Notes || ''
        };
      });

    const q = teamSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      item =>
        item.fullName.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.district.toLowerCase().includes(q) ||
        item.role.toLowerCase().includes(q)
    );
  }, [organizationRecords, citizens, teamSearch]);

  // Statistics for "إحصائيات"
  const evalAnalytics = useMemo(() => {
    const evals = (organizationRecords || []).filter(r => r?.finalEvaluation?.finalResult);
    const fullCount = evals.filter(r => r.finalEvaluation?.finalResult === 'تم اكمال الطلب بالكامل').length;
    const partialCount = evals.filter(r => r.finalEvaluation?.finalResult === 'تم حل الطلب جزئيا').length;
    const followupCount = evals.filter(r => r.finalEvaluation?.finalResult === 'الطلب يحتاج متابعة').length;
    const failedCount = evals.filter(r => r.finalEvaluation?.finalResult === 'لم يتم حل الطلب').length;

    const pieData = [
      { name: 'مكتمل بالكامل', value: fullCount },
      { name: 'حل جزئي', value: partialCount },
      { name: 'يحتاج متابعة', value: followupCount },
      { name: 'لم يتم الحل', value: failedCount }
    ].filter(d => d.value > 0);

    // By District distribution
    const districtMap = new Map<string, { district: string; completed: number; pending: number }>();
    allDailyWorkEntries.forEach(entry => {
      const dist = (entry.citizen.District || 'غير محدد').trim() || 'غير محدد';
      const cur = districtMap.get(dist) || { district: dist, completed: 0, pending: 0 };
      if (entry.isCompleted) cur.completed++;
      else cur.pending++;
      districtMap.set(dist, cur);
    });
    const districtChartData = Array.from(districtMap.values())
      .sort((a, b) => b.completed + b.pending - (a.completed + a.pending))
      .slice(0, 8);

    return {
      totalEvaluated: evals.length,
      fullCount,
      partialCount,
      followupCount,
      failedCount,
      pieData,
      districtChartData
    };
  }, [organizationRecords, allDailyWorkEntries]);

  // Open "إكمال الطلب" modal for any citizen (works whether OrganizationRecord exists or not!)
  const handleOpenCompleteRequest = (entry: DailyWorkEntry) => {
    setEvalTargetCitizen(entry.citizen);
    setEvalTargetRecord(entry.orgRecord || null);
    setEvalTargetRequestId(entry.latestRequest?.Request_ID || '');
    setIsEvalModalOpen(true);
  };

  // Save handler for OrgFinalEvaluationModal
  const handleSaveEvaluation = (updatedRecord: OrganizationRecord, teamMemberToOpen?: OrgTeamMember | null) => {
    const exists = organizationRecords.some(r => r.Citizen_ID === updatedRecord.Citizen_ID);
    if (exists) {
      updateOrganizationRecord(updatedRecord);
    } else {
      addOrganizationRecord(updatedRecord);
    }

    addAuditLog(
      'إكمال وتقييم طلب في قسم التنظيم',
      'قسم التنظيم',
      `تم حفظ النتيجة (${updatedRecord.finalEvaluation?.finalResult || 'مكتمل'}) للمواطن ${updatedRecord.FullName}`
    );

    if (teamMemberToOpen) {
      showToast(`تم حفظ النتيجة وإضافة (${updatedRecord.FullName}) إلى سجل فريق العمل تلقائياً.`, 'success');
    } else {
      showToast(`تم حفظ نتيجة إكمال الطلب للمواطن (${updatedRecord.FullName}) بنجاح.`, 'success');
    }
  };

  // Add a citizen to Team Members (persisted via OrganizationRecord in Firestore + Google Sheets)
  const handleAddTeamMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cit = citizens.find(c => c.Citizen_ID === selectedCitizenForTeam);
    if (!cit) {
      showToast('يرجى اختيار مواطن من القائمة أولاً.', 'error');
      return;
    }

    const existing = orgRecordByCitizenId.get(cit.Citizen_ID);
    const updatedRecord: OrganizationRecord = existing
      ? {
          ...existing,
          isTeamMember: true,
          teamMemberRole: newTeamRole,
          Notes: newTeamNotes.trim() || existing.Notes || ''
        }
      : {
          Citizen_ID: cit.Citizen_ID,
          FullName: cit.FullName,
          District: cit.District || '',
          SubDistrict: cit.SubDistrict || '',
          Phone1: cit.Phone1 || '',
          OrgRating: 'مؤيد',
          InfluenceType: newTeamRole,
          Notes: newTeamNotes.trim(),
          isTeamMember: true,
          teamMemberRole: newTeamRole
        };

    if (existing) {
      updateOrganizationRecord(updatedRecord);
    } else {
      addOrganizationRecord(updatedRecord);
    }

    addAuditLog('إضافة عضو إلى فريق العمل', 'قسم التنظيم', `تم ضم (${cit.FullName}) إلى سجل فريق العمل بصفة (${newTeamRole})`);
    showToast(`تمت إضافة (${cit.FullName}) إلى سجل فريق العمل وحفظه سحابياً.`, 'success');
    setIsAddTeamModalOpen(false);
    setSelectedCitizenForTeam('');
    setNewTeamRole('مفتاح نهائي');
    setNewTeamNotes('');
  };

  // Remove team member status cleanly without deleting citizen history
  const handleConfirmRemoveTeamMember = (record: OrganizationRecord) => {
    updateOrganizationRecord({
      ...record,
      isTeamMember: false,
      teamMemberRole: undefined
    });
    addAuditLog('إزالة عضو من سجل فريق العمل', 'قسم التنظيم', `تمت إزالة (${record.FullName}) من قائمة فريق العمل`);
    showToast(`تمت إزالة (${record.FullName}) من سجل فريق العمل.`, 'info');
    setConfirmRemoveTeamId(null);
  };

  const handleExportOrgExcel = () => {
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
      exporterName: currentUser?.FullName || 'مسؤول قسم التنظيم'
    });
    showToast('تم تصدير بيانات المنظومة وقسم التنظيم إلى ملف Excel بنجاح.', 'success');
  };

  // Strictly 3 Main Icons for Organization Hub
  const organizationHubTiles: OfficeTileItem[] = [
    {
      id: 'org_team_tab',
      title: 'سجل فريق العمل',
      subtitle: 'قاعدة بيانات أعضاء فريق العمل والمفاتيح الانتخابية والمنسقين',
      icon: UserCheck,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
      badge: `${teamMembersList.length} عضو`,
      badgeColor: 'bg-emerald-600 text-white',
      onClick: () => setActiveTab('team_members')
    },
    {
      id: 'org_reports_tab',
      title: 'إحصائيات',
      subtitle: 'مؤشرات الإنجاز والتقييم الجماهيري وتوزيع الطلبات حسب الأقضية',
      icon: BarChart3,
      iconColor: 'text-sky-600 dark:text-sky-400',
      iconBg: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800',
      badge: `${evalAnalytics.totalEvaluated} تقييم`,
      badgeColor: 'bg-sky-600 text-white',
      onClick: () => setActiveTab('reports')
    },
    {
      id: 'org_daily_work_tab',
      title: 'العمل اليومي',
      subtitle: 'قائمة الأسماء اليومية وإكمال الطلبات وعرض بيانات الاستعلامات والإدارة',
      icon: Briefcase,
      iconColor: 'text-purple-600 dark:text-purple-400',
      iconBg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
      badge: `${dailyStats.pending} بانتظار الإكمال`,
      badgeColor: 'bg-purple-600 text-white',
      onClick: () => setActiveTab('daily_work')
    }
  ];

  const getResultBadge = (result?: string) => {
    switch (result) {
      case 'تم اكمال الطلب بالكامل':
        return { label: 'مكتمل بالكامل', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'تم حل الطلب جزئيا':
        return { label: 'حل جزئي', cls: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'الطلب يحتاج متابعة':
        return { label: 'يحتاج متابعة', cls: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'لم يتم حل الطلب':
        return { label: 'لم يتم الحل', cls: 'bg-rose-100 text-rose-800 border-rose-200' };
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5 text-right animate-in fade-in duration-200 font-['Tajawal',sans-serif]" dir="rtl">
      {/* Toast Notification Banner */}
      {toastBanner && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold shadow-sm ${
            toastBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : toastBanner.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : toastBanner.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{toastBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastBanner(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/* HUB VIEW: EXACTLY 3 MAIN ICONS ONLY                              */}
      {/* ================================================================ */}
      {activeTab === 'hub' && (
        <OfficeIconTilesGrid
          title="قسم التنظيم والموقف الجماهيري"
          subtitle="اختر إحدى الأيقونات الرئيسية الثلاث لإدارة فريق العمل أو متابعة الإحصائيات أو العمل اليومي"
          items={organizationHubTiles}
          columns={3}
        />
      )}

      {/* ================================================================ */}
      {/* SUB-VIEW HEADER (SHOWN IN ANY OF THE 3 SUB-SECTIONS)             */}
      {/* ================================================================ */}
      {activeTab !== 'hub' && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('hub')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              → الأيقونات الرئيسية
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                {activeTab === 'daily_work'
                  ? 'العمل اليومي — قسم التنظيم'
                  : activeTab === 'team_members'
                  ? 'سجل فريق العمل'
                  : 'إحصائيات قسم التنظيم'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeTab === 'daily_work'
                  ? 'قائمة الأسماء اليومية — اضغط على (إكمال الطلب) لعرض كافة بيانات الاستعلامات والإدارة وتسجيل النتيجة النهائية'
                  : activeTab === 'team_members'
                  ? 'قائمة أعضاء فريق العمل والمفاتيح الانتخابية المحفوظة سحابياً'
                  : 'التقارير البيانية ومؤشرات إنجاز وتقييم طلبات المراجعين'}
              </p>
            </div>
          </div>

          {/* Clean 3-tab quick switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('daily_work')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'daily_work'
                  ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>العمل اليومي</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('team_members')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'team_members'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>سجل فريق العمل</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'reports'
                  ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>إحصائيات</span>
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 1: العمل اليومي (DIRECTOR-STYLE NAME BARS + إكمال الطلب)      */}
      {/* ================================================================ */}
      {activeTab === 'daily_work' && (
        <div className="space-y-4">
          {/* Status Filter KPI Cards (Director style) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                setDailyFilter('pending');
                setVisibleLimit(40);
              }}
              className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                dailyFilter === 'pending'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/30 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              <div>
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300">بانتظار إكمال الطلب</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">{dailyStats.pending}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setDailyFilter('completed');
                setVisibleLimit(40);
              }}
              className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                dailyFilter === 'completed'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 ring-2 ring-emerald-400/30 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              <div>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">تم إكمال الطلب</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">{dailyStats.completed}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setDailyFilter('all');
                setVisibleLimit(40);
              }}
              className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                dailyFilter === 'all'
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 ring-2 ring-indigo-400/30 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              <div>
                <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">جميع الأسماء</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">{dailyStats.total}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </button>
          </div>

          {/* Search Bar & Non-Destructive Archive Controls */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 flex-wrap">
            <div className="relative w-full sm:w-96">
              <input
                type="text"
                value={dailySearch}
                onChange={e => setDailySearch(e.target.value)}
                placeholder="بحث بالاسم، رقم الهاتف، القضاء، أو رقم الطلب..."
                className="w-full h-10 pr-9 pl-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle Section Archive View for Organization */}
              <button
                type="button"
                onClick={() => {
                  setOrgViewMode(prev => (prev === 'daily' ? 'section_archive' : 'daily'));
                  setConfirmArchiveOrgDaily(false);
                  setVisibleLimit(40);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 border cursor-pointer transition-all active:scale-95 ${
                  orgViewMode === 'section_archive'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700'
                }`}
                title="عرض السجلات المؤرشفة في قسم التنظيم فقط مع إمكانية إرجاعها للعمل اليومي"
              >
                {orgViewMode === 'section_archive' ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>العودة للعمل اليومي ({allDailyWorkEntries.length})</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>عرض المؤرشف / أرشيف قسم التنظيم ({archivedOrgDailyCount.toLocaleString()})</span>
                  </>
                )}
              </button>

              {orgViewMode === 'daily' && allDailyWorkEntries.length > 0 && (
                confirmArchiveOrgDaily ? (
                  <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 px-2.5 py-1.5 rounded-xl text-[11px] flex-wrap">
                    <span className="font-bold text-emerald-900 dark:text-emerald-200">
                      أرشفة في قسم التنظيم فقط؟
                    </span>
                    {dailyStats.completed > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const completedIds = allDailyWorkEntries
                            .filter(e => e.isCompleted)
                            .map(e => e.citizen.Citizen_ID);
                          const res = archiveDailyWorkItems({
                            citizenIds: completedIds,
                            sectionKey: 'organization',
                            reason: 'أرشفة مستقلة في قسم التنظيم للمكتمل (دون التأثير على بقية الأقسام)'
                          });
                          setConfirmArchiveOrgDaily(false);
                          showToast(`✓ تمت أرشفة (${res.archivedCitizens}) سجل في أرشيف قسم التنظيم فقط دون التأثير على بقية الأقسام.`);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-black cursor-pointer"
                      >
                        المكتمل ({dailyStats.completed})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const visibleIds = filteredDailyWork.map(e => e.citizen.Citizen_ID);
                        const res = archiveDailyWorkItems({
                          citizenIds: visibleIds,
                          sectionKey: 'organization',
                          reason: 'أرشفة مستقلة في قسم التنظيم للسجلات المعروضة (دون التأثير على بقية الأقسام)'
                        });
                        setConfirmArchiveOrgDaily(false);
                        showToast(`✓ تمت أرشفة (${res.archivedCitizens}) سجل في أرشيف قسم التنظيم فقط دون التأثير على بقية الأقسام.`);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black cursor-pointer"
                    >
                      المعروض ({filteredDailyWork.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmArchiveOrgDaily(false)}
                      className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmArchiveOrgDaily(true)}
                    className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 cursor-pointer"
                    title="أرشفة مستقلة في قسم التنظيم فقط (لا يؤثر على بقية الأقسام)"
                  >
                    <Archive className="w-3.5 h-3.5 text-amber-600" />
                    <span>أرشفة (إخراج من العمل اليومي)</span>
                  </button>
                )
              )}

              {orgViewMode === 'section_archive' && filteredDailyWork.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const res = restoreDailyWorkItems({
                      citizenIds: filteredDailyWork.map(e => e.citizen.Citizen_ID),
                      sectionKey: 'organization'
                    });
                    showToast(`✓ تم إرجاع (${res.restoredCitizens}) سجل إلى العمل اليومي لقسم التنظيم.`);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إرجاع الكل للعمل اليومي ({filteredDailyWork.length})</span>
                </button>
              )}

              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                المعروض: <span className="font-mono text-slate-800 dark:text-slate-200">{filteredDailyWork.length}</span> اسم
              </div>
            </div>
          </div>

          {/* Clean Director-Style Horizontal Name Bars (Name + Action Buttons ONLY) */}
          <div className="space-y-2.5">
            {filteredDailyWork.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                  {dailyFilter === 'pending'
                    ? 'لا توجد أسماء بانتظار إكمال الطلب حالياً.'
                    : 'لا توجد نتائج مطابقة للبحث الحالي.'}
                </h4>
                {dailyFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setDailyFilter('all')}
                    className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                  >
                    عرض جميع الأسماء
                  </button>
                )}
              </div>
            ) : (
              <>
                {filteredDailyWork.slice(0, visibleLimit).map((entry, idx) => {
                  const resultBadge = getResultBadge(entry.orgRecord?.finalEvaluation?.finalResult);
                  return (
                    <div
                      key={entry.citizen.Citizen_ID}
                      className={`px-4 py-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        entry.isCompleted
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/70'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-300 shadow-2xs'
                      }`}
                    >
                      {/* Right: Clean Citizen Name Only (+ minimal status tag if evaluated) */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex flex-wrap items-center gap-2">
                          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                            {entry.citizen.FullName}
                          </h3>
                          {resultBadge && (
                            <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold ${resultBadge.cls}`}>
                              {resultBadge.label}
                            </span>
                          )}
                          {entry.orgRecord?.isTeamMember && (
                            <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 border border-purple-200 text-[11px] font-bold">
                              عضو فريق عمل
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Left: Dedicated Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenCompleteRequest(entry)}
                          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                            entry.isCompleted
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          <ClipboardCheck className="w-4 h-4" />
                          <span>{entry.isCompleted ? 'تعديل إكمال الطلب' : 'إكمال الطلب'}</span>
                        </button>

                        {orgViewMode === 'section_archive' ? (
                          <button
                            type="button"
                            onClick={() => {
                              restoreDailyWorkItem(entry.citizen.Citizen_ID, undefined, 'organization');
                              showToast(`✓ تم إرجاع (${entry.citizen.FullName}) إلى العمل اليومي لقسم التنظيم.`);
                            }}
                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                            title="إرجاع السجل من أرشيف قسم التنظيم إلى العمل اليومي"
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>إرجاع للعمل اليومي</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              archiveDailyWorkItems({
                                citizenIds: [entry.citizen.Citizen_ID],
                                sectionKey: 'organization',
                                reason: 'أرشفة مستقلة فردية في قسم التنظيم (محفوظ بالكامل ولا يؤثر على بقية الأقسام)'
                              });
                              showToast(`✓ تمت أرشفة (${entry.citizen.FullName}) في أرشيف قسم التنظيم فقط دون التأثير على بقية الأقسام.`);
                            }}
                            className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="أرشفة مستقلة في قسم التنظيم فقط (يبقى محفوظاً ومشاهداً في بقية الأقسام)"
                          >
                            <Archive className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <span>أرشفة</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedCitizenForHistory(entry.citizen)}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="عرض السجل الكامل للمراجع"
                        >
                          <Eye className="w-4 h-4" />
                          <span>السجل</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredDailyWork.length > visibleLimit && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleLimit(prev => prev + 40)}
                      className="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer shadow-2xs"
                    >
                      عرض المزيد ({filteredDailyWork.length - visibleLimit} اسم متبقي)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 2: سجل فريق العمل (CLOUD-SYNCED TEAM MEMBERS)                */}
      {/* ================================================================ */}
      {activeTab === 'team_members' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-96">
              <input
                type="text"
                value={teamSearch}
                onChange={e => setTeamSearch(e.target.value)}
                placeholder="بحث في سجل فريق العمل بالاسم، الهاتف، القضاء، أو الدور..."
                className="w-full h-10 pr-9 pl-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            </div>

            <button
              type="button"
              onClick={() => setIsAddTeamModalOpen(true)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة عضو إلى فريق العمل</span>
            </button>
          </div>

          {teamMembersList.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mx-auto">
                <Users className="w-7 h-7" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                لا يوجد أعضاء مسجلون في سجل فريق العمل حالياً
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                يمكنك إضافة عضو جديد مباشرة من الزر أعلاه، أو عند اختيار انضمام المواطن للفريق داخل شاشة (إكمال الطلب) في العمل اليومي.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {teamMembersList.map(item => (
                <div
                  key={item.record.Citizen_ID}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{item.fullName}</h4>
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                          <Award className="w-3 h-3" />
                          {item.role}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">{item.record.Citizen_ID}</span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-mono font-bold">{item.phone || 'غير مسجل'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>{[item.district, item.subDistrict].filter(Boolean).join(' — ') || 'غير محدد'}</span>
                      </div>
                      {item.notes && (
                        <p className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/70 p-2 rounded-lg border border-slate-100 dark:border-slate-700 leading-relaxed">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      {item.citizen && (
                        <button
                          type="button"
                          onClick={() => {
                            const reqs = requestsByCitizenId.get(item.citizen!.Citizen_ID) || [];
                            setEvalTargetCitizen(item.citizen!);
                            setEvalTargetRecord(item.record);
                            setEvalTargetRequestId(reqs[0]?.Request_ID || '');
                            setIsEvalModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] cursor-pointer"
                        >
                          إكمال / تقييم
                        </button>
                      )}
                      {item.citizen && (
                        <button
                          type="button"
                          onClick={() => setSelectedCitizenForHistory(item.citizen!)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                        >
                          السجل
                        </button>
                      )}
                    </div>

                    {confirmRemoveTeamId === item.record.Citizen_ID ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleConfirmRemoveTeamMember(item.record)}
                          className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                        >
                          تأكيد الإزالة
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveTeamId(null)}
                          className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveTeamId(item.record.Citizen_ID)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="إزالة من سجل فريق العمل"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 3: إحصائيات (ANALYTICS & REPORTS)                            */}
      {/* ================================================================ */}
      {activeTab === 'reports' && (
        <div className="space-y-5">
          {/* Action Strip */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleExportOrgExcel}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تصدير Excel شامل</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير</span>
            </button>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700">مكتمل بالكامل</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">{evalAnalytics.fullCount}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700">حل جزئي</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">{evalAnalytics.partialCount}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700">يحتاج متابعة</span>
                <AlertCircle className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">{evalAnalytics.followupCount}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-700">لم يتم الحل</span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">{evalAnalytics.failedCount}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
                توزيع نتائج إكمال الطلبات
              </h4>
              {evalAnalytics.pieData.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                  لا توجد تقييمات مسجلة بعد لعرض الرسم البياني
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={evalAnalytics.pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={82}
                        label
                      >
                        {evalAnalytics.pieData.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
                توزيع العمل اليومي حسب القضاء
              </h4>
              {evalAnalytics.districtChartData.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                  لا توجد بيانات كافية لعرض توزيع الأقضية
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={evalAnalytics.districtChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="district" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="completed" name="تم إكمال الطلب" fill="#10b981" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="pending" name="بانتظار الإكمال" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Unified Department Analytics */}
          <DepartmentAnalyticsDashboard department="organization" />
        </div>
      )}

      {/* ================================================================ */}
      {/* MODAL 1: إكمال الطلب (OrgFinalEvaluationModal with Reception+Admin Dossier) */}
      {/* ================================================================ */}
      <OrgFinalEvaluationModal
        isOpen={isEvalModalOpen}
        onClose={() => {
          setIsEvalModalOpen(false);
          setEvalTargetCitizen(null);
          setEvalTargetRecord(null);
          setEvalTargetRequestId('');
        }}
        citizen={evalTargetCitizen}
        initialRecord={evalTargetRecord}
        initialRequestId={evalTargetRequestId}
        requests={requests}
        citizens={citizens}
        onSave={handleSaveEvaluation}
      />

      {/* ================================================================ */}
      {/* MODAL 2: إضافة عضو جديد إلى سجل فريق العمل                      */}
      {/* ================================================================ */}
      {isAddTeamModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-900">إضافة عضو جديد إلى سجل فريق العمل</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTeamModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTeamMemberSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اختر المواطن *</label>
                <select
                  value={selectedCitizenForTeam}
                  onChange={e => setSelectedCitizenForTeam(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- اختر من سجل المواطنين --</option>
                  {citizens.map(c => (
                    <option key={c.Citizen_ID} value={c.Citizen_ID}>
                      {c.FullName} — {c.District || 'ذي قار'} ({c.Phone1 || c.Citizen_ID})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الدور / الصفة التنظيمية *</label>
                <select
                  value={newTeamRole}
                  onChange={e => setNewTeamRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="مفتاح نهائي">مفتاح نهائي</option>
                  <option value="منسق منطقة / حي">منسق منطقة / حي</option>
                  <option value="عضو فريق مبادرات شبابية">عضو فريق مبادرات شبابية</option>
                  <option value="كادر تنظيمي عام">كادر تنظيمي عام</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات تنظيمية</label>
                <textarea
                  value={newTeamNotes}
                  onChange={e => setNewTeamNotes(e.target.value)}
                  rows={2}
                  placeholder="تفاصيل المنطقة أو المهام المكلف بها العضو..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddTeamModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>حفظ في سجل فريق العمل</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
