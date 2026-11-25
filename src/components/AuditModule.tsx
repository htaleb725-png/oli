import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import * as XLSX from 'xlsx';
import { 
  ShieldCheck, 
  Search, 
  Plus,
  BarChart2,
  FileSpreadsheet,
  Printer,
  Download,
  Building2,
  Users,
  MapPin,
  Briefcase,
  Layers,
  HeartHandshake,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronLeft,
  Database,
  FileDown,
  ArrowLeft,
  Activity,
  ShieldAlert,
  UserCheck,
  Filter,
  RotateCcw,
  Trash2,
  Edit3,
  KeyRound,
  LogIn,
  Calendar
} from 'lucide-react';
import { OfficeIconTilesGrid, OfficeTileItem } from './OfficeIconTilesGrid';

const escapeHtml = (val: any): string =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const classifyAuditAction = (
  actionRaw: string,
  detailsRaw: string
): 'delete' | 'security' | 'create' | 'update' | 'login' | 'export' | 'other' => {
  const txt = `${actionRaw || ''} ${detailsRaw || ''}`.toLowerCase();
  if (
    txt.includes('حذف') ||
    txt.includes('تصفير') ||
    txt.includes('إزالة') ||
    txt.includes('مسح')
  ) {
    return 'delete';
  }
  if (
    txt.includes('قائمة سوداء') ||
    txt.includes('حظر') ||
    txt.includes('صلاحي') ||
    txt.includes('رمز') ||
    txt.includes('كلمة المرور') ||
    txt.includes('مستخدم') ||
    txt.includes('ضبط المصنع')
  ) {
    return 'security';
  }
  if (txt.includes('دخول') || txt.includes('خروج') || txt.includes('مصادقة')) {
    return 'login';
  }
  if (txt.includes('تصدير') || txt.includes('إكسيل') || txt.includes('طباعة') || txt.includes('استيراد')) {
    return 'export';
  }
  if (txt.includes('تحديث') || txt.includes('تعديل') || txt.includes('إحالة') || txt.includes('ترحيل') || txt.includes('توجيه')) {
    return 'update';
  }
  if (txt.includes('إضافة') || txt.includes('تسجيل') || txt.includes('إنشاء') || txt.includes('إصدار') || txt.includes('جدولة') || txt.includes('رفع')) {
    return 'create';
  }
  return 'other';
};

interface ParliamentaryInquiry {
  id: string;
  inquiryNumber: string;
  targetMinistry: string;
  subject: string;
  details: string;
  status: 'قيد الإجابة' | 'تمت الإجابة' | 'إحالة للنزاهة' | 'جلسة استجواب';
  submissionDate: string;
}

