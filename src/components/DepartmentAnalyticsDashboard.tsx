import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Users,
  FolderKanban,
  Handshake,
  FileText,
  Layers,
  HeartHandshake,
  PackageCheck,
  PackageX,
  Building2,
  MapPin,
  Coins
} from 'lucide-react';
import { SOCIAL_CARE_LEGACY_CUSTOM_ID } from '../utils/permissions';
import { parseExcelDateValue } from '../utils/outgoingNumberHelper';
import { getLocalTodayIsoDate, extractLocalDateYMD } from '../utils/archiveHelper';
import { cleanReferrerLabel, normalizeReferrerGroupKey } from '../utils/referrerHelper';

export type AnalyticsDepartmentKey =
  | 'executive_all'
  | 'reception'
  | 'admin'
  | 'interviews'
  | 'organization'
  | 'social_care'
  | 'custom';

interface DepartmentAnalyticsDashboardProps {
  department: AnalyticsDepartmentKey;
  customSectionId?: string;
  customSectionTitle?: string;
  compact?: boolean;
}

type TimeWindow = 'all' | 'today' | 'week' | 'month';

const CHART_COLORS = ['#0f766e', '#2563eb', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4f46e5', '#059669'];

function extractIsoDay(raw?: string): string {
  if (!raw) return '';
  const local = extractLocalDateYMD(raw);
  if (local) return local;
  const parsed = parseExcelDateValue(raw);
  const match = String(parsed || raw).trim().match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function isWithinWindow(rawDate: string | undefined, win: TimeWindow, todayIso: string): boolean {
  if (win === 'all') return true;
  const day = extractIsoDay(rawDate);
  if (!day) return false;
  if (win === 'today') return day === todayIso;
  const itemMs = Date.parse(`${day}T00:00:00`);
  const nowMs = Date.parse(`${todayIso}T00:00:00`);
  if (isNaN(itemMs) || isNaN(nowMs)) return false;
  const diffDays = (nowMs - itemMs) / 86_400_000;
  if (win === 'week') return diffDays >= 0 && diffDays <= 7;
  if (win === 'month') return diffDays >= 0 && diffDays <= 30;
  return true;
}

function buildDailySeries(dates: (string | undefined)[], daysCount = 10): Array<{ day: string; العدد: number }> {
  const counts = new Map<string, number>();
  const now = new Date();
  const labels: string[] = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    labels.push(iso);
    counts.set(iso, 0);
  }
  for (const d of dates) {
    const iso = extractIsoDay(d);
    if (iso && counts.has(iso)) {
      counts.set(iso, (counts.get(iso) || 0) + 1);
    }
  }
  return labels.map((iso) => ({
    day: iso.slice(5), // MM-DD
    العدد: counts.get(iso) || 0
  }));
}

function topNMap(items: string[], max = 6): Array<{ name: string; العدد: number }> {
  const map = new Map<string, number>();
  for (const raw of items) {
    const clean = (raw || 'غير محدد').trim() || 'غير محدد';
    map.set(clean, (map.get(clean) || 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([name, العدد]) => ({
      name: name.length > 26 ? `${name.slice(0, 26)}…` : name,
      العدد
    }));
}

export const DepartmentAnalyticsDashboard: React.FC<DepartmentAnalyticsDashboardProps> = ({
  department,
  customSectionId,
  customSectionTitle,
  compact = false
}) => {
  const {
    citizens,
    requests,
    interviews,
    officialLetters,
    organizationRecords,
    cheques,
    customSections,
    customRecords
  } = useApp();

  const [timeWindow, setTimeWindow] = useState<TimeWindow>('all');
  const [execDrilldown, setExecDrilldown] = useState<AnalyticsDepartmentKey>('executive_all');

  const todayIso = useMemo(() => getLocalTodayIsoDate(), []);
  const activeDept: AnalyticsDepartmentKey =
    department === 'executive_all' ? execDrilldown : department;

  // Filtered datasets by selected time window
  const scoped = useMemo(() => {
    const cits = (citizens || []).filter((c) => c && isWithinWindow(c.CreatedAt, timeWindow, todayIso));
    const reqs = (requests || []).filter((r) => r && isWithinWindow(r.OutgoingDate || r.CreatedAt, timeWindow, todayIso));
    const ints = (interviews || []).filter((i) => i && isWithinWindow(i.InterviewDate || i.CreatedAt, timeWindow, todayIso));
    const lets = (officialLetters || []).filter((l) => l && isWithinWindow(l.LetterDate, timeWindow, todayIso));
    const orgs = (organizationRecords || []).filter((o) => o && isWithinWindow(o.UpdatedAt, timeWindow, todayIso));
    const chqs = (cheques || []).filter((c) => c && isWithinWindow(c.IssueDate || c.CreatedAt, timeWindow, todayIso));
    const cust = (customRecords || []).filter((r) => r && isWithinWindow(r.createdAt, timeWindow, todayIso));
    return { cits, reqs, ints, lets, orgs, chqs, cust };
  }, [citizens, requests, interviews, officialLetters, organizationRecords, cheques, customRecords, timeWindow, todayIso]);

  const socialCareRecords = useMemo(() => {
    const fromCustom = scoped.cust.filter(
      (r) => r.sectionId === SOCIAL_CARE_LEGACY_CUSTOM_ID || r.sectionId.startsWith(`${SOCIAL_CARE_LEGACY_CUSTOM_ID}__`)
    );
    const fromReqs = scoped.reqs.filter(
      (r) =>
        r.TargetDepartment === 'social_care' ||
        (r.Entity || '').includes('العمل والشؤون') ||
        (r.Entity || '').includes('الرعاية') ||
        (r.Entity || '').includes('الحماية')
    );
    return { fromCustom, fromReqs, total: fromCustom.length + fromReqs.length };
  }, [scoped]);

  const customSectionData = useMemo(() => {
    if (!customSectionId) return [];
    return scoped.cust.filter(
      (r) => r.sectionId === customSectionId || r.sectionId.startsWith(`${customSectionId}__`)
    );
  }, [scoped.cust, customSectionId]);

  // Executive Master All-Departments comparison bar data
  const executiveComparisonData = useMemo(() => {
    return [
      { القسم: 'الاستعلامات', السجلات: scoped.cits.length },
      { القسم: 'الإدارة والمعاملات', السجلات: scoped.reqs.length },
      { القسم: 'الرعاية الاجتماعية', السجلات: socialCareRecords.total },
      { القسم: 'المقابلات', السجلات: scoped.ints.length },
      { القسم: 'التنظيم', السجلات: scoped.orgs.length },
      { القسم: 'الصكوك', السجلات: scoped.chqs.length }
    ];
  }, [scoped, socialCareRecords]);

  // Live grouped Referrers distribution (cleaned & variant-merged directly from Firestore requests/citizens)
  const topReferrersData = useMemo(() => {
    const citizenById = new Map<string, string>();
    (citizens || []).forEach(c => {
      if (c?.Citizen_ID) {
        const clean = cleanReferrerLabel(c.ReferralSource);
        if (clean) citizenById.set(c.Citizen_ID, clean);
      }
    });
    const groups = new Map<string, { label: string; count: number }>();
    scoped.reqs.forEach(r => {
      const clean = cleanReferrerLabel(r.ReferralSource) || citizenById.get(r.Citizen_ID) || '';
      if (!clean) return;
      const key = normalizeReferrerGroupKey(clean) || clean;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(key, { label: clean, count: 1 });
      }
    });
    return Array.from(groups.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 7)
      .map(item => ({
        name: item.label.length > 26 ? `${item.label.slice(0, 26)}…` : item.label,
        العدد: item.count
      }));
  }, [scoped.reqs, citizens]);

  // Build view model dynamically per department
  const view = useMemo(() => {
    const completedReqs = scoped.reqs.filter((r) => r.ProcessingStatus === 'منجز' || Boolean(r.OutgoingNumber));
    const rejectedReqs = scoped.reqs.filter((r) => r.ProcessingStatus === 'مرفوض');
    const pendingReqs = scoped.reqs.filter(
      (r) => !(r.ProcessingStatus === 'منجز' || Boolean(r.OutgoingNumber)) && r.ProcessingStatus !== 'مرفوض'
    );
    const deliveredReqs = scoped.reqs.filter((r) => r.DeliveryStatus === 'مستلم' || r.RequestStatus === 'مستلم');
    const undeliveredReqs = scoped.reqs.filter(
      (r) => !(r.DeliveryStatus === 'مستلم' || r.RequestStatus === 'مستلم')
    );
    const completedUndeliveredReqs = completedReqs.filter(
      (r) => !(r.DeliveryStatus === 'مستلم' || r.RequestStatus === 'مستلم')
    );

    if (activeDept === 'reception') {
      const male = scoped.cits.filter((c) => c.Gender === 'ذكر').length;
      const female = scoped.cits.filter((c) => c.Gender === 'أنثى').length;
      const blocked = scoped.cits.filter((c) => c.IsBlocked).length;
      const todayIntake = (citizens || []).filter((c) => extractIsoDay(c.CreatedAt) === todayIso).length;

      return {
        title: 'لوحة إحصائيات قسم الاستعلامات واستقبال المراجعين',
        subtitle: 'متابعة حركة تسجيل المواطنين حسب القضاء والمنطقة السكنية والتوزيع الديموغرافي',
        kpis: [
          { label: 'إجمالي المراجعين', value: scoped.cits.length, note: `تسجيل اليوم: ${todayIntake}`, icon: Users, accent: 'text-blue-600 dark:text-blue-400' },
          { label: 'المراجعون (ذكور)', value: male, note: scoped.cits.length ? `${Math.round((male / scoped.cits.length) * 100)}%` : '0%', icon: Users, accent: 'text-teal-600 dark:text-teal-400' },
          { label: 'المراجعات (إناث)', value: female, note: scoped.cits.length ? `${Math.round((female / scoped.cits.length) * 100)}%` : '0%', icon: Users, accent: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'الأقضية المغطاة', value: new Set(scoped.cits.map((c) => c.District).filter(Boolean)).size, note: blocked > 0 ? `محظور: ${blocked}` : 'تغطية شاملة', icon: MapPin, accent: 'text-amber-600 dark:text-amber-400' }
        ],
        trendTitle: 'حركة تسجيل المراجعين (آخر 10 أيام)',
        trendData: buildDailySeries(scoped.cits.map((c) => c.CreatedAt)),
        barTitle: 'توزيع المراجعين حسب الأقضية والمناطق',
        barData: topNMap(scoped.cits.map((c) => c.District || 'غير محدد'), 7),
        pieTitle: 'التوزيع حسب الجنس والتقييم',
        pieData: [
          { name: 'ذكور', value: male },
          { name: 'إناث', value: female }
        ].filter((d) => d.value > 0)
      };
    }

    if (activeDept === 'admin') {
      const rate = scoped.reqs.length ? Math.round((completedReqs.length / scoped.reqs.length) * 100) : 0;
      const deliveryRate = scoped.reqs.length ? Math.round((deliveredReqs.length / scoped.reqs.length) * 100) : 0;
      return {
        title: 'لوحة إحصائيات قسم الإدارة والمعاملات والصادر',
        subtitle: 'مؤشرات حية مباشرة من Firestore — الإنجاز، الاستلام (مستلم / غير مستلم)، الوزارات والمعرّفين',
        kpis: [
          { label: 'إجمالي المعاملات', value: scoped.reqs.length, note: `نسبة الإنجاز: ${rate}%`, icon: FolderKanban, accent: 'text-blue-600 dark:text-blue-400' },
          { label: 'معاملات منجزة وصادرة', value: completedReqs.length, note: `قيد الإجراء: ${pendingReqs.length} · مرفوض: ${rejectedReqs.length}`, icon: CheckCircle2, accent: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'مستلم من المراجع', value: deliveredReqs.length, note: `نسبة الاستلام: ${deliveryRate}%`, icon: PackageCheck, accent: 'text-teal-600 dark:text-teal-400' },
          { label: 'غير مستلم بعد', value: undeliveredReqs.length, note: `منها منجز جاهز للتسليم: ${completedUndeliveredReqs.length}`, icon: PackageX, accent: 'text-amber-600 dark:text-amber-400' }
        ],
        trendTitle: 'معدل إنجاز وإصدار المعاملات (آخر 10 أيام)',
        trendData: buildDailySeries(scoped.reqs.map((r) => r.OutgoingDate || r.CreatedAt)),
        barTitle: 'أكثر الوزارات والدوائر الحكومية مخاطبة',
        barData: topNMap(scoped.reqs.map((r) => r.Entity || 'غير محدد'), 7),
        pieTitle: 'توزيع حالة الاستلام والإنجاز',
        pieData: [
          { name: 'مستلم', value: deliveredReqs.length },
          { name: 'غير مستلم (منجز)', value: completedUndeliveredReqs.length },
          { name: 'قيد المتابعة', value: pendingReqs.length },
          { name: 'مرفوض', value: rejectedReqs.length }
        ].filter((d) => d.value > 0)
      };
    }

    if (activeDept === 'interviews') {
      const done = scoped.ints.filter((i) => i.Status === 'تمت المقابلة').length;
      const scheduled = scoped.ints.filter((i) => i.Status === 'مجدولة').length;
      const converted = scoped.ints.filter((i) => i.ConvertedToRequest).length;
      return {
        title: 'لوحة إحصائيات قسم المقابلات الرسمية',
        subtitle: 'مؤشرات المقابلات المجدولة والمنجزة ونسبة تحويلها إلى معاملات رسمية',
        kpis: [
          { label: 'إجمالي المقابلات', value: scoped.ints.length, note: 'مقابلات مسجلة', icon: Handshake, accent: 'text-blue-600 dark:text-blue-400' },
          { label: 'تمت المقابلة', value: done, note: scoped.ints.length ? `${Math.round((done / scoped.ints.length) * 100)}%` : '0%', icon: CheckCircle2, accent: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'مقابلات مجدولة', value: scheduled, note: 'بانتظار الموعد', icon: Clock, accent: 'text-amber-600 dark:text-amber-400' },
          { label: 'محوّلة إلى معاملة', value: converted, note: 'تمت إحالتها للإدارة', icon: FolderKanban, accent: 'text-teal-600 dark:text-teal-400' }
        ],
        trendTitle: 'حركة المقابلات (آخر 10 أيام)',
        trendData: buildDailySeries(scoped.ints.map((i) => i.InterviewDate || i.CreatedAt)),
        barTitle: 'أكثر الأقضية في طلبات المقابلة',
        barData: topNMap(
          scoped.ints.map((i) => {
            const cit = citizens.find((c) => c.Citizen_ID === i.Citizen_ID);
            return cit?.District || i.Address || 'الناصرية';
          }),
          6
        ),
        pieTitle: 'حالة المقابلات',
        pieData: [
          { name: 'تمت المقابلة', value: done },
          { name: 'مجدولة', value: scheduled },
          { name: 'أخرى / ملغاة', value: Math.max(0, scoped.ints.length - done - scheduled) }
        ].filter((d) => d.value > 0)
      };
    }

    if (activeDept === 'organization') {
      const activeOrg = scoped.orgs.filter((o) => o.OrgRating === 'ممتاز' || o.OrgRating === 'فعال' || o.OrgRating === 'متفاعل').length;
      return {
        title: 'لوحة إحصائيات قسم التنظيم والميدان',
        subtitle: 'متابعة التقييم التنظيمي والتوزيع الجغرافي للمرتكزات والفرق الميدانية',
        kpis: [
          { label: 'السجل التنظيمي', value: scoped.orgs.length, note: 'إجمالي الكوادر والمرتكزات', icon: Users, accent: 'text-blue-600 dark:text-blue-400' },
          { label: 'تقييم فعال / ممتاز', value: activeOrg, note: scoped.orgs.length ? `${Math.round((activeOrg / scoped.orgs.length) * 100)}%` : '0%', icon: CheckCircle2, accent: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'الأقضية المغطاة', value: new Set(scoped.orgs.map((o) => o.District).filter(Boolean)).size, note: 'تغطية ميدانية', icon: MapPin, accent: 'text-amber-600 dark:text-amber-400' },
          { label: 'الصكوك والمساعدات', value: scoped.chqs.length, note: 'مسجلة بالنظام', icon: Coins, accent: 'text-teal-600 dark:text-teal-400' }
        ],
        trendTitle: 'تحديثات السجل التنظيمي (آخر 10 أيام)',
        trendData: buildDailySeries(scoped.orgs.map((o) => o.UpdatedAt)),
        barTitle: 'التوزيع التنظيمي حسب القضاء',
        barData: topNMap(scoped.orgs.map((o) => o.District || 'الناصرية'), 6),
        pieTitle: 'توزيع التقييم التنظيمي',
        pieData: topNMap(scoped.orgs.map((o) => o.OrgRating || 'عادي'), 5).map((x) => ({
          name: x.name,
          value: x.العدد
        }))
      };
    }

    if (activeDept === 'social_care') {
      const deliveredSC = socialCareRecords.fromReqs.filter((r) => r.DeliveryStatus === 'مستلم').length +
        socialCareRecords.fromCustom.filter((r) => r.data?.deliveryStatus === 'مستلم').length;
      const undeliveredSC = Math.max(0, socialCareRecords.total - deliveredSC);
      return {
        title: 'لوحة إحصائيات قسم الرعاية الاجتماعية وشبكة الحماية',
        subtitle: 'متابعة معاملات الرعاية الاجتماعية، حالات الاستلام، والتوزيع حسب المناطق السكنية',
        kpis: [
          { label: 'إجمالي ملفات الرعاية', value: socialCareRecords.total, note: 'مستقل ومفروز بالكامل', icon: HeartHandshake, accent: 'text-rose-600 dark:text-rose-400' },
          { label: 'سجلات القسم المباشرة', value: socialCareRecords.fromCustom.length, note: 'مدخلة أو مستوردة للقسم', icon: Layers, accent: 'text-blue-600 dark:text-blue-400' },
          { label: 'حالات مستلمة', value: deliveredSC, note: socialCareRecords.total ? `${Math.round((deliveredSC / socialCareRecords.total) * 100)}%` : '0%', icon: PackageCheck, accent: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'بانتظار الاستلام', value: undeliveredSC, note: 'غير مستلم بعد', icon: PackageX, accent: 'text-amber-600 dark:text-amber-400' }
        ],
        trendTitle: 'حركة قيود الرعاية الاجتماعية (آخر 10 أيام)',
        trendData: buildDailySeries([
          ...socialCareRecords.fromCustom.map((r) => r.createdAt),
          ...socialCareRecords.fromReqs.map((r) => r.OutgoingDate || r.CreatedAt)
        ]),
        barTitle: 'التوزيع حسب السكن / الجهة',
        barData: topNMap([
          ...socialCareRecords.fromCustom.map((r) => String(r.data?.address || r.data?.district || 'الناصرية')),
          ...socialCareRecords.fromReqs.map((r) => r.Address || 'الناصرية')
        ], 6),
        pieTitle: 'حالة استلام معاملات الرعاية',
        pieData: [
          { name: 'مستلم', value: deliveredSC },
          { name: 'غير مستلم', value: undeliveredSC }
        ].filter((d) => d.value > 0)
      };
    }

    if (activeDept === 'custom') {
      return {
        title: `لوحة إحصائيات ${customSectionTitle || 'القسم المخصص'}`,
        subtitle: 'إحصائيات حية لسجلات القسم ومعدل الإدخال اليومي',
        kpis: [
          { label: 'إجمالي السجلات', value: customSectionData.length, note: 'سجل محفوظ بالقسم', icon: Layers, accent: 'text-blue-600 dark:text-blue-400' },
          { label: 'إدخال اليوم', value: customSectionData.filter((r) => extractIsoDay(r.createdAt) === todayIso).length, note: 'سجل جديد اليوم', icon: Clock, accent: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'الموظفون المساهمون', value: new Set(customSectionData.map((r) => r.createdBy).filter(Boolean)).size, note: 'موظف نشط', icon: Users, accent: 'text-amber-600 dark:text-amber-400' },
          { label: 'سجلات بحالة مستلم', value: customSectionData.filter((r) => r.data?.deliveryStatus === 'مستلم').length, note: 'تم تسليمها', icon: PackageCheck, accent: 'text-teal-600 dark:text-teal-400' }
        ],
        trendTitle: 'حركة الإدخال (آخر 10 أيام)',
        trendData: buildDailySeries(customSectionData.map((r) => r.createdAt)),
        barTitle: 'التوزيع حسب المدخلين',
        barData: topNMap(customSectionData.map((r) => r.createdBy || 'موظف القسم'), 6),
        pieTitle: 'حالة الاستلام في القسم',
        pieData: [
          { name: 'مستلم', value: customSectionData.filter((r) => r.data?.deliveryStatus === 'مستلم').length },
          { name: 'غير مستلم / قيد الإجراء', value: customSectionData.filter((r) => r.data?.deliveryStatus !== 'مستلم').length }
        ].filter((d) => d.value > 0)
      };
    }

    // EXECUTIVE / DEVELOPER MASTER OVERVIEW (All Departments Unified)
    const overallCompletion = scoped.reqs.length ? Math.round((completedReqs.length / scoped.reqs.length) * 100) : 0;
    return {
      title: 'لوحة الإحصائيات الشاملة لجميع أقسام المنظومة (المدير والمطور)',
      subtitle: 'نظرة تنفيذية كاملة على أداء كافة الأقسام، نسب الإنجاز، وحالة الاستلام مع إمكانية استعراض كل قسم بالتفصيل',
      kpis: [
        { label: 'إجمالي المراجعين', value: scoped.cits.length, note: `أقسام مخصصة: ${customSections.length}`, icon: Users, accent: 'text-blue-600 dark:text-blue-400' },
        { label: 'المعاملات والصادر', value: scoped.reqs.length, note: `نسبة الإنجاز: ${overallCompletion}%`, icon: FolderKanban, accent: 'text-emerald-600 dark:text-emerald-400' },
        { label: 'مستلم / غير مستلم', value: `${deliveredReqs.length} / ${undeliveredReqs.length}`, note: 'تتبع تسليم الكتب المنجزة', icon: PackageCheck, accent: 'text-teal-600 dark:text-teal-400' },
        { label: 'المقابلات والكتب', value: scoped.ints.length + scoped.lets.length, note: `مقابلات: ${scoped.ints.length} · كتب: ${scoped.lets.length}`, icon: Handshake, accent: 'text-amber-600 dark:text-amber-400' }
      ],
      trendTitle: 'حجم العمل اليومي الشامل (المراجعين + المعاملات — آخر 10 أيام)',
      trendData: buildDailySeries([
        ...scoped.cits.map((c) => c.CreatedAt),
        ...scoped.reqs.map((r) => r.OutgoingDate || r.CreatedAt)
      ]),
      barTitle: 'مقارنة حجم العمل بين كافة الأقسام',
      barData: executiveComparisonData.map((d) => ({ name: d.القسم, العدد: d.السجلات })),
      pieTitle: 'موقف الإنجاز والاستلام العام',
      pieData: [
        { name: 'مستلم', value: deliveredReqs.length },
        { name: 'غير مستلم (منجز)', value: completedUndeliveredReqs.length },
        { name: 'قيد الإجراء', value: pendingReqs.length },
        { name: 'مرفوض', value: rejectedReqs.length },
        { name: 'الرعاية الاجتماعية', value: socialCareRecords.fromCustom.length }
      ].filter((d) => d.value > 0)
    };
  }, [activeDept, scoped, citizens, todayIso, socialCareRecords, customSectionData, customSectionTitle, customSections.length, executiveComparisonData]);

  return (
    <section
      className={`rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${
        compact ? 'p-4' : 'p-5'
      } space-y-5 text-right font-['Tajawal',sans-serif]`}
      dir="rtl"
    >
      {/* Top Bar: Title + Time Range Segmented Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-800 text-amber-400 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-snug">
              {view.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{view.subtitle}</p>
          </div>
        </div>

        {/* Interactive Time-Range Segmented Control */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 self-start lg:self-auto shrink-0">
          {(
            [
              { id: 'all', label: 'الكل' },
              { id: 'today', label: 'اليوم' },
              { id: 'week', label: '7 أيام' },
              { id: 'month', label: '30 يوماً' }
            ] as Array<{ id: TimeWindow; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTimeWindow(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                timeWindow === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Executive / Developer All-Departments Drill-Down Switcher */}
      {department === 'executive_all' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            [
              { id: 'executive_all', label: 'نظرة شاملة لجميع الأقسام' },
              { id: 'reception', label: 'الاستعلامات' },
              { id: 'admin', label: 'الإدارة والصادر' },
              { id: 'social_care', label: 'الرعاية الاجتماعية' },
              { id: 'interviews', label: 'المقابلات' },
              { id: 'organization', label: 'التنظيم' }
            ] as Array<{ id: AnalyticsDepartmentKey; label: string }>
          ).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setExecDrilldown(d.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer border ${
                execDrilldown === d.id
                  ? 'bg-slate-900 text-amber-300 border-slate-900 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-500'
                  : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {/* KPI Strip (4 Columns, Single-Elevation, Tabular Numerals) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {view.kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/80 space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold">
                <span className="truncate">{kpi.label}</span>
                <Icon className={`w-4 h-4 shrink-0 ${kpi.accent}`} />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-['Cairo',sans-serif] tabular-nums">
                {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
              </div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                {kpi.note}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Grid: 3-Chart Responsive Analytics Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Chart 1: Area Trend */}
        <div className="lg:col-span-5 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-black text-slate-800 dark:text-slate-200 mb-3">
            {view.trendTitle}
          </div>
          <div className="h-56 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={view.trendData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad_${activeDept}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    direction: 'rtl'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="العدد"
                  stroke="#0f766e"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill={`url(#grad_${activeDept})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Bar Comparison */}
        <div className="lg:col-span-4 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-black text-slate-800 dark:text-slate-200 mb-3">
            {view.barTitle}
          </div>
          {view.barData.length > 0 ? (
            <div className="h-56 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={view.barData}
                  layout="vertical"
                  margin={{ top: 4, right: 14, left: 6, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={105}
                    tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      direction: 'rtl'
                    }}
                  />
                  <Bar dataKey="العدد" radius={[0, 6, 6, 0]} barSize={16}>
                    {view.barData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs text-slate-400">
              لا توجد بيانات كافية لعرض الرسم البياني في هذه الفترة
            </div>
          )}
        </div>

        {/* Chart 3: Donut Status / Delivery Distribution */}
        <div className="lg:col-span-3 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-black text-slate-800 dark:text-slate-200 mb-3">
            {view.pieTitle}
          </div>
          {view.pieData.length > 0 ? (
            <div className="h-56 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={view.pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="46%"
                    innerRadius={42}
                    outerRadius={68}
                    paddingAngle={3}
                  >
                    {view.pieData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      direction: 'rtl'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', direction: 'rtl' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs text-slate-400">
              لا توجد بيانات توزيع حالياً
            </div>
          )}
        </div>
      </div>

      {/* Live Distribution by Referrers (التوزيع حسب المعرّفين — مباشر من Firestore) */}
      {(activeDept === 'executive_all' || activeDept === 'admin') && topReferrersData.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-black text-slate-800 dark:text-slate-200">
              التوزيع حسب المعرّفين والتزكيات (أعلى 7 معرّفين — تحديث لحظي من Firestore)
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              إجمالي المعاملات المفحوصة: {scoped.reqs.length.toLocaleString()}
            </span>
          </div>
          <div className="h-52 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topReferrersData}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    direction: 'rtl'
                  }}
                />
                <Bar dataKey="العدد" radius={[0, 6, 6, 0]} barSize={16}>
                  {topReferrersData.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[(idx + 1) % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
};
