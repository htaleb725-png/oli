import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Users, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  X, 
  Printer, 
  Calendar, 
  Building2, 
  MapPin, 
  Coins, 
  MessageSquare, 
  UserCheck, 
  Briefcase,
  Layers,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { printHtmlSafely } from '../utils/printReceiptHelper';

interface UniversalStatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UniversalStatisticsModal: React.FC<UniversalStatisticsModalProps> = ({ isOpen, onClose }) => {
  const { 
    currentUser, 
    citizens, 
    requests, 
    interviews, 
    cheques, 
    organizationRecords, 
    officialLetters, 
    auditLogs,
    systemSettings 
  } = useApp();

  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('all');

  if (!isOpen) return null;

  // Determine if the user is an Executive (Admin / Director / Developer / Office Manager)
  const isExecutiveOrAdmin = useMemo(() => {
    if (!currentUser) return false;
    const role = (currentUser.Role || '').toLowerCase();
    const dept = (currentUser.Department || '').toLowerCase();
    return (
      role === 'developer' ||
      role === 'director' ||
      role === 'admin' ||
      role === 'master_admin' ||
      role === 'admin_officer' ||
      dept.includes('إدارة') ||
      dept.includes('ادارة') ||
      dept.includes('مدير')
    );
  }, [currentUser]);

  // Date filtering helper
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const isWithinTimeRange = (dateStr?: string) => {
    if (!dateStr) return timeRange === 'all';
    if (timeRange === 'all') return true;
    
    const itemDate = new Date(dateStr.slice(0, 10));
    if (isNaN(itemDate.getTime())) return true;

    if (timeRange === 'today') {
      return dateStr.startsWith(todayStr);
    }
    if (timeRange === 'week') {
      const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 7;
    }
    if (timeRange === 'month') {
      const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 30;
    }
    return true;
  };

  // Filtered collections
  const filteredCitizens = citizens.filter(c => isWithinTimeRange(c.CreatedAt));
  const filteredRequests = requests.filter(r => isWithinTimeRange(r.CreatedAt));
  const filteredInterviews = interviews.filter(i => isWithinTimeRange(i.InterviewDate || i.CreatedAt));
  const filteredCheques = cheques.filter(c => isWithinTimeRange(c.IssueDate || c.CreatedAt));
  const filteredLetters = officialLetters.filter(l => isWithinTimeRange(l.LetterDate));

  // Executive Stats Calculation
  const totalCitizens = filteredCitizens.length;
  const blockedCitizensCount = filteredCitizens.filter(c => c.IsBlocked).length;
  const todayNewCitizensCount = citizens.filter(c => (c.CreatedAt || '').startsWith(todayStr)).length;

  const totalRequests = filteredRequests.length;
  const completedRequests = filteredRequests.filter(r => r.ProcessingStatus === 'منجز' || Boolean(r.OutgoingNumber));
  const pendingRequests = filteredRequests.filter(r => r.ProcessingStatus === 'قيد الإجراء' || r.ProcessingStatus === 'بانتظار الموافقة' || !r.OutgoingNumber);
  const specialRequests = filteredRequests.filter(r => r.Priority === 'خاص جداً' || (r.DirectorNotes && r.DirectorNotes.includes('خاص')));
  const rejectedRequests = filteredRequests.filter(r => r.ProcessingStatus === 'مرفوض' || (r.DirectorNotes && r.DirectorNotes.includes('مرفوض')));
  const todayCompletedRequests = requests.filter(r => (r.OutgoingDate === todayStr || (r.CreatedAt || '').startsWith(todayStr)) && r.OutgoingNumber).length;

  const totalChequesAmount = filteredCheques.reduce((sum, c) => sum + (Number(c.Amount) || 0), 0);
  const totalInterviewsCount = filteredInterviews.length;
  const completedInterviewsCount = filteredInterviews.filter(i => i.Status === 'تمت المقابلة' || Boolean(i.ConvertedToRequest)).length;

