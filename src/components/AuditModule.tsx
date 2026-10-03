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
  FileDown
} from 'lucide-react';
import { OfficeIconTilesGrid, OfficeTileItem } from './OfficeIconTilesGrid';

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
    addAuditLog,
    exportToExcel 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'followup_stats' | 'audit_trail' | 'inquiries'>('followup_stats');
  const [statsCategory, setStatsCategory] = useState<'clans' | 'districts' | 'jobs' | 'entities'>('clans');
  const [searchQuery, setSearchQuery] = useState('');

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

  // 1. Clan / Surname Statistics
  const clanStats = useMemo(() => {
    const map = new Map<string, { count: number; requestsCount: number; completedCount: number }>();
    citizens.forEach(c => {
      const clan = c.Surname?.trim() || 'عام / بدون لقب';
      const citReqs = requests.filter(r => r.Citizen_ID === c.Citizen_ID);
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
  }, [citizens, requests]);

  // 2. District / Regional Statistics
  const districtStats = useMemo(() => {
    const map = new Map<string, { count: number; requestsCount: number; completedCount: number }>();
    citizens.forEach(c => {
      const district = c.District?.trim() || 'غير محدد';
      const citReqs = requests.filter(r => r.Citizen_ID === c.Citizen_ID);
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
  }, [citizens, requests]);

  // 3. Job / Occupation Statistics
  const jobStats = useMemo(() => {
    const map = new Map<string, { count: number; requestsCount: number }>();
    citizens.forEach(c => {
      const job = c.Job?.trim() || 'كاسب';
      const citReqs = requests.filter(r => r.Citizen_ID === c.Citizen_ID);
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
  }, [citizens, requests]);

  // 4. Entity / Social Care & Ministry Statistics
  const entityStats = useMemo(() => {
    const map = new Map<string, { total: number; completed: number; inProgress: number; urgent: number }>();
    requests.forEach(r => {
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
  }, [requests]);

  // Global totals
  const totalCompleted = requests.filter(r => r.ProcessingStatus === 'منجز').length;
  const totalUrgent = requests.filter(r => r.Priority === 'عاجل' || r.Priority === 'خاص جداً').length;
  const totalScheduledInterviews = interviews.filter(i => i.Status === 'مجدولة').length;

  // Filtered audit logs
  const filteredLogs = auditLogs.filter(log => {
    const action = (log.ActionType || log.Action || '').toLowerCase();
    const user = (log.UserName || log.User || '').toLowerCase();
    const dept = (log.Department || log.Section || '').toLowerCase();
    const details = (log.Details || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return action.includes(q) || user.includes(q) || dept.includes(q) || details.includes(q);
  });

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
      const reqData = requests.map(r => ({
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

      {/* 5-Column Desktop Icon Grid for Audit & Control */}
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
            isActive: activeTab === 'followup_stats',
            onClick: () => setActiveTab('followup_stats')
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
            isActive: activeTab === 'audit_trail',
            onClick: () => setActiveTab('audit_trail')
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
            isActive: activeTab === 'inquiries',
            onClick: () => setActiveTab('inquiries')
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
            isActive: activeTab === 'followup_stats' && statsCategory === 'clans',
            onClick: () => {
              setActiveTab('followup_stats');
              setStatsCategory('clans');
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
            isActive: activeTab === 'followup_stats' && statsCategory === 'districts',
            onClick: () => {
              setActiveTab('followup_stats');
              setStatsCategory('districts');
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
            isActive: activeTab === 'followup_stats' && statsCategory === 'jobs',
            onClick: () => {
              setActiveTab('followup_stats');
              setStatsCategory('jobs');
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
            isActive: activeTab === 'followup_stats' && statsCategory === 'entities',
            onClick: () => {
              setActiveTab('followup_stats');
              setStatsCategory('entities');
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

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('followup_stats')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'followup_stats'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>المتابعة والإحصائيات الشاملة لكافة الأقسام</span>
        </button>

        <button
          onClick={() => setActiveTab('audit_trail')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'audit_trail'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>سجل الحركات والتدقيق الأمني ({filteredLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('inquiries')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'inquiries'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>الأسئلة والمساءلات البرلمانية ({inquiries.length})</span>
        </button>
      </div>

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
              <div className="text-2xl font-black text-blue-700">{requests.length} <span className="text-xs font-normal text-slate-400">معاملة</span></div>
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

      {/* TAB 2: Audit Trail (سجل الحركات) */}
      {activeTab === 'audit_trail' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في سجل العمليات باسم الموظف، القسم، أو نوع الحركة..."
              className="w-full pr-10 pl-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-xs text-right outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
            />
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-xs font-bold text-slate-800">سجل النشاطات الإدارية المشفر ({filteredLogs.length})</span>
              <span className="text-[10px] text-slate-500">حفظ تلقائي لجميع التعديلات وحركات الحذف والطباعة</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">الرقم</th>
                    <th className="p-3">نوع الإجراء</th>
                    <th className="p-3">القسم</th>
                    <th className="p-3">الموظف القائم بالحركة</th>
                    <th className="p-3">تفاصيل الحركة الإدارية</th>
                    <th className="p-3">الوقت والتاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLogs.map((log, idx) => (
                    <tr key={`${log.Log_ID || 'log'}-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono text-slate-400 text-[11px]">{log.Log_ID}</td>
                      <td className="p-3 font-bold text-slate-900">{log.ActionType || log.Action}</td>
                      <td className="p-3 text-blue-700 font-semibold">{log.Department || log.Section}</td>
                      <td className="p-3 font-semibold text-slate-800">{log.UserName || log.User}</td>
                      <td className="p-3 text-slate-600">{log.Details}</td>
                      <td className="p-3 font-mono text-[10px] text-slate-400" dir="ltr">{log.Timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