export const AuditModule: React.FC = () => {
  const { 
    auditLogs, 
    citizens, 
    requests, 
    interviews, 
    organizationRecords,
    officialLetters,
    documents,
    users,
    systemSettings,
    addAuditLog,
    exportToExcel 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'hub' | 'followup_stats' | 'audit_trail' | 'inquiries'>('hub');
  const [statsCategory, setStatsCategory] = useState<'clans' | 'districts' | 'jobs' | 'entities'>('clans');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLogUser, setSelectedLogUser] = useState<string>('ALL');
  const [selectedLogDept, setSelectedLogDept] = useState<string>('ALL');
  const [selectedLogCategory, setSelectedLogCategory] = useState<string>('ALL');
  const [selectedLogDate, setSelectedLogDate] = useState<string>('');
  const [visibleLogsLimit, setVisibleLogsLimit] = useState<number>(50);

  const [inquiries, setInquiries] = useState<ParliamentaryInquiry[]>([
    {
      id: 'INQ-2026-01',
      inquiryNumber: 'س/ن/2026/44',
      targetMinistry: 'وزارة الموارد المائية',
      subject: 'سؤال برلماني حول شحة المياه في مناطق أهوار الجبايش',
      details: 'مطالبة بزيادة الإطلاقات المائية وتطهير مجاري الأنهر في جنوب ذي قار استناداً للمادة 61 من الدستور العراقي.',
      status: 'قيد الإجابة',
      submissionDate: '2026-02-20'
    },
    {
      id: 'INQ-2026-02',
      inquiryNumber: 'س/ن/2026/45',
      targetMinistry: 'وزارة الصحة',
      subject: 'طلب تشكيل لجنة تحقيقية بشأن تأخر إنجاز مستشفى الشطرة',
      details: 'متابعة نسب الإنجاز المالي والفني ومحاسبة الشركة المتلكئة في تنفيذ المشروع الخدمي.',
      status: 'إحالة للنزاهة',
      submissionDate: '2026-02-28'
    }
  ]);

  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [newInqNumber, setNewInqNumber] = useState('س/ن/2026/46');
  const [newMinistry, setNewMinistry] = useState('وزارة الكهرباء');
  const [newSubject, setNewSubject] = useState('');
  const [newDetails, setNewDetails] = useState('');

  // Exclude direct instant administrative requests from Oversight/Audit section (القسم الرقابي)
  const auditableRequests = useMemo(
    () => (requests || []).filter(r => r && !r.IsDirectInstantRequest),
    [requests]
  );

  // 1. Clan / Surname Statistics
  const clanStats = useMemo(() => {
    const map = new Map<string, { count: number; requestsCount: number; completedCount: number }>();
    citizens.forEach(c => {
      const clan = c.Surname?.trim() || 'عام / بدون لقب';
      const citReqs = auditableRequests.filter(r => r.Citizen_ID === c.Citizen_ID);
      const completed = citReqs.filter(r => r.ProcessingStatus === 'منجز').length;
      
      const current = map.get(clan) || { count: 0, requestsCount: 0, completedCount: 0 };
      map.set(clan, {
        count: current.count + 1,
        requestsCount: current.requestsCount + citReqs.length,
        completedCount: current.completedCount + completed
      });
    });

    return Array.from(map.entries())
      .map(([clan, data]) => ({
        clan,
        ...data,
        rate: data.requestsCount > 0 ? Math.round((data.completedCount / data.requestsCount) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [citizens, auditableRequests]);

  // 2. District / Regional Statistics
  const districtStats = useMemo(() => {
    const map = new Map<string, { count: number; requestsCount: number; completedCount: number }>();
    citizens.forEach(c => {
      const district = c.District?.trim() || 'غير محدد';
      const citReqs = auditableRequests.filter(r => r.Citizen_ID === c.Citizen_ID);
      const completed = citReqs.filter(r => r.ProcessingStatus === 'منجز').length;

      const current = map.get(district) || { count: 0, requestsCount: 0, completedCount: 0 };
      map.set(district, {
        count: current.count + 1,
        requestsCount: current.requestsCount + citReqs.length,
        completedCount: current.completedCount + completed
      });
    });

    return Array.from(map.entries())
      .map(([district, data]) => ({
        district,
        ...data,
        rate: data.requestsCount > 0 ? Math.round((data.completedCount / data.requestsCount) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [citizens, auditableRequests]);

  // 3. Job / Occupation Statistics
  const jobStats = useMemo(() => {
    const map = new Map<string, { count: number; requestsCount: number }>();
    citizens.forEach(c => {
      const job = c.Job?.trim() || 'كاسب';
      const citReqs = auditableRequests.filter(r => r.Citizen_ID === c.Citizen_ID);
      const current = map.get(job) || { count: 0, requestsCount: 0 };
      map.set(job, {
        count: current.count + 1,
        requestsCount: current.requestsCount + citReqs.length
      });
    });

    return Array.from(map.entries())
      .map(([job, data]) => ({
        job,
        ...data,
        percent: citizens.length > 0 ? Math.round((data.count / citizens.length) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [citizens, auditableRequests]);

  // 4. Entity / Social Care & Ministry Statistics
  const entityStats = useMemo(() => {
    const map = new Map<string, { total: number; completed: number; inProgress: number; urgent: number }>();
    auditableRequests.forEach(r => {
      const ent = r.Entity?.trim() || 'جهات أخرى';
      const current = map.get(ent) || { total: 0, completed: 0, inProgress: 0, urgent: 0 };
      const isCompleted = r.ProcessingStatus === 'منجز';
      const isUrgent = r.Priority === 'عاجل' || r.Priority === 'خاص جداً';

      map.set(ent, {
        total: current.total + 1,
        completed: current.completed + (isCompleted ? 1 : 0),
        inProgress: current.inProgress + (isCompleted ? 0 : 1),
        urgent: current.urgent + (isUrgent ? 1 : 0)
      });
    });

    return Array.from(map.entries())
      .map(([entity, data]) => ({
        entity,
        ...data,
        rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [auditableRequests]);

  // Global totals
  const totalCompleted = auditableRequests.filter(r => r.ProcessingStatus === 'منجز').length;
  const totalUrgent = auditableRequests.filter(r => r.Priority === 'عاجل' || r.Priority === 'خاص جداً').length;
  const totalScheduledInterviews = interviews.filter(i => i.Status === 'مجدولة').length;

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Unique users & departments inside auditLogs for rich filtering
  const auditFilterOptions = useMemo(() => {
    const userSet = new Set<string>();
    const deptSet = new Set<string>();
    (auditLogs || []).forEach(log => {
      const u = (log.UserName || log.User || '').trim();
      const d = (log.Department || log.Section || '').trim();
      if (u) userSet.add(u);
      if (d) deptSet.add(d);
    });
    return {
      users: Array.from(userSet).sort((a, b) => a.localeCompare(b, 'ar')),
      departments: Array.from(deptSet).sort((a, b) => a.localeCompare(b, 'ar'))
    };
  }, [auditLogs]);

  // Comprehensive Staff Activity & Oversight Metrics
  const staffOversightMetrics = useMemo(() => {
    const map = new Map<
      string,
      {
        user: string;
        total: number;
        creates: number;
        updates: number;
        deletes: number;
        security: number;
        departments: Set<string>;
        lastSeen: string;
      }
    >();

    let todayCount = 0;
    const alerts: Array<{ log: typeof auditLogs[number]; category: 'delete' | 'security'; severity: 'high' | 'medium' }> = [];

    (auditLogs || []).forEach(log => {
      const user = (log.UserName || log.User || 'النظام الآلي').trim();
      const dept = (log.Department || log.Section || 'النظام').trim();
      const action = log.ActionType || log.Action || '';
      const details = log.Details || '';
      const ts = log.Timestamp || '';
      const cat = classifyAuditAction(action, details);

      if (ts.includes(todayIso)) {
        todayCount += 1;
      }

      if (cat === 'delete' || cat === 'security') {
        const isHigh =
          action.includes('حذف نهائي') ||
          action.includes('تصفير') ||
          action.includes('قائمة سوداء') ||
          action.includes('رمز دخول المطور') ||
          action.includes('ضبط المصنع');
        alerts.push({ log, category: cat, severity: isHigh ? 'high' : 'medium' });
      }

      const cur = map.get(user) || {
        user,
        total: 0,
        creates: 0,
        updates: 0,
        deletes: 0,
        security: 0,
        departments: new Set<string>(),
        lastSeen: ts
      };
      cur.total += 1;
      if (cat === 'create') cur.creates += 1;
      else if (cat === 'update') cur.updates += 1;
      else if (cat === 'delete') cur.deletes += 1;
      else if (cat === 'security') cur.security += 1;
      if (dept) cur.departments.add(dept);
      if (ts && (!cur.lastSeen || ts > cur.lastSeen)) {
        cur.lastSeen = ts;
      }
      map.set(user, cur);
    });

    const staffList = Array.from(map.values())
      .map(s => ({ ...s, departmentsList: Array.from(s.departments) }))
      .sort((a, b) => b.total - a.total);

    return {
      todayCount,
      alerts,
      staffList,
      activeUsersCount: staffList.length,
      registeredStaffCount: (users || []).length
    };
  }, [auditLogs, todayIso, users]);

  // Multi-filtered audit logs
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (auditLogs || []).filter(log => {
      const actionRaw = log.ActionType || log.Action || '';
      const userRaw = log.UserName || log.User || '';
      const deptRaw = log.Department || log.Section || '';
      const detailsRaw = log.Details || '';
      const tsRaw = log.Timestamp || '';

      if (selectedLogUser !== 'ALL' && userRaw.trim() !== selectedLogUser) return false;
      if (selectedLogDept !== 'ALL' && deptRaw.trim() !== selectedLogDept) return false;
      if (selectedLogDate && !tsRaw.includes(selectedLogDate)) return false;

      if (selectedLogCategory !== 'ALL') {
        const cat = classifyAuditAction(actionRaw, detailsRaw);
        if (selectedLogCategory === 'alerts') {
          if (cat !== 'delete' && cat !== 'security') return false;
        } else if (cat !== selectedLogCategory) {
          return false;
        }
      }

      if (q) {
        const hay = `${actionRaw} ${userRaw} ${deptRaw} ${detailsRaw} ${tsRaw} ${log.Log_ID || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [auditLogs, searchQuery, selectedLogUser, selectedLogDept, selectedLogCategory, selectedLogDate]);

  const handleExportAuditLogs = () => {
    const rows = filteredLogs.map((l, idx) => ({
      'ت': idx + 1,
      'رقم الحركة': l.Log_ID || '',
      'نوع الإجراء': l.ActionType || l.Action || '',
      'القسم': l.Department || l.Section || '',
      'الموظف القائم بالحركة': l.UserName || l.User || '',
      'تفاصيل الحركة': l.Details || '',
      'التاريخ والوقت': l.Timestamp || ''
    }));
    exportToExcel(rows, `سجل_الرقابة_والتدقيق_${todayIso}`);
    addAuditLog('تصدير سجل الرقابة والتدقيق', 'قسم الرقابة والتدقيق', `تم تصدير (${rows.length}) حركة رقابية بصيغة Excel`);
  };

  const handlePrintAuditLogsA4 = () => {
    const officeTitle = systemSettings?.officeName || systemSettings?.appName || 'مكتب النائب المهندسة علا عودة الناشي';
    const printDate = new Date().toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' });
    const rowsHtml = filteredLogs.slice(0, 400).map((log, idx) => `
      <tr>
        <td style="text-align:center;font-weight:700;">${idx + 1}</td>
        <td style="font-weight:700;color:#0f172a;">${escapeHtml(log.ActionType || log.Action || '—')}</td>
        <td style="color:#1e40af;font-weight:600;">${escapeHtml(log.Department || log.Section || '—')}</td>
        <td style="font-weight:700;">${escapeHtml(log.UserName || log.User || '—')}</td>
        <td style="line-height:1.5;">${escapeHtml(log.Details || '—')}</td>
        <td style="font-family:monospace;font-size:10px;direction:ltr;text-align:center;">${escapeHtml(log.Timestamp || '—')}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>تقرير سجل الرقابة والتدقيق الشامل</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: 'Tajawal', 'Cairo', Tahoma, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; direction: rtl; background: #fff; }
  .header { border-bottom: 2.5px solid #0b192c; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { margin: 0; font-size: 17px; color: #0b192c; }
  .header p { margin: 3px 0 0; font-size: 11px; color: #475569; }
  .meta { font-size: 11px; text-align: left; color: #334155; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
  .kpi { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; background: #f8fafc; }
  .kpi .lbl { font-size: 10px; color: #475569; }
  .kpi .val { font-size: 16px; font-weight: 800; color: #0b192c; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #0b192c; color: #fff; padding: 7px 6px; border: 1px solid #0b192c; text-align: right; font-weight: 700; }
  td { padding: 6px; border: 1px solid #cbd5e1; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(officeTitle)} — تقرير الرقابة والتدقيق الإداري</h1>
      <p>سجل نشاط الموظفين والتعديلات والعمليات الحساسة داخل المنظومة</p>
    </div>
    <div class="meta">
      <div>تاريخ الطباعة: ${escapeHtml(printDate)}</div>
      <div>عدد الحركات بالتقرير: <strong>${filteredLogs.length}</strong></div>
    </div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="lbl">إجمالي الحركات المسجلة</div><div class="val">${auditLogs.length}</div></div>
    <div class="kpi"><div class="lbl">نشاط اليوم</div><div class="val">${staffOversightMetrics.todayCount}</div></div>
    <div class="kpi"><div class="lbl">الموظفون النشطون</div><div class="val">${staffOversightMetrics.activeUsersCount}</div></div>
    <div class="kpi"><div class="lbl">الحركات الحساسة والتنبيهات</div><div class="val">${staffOversightMetrics.alerts.length}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:32px;text-align:center;">ت</th>
        <th style="width:145px;">نوع الإجراء</th>
        <th style="width:120px;">القسم</th>
        <th style="width:140px;">الموظف القائم بالحركة</th>
        <th>تفاصيل الحركة الإدارية</th>
        <th style="width:118px;text-align:center;">الوقت والتاريخ</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="6" style="text-align:center;padding:18px;color:#64748b;">لا توجد حركات مطابقة للفلاتر الحالية</td></tr>'}
    </tbody>
  </table>
  <div class="footer">
    <span>وثيقة رقابية صادرة آلياً من نظام مكتب النائب — سري للاستخدام الإداري</span>
    <span>توقيع مسؤول الرقابة والتدقيق: _______________________</span>
  </div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1200);
      }, 250);
    }
  };

  const handleAddInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) return;

    setInquiries([
      {
        id: `INQ-2026-0${inquiries.length + 1}`,
        inquiryNumber: newInqNumber,
        targetMinistry: newMinistry,
        subject: newSubject,
        details: newDetails,
        status: 'قيد الإجابة',
        submissionDate: new Date().toISOString().split('T')[0]
      },
      ...inquiries
    ]);

    setShowInquiryModal(false);
    setNewSubject('');
    setNewDetails('');
  };

  const handleExportCurrentTable = () => {
    if (statsCategory === 'clans') {
      const data = clanStats.map(c => ({
        'العشيرة / اللقب': c.clan,
        'عدد المواطنين': c.count,
        'إجمالي المعاملات': c.requestsCount,
        'المعاملات المنجزة': c.completedCount,
        'نسبة الإنجاز': `${c.rate}%`
      }));
      exportToExcel(data, 'تقرير_عشائر_ذي_قار_الشامل');
    } else if (statsCategory === 'districts') {
      const data = districtStats.map(d => ({
        'القضاء / المنطقة': d.district,
        'عدد المواطنين': d.count,
        'إجمالي المعاملات': d.requestsCount,
        'المنجز': d.completedCount,
        'نسبة الإنجاز': `${d.rate}%`
      }));
      exportToExcel(data, 'تقرير_أقضية_ومناطق_ذي_قار');
    } else if (statsCategory === 'jobs') {
      const data = jobStats.map(j => ({
        'المهنة / العمل': j.job,
        'العدد الكلي': j.count,
        'إجمالي المعاملات': j.requestsCount,
        'النسبة المئوية': `${j.percent}%`
      }));
      exportToExcel(data, 'تقرير_المهن_وتصنيف_الأعمال');
    } else {
      const data = entityStats.map(e => ({
        'الجهة / الوزارة / الدائرة': e.entity,
        'إجمالي الطلبات': e.total,
        'المنجز': e.completed,
        'قيد الإجراء': e.inProgress,
        'الطلبات العاجلة': e.urgent,
        'نسبة الإنجاز': `${e.rate}%`
      }));
      exportToExcel(data, 'تقرير_الرعاية_والدوائر_الحكومية');
    }
  };

  // Master System Exporter: Downloads ALL data across all departments in a single workbook
  // "وقسم المتابعة يتولى متابعة هذا شكو احصائيات بالنظام من الاول للاخير يمه من ما بين شهيرات مناطق الأعمال وشهرات الرعاية كل شي يمه يهوة يطلع علية ويكدر يسبحة وينزل ملفات كلشي بالنظام بهذا القسم"
  const handleExportAllSystemFiles = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Citizens (المراجعين)
      const citData = citizens.map(c => ({
        'الرقم التعريفي (ONA-ID)': c.Citizen_ID,
        'الاسم الرباعي واللقب': c.FullName,
        'الاسم الأول': c.FirstName || '',
        'اسم الأب': c.FatherName || '',
        'اسم الجد': c.GrandFatherName || '',
        'الاسم الرابع': c.GreatGrandFatherName || '',
        'العشيرة / اللقب': c.Surname || '',
        'رقم الهاتف الأساسي': c.Phone1,
        'رقم الهاتف البديل': c.Phone2 || '',
        'القضاء / السكن': c.District,
        'المهنة': c.Job || '',
        'التحصيل الدراسي': c.Education || '',
        'طريقة الحضور': c.AttendanceType || 'شخصياً',
        'حامل الطلب (المعتمد)': c.ProxyName || '',
        'هاتف حامل الطلب': c.ProxyPhone || '',
        'عنوان حامل الطلب': c.ProxyAddress || '',
        'صلة القرابة': c.ProxyRelation || '',
        'المرحلة الإدارية': c.CurrentStage || 'الاستعلامات',
        'تاريخ التسجيل': c.CreatedAt,
        'الموظف المسجل': c.CreatedBy || ''
      }));
      const wsCit = XLSX.utils.json_to_sheet(citData);
      XLSX.utils.book_append_sheet(wb, wsCit, 'سجل المراجعين المركزي');

      // Sheet 2: Requests (المعاملات والطلبات)
      const reqData = auditableRequests.map(r => ({
        'رقم المعاملة': r.Request_ID,
        'الرقم التعريفي للمواطن': r.Citizen_ID,
        'اسم المواطن': r.CitizenName,
        'هاتف المواطن': r.CitizenPhone || '',
        'الجهة المعنية': r.Entity,
        'حالة المعاملة': r.ProcessingStatus,
        'الأسبقية': r.Priority,
        'تفاصيل المعاملة': r.Details,
        'توجيه وهامش النائب': r.DeputyNotes || '',
        'المرحلة الحالية': r.CurrentStage || 'الإدارة',
        'تاريخ الإنشاء': r.CreatedAt,
        'الموظف المنشئ': r.CreatedBy
      }));
      const wsReq = XLSX.utils.json_to_sheet(reqData);
      XLSX.utils.book_append_sheet(wb, wsReq, 'سجل المعاملات والكتب');

      // Sheet 3: Interviews (المقابلات)
      const intData = interviews.map(i => ({
        'رقم المقابلة': i.Interview_ID,
        'الرقم التعريفي': i.Citizen_ID,
        'اسم المواطن': i.FullName,
        'الهاتف': i.Phone1,
        'القضاء': i.Address || '',
        'تاريخ المقابلة': i.InterviewDate,
        'الوقت': i.InterviewTime || '',
        'الموضوع': i.Subject,
        'الأولوية': i.Priority,
        'الحالة': i.Status,
        'توجيهات النائب': i.DeputyNotes || ''
      }));
      const wsInt = XLSX.utils.json_to_sheet(intData);
      XLSX.utils.book_append_sheet(wb, wsInt, 'مقابلات النائب');

      // Sheet 4: Clan Statistics (عشائر ذي قار والشهيرات)
      const clanData = clanStats.map(c => ({
        'العشيرة / اللقب': c.clan,
        'عدد المراجعين المسجلين': c.count,
        'إجمالي المعاملات': c.requestsCount,
        'المعاملات المنجزة': c.completedCount,
        'نسبة الإنجاز': `${c.rate}%`
      }));
      const wsClan = XLSX.utils.json_to_sheet(clanData);
      XLSX.utils.book_append_sheet(wb, wsClan, 'إحصائيات العشائر والشهيرات');

      // Sheet 5: District Statistics (مناطق الأعمال والأقضية)
      const distData = districtStats.map(d => ({
        'القضاء / المنطقة': d.district,
        'عدد المواطنين': d.count,
        'إجمالي المعاملات': d.requestsCount,
        'المنجز': d.completedCount,
        'نسبة الإنجاز': `${d.rate}%`
      }));
      const wsDist = XLSX.utils.json_to_sheet(distData);
      XLSX.utils.book_append_sheet(wb, wsDist, 'مناطق الأعمال والأقضية');

      // Sheet 6: Social Care & Ministries (الرعاية والوزارات)
      const entData = entityStats.map(e => ({
        'الجهة / الدائرة / الرعاية': e.entity,
        'إجمالي الطلبات': e.total,
        'المنجز': e.completed,
        'قيد الإجراء': e.inProgress,
        'عاجل': e.urgent,
        'نسبة الإنجاز': `${e.rate}%`
      }));
      const wsEnt = XLSX.utils.json_to_sheet(entData);
      XLSX.utils.book_append_sheet(wb, wsEnt, 'الرعاية والوزارات والجهات');

      // Sheet 7: Audit Logs (سجل المتابعة والتدقيق)
      const auditData = auditLogs.map(a => ({
        'الرقم': a.Log_ID || '',
        'نوع الإجراء': a.ActionType || a.Action || '',
        'القسم': a.Department || a.Section || '',
        'الموظف': a.UserName || a.User || '',
        'التفاصيل': a.Details || '',
        'الوقت والتاريخ': a.Timestamp || ''
      }));
      const wsAudit = XLSX.utils.json_to_sheet(auditData);
      XLSX.utils.book_append_sheet(wb, wsAudit, 'سجل المتابعة والرقابة');

      const fileName = `سجلات_ملفات_النظام_الشاملة_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      addAuditLog('تنزيل ملفات النظام الشاملة', 'قسم المتابعة والرقابة', `تم تنزيل وتصدير حزمة ملفات وسجلات النظام الشاملة (${fileName}) بنجاح`);
    } catch (err) {
      console.error('Master export error', err);
      alert('حدث خطأ أثناء تنزيل الملفات.');
    }
  };

  return (
    <div className="space-y-4 text-right font-['Tajawal',sans-serif] select-none" dir="rtl">
      
      {/* Header Bar - Comprehensive Follow-up, Audit & Analytics */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-2xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  قسم المتابعة والرقابة البرلمانية والإحصائيات الشاملة
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  متابعة وتنزيل كافة ملفات النظام
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                متابعة شكو إحصائيات بالنظام من الأول للآخر: العشائر والشهيرات، مناطق الأعمال والأقضية، شهادات ودوائر الرعاية، وسحب وتنزيل ملفات كل شيء بالنظام.
              </p>
            </div>
          </div>
        </div>

        {/* Global Export & Print Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {/* MASTER ALL-IN-ONE DOWNLOAD BUTTON */}
          <button
            onClick={handleExportAllSystemFiles}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-700 to-rose-700 hover:from-blue-800 hover:to-rose-800 text-white font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-700/20 cursor-pointer active:scale-95"
            title="تنزيل حزمة ملفات وسجلات النظام كاملة بكل الأقسام (Excel متعدد التبويبات)"
          >
            <Database className="w-4 h-4 text-amber-300" />
            <span>📥 تنزيل ملفات كل شيء بالنظام (Excel شامل)</span>
          </button>

          <button
            onClick={handleExportCurrentTable}
            className="flex-1 md:flex-none px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="تصدير جدول الإحصائيات المعروض حالياً إلى ملف إكسل"
          >
            <Download className="w-4 h-4" />
            <span>تنزيل القسم الحالي</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex-1 md:flex-none px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="سحب وطباعة التقرير الشامل"
          >
            <Printer className="w-4 h-4" />
            <span>🖨️ سحب وطباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* ---------------- VIEW 1: CENTRAL ICONS HUB ---------------- */}
      {activeTab === 'hub' && (
        <OfficeIconTilesGrid
          title="أيقونات ومهام قسم المتابعة والرقابة البرلمانية"
          subtitle="انقر على أي أيقونة للاستعراض المباشر للإحصائية أو التدقيق الرقابي المطلوب"
          columns={5}
          items={[
            {
              id: 'audit_stats_tab',
              title: 'المتابعة والإحصاءات الشاملة',
              subtitle: 'كافة المؤشرات المركزية',
              icon: BarChart2,
              iconColor: 'text-rose-600 dark:text-rose-400',
              iconBg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
              onClick: () => {
                setActiveTab('followup_stats');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            },
            {
              id: 'audit_trail_tab',
              title: 'سجل التدقيق الإداري العام',
              subtitle: 'Audit Trail وتوثيق العمليات',
              icon: ShieldCheck,
              iconColor: 'text-blue-600 dark:text-blue-400',
              iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
              badge: auditLogs.length,
              badgeColor: 'bg-blue-600 text-white',
              onClick: () => {
                setActiveTab('audit_trail');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            },
            {
              id: 'audit_inquiries_tab',
              title: 'الأسئلة والرقابة البرلمانية',
              subtitle: 'المخاطبات الوزارية والنزاهة',
              icon: Building2,
              iconColor: 'text-amber-600 dark:text-amber-400',
              iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
              badge: inquiries.length,
              badgeColor: 'bg-amber-600 text-white',
              onClick: () => {
                setActiveTab('inquiries');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            },
            {
              id: 'audit_clans',
              title: 'إحصائيات العشائر والشهيرات',
              subtitle: 'توزيع المراجعين عشائرياً',
              icon: Users,
              iconColor: 'text-purple-600 dark:text-purple-400',
              iconBg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
              badge: clanStats.length,
              badgeColor: 'bg-purple-600 text-white',
              onClick: () => {
                setActiveTab('followup_stats');
                setStatsCategory('clans');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            },
            {
              id: 'audit_districts',
              title: 'التوزيع الجغرافي للأقضية',
              subtitle: 'مناطق المحافظة والمدن',
              icon: MapPin,
              iconColor: 'text-cyan-600 dark:text-cyan-400',
              iconBg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800',
              badge: districtStats.length,
              badgeColor: 'bg-cyan-600 text-white',
              onClick: () => {
                setActiveTab('followup_stats');
                setStatsCategory('districts');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            },
            {
              id: 'audit_jobs',
              title: 'توزيع المهن والتوصيف',
              subtitle: 'الكوادر والأطباء والموظفين',
              icon: Briefcase,
              iconColor: 'text-indigo-600 dark:text-indigo-400',
              iconBg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
              badge: jobStats.length,
              badgeColor: 'bg-indigo-600 text-white',
              onClick: () => {
                setActiveTab('followup_stats');
                setStatsCategory('jobs');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            },
            {
              id: 'audit_entities',
              title: 'توزيع الوزارات والجهات',
              subtitle: 'الطلبات الحكومية القطاعية',
              icon: Layers,
              iconColor: 'text-teal-600 dark:text-teal-400',
              iconBg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
              badge: entityStats.length,
              badgeColor: 'bg-teal-600 text-white',
              onClick: () => {
                setActiveTab('followup_stats');
                setStatsCategory('entities');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            },
            {
              id: 'audit_export_all',
              title: 'تنزيل حزمة ملفات المنظومة',
              subtitle: 'Excel متعدد التبويبات لكافة الأقسام',
              icon: Database,
              iconColor: 'text-emerald-600 dark:text-emerald-400',
              iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
              onClick: () => handleExportAllSystemFiles()
            },
            {
              id: 'audit_export_curr',
              title: 'تنزيل الجدول المعروض حالياً',
              subtitle: 'سحب جدول الإحصائية إلى Excel',
              icon: FileSpreadsheet,
              iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
              iconBg: 'bg-fuchsia-50 dark:bg-fuchsia-950/50 border-fuchsia-200 dark:border-fuchsia-800',
              onClick: () => handleExportCurrentTable()
            },
            {
              id: 'audit_print',
              title: 'سحب وطباعة التقرير الشامل',
              subtitle: 'طباعة فورية لكافة الإحصائيات',
              icon: Printer,
              iconColor: 'text-orange-600 dark:text-orange-400',
              iconBg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800',
              onClick: () => window.print()
            }
          ]}
        />
      )}

      {/* ---------------- VIEW 2: DEDICATED SUBVIEW HEADER WITH BACK BUTTON ---------------- */}
      {activeTab !== 'hub' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveTab('hub');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 rotate-180" />
              <span>رجوع إلى شبكة أيقونات الرقابة والتدقيق</span>
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            <span className="font-black text-sm text-slate-900 dark:text-white">
              {activeTab === 'followup_stats' && '📊 المتابعة والإحصائيات الشاملة لكافة الأقسام'}
              {activeTab === 'audit_trail' && `🔒 سجل الحركات والتدقيق الأمني (${filteredLogs.length})`}
              {activeTab === 'inquiries' && `🏛️ الأسئلة والرقابة البرلمانية (${inquiries.length})`}
            </span>
          </div>

          {/* Quick Sub-tab Jump Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-bold">
            <button
              onClick={() => setActiveTab('followup_stats')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'followup_stats' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              الإحصائيات الشاملة
            </button>
            <button
              onClick={() => setActiveTab('audit_trail')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'audit_trail' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              سجل التدقيق ({filteredLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('inquiries')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'inquiries' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              الأسئلة البرلمانية ({inquiries.length})
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: Follow-up & Comprehensive Analytics ("قسم المتابعة يتولى متابعة هذا شكو احصائيات بالنظام من الاول للاخير") */}
      {activeTab === 'followup_stats' && (
        <div className="space-y-4">
          
          {/* Top KPI Metrics Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs text-right">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">إجمالي المراجعين بالنظام</span>
              <div className="text-2xl font-black text-slate-900">{citizens.length} <span className="text-xs font-normal text-slate-400">مواطن</span></div>
              <div className="text-[10px] text-blue-600 font-bold mt-1">موزعين على كافة الأقضية</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs text-right">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">إجمالي المعاملات والطلبات</span>
              <div className="text-2xl font-black text-blue-700">{auditableRequests.length} <span className="text-xs font-normal text-slate-400">معاملة</span></div>
              <div className="text-[10px] text-emerald-600 font-bold mt-1">{totalCompleted} معاملة منجزة بالكامل</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs text-right">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">الطلبات العاجلة والمهمة</span>
              <div className="text-2xl font-black text-rose-600">{totalUrgent} <span className="text-xs font-normal text-slate-400">عاجل</span></div>
              <div className="text-[10px] text-rose-700 font-bold mt-1">تتطلب متابعة استثنائية</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs text-right">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">مقابلات النائب المجدولة</span>
              <div className="text-2xl font-black text-teal-700">{totalScheduledInterviews} <span className="text-xs font-normal text-slate-400">لقاء</span></div>
              <div className="text-[10px] text-teal-800 font-bold mt-1">من أصل {interviews.length} مقابلة موثقة</div>
            </div>
          </div>

          {/* Sub-Category Selector Pills: Clans, Districts, Jobs, Entities */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs font-bold">
              <button
                onClick={() => setStatsCategory('clans')}
                className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  statsCategory === 'clans'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>عشائر ذي قار والألقاب ({clanStats.length})</span>
              </button>

              <button
                onClick={() => setStatsCategory('districts')}
                className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  statsCategory === 'districts'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>أقضية ومناطق المحافظة ({districtStats.length})</span>
              </button>

              <button
                onClick={() => setStatsCategory('jobs')}
                className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  statsCategory === 'jobs'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>المهن وتصنيف الأعمال ({jobStats.length})</span>
              </button>

              <button
                onClick={() => setStatsCategory('entities')}
                className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  statsCategory === 'entities'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>الرعاية الاجتماعية والوزارات ({entityStats.length})</span>
              </button>
            </div>

            <button
              onClick={handleExportCurrentTable}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>تصدير هذا القسم كملف إكسل</span>
            </button>
          </div>

          {/* Sub-Table Display */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            
            {/* 1. Clans Table */}
            {statsCategory === 'clans' && (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">العشيرة / اللقب</th>
                      <th className="p-3">عدد المراجعين المسجلين</th>
                      <th className="p-3">إجمالي الطلبات والمعاملات</th>
                      <th className="p-3">المعاملات المنجزة</th>
                      <th className="p-3">نسبة الإنجاز</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {clanStats.map((item, idx) => (
                      <tr key={item.clan} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{item.clan}</td>
                        <td className="p-3 font-semibold text-blue-700">{item.count} مراجع</td>
                        <td className="p-3 font-semibold">{item.requestsCount} معاملة</td>
                        <td className="p-3 font-bold text-emerald-700">{item.completedCount}</td>
                        <td className="p-3 font-mono font-bold text-slate-800">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            item.rate >= 50 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {item.rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. Districts Table */}
            {statsCategory === 'districts' && (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">القضاء / المنطقة</th>
                      <th className="p-3">عدد المواطنين المسجلين</th>
                      <th className="p-3">إجمالي المعاملات</th>
                      <th className="p-3">المعاملات المنجزة</th>
                      <th className="p-3">نسبة الإنجاز</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {districtStats.map((item, idx) => (
                      <tr key={item.district} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{item.district}</td>
                        <td className="p-3 font-semibold text-blue-700">{item.count} مواطن</td>
                        <td className="p-3 font-semibold">{item.requestsCount} معاملة</td>
                        <td className="p-3 font-bold text-emerald-700">{item.completedCount}</td>
                        <td className="p-3 font-mono font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            item.rate >= 50 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {item.rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. Jobs Table */}
            {statsCategory === 'jobs' && (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">المهنة / تصنيف العمل</th>
                      <th className="p-3">عدد المراجعين</th>
                      <th className="p-3">إجمالي المعاملات</th>
                      <th className="p-3">النسبة المئوية من إجمالي القاعدة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {jobStats.map((item, idx) => (
                      <tr key={item.job} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{item.job}</td>
                        <td className="p-3 font-semibold text-blue-700">{item.count}</td>
                        <td className="p-3 font-semibold">{item.requestsCount}</td>
                        <td className="p-3 font-mono font-bold text-purple-700">{item.percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. Entities / Social Care & Ministries Table */}
            {statsCategory === 'entities' && (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">الجهة / الوزارة / الدائرة</th>
                      <th className="p-3">إجمالي المعاملات</th>
                      <th className="p-3">المنجز</th>
                      <th className="p-3">قيد الإجراء والمتابعة</th>
                      <th className="p-3">المعاملات العاجلة</th>
                      <th className="p-3">نسبة الاستجابة والإنجاز</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {entityStats.map((item, idx) => (
                      <tr key={item.entity} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{item.entity}</td>
                        <td className="p-3 font-semibold text-blue-700">{item.total}</td>
                        <td className="p-3 font-bold text-emerald-700">{item.completed}</td>
                        <td className="p-3 font-semibold text-amber-700">{item.inProgress}</td>
                        <td className="p-3 font-bold text-rose-700">{item.urgent}</td>
                        <td className="p-3 font-mono font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            item.rate >= 50 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {item.rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        </div>
      )}

      {/* TAB 2: Comprehensive System & Staff Oversight (أدوات الرقابة الشاملة وسجل الحركات) */}
      {activeTab === 'audit_trail' && (
        <div className="space-y-4">
          {/* 1. Executive Oversight KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>إجمالي العمليات المسجلة</span>
                <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {auditLogs.length.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">محفوظة لحظياً في Firebase</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>حركات ونشاط اليوم</span>
                <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                {staffOversightMetrics.todayCount.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">بتاريخ {todayIso}</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>الموظفون النشطون</span>
                <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400 font-mono tabular-nums">
                {staffOversightMetrics.activeUsersCount}
                <span className="text-xs text-slate-400 font-normal"> / {staffOversightMetrics.registeredStaffCount}</span>
              </div>
              <div className="text-[11px] text-slate-500">حساب موظف لديه نشاط مسجل</div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLogCategory(prev => (prev === 'alerts' ? 'ALL' : 'alerts'))}
              className={`p-4 rounded-2xl border shadow-xs space-y-1 text-right transition-all cursor-pointer ${
                selectedLogCategory === 'alerts'
                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-400 dark:border-rose-600 ring-2 ring-rose-500/30'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400">
                <span>عمليات حساسة وتنبيهات أمنية</span>
                <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-700 dark:text-rose-400 font-mono tabular-nums">
                {staffOversightMetrics.alerts.length.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">حذف، حظر، صلاحيات، أو تصفير (انقر للفرز)</div>
            </button>
          </div>

          {/* 2. Security & Sensitive Actions Monitor */}
          {staffOversightMetrics.alerts.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 overflow-hidden shadow-xs">
              <div className="px-4 py-3 bg-rose-50/80 dark:bg-rose-950/35 border-b border-rose-200/80 dark:border-rose-900/50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-black text-rose-900 dark:text-rose-200">
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>مرصد العمليات الحساسة والتعديلات الأمنية ({staffOversightMetrics.alerts.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLogCategory(prev => (prev === 'alerts' ? 'ALL' : 'alerts'))}
                  className="text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:underline cursor-pointer"
                >
                  {selectedLogCategory === 'alerts' ? 'إظهار كافة الحركات' : 'عرض جميع التنبيهات بالجدول'}
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-44 overflow-y-auto">
                {staffOversightMetrics.alerts.slice(0, 6).map(({ log, category, severity }, idx) => (
                  <div key={`${log.Log_ID}-alert-${idx}`} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border shrink-0 ${
                        severity === 'high'
                          ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                          : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                      }`}>
                        {category === 'delete' ? 'حذف / إزالة' : 'أمان / صلاحيات'}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white truncate">{log.ActionType || log.Action}</span>
                      <span className="text-slate-500 truncate hidden md:inline">— {log.Details}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] shrink-0">
                      <span className="font-bold text-blue-700 dark:text-blue-400">{log.UserName || log.User}</span>
                      <span className="font-mono text-slate-400" dir="ltr">{log.Timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Staff Activity Breakdown (Click any staff card to inspect their exact actions) */}
          {staffOversightMetrics.staffList.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>مراقبة نشاط وأداء الموظفين (انقر على أي موظف لعرض سجل حركاته)</span>
                </div>
                {selectedLogUser !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedLogUser('ALL')}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    إلغاء تحديد الموظف
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {staffOversightMetrics.staffList.slice(0, 8).map((staff) => {
                  const isSelected = selectedLogUser === staff.user;
                  return (
                    <button
                      key={staff.user}
                      type="button"
                      onClick={() => setSelectedLogUser(prev => (prev === staff.user ? 'ALL' : staff.user))}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/25'
                          : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{staff.user}</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 dark:bg-blue-600 text-white font-mono text-[10px] font-black tabular-nums shrink-0">
                          {staff.total}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold">
                        <span className="text-emerald-700 dark:text-emerald-400">إضافة: {staff.creates}</span>
                        <span className="text-blue-700 dark:text-blue-400">تعديل: {staff.updates}</span>
                        {staff.deletes > 0 && <span className="text-rose-700 dark:text-rose-400">حذف: {staff.deletes}</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate" dir="ltr">
                        آخر نشاط: {staff.lastSeen || '—'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Multi-Filter Controls & Export/Print Actions */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100">
                <Filter className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>فلاتر التدقيق والرقابة المتقدمة</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(searchQuery || selectedLogUser !== 'ALL' || selectedLogDept !== 'ALL' || selectedLogCategory !== 'ALL' || selectedLogDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedLogUser('ALL');
                      setSelectedLogDept('ALL');
                      setSelectedLogCategory('ALL');
                      setSelectedLogDate('');
                      setVisibleLogsLimit(50);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>إعادة ضبط</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExportAuditLogs}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>تصدير Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintAuditLogsA4}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة تقرير رقابي A4</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              <div className="relative lg:col-span-2">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث باسم الموظف، نوع العملية، رقم المعاملة أو التفاصيل..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white placeholder-slate-400 text-xs text-right outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <select
                value={selectedLogUser}
                onChange={(e) => setSelectedLogUser(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="ALL">الموظف: الكل ({auditFilterOptions.users.length})</option>
                {auditFilterOptions.users.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>

              <select
                value={selectedLogDept}
                onChange={(e) => setSelectedLogDept(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="ALL">القسم: الكل ({auditFilterOptions.departments.length})</option>
                {auditFilterOptions.departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <select
                  value={selectedLogCategory}
                  onChange={(e) => setSelectedLogCategory(e.target.value)}
                  className="flex-1 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="ALL">النوع: الكل</option>
                  <option value="alerts">تنبيهات حساسة</option>
                  <option value="create">إضافة وتسجيل</option>
                  <option value="update">تعديل وتحديث</option>
                  <option value="delete">حذف وتصفير</option>
                  <option value="security">صلاحيات وأمان</option>
                  <option value="login">دخول ومصادقة</option>
                  <option value="export">تصدير واستيراد</option>
                </select>
                <input
                  type="date"
                  value={selectedLogDate}
                  onChange={(e) => setSelectedLogDate(e.target.value)}
                  title="تصفية حسب التاريخ"
                  className="w-32 px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-[11px] font-mono outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
          </div>

          {/* 5. Audit Log Table */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <span className="text-xs font-bold text-slate-800 dark:text-white">
                سجل النشاطات الإدارية الموثّق ({filteredLogs.length.toLocaleString()} حركة)
              </span>
              <span className="text-[10px] text-slate-500">توثيق لحظي في Firebase Firestore لكافة الإضافات والتعديلات والحذف</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3 w-12 text-center">ت</th>
                    <th className="p-3">التصنيف</th>
                    <th className="p-3">نوع الإجراء</th>
                    <th className="p-3">القسم</th>
                    <th className="p-3">الموظف القائم بالحركة</th>
                    <th className="p-3">تفاصيل الحركة الإدارية</th>
                    <th className="p-3">الوقت والتاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 text-xs font-bold">
                        لا توجد حركات مسجلة مطابقة لمعايير البحث والفلترة الحالية.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.slice(0, visibleLogsLimit).map((log, idx) => {
                      const actionStr = log.ActionType || log.Action || 'إجراء';
                      const cat = classifyAuditAction(actionStr, log.Details || '');
                      const badge =
                        cat === 'delete'
                          ? { label: 'حذف', icon: Trash2, cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' }
                          : cat === 'security'
                          ? { label: 'أمان', icon: KeyRound, cls: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' }
                          : cat === 'update'
                          ? { label: 'تعديل', icon: Edit3, cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800' }
                          : cat === 'login'
                          ? { label: 'دخول', icon: LogIn, cls: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800' }
                          : cat === 'create'
                          ? { label: 'إضافة', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' }
                          : { label: 'عملية', icon: Activity, cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' };
                      const BadgeIcon = badge.icon;

                      return (
                        <tr key={`${log.Log_ID || 'log'}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 text-center font-mono text-slate-400 text-[11px] tabular-nums">{idx + 1}</td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.cls}`}>
                              <BadgeIcon className="w-3 h-3" />
                              {badge.label}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">{actionStr}</td>
                          <td className="p-3 text-blue-700 dark:text-blue-400 font-semibold whitespace-nowrap">{log.Department || log.Section || '—'}</td>
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{log.UserName || log.User || '—'}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-300 max-w-md leading-relaxed">{log.Details}</td>
                          <td className="p-3 font-mono text-[10px] text-slate-400 whitespace-nowrap tabular-nums" dir="ltr">{log.Timestamp}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredLogs.length > visibleLogsLimit && (
              <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex justify-center bg-slate-50/60 dark:bg-slate-800/30">
                <button
                  type="button"
                  onClick={() => setVisibleLogsLimit(prev => prev + 50)}
                  className="px-5 py-1.5 rounded-xl bg-slate-900 dark:bg-blue-600 hover:opacity-90 text-white text-xs font-bold cursor-pointer"
                >
                  عرض المزيد ({(filteredLogs.length - visibleLogsLimit).toLocaleString()} حركة متبقية)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Parliamentary Inquiries */}
      {activeTab === 'inquiries' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs text-slate-800">الأسئلة النيابية واللجان الرقابية</h3>
            <button
              onClick={() => setShowInquiryModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة سؤال نيابي أو ملف رقابي</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {inquiries.map((inq) => (
              <div key={inq.id} className="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-700">{inq.inquiryNumber}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    inq.status === 'إحالة للنزاهة'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {inq.status}
                  </span>
                </div>

                <h4 className="font-bold text-xs text-slate-900">{inq.subject}</h4>
                <div className="text-xs text-amber-700 font-semibold">الوزارة المستهدفة: {inq.targetMinistry}</div>
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                  {inq.details}
                </p>

                <div className="text-[10px] text-slate-400 font-mono">
                  تاريخ التقديم: {inq.submissionDate}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inquiry Modal */}
      {showInquiryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">إضافة سؤال برلماني رقابي</h3>
              <button onClick={() => setShowInquiryModal(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
            </div>

            <form onSubmit={handleAddInquiry} className="space-y-3 text-right">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الوزارة / الجهة التنفيذية</label>
                <input
                  type="text"
                  value={newMinistry}
                  onChange={(e) => setNewMinistry(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">موضوع السؤال أو الملف الرقابي</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="حول تلكؤ مشاريع مجاري ذي قار..."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">السند الدستوري وتفاصيل الاستفسار</label>
                <textarea
                  value={newDetails}
                  onChange={(e) => setNewDetails(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setShowInquiryModal(false)} className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">إلغاء</button>
                <button type="submit" className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs">حفظ السؤال النيابي</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