  // Top Entities / Ministries breakdown
  const entityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRequests.forEach(r => {
      const ent = (r.Entity || 'جهة غير محددة').trim();
      counts[ent] = (counts[ent] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [filteredRequests]);

  // Top Districts breakdown
  const districtCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCitizens.forEach(c => {
      const dist = (c.District || 'مركز المحافظة').trim();
      counts[dist] = (counts[dist] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [filteredCitizens]);

  // Employee Department-Specific Stats Calculation
  const employeeName = currentUser?.FullName || '';
  const employeeRole = currentUser?.Role || '';
  const employeeDept = currentUser?.Department || 'القسم العام';

  // Audit actions executed by this user
  const userAuditActions = auditLogs.filter(log => 
    (log.User && log.User === employeeName) || 
    (log.UserName && log.UserName === employeeName) ||
    (log.Details && employeeName && log.Details.includes(employeeName))
  );
  const todayUserAuditCount = userAuditActions.filter(log => (log.Timestamp || '').startsWith(todayStr)).length;

  // Department-specific records:
  const deptCitizensCreated = citizens.filter(c => c.CreatedBy === employeeName || (c.CreatedBy && c.CreatedBy.includes(employeeName)));
  const deptRequestsHandled = requests.filter(r => r.CreatedBy === employeeName || (r.CreatedBy && r.CreatedBy.includes(employeeName)));
  const deptInterviewsHandled = interviews.filter(i => (i.CitizenName && i.CitizenName.includes(employeeName)));

  // Print statistics report safely
  const handlePrintReport = () => {
    const printContent = `
      <div style="direction: rtl; font-family: sans-serif; padding: 24px;">
        <div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #1e3a8a;">${systemSettings.officeName || 'مكتب مجلس النواب العراقي'}</h2>
          <h3 style="margin: 6px 0; color: #475569;">تقرير مؤشرات الأداء والإحصائيات الرسمية</h3>
          <p style="margin: 0; font-size: 12px; color: #64748b;">تاريخ التقرير: ${new Date().toLocaleString('ar-IQ')} | المستخدم: ${currentUser?.FullName} (${currentUser?.RoleArabic || currentUser?.Role})</p>
        </div>

        ${isExecutiveOrAdmin ? `
          <h4 style="color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">المؤشرات الإدارية العامة للمنظومة:</h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
            <tr style="background: #f1f5f9;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">المؤشر</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">العدد الإجمالي</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">الملاحظات</th>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">إجمالي المراجعين المسجلين</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${totalCitizens}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">منهم ${todayNewCitizensCount} مراجعين مسجلين اليوم</td>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">إجمالي الطلبات والمعاملات</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${totalRequests}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">منجز: ${completedRequests.length} | قيد التدقيق: ${pendingRequests.length}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">المعاملات الصادرة اليوم</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${todayCompletedRequests}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">معاملات موثقة برقم وتاريخ صادر رسمي</td>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">المقابلات الشخصية للنائب</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${totalInterviewsCount}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">المكتمل منها: ${completedInterviewsCount}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">المساعدات المالية (الصكوك)</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${filteredCheques.length} صك</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">إجمالي المبالغ: ${totalChequesAmount.toLocaleString()} دينار عراقي</td>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">المراجعين بالقائمة السوداء (محظورين)</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: #dc2626;">${blockedCitizensCount}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">محظورين رسمياً من الترويج والإصدار</td>
            </tr>
          </table>
        ` : `
          <h4 style="color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">إحصائيات إنجاز الموظف (${currentUser?.FullName}):</h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
            <tr style="background: #f1f5f9;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">البيان</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">العدد</th>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">القسم التابع له</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${employeeDept}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">المراجعين المسجلين بواسطة الموظف</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${deptCitizensCreated.length}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">الطلبات والمعاملات المسجلة / المتابعة</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${deptRequestsHandled.length}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">إجمالي الحركات الموثقة بالسجل</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${userAuditActions.length} (اليوم: ${todayUserAuditCount})</td>
            </tr>
          </table>
        `}
      </div>
    `;

    printHtmlSafely(printContent);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-blue-500/30 dark:border-blue-400/20 max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300 shadow-inner">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  {isExecutiveOrAdmin ? 'لوحة الإحصائيات المركزية الشاملة للمنظومة' : `لوحة إحصائيات وإنجاز: ${employeeDept}`}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-400/20 text-blue-200 border border-blue-300/30">
                  {isExecutiveOrAdmin ? 'صلاحية الإدارة العليا' : 'قسم الموظف'}
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                {isExecutiveOrAdmin 
                  ? 'عرض مباشر لكافة مؤشرات الأداء، حركات المراجعين، الصادر، والموقف المالي'
                  : `متابعة إنجاز وحركات الموظف (${currentUser?.FullName}) في ${employeeDept}`
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintReport}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
              title="طباعة تقرير الإحصائيات"
            >
              <Printer className="w-4 h-4 text-blue-200" />
              <span className="hidden sm:inline">طباعة التقرير</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Time Filter Bar */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs shrink-0 flex-wrap">
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-bold">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>نطاق العرض الزمني:</span>
          </div>

          <div className="flex items-center gap-1.5 font-bold">
            <button
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                timeRange === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              كافة البيانات
            </button>
            <button
              onClick={() => setTimeRange('today')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                timeRange === 'today'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              اليوم فقط ({todayStr})
            </button>
            <button
              onClick={() => setTimeRange('week')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                timeRange === 'week'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              آخر 7 أيام
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                timeRange === 'month'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              آخر 30 يوماً
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">

          {isExecutiveOrAdmin ? (
            /* ========================================================= */
            /* EXECUTIVE / ADMIN / DIRECTOR / DEVELOPER VIEW             */
            /* ========================================================= */
            <>
              {/* Top Key Performance Indicators Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Citizens */}
                <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60">
                  <div className="flex items-center justify-between text-blue-700 dark:text-blue-300 mb-1">
                    <span className="text-xs font-bold">المراجعين المسجلين</span>
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black font-mono text-blue-950 dark:text-blue-100">
                    {totalCitizens.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-blue-700 dark:text-blue-400 font-medium mt-1">
                    اليوم: +{todayNewCitizensCount} مراجع جديد
                  </div>
                </div>

                {/* 2. Requests */}
                <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
                  <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300 mb-1">
                    <span className="text-xs font-bold">إجمالي المعاملات</span>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black font-mono text-indigo-950 dark:text-indigo-100">
                    {totalRequests.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium mt-1">
                    بمعدل {(totalCitizens > 0 ? (totalRequests / totalCitizens).toFixed(1) : 1)} معاملة لكل مراجع
                  </div>
                </div>

                {/* 3. Completed & Outgoing */}
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 mb-1">
                    <span className="text-xs font-bold">المعاملات المنجزة (صادر)</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-950 dark:text-emerald-100">
                    {completedRequests.length.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-1">
                    نسبة الإنجاز: {totalRequests > 0 ? Math.round((completedRequests.length / totalRequests) * 100) : 0}%
                  </div>
                </div>

                {/* 4. Pending Attention */}
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                  <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 mb-1">
                    <span className="text-xs font-bold">قيد التدقيق والمتابعة</span>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-950 dark:text-amber-100">
                    {pendingRequests.length.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium mt-1">
                    بانتظار توجيه أو صادر رسمي
                  </div>
                </div>
              </div>

              {/* Secondary Status Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Special Path */}
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-purple-700 dark:text-purple-300 font-bold block">مسار وتوجيه خاص</span>
                    <span className="text-lg font-black font-mono text-purple-900 dark:text-purple-100">{specialRequests.length}</span>
                  </div>
                  <Sparkles className="w-5 h-5 text-purple-500" />
                </div>

                {/* Rejected */}
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-rose-700 dark:text-rose-300 font-bold block">معاملات مرفوضة</span>
                    <span className="text-lg font-black font-mono text-rose-900 dark:text-rose-100">{rejectedRequests.length}</span>
                  </div>
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                </div>

                {/* Blacklist / Blocked */}
                <div className="p-3 rounded-xl bg-red-100/80 dark:bg-red-950/60 border-2 border-red-300 dark:border-red-700 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-red-800 dark:text-red-300 font-bold block">القائمة السوداء (محظورين)</span>
                    <span className="text-lg font-black font-mono text-red-900 dark:text-red-100">{blockedCitizensCount}</span>
                  </div>
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                </div>

                {/* Financial Support */}
                <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-teal-700 dark:text-teal-300 font-bold block">المساعدات المالية (صكوك)</span>
                    <span className="text-xs font-black font-mono text-teal-900 dark:text-teal-100">
                      {totalChequesAmount.toLocaleString()} د.ع
                    </span>
                  </div>
                  <Coins className="w-5 h-5 text-teal-600" />
                </div>
              </div>

              {/* Detailed Breakdown: Top Entities & Top Districts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Entities */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span>الجهات والوزارات الأكثر استهدافاً بالطلبات</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-bold">أعلى 5 جهات</span>
                  </div>

                  <div className="space-y-2">
                    {entityCounts.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">لا توجد طلبات كافية للتحليل</p>
                    ) : (
                      entityCounts.map(([entity, count], idx) => {
                        const pct = totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[220px]" title={entity}>
                                {idx + 1}. {entity}
                              </span>
                              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                {count} معاملة ({pct}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-blue-600 h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.max(5, pct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Top Districts */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>التوزيع الجغرافي للمراجعين (الأقضية والنواحي)</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-bold">أعلى 5 مناطق</span>
                  </div>

                  <div className="space-y-2">
                    {districtCounts.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">لا توجد بيانات جغرافية كافية</p>
                    ) : (
                      districtCounts.map(([district, count], idx) => {
                        const pct = totalCitizens > 0 ? Math.round((count / totalCitizens) * 100) : 0;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {idx + 1}. {district}
                              </span>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {count} مراجع ({pct}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.max(5, pct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ========================================================= */
            /* DEPARTMENTAL EMPLOYEE VIEW                                */
            /* ========================================================= */
            <>
              {/* Employee Header Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/80 border border-blue-200 dark:border-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {currentUser?.FullName ? currentUser.FullName.slice(0, 1) : 'م'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        الموظف: {currentUser?.FullName}
                      </h4>
                      <span className="text-[10px] bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">
                        {currentUser?.RoleArabic || currentUser?.Role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      القسم الحالي: {employeeDept} • مؤشرات الإنجاز المباشرة
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs font-black flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>حالة الحساب: نشط 🌟</span>
                  </div>
                </div>
              </div>

              {/* Departmental KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-500 block mb-1">المراجعين المسجلين بواسطتك</span>
                  <div className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                    {deptCitizensCreated.length}
                  </div>
                  <span className="text-[11px] text-slate-400">ملفات مراجعين جديدة</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-500 block mb-1">المعاملات التي تمت معالجتها</span>
                  <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                    {deptRequestsHandled.length}
                  </div>
                  <span className="text-[11px] text-slate-400">طلبات مرتبطة بحسابك</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 col-span-2 sm:col-span-1">
                  <span className="text-xs font-bold text-slate-500 block mb-1">النشاطات الموثقة اليوم</span>
                  <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {todayUserAuditCount}
                  </div>
                  <span className="text-[11px] text-slate-400">حركة إدارية مسجلة اليوم</span>
                </div>
              </div>

              {/* Recent Actions List for the Employee */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>آخر العمليات والحركات المنجزة بواسطة الموظف</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">
                    إجمالي السجل: {userAuditActions.length}
                  </span>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {userAuditActions.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">لا توجد عمليات مسجلة حديثاً للموظف.</p>
                  ) : (
                    userAuditActions.slice(0, 10).map((log, idx) => (
                      <div key={idx} className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block truncate">
                            {log.Action || log.ActionType || 'عملية إدارية'}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">
                            {log.Details}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0" dir="ltr">
                          {log.Timestamp}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            تحديث لحظي ومستمر مع قواعد بيانات Firebase و Google Sheets ⚡
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs cursor-pointer shadow-sm"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
