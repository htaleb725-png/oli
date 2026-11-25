import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  X,
  Phone,
  Building2,
  FileText,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  Award,
  UserCheck,
  Filter,
  ArrowUpDown,
  PackageCheck
} from 'lucide-react';
import { Citizen, OfficeRequest } from '../types';

interface ReferrerSummary {
  name: string;
  category: 'women' | 'men' | 'org';
  categoryLabel: string;
  citizensCount: number;
  requestsCount: number;
  completedCount: number;
  inProgressCount: number;
  rejectedCount: number;
  deliveredCount: number;
  completionRate: number;
  topEntities: string[];
  citizens: Citizen[];
  requests: OfficeRequest[];
}

const escapeHtml = (val: any): string =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const printHtmlViaIframe = (html: string) => {
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
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 1400);
    }, 260);
  }
};

export const ReferrersStats: React.FC = () => {
  const { citizens, requests, systemSettings, exportToExcel, addAuditLog } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'women' | 'men' | 'org' | 'specific'>('all');
  const [selectedReferrerName, setSelectedReferrerName] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'requests' | 'rate' | 'citizens' | 'name'>('requests');
  const [selectedReferrer, setSelectedReferrer] = useState<ReferrerSummary | null>(null);
  const [modalSearch, setModalSearch] = useState('');

  // Smart classifier for Iraqi Arabic referrer names (Women / Men / Organizations)
  const classifyReferrer = (name: string): { category: 'women' | 'men' | 'org'; label: string } => {
    const clean = name.trim();
    const orgKeywords = [
      'مكتب',
      'حزب',
      'تيار',
      'كتلة',
      'حركة',
      'مؤسسة',
      'منظمة',
      'نقابة',
      'هيئة',
      'لجنة',
      'رابطة',
      'فريق',
      'ديوان',
      'مديرية',
      'عشيرة',
      'قبيلة',
      'مجلس',
      'موكب',
      'حسينية',
      'تنظيم',
      'مباشر',
      'استيراد'
    ];
    if (orgKeywords.some(k => clean.includes(k))) {
      return { category: 'org', label: 'جهة / تنظيم' };
    }

    const femaleTitles = [
      'أم ',
      'ام ',
      'الست ',
      'ست ',
      'السيدة ',
      'سيدة ',
      'الأخت ',
      'اخت ',
      'الحاجة ',
      'حاجة ',
      'العلوية ',
      'علوية ',
      'الدكتورة ',
      'دكتورة ',
      'المهندسة ',
      'مهندسة ',
      'الأستاذة ',
      'أستاذة ',
      'النائب علا',
      'النائبة ',
      'مدام ',
      'خالة ',
      'عمة '
    ];
    const femaleFirstNames = [
      'علا', 'زينب', 'فاطمة', 'فاطمه', 'زهراء', 'مريم', 'نور', 'هدى', 'سارة', 'ساره', 'رؤى', 'رقية', 'رقيه',
      'سكينة', 'سكينه', 'أمل', 'امل', 'آمنة', 'امنة', 'امنه', 'إيمان', 'ايمان', 'حنين', 'دعاء', 'رسل', 'سجى',
      'ضحى', 'عذراء', 'غدير', 'ملاك', 'مروة', 'مروه', 'ندى', 'هاجر', 'ولاء', 'يسرى', 'بتول', 'كوثر', 'نرجس',
      'بنين', 'طيبة', 'طيبه', 'شهد', 'شمس', 'تبارك', 'جنان', 'حنان', 'خديجة', 'خديجه', 'سعاد', 'سلمى', 'سميرة',
      'سميره', 'صباح', 'عائشة', 'عائشه', 'عبير', 'عفاف', 'فاتن', 'كفاح', 'لمياء', 'ليلى', 'منى', 'مها', 'نادية',
      'ناديه', 'نجاة', 'نجلاء', 'نسرين', 'نهى', 'هناء', 'وداد', 'وفاء', 'آلاء', 'الاء', 'إسراء', 'اسراء', 'أفراح',
      'افراح', 'أزهار', 'ازهار', 'إنتصار', 'انتصار', 'بشرى', 'تغريد', 'ثريا', 'جميلة', 'جميله', 'جواهر', 'حسناء',
      'حليمة', 'حليمه', 'حورية', 'حوريه', 'خالدة', 'خالده', 'دلال', 'دنيا', 'رغد', 'رنا', 'ريم', 'زينة', 'زينه',
      'سحر', 'سناء', 'سهام', 'سهى', 'شذى', 'شيماء', 'صفاء', 'ضمياء', 'علياء', 'غفران', 'فائزة', 'فائزه', 'فرح',
      'فضيلة', 'فضيله', 'فوزية', 'فوزيه', 'كريمة', 'كريمه', 'لطيفة', 'لطيفه', 'ماجدة', 'ماجده', 'محاسن', 'مديحة',
      'مديحه', 'ميادة', 'مياده', 'ناهدة', 'ناهده', 'نبيلة', 'نبيله', 'نوال', 'هالة', 'هاله', 'هبة', 'هبه', 'هديل',
      'هند', 'هيام', 'ياسمين', 'ابتسام', 'أحلام', 'احلام', 'أريج', 'اريج', 'أسماء', 'اسماء', 'أشواق', 'اشواق',
      'آيات', 'ايات', 'بيداء', 'تهاني', 'جمانة', 'جمانه', 'خلود', 'رحاب', 'رحمة', 'رحمه', 'رشا', 'رفل', 'رند',
      'روان', 'زمن', 'سما', 'سمية', 'سميه', 'سوسن', 'شروق', 'صبرية', 'صبريه', 'عروبة', 'عروبه', 'غادة', 'غاده',
      'فادية', 'فاديه', 'فاطم', 'قبس', 'لبنى', 'لينا', 'مآرب', 'ميساء', 'ميسون', 'نغم', 'نور الهدى', 'وسن', 'يمنى'
    ];

    if (femaleTitles.some(t => clean.startsWith(t) || clean.includes(` ${t}`))) {
      return { category: 'women', label: 'معرّفة (نساء)' };
    }
    const firstWord = clean.split(/\s+/)[0] || '';
    if (femaleFirstNames.includes(firstWord)) {
      return { category: 'women', label: 'معرّفة (نساء)' };
    }
    const maleEndingTaa = ['حمزة', 'حمزه', 'أسامة', 'اسامة', 'اسامه', 'معاوية', 'معاويه', 'حذيفة', 'حذيفه', 'طلحة', 'طلحه', 'عبيدة', 'عبيده', 'عكرمة', 'عكرمه', 'خليفة', 'خليفه', 'قتيبة', 'قتيبه', 'عقبة', 'عقبه', 'عطية', 'عطيه', 'جمعة', 'جمعه', 'عرفة', 'عرفه', 'عنترة', 'طعمه', 'طعمة', 'لفتة', 'لفته', 'حنتوشة', 'موسى', 'عيسى', 'يحيى', 'مصطفى', 'مرتضى', 'مجتبى'];
    if (firstWord.endsWith('ة') && !maleEndingTaa.includes(firstWord) && firstWord.length >= 3) {
      return { category: 'women', label: 'معرّفة (نساء)' };
    }

    return { category: 'men', label: 'معرّف / منسق (رجال)' };
  };

  // Aggregate citizens and requests by Referrer name accurately
  const referrerList = useMemo<ReferrerSummary[]>(() => {
    const map = new Map<
      string,
      {
        citizensMap: Map<string, Citizen>;
        requestsMap: Map<string, OfficeRequest>;
      }
    >();

    const citizenById = new Map<string, Citizen>();
    (citizens || []).forEach(c => {
      if (c && c.Citizen_ID) citizenById.set(c.Citizen_ID, c);
    });

    const getBucket = (rawName: string) => {
      const clean = rawName.trim() || 'مباشر (بدون معرف)';
      if (!map.has(clean)) {
        map.set(clean, { citizensMap: new Map(), requestsMap: new Map() });
      }
      return map.get(clean)!;
    };

    (citizens || []).forEach(c => {
      if (!c || !c.Citizen_ID) return;
      const refName = (c.ReferralSource || '').trim() || 'مباشر (بدون معرف)';
      getBucket(refName).citizensMap.set(c.Citizen_ID, c);
    });

    (requests || []).forEach(r => {
      if (!r || !r.Request_ID) return;
      const cit = citizenById.get(r.Citizen_ID);
      const refName = (r.ReferralSource || cit?.ReferralSource || '').trim() || 'مباشر (بدون معرف)';
      const bucket = getBucket(refName);
      bucket.requestsMap.set(r.Request_ID, r);
      if (cit) {
        bucket.citizensMap.set(cit.Citizen_ID, cit);
      }
    });

    const list: ReferrerSummary[] = [];
    map.forEach((bucket, name) => {
      const citArr = Array.from(bucket.citizensMap.values());
      const reqArr = Array.from(bucket.requestsMap.values());
      const completedCount = reqArr.filter(r => r.ProcessingStatus === 'منجز' || Boolean(r.OutgoingNumber)).length;
      const rejectedCount = reqArr.filter(r => r.ProcessingStatus === 'مرفوض').length;
      const inProgressCount = Math.max(0, reqArr.length - completedCount - rejectedCount);
      const deliveredCount = reqArr.filter(r => r.DeliveryStatus === 'مستلم').length;
      const completionRate = reqArr.length > 0 ? Math.round((completedCount / reqArr.length) * 100) : 0;

      // Top 3 entities per referrer
      const entCounts = new Map<string, number>();
      reqArr.forEach(r => {
        const ent = (r.Entity || '').trim();
        if (ent) entCounts.set(ent, (entCounts.get(ent) || 0) + 1);
      });
      const topEntities = Array.from(entCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([e]) => e);

      const cls = classifyReferrer(name);

      list.push({
        name,
        category: cls.category,
        categoryLabel: cls.label,
        citizensCount: citArr.length,
        requestsCount: reqArr.length,
        completedCount,
        inProgressCount,
        rejectedCount,
        deliveredCount,
        completionRate,
        topEntities,
        citizens: citArr,
        requests: reqArr
      });
    });

    return list.sort((a, b) => b.requestsCount - a.requestsCount || b.citizensCount - a.citizensCount);
  }, [citizens, requests]);

  const categoryCounts = useMemo(() => {
    const women = referrerList.filter(r => r.category === 'women').length;
    const men = referrerList.filter(r => r.category === 'men').length;
    const org = referrerList.filter(r => r.category === 'org').length;
    return { all: referrerList.length, women, men, org };
  }, [referrerList]);

  const filteredReferrers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = referrerList.filter(r => {
      if (filterMode === 'women' && r.category !== 'women') return false;
      if (filterMode === 'men' && r.category !== 'men') return false;
      if (filterMode === 'org' && r.category !== 'org') return false;
      if (filterMode === 'specific' && selectedReferrerName !== 'ALL' && r.name !== selectedReferrerName) return false;
      if (q) {
        const inName = r.name.toLowerCase().includes(q);
        const inEnt = r.topEntities.some(e => e.toLowerCase().includes(q));
        if (!inName && !inEnt) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'rate') return b.completionRate - a.completionRate || b.requestsCount - a.requestsCount;
      if (sortBy === 'citizens') return b.citizensCount - a.citizensCount || b.requestsCount - a.requestsCount;
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
      return b.requestsCount - a.requestsCount || b.citizensCount - a.citizensCount;
    });
  }, [referrerList, filterMode, selectedReferrerName, searchQuery, sortBy]);

  // Executive KPIs computed over current filtered dataset
  const totals = useMemo(() => {
    const totalCitizens = filteredReferrers.reduce((acc, r) => acc + r.citizensCount, 0);
    const totalRequests = filteredReferrers.reduce((acc, r) => acc + r.requestsCount, 0);
    const totalCompleted = filteredReferrers.reduce((acc, r) => acc + r.completedCount, 0);
    const totalInProgress = filteredReferrers.reduce((acc, r) => acc + r.inProgressCount, 0);
    const totalRejected = filteredReferrers.reduce((acc, r) => acc + r.rejectedCount, 0);
    const totalDelivered = filteredReferrers.reduce((acc, r) => acc + r.deliveredCount, 0);
    const avgRate = totalRequests > 0 ? Math.round((totalCompleted / totalRequests) * 100) : 0;
    const topReferrer = filteredReferrers.find(r => r.name !== 'مباشر (بدون معرف)') || filteredReferrers[0] || null;
    return {
      totalCitizens,
      totalRequests,
      totalCompleted,
      totalInProgress,
      totalRejected,
      totalDelivered,
      avgRate,
      topReferrer
    };
  }, [filteredReferrers]);

  const top5Visual = useMemo(() => {
    const real = filteredReferrers.filter(r => r.requestsCount > 0).slice(0, 5);
    const maxReq = Math.max(1, ...real.map(r => r.requestsCount));
    return real.map(r => ({
      ...r,
      widthPct: Math.max(8, Math.round((r.requestsCount / maxReq) * 100))
    }));
  }, [filteredReferrers]);

  const activeFilterLabel = useMemo(() => {
    if (filterMode === 'women') return 'النساء فقط (المعرّفات)';
    if (filterMode === 'men') return 'الرجال فقط (المعرّفين والمنسقين)';
    if (filterMode === 'org') return 'الجهات والتنظيمات';
    if (filterMode === 'specific' && selectedReferrerName !== 'ALL') return `معرف محدد: ${selectedReferrerName}`;
    return 'كافة المعرفين والمنسقين';
  }, [filterMode, selectedReferrerName]);

  const handleExportAll = () => {
    const data = filteredReferrers.map((r, idx) => ({
      'ت': idx + 1,
      'اسم المعرف / المنسق': r.name,
      'التصنيف': r.categoryLabel,
      'عدد المواطنين': r.citizensCount,
      'إجمالي الطلبات': r.requestsCount,
      'المنجز': r.completedCount,
      'قيد المتابعة': r.inProgressCount,
      'المرفوض': r.rejectedCount,
      'تم تسليمه للمراجع': r.deliveredCount,
      'نسبة الإنجاز': `${r.completionRate}%`,
      'أبرز الجهات والوزارات': r.topEntities.join(' ، ') || '—'
    }));
    const suffix =
      filterMode === 'women'
        ? 'النساء_فقط'
        : filterMode === 'men'
        ? 'الرجال_فقط'
        : filterMode === 'org'
        ? 'الجهات_والتنظيمات'
        : filterMode === 'specific' && selectedReferrerName !== 'ALL'
        ? selectedReferrerName.replace(/\s+/g, '_')
        : 'الشامل';
    exportToExcel(data, `قائمة_وإحصائيات_المعرفين_${suffix}`);
    addAuditLog('تصدير قائمة المعرفين Excel', 'قسم الإدارة — المعرفين', `تم تصدير (${data.length}) معرف (${activeFilterLabel})`);
  };

  const handleExportSingleReferrer = (refItem: ReferrerSummary) => {
    const data = refItem.requests.map((req, idx) => ({
      'ت': idx + 1,
      'رقم الطلب': req.Request_ID,
      'العدد الصادر': req.OutgoingNumber || '—',
      'تاريخ الصادر': req.OutgoingDate || '—',
      'اسم المواطن': req.CitizenName,
      'رقم الهاتف': req.CitizenPhone || '—',
      'القضاء / العنوان': req.Address || '—',
      'الجهة / الوزارة': req.Entity,
      'موضوع الطلب': req.Details,
      'حالة الإنجاز': req.ProcessingStatus || 'قيد المتابعة',
      'حالة الاستلام': req.DeliveryStatus || 'غير مستلم',
      'قرار المدير': req.DirectorDecision || '—',
      'تاريخ التسجيل': req.CreatedAt || '—'
    }));
    exportToExcel(data, `كشف_طلبات_المعرف_${refItem.name.replace(/\s+/g, '_')}`);
    addAuditLog('تصدير كشف معرف Excel', 'قسم الإدارة — المعرفين', `تم تصدير (${data.length}) طلب للمعرف: ${refItem.name}`);
  };

  // Official A4 Print for the Complete Referrers List (قائمة المعرفين بكافة التفاصيل)
  const handlePrintReferrersListA4 = () => {
    const officeTitle = systemSettings?.officeName || systemSettings?.appName || 'مكتب النائب المهندسة علا عودة الناشي';
    const printDate = new Date().toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' });
    const rowsHtml = filteredReferrers.map((r, idx) => `
      <tr>
        <td style="text-align:center;font-weight:700;">${idx + 1}</td>
        <td style="font-weight:800;color:#0b192c;">${escapeHtml(r.name)}</td>
        <td style="text-align:center;">${escapeHtml(r.categoryLabel)}</td>
        <td style="text-align:center;font-weight:700;">${r.citizensCount.toLocaleString()}</td>
        <td style="text-align:center;font-weight:800;color:#1d4ed8;">${r.requestsCount.toLocaleString()}</td>
        <td style="text-align:center;font-weight:700;color:#047857;">${r.completedCount.toLocaleString()}</td>
        <td style="text-align:center;font-weight:700;color:#b45309;">${r.inProgressCount.toLocaleString()}</td>
        <td style="text-align:center;font-weight:700;color:#be123c;">${r.rejectedCount.toLocaleString()}</td>
        <td style="text-align:center;font-weight:700;color:#0f766e;">${r.deliveredCount.toLocaleString()}</td>
        <td style="text-align:center;font-weight:800;">${r.completionRate}%</td>
        <td style="font-size:10px;color:#334155;">${escapeHtml(r.topEntities.join(' ، ') || '—')}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>قائمة وإحصائيات المعرفين والمنسقين</title>
<style>
  @page { size: A4 landscape; margin: 11mm; }
  body { font-family: 'Tajawal', 'Cairo', Tahoma, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; direction: rtl; background: #fff; }
  .header { border-bottom: 3px double #0b192c; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header h1 { margin: 0; font-size: 18px; color: #0b192c; font-weight: 900; }
  .header .sub { margin: 3px 0 0; font-size: 11px; color: #475569; font-weight: 600; }
  .meta { font-size: 11px; text-align: left; color: #334155; line-height: 1.6; }
  .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 12px; }
  .kpi { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 9px; background: #f8fafc; text-align: center; }
  .kpi .lbl { font-size: 10px; color: #475569; font-weight: 700; }
  .kpi .val { font-size: 15px; font-weight: 900; color: #0b192c; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #0b192c; color: #ffffff; padding: 7px 5px; border: 1px solid #0b192c; font-weight: 800; text-align: center; }
  td { padding: 6px 5px; border: 1px solid #cbd5e1; vertical-align: middle; }
  tr:nth-child(even) td { background: #f8fafc; }
  tfoot td { background: #e2e8f0 !important; font-weight: 900; border-top: 2px solid #0b192c; }
  .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 10px; color: #475569; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(officeTitle)}</h1>
      <div class="sub">الكشف الرسمي الشامل لقائمة المعرفين والمنسقين ومتابعة إنجاز طلباتهم — (${escapeHtml(activeFilterLabel)})</div>
    </div>
    <div class="meta">
      <div>تاريخ الطباعة: <strong>${escapeHtml(printDate)}</strong></div>
      <div>إجمالي القائمة: <strong>${filteredReferrers.length.toLocaleString()}</strong> معرف / منسق</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="lbl">عدد المعرفين</div><div class="val">${filteredReferrers.length.toLocaleString()}</div></div>
    <div class="kpi"><div class="lbl">إجمالي المراجعين</div><div class="val">${totals.totalCitizens.toLocaleString()}</div></div>
    <div class="kpi"><div class="lbl">إجمالي الطلبات</div><div class="val" style="color:#1d4ed8;">${totals.totalRequests.toLocaleString()}</div></div>
    <div class="kpi"><div class="lbl">الطلبات المنجزة</div><div class="val" style="color:#047857;">${totals.totalCompleted.toLocaleString()}</div></div>
    <div class="kpi"><div class="lbl">قيد المتابعة</div><div class="val" style="color:#b45309;">${totals.totalInProgress.toLocaleString()}</div></div>
    <div class="kpi"><div class="lbl">نسبة الإنجاز العام</div><div class="val" style="color:#0f766e;">${totals.avgRate}%</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:30px;">ت</th>
        <th style="text-align:right;min-width:155px;">اسم المعرف / المنسق</th>
        <th style="width:96px;">التصنيف</th>
        <th style="width:62px;">المراجعين</th>
        <th style="width:64px;">الطلبات</th>
        <th style="width:58px;">المنجز</th>
        <th style="width:66px;">قيد الإجراء</th>
        <th style="width:56px;">المرفوض</th>
        <th style="width:58px;">المستلم</th>
        <th style="width:64px;">الإنجاز %</th>
        <th style="text-align:right;">أبرز الوزارات والجهات المخاطبة</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="11" style="text-align:center;padding:20px;color:#64748b;">لا توجد بيانات مطابقة</td></tr>'}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align:right;padding-right:10px;">المجموع الكلي للقائمة</td>
        <td style="text-align:center;">${totals.totalCitizens.toLocaleString()}</td>
        <td style="text-align:center;color:#1d4ed8;">${totals.totalRequests.toLocaleString()}</td>
        <td style="text-align:center;color:#047857;">${totals.totalCompleted.toLocaleString()}</td>
        <td style="text-align:center;color:#b45309;">${totals.totalInProgress.toLocaleString()}</td>
        <td style="text-align:center;color:#be123c;">${totals.totalRejected.toLocaleString()}</td>
        <td style="text-align:center;color:#0f766e;">${totals.totalDelivered.toLocaleString()}</td>
        <td style="text-align:center;">${totals.avgRate}%</td>
        <td>تقرير رسمي موثق بكافة التفاصيل</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <span>صادر عن منظومة الإدارة الإلكترونية — ${escapeHtml(officeTitle)}</span>
    <span>توقيع مدير المكتب / مسؤول الإدارة: _______________________</span>
  </div>
</body>
</html>`;

    printHtmlViaIframe(html);
    addAuditLog('طباعة قائمة المعرفين A4', 'قسم الإدارة — المعرفين', `تمت طباعة كشف قائمة المعرفين (${filteredReferrers.length} معرف — ${activeFilterLabel})`);
  };

  // Official A4 Print for a SINGLE Referrer's Full Dossier (كشف تفصيلي بكافة طلبات المعرف)
  const handlePrintSingleReferrerA4 = (refItem: ReferrerSummary) => {
    const officeTitle = systemSettings?.officeName || systemSettings?.appName || 'مكتب النائب المهندسة علا عودة الناشي';
    const printDate = new Date().toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' });
    const rowsHtml = refItem.requests.map((req, idx) => `
      <tr>
        <td style="text-align:center;font-weight:700;">${idx + 1}</td>
        <td style="font-weight:800;color:#0b192c;">${escapeHtml(req.CitizenName || '—')}</td>
        <td style="font-family:monospace;text-align:center;direction:ltr;">${escapeHtml(req.CitizenPhone || '—')}</td>
        <td>${escapeHtml(req.Address || '—')}</td>
        <td style="font-weight:700;color:#1d4ed8;">${escapeHtml(req.Entity || '—')}</td>
        <td style="line-height:1.45;">${escapeHtml(req.Details || '—')}</td>
        <td style="font-family:monospace;text-align:center;">${escapeHtml(req.OutgoingNumber || '—')}</td>
        <td style="text-align:center;font-weight:700;">${escapeHtml(req.ProcessingStatus || 'قيد المتابعة')}</td>
        <td style="text-align:center;">${escapeHtml(req.DeliveryStatus || 'غير مستلم')}</td>
        <td style="font-family:monospace;text-align:center;font-size:10px;">${escapeHtml(req.OutgoingDate || (req.CreatedAt ? String(req.CreatedAt).split('T')[0] : '—'))}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>كشف تفصيلي — ${escapeHtml(refItem.name)}</title>
<style>
  @page { size: A4 landscape; margin: 11mm; }
  body { font-family: 'Tajawal', 'Cairo', Tahoma, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; direction: rtl; background: #fff; }
  .header { border-bottom: 3px double #0b192c; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header h1 { margin: 0; font-size: 17px; color: #0b192c; font-weight: 900; }
  .header .sub { margin: 4px 0 0; font-size: 12px; color: #1e40af; font-weight: 800; }
  .meta { font-size: 11px; text-align: left; color: #334155; line-height: 1.6; }
  .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 12px; }
  .kpi { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; background: #f8fafc; text-align: center; }
  .kpi .lbl { font-size: 10px; color: #475569; font-weight: 700; }
  .kpi .val { font-size: 15px; font-weight: 900; color: #0b192c; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { background: #0b192c; color: #fff; padding: 7px 5px; border: 1px solid #0b192c; font-weight: 800; text-align: center; }
  td { padding: 5.5px 5px; border: 1px solid #cbd5e1; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 10px; color: #475569; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(officeTitle)} — كشف معاملات معرّف / منسق</h1>
      <div class="sub">المعرف / المنسق: ${escapeHtml(refItem.name)} (${escapeHtml(refItem.categoryLabel)})</div>
    </div>
    <div class="meta">
      <div>تاريخ الطباعة: <strong>${escapeHtml(printDate)}</strong></div>
      <div>عدد المعاملات بالكشف: <strong>${refItem.requestsCount}</strong></div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="lbl">المراجعين</div><div class="val">${refItem.citizensCount}</div></div>
    <div class="kpi"><div class="lbl">إجمالي الطلبات</div><div class="val" style="color:#1d4ed8;">${refItem.requestsCount}</div></div>
    <div class="kpi"><div class="lbl">المنجز</div><div class="val" style="color:#047857;">${refItem.completedCount}</div></div>
    <div class="kpi"><div class="lbl">قيد المتابعة</div><div class="val" style="color:#b45309;">${refItem.inProgressCount}</div></div>
    <div class="kpi"><div class="lbl">المستلم</div><div class="val" style="color:#0f766e;">${refItem.deliveredCount}</div></div>
    <div class="kpi"><div class="lbl">نسبة الإنجاز</div><div class="val">${refItem.completionRate}%</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:28px;">ت</th>
        <th style="text-align:right;min-width:130px;">اسم المواطن</th>
        <th style="width:90px;">رقم الهاتف</th>
        <th style="width:90px;">العنوان / القضاء</th>
        <th style="width:120px;">الوزارة / الجهة</th>
        <th style="text-align:right;">موضوع وتفاصيل الطلب</th>
        <th style="width:82px;">العدد الصادر</th>
        <th style="width:68px;">الإنجاز</th>
        <th style="width:64px;">الاستلام</th>
        <th style="width:74px;">التاريخ</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="10" style="text-align:center;padding:18px;color:#64748b;">لا توجد معاملات مسجلة لهذا المعرف</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    <span>كشف تفصيلي رسمي صادر من ${escapeHtml(officeTitle)}</span>
    <span>توقيع مسؤول الإدارة: _______________________</span>
  </div>
</body>
</html>`;

    printHtmlViaIframe(html);
    addAuditLog('طباعة كشف معرف A4', 'قسم الإدارة — المعرفين', `تمت طباعة الكشف التفصيلي للمعرف: ${refItem.name} (${refItem.requestsCount} طلب)`);
  };

  const modalFilteredRequests = useMemo(() => {
    if (!selectedReferrer) return [];
    const q = modalSearch.trim().toLowerCase();
    if (!q) return selectedReferrer.requests;
    return selectedReferrer.requests.filter(req =>
      `${req.CitizenName} ${req.CitizenPhone || ''} ${req.Entity || ''} ${req.Details || ''} ${req.OutgoingNumber || ''} ${req.Request_ID || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [selectedReferrer, modalSearch]);

  return (
    <div className="space-y-4 font-['Tajawal',sans-serif]">
      {/* 1. Executive KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>إجمالي المعرفين والمنسقين</span>
            <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
            {filteredReferrers.length.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
            <span className="text-rose-600 dark:text-rose-400">نساء: {categoryCounts.women}</span>
            <span>•</span>
            <span className="text-blue-600 dark:text-blue-400">رجال: {categoryCounts.men}</span>
            <span>•</span>
            <span className="text-teal-600 dark:text-teal-400">جهات: {categoryCounts.org}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>المواطنون المحالون</span>
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-700 dark:text-blue-400 font-mono tabular-nums">
            {totals.totalCitizens.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            معدل {(filteredReferrers.length ? (totals.totalCitizens / filteredReferrers.length).toFixed(1) : '0')} مراجع لكل معرف
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>إجمالي الطلبات والمعاملات</span>
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
            {totals.totalRequests.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold">
            <span className="text-emerald-700 dark:text-emerald-400">منجز: {totals.totalCompleted.toLocaleString()}</span>
            <span className="text-slate-300">|</span>
            <span className="text-amber-700 dark:text-amber-400">قيد الإجراء: {totals.totalInProgress.toLocaleString()}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>نسبة الإنجاز العام</span>
            <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-teal-700 dark:text-teal-400 font-mono tabular-nums">
              {totals.avgRate}%
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              (مستلم: {totals.totalDelivered.toLocaleString()})
            </span>
          </div>
          {totals.topReferrer && (
            <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 truncate">
              <Award className="w-3 h-3 shrink-0" />
              <span className="truncate">الأكثر نشاطاً: {totals.topReferrer.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Top Performers Visual Overview (Compact Executive Card) */}
      {top5Visual.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>أبرز المعرفين والمنسقين حسب حجم الطلبات ونسبة الإنجاز</span>
            </h4>
            <span className="text-[11px] font-bold text-slate-500">عرض تلقائي لأعلى 5 ضمن الفلتر الحالي</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
            {top5Visual.map((item, i) => (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  setModalSearch('');
                  setSelectedReferrer(item);
                }}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-right transition-all cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-black text-amber-700 dark:text-amber-400">#{i + 1}</span>
                  <span className="font-mono text-[10px] font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {item.completionRate}% إنجاز
                  </span>
                </div>
                <div className="text-xs font-black text-slate-900 dark:text-white truncate" title={item.name}>
                  {item.name}
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-blue-600 to-teal-500"
                    style={{ width: `${item.widthPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                  <span>{item.requestsCount} طلب</span>
                  <span>{item.citizensCount} مراجع</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Main Referrers Directory, Filters & Official A4 Print Toolbar */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
          {/* Row 1: Title + Official Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  قائمة وإحصائيات المعرفين والمنسقين ({filteredReferrers.length.toLocaleString()})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  التصنيف النشط: <strong className="text-slate-700 dark:text-slate-200">{activeFilterLabel}</strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrintReferrersListA4}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة قائمة المعرفين (A4)</span>
              </button>
              <button
                type="button"
                onClick={handleExportAll}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>تصدير Excel</span>
              </button>
            </div>
          </div>

          {/* Row 2: Segmented Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {[
              { id: 'all', label: `الكل (${categoryCounts.all})` },
              { id: 'women', label: `النساء فقط (${categoryCounts.women})` },
              { id: 'men', label: `الرجال فقط (${categoryCounts.men})` },
              { id: 'org', label: `جهات وتنظيمات (${categoryCounts.org})` },
              { id: 'specific', label: 'معرف محدد بالاسم' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setFilterMode(tab.id as any);
                  if (tab.id !== 'specific') setSelectedReferrerName('ALL');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  filterMode === tab.id
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-blue-600 dark:border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Row 3: Search, Quick Referrer Selector, and Sort */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            <div className="relative md:col-span-5">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث باسم المعرف أو المنسق أو الوزارة..."
                className="w-full pr-9 pl-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-4 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedReferrerName}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedReferrerName(val);
                  if (val !== 'ALL') {
                    setFilterMode('specific');
                  } else if (filterMode === 'specific') {
                    setFilterMode('all');
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">-- اختيار معرف محدد مباشرة ({referrerList.length}) --</option>
                {referrerList.map(r => (
                  <option key={r.name} value={r.name}>
                    {r.name} ({r.requestsCount} طلب / {r.citizensCount} مراجع)
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="requests">الترتيب: الأكثر طلبات</option>
                <option value="rate">الترتيب: الأعلى نسبة إنجاز</option>
                <option value="citizens">الترتيب: الأكثر مراجعين</option>
                <option value="name">الترتيب: أبجدي (أ - ي)</option>
              </select>
            </div>
          </div>
        </div>

        {/* High-Density Executive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3 w-10 text-center">ت</th>
                <th className="p-3">اسم المعرف / المنسق</th>
                <th className="p-3 text-center">التصنيف</th>
                <th className="p-3 text-center">المواطنين</th>
                <th className="p-3 text-center">الطلبات</th>
                <th className="p-3 text-center">المنجز</th>
                <th className="p-3 text-center">قيد الإجراء</th>
                <th className="p-3 text-center">المستلم</th>
                <th className="p-3 text-center min-w-[120px]">نسبة الإنجاز</th>
                <th className="p-3">أبرز الجهات</th>
                <th className="p-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              {filteredReferrers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-10 text-center text-slate-400 font-bold">
                    لا توجد بيانات معرفين مطابقة لمعايير البحث أو الفلترة الحالية.
                  </td>
                </tr>
              ) : (
                filteredReferrers.map((ref, idx) => (
                  <tr
                    key={ref.name}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3 text-center font-mono text-slate-400 tabular-nums">{idx + 1}</td>
                    <td className="p-3 font-black text-slate-900 dark:text-white whitespace-nowrap">
                      {ref.name}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          ref.category === 'women'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                            : ref.category === 'org'
                            ? 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
                            : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                        }`}
                      >
                        {ref.categoryLabel}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                      {ref.citizensCount.toLocaleString()}
                    </td>
                    <td className="p-3 text-center font-mono font-black text-blue-700 dark:text-blue-400 tabular-nums">
                      {ref.requestsCount.toLocaleString()}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {ref.completedCount.toLocaleString()}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                      {ref.inProgressCount.toLocaleString()}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-teal-700 dark:text-teal-400 tabular-nums">
                      {ref.deliveredCount.toLocaleString()}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              ref.completionRate >= 70
                                ? 'bg-emerald-500'
                                : ref.completionRate >= 40
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`}
                            style={{ width: `${ref.completionRate}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-black text-slate-700 dark:text-slate-200 tabular-nums w-9 text-left">
                          {ref.completionRate}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3 max-w-[200px]">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={ref.topEntities.join(' ، ')}>
                        {ref.topEntities.length > 0 ? ref.topEntities.join(' ، ') : '—'}
                      </div>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setModalSearch('');
                            setSelectedReferrer(ref);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white border border-blue-200 dark:border-blue-800 text-[11px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>التفاصيل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintSingleReferrerA4(ref)}
                          title="طباعة كشف هذا المعرف A4"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-600 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modernized Referrer Dossier & Requests Modal */}
      {selectedReferrer && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
          dir="rtl"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold">
                    {selectedReferrer.categoryLabel}
                  </span>
                  <h3 className="text-base font-black">{selectedReferrer.name}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
                  <span>المراجعين: <strong className="text-white">{selectedReferrer.citizensCount}</strong></span>
                  <span>•</span>
                  <span>الطلبات: <strong className="text-blue-300">{selectedReferrer.requestsCount}</strong></span>
                  <span>•</span>
                  <span>المنجز: <strong className="text-emerald-300">{selectedReferrer.completedCount}</strong></span>
                  <span>•</span>
                  <span>المستلم: <strong className="text-teal-300">{selectedReferrer.deliveredCount}</strong></span>
                  <span>•</span>
                  <span>نسبة الإنجاز: <strong className="text-amber-300">{selectedReferrer.completionRate}%</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintSingleReferrerA4(selectedReferrer)}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة الكشف (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportSingleReferrer(selectedReferrer)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReferrer(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Search Strip */}
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  placeholder="بحث داخل طلبات هذا المعرف (الاسم، الهاتف، الصادر، الوزارة...)"
                  className="w-full pr-9 pl-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="text-xs font-bold text-slate-500">
                المعروض: {modalFilteredRequests.length} من {selectedReferrer.requestsCount} معاملة
              </span>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1">
              {modalFilteredRequests.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs font-bold">
                  لا توجد معاملات مطابقة للبحث داخل هذا الكشف.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5 text-center">ت</th>
                        <th className="p-2.5">اسم المواطن</th>
                        <th className="p-2.5">الهاتف</th>
                        <th className="p-2.5">الوزارة / الجهة</th>
                        <th className="p-2.5">موضوع الطلب</th>
                        <th className="p-2.5 text-center">العدد الصادر</th>
                        <th className="p-2.5 text-center">حالة الإنجاز</th>
                        <th className="p-2.5 text-center">الاستلام</th>
                        <th className="p-2.5 text-center">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {modalFilteredRequests.map((req, i) => (
                        <tr key={req.Request_ID || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 text-center font-mono text-slate-400 tabular-nums">{i + 1}</td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">{req.CitizenName}</td>
                          <td className="p-2.5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap" dir="ltr">
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {req.CitizenPhone || '—'}
                            </span>
                          </td>
                          <td className="p-2.5 font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="w-3 h-3 opacity-75" />
                              {req.Entity || '—'}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300 max-w-xs leading-relaxed">
                            {req.Details || '—'}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {req.OutgoingNumber || '—'}
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            {req.ProcessingStatus === 'منجز' || req.OutgoingNumber ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                منجز
                              </span>
                            ) : req.ProcessingStatus === 'مرفوض' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-bold">
                                <XCircle className="w-3 h-3" />
                                مرفوض
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold">
                                <Clock className="w-3 h-3" />
                                قيد المتابعة
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                req.DeliveryStatus === 'مستلم'
                                  ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <PackageCheck className="w-3 h-3" />
                              {req.DeliveryStatus === 'مستلم' ? 'مستلم' : 'غير مستلم'}
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-mono text-[10px] text-slate-400 whitespace-nowrap tabular-nums">
                            {req.OutgoingDate || (req.CreatedAt ? String(req.CreatedAt).split('T')[0] : '—')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
