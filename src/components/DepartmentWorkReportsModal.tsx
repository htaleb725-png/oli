import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { Citizen, OfficeRequest, Interview, OrganizationRecord } from '../types';
import { 
  Printer, 
  Download, 
  FileSpreadsheet, 
  X, 
  Calendar, 
  Filter, 
  CheckSquare, 
  Square, 
  Building2, 
  CheckCircle2, 
  Clock, 
  Search,
  FileText
} from 'lucide-react';

export type DepartmentType = 'reception' | 'organization' | 'interviews' | 'admin';

interface DepartmentWorkReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDepartment?: DepartmentType;
  allowedDepartments?: DepartmentType[];
}

export const DepartmentWorkReportsModal: React.FC<DepartmentWorkReportsModalProps> = ({
  isOpen,
  onClose,
  defaultDepartment = 'reception',
  allowedDepartments
}) => {
  const { citizens, requests, interviews, organizationRecords, addAuditLog, currentUser } = useApp();

  // Role and Department Access Logic: Developer & Director have full access; others locked to their department
  const isSuperUser = ['developer', 'director', 'deputy'].includes(currentUser?.Role || '');
  const userRole = currentUser?.Role || '';
  const userDept = currentUser?.Department || '';

  const userAuthorizedDept: DepartmentType = useMemo(() => {
    if (userRole === 'reception' || userRole === 'reception_officer' || userDept.includes('الاستعلامات')) {
      return 'reception';
    }
    if (userRole === 'admin' || userRole === 'admin_officer' || userDept.includes('الإدارة')) {
      return 'admin';
    }
    if (userRole === 'interviews_officer' || userDept.includes('المقابلات')) {
      return 'interviews';
    }
    if (userRole === 'organization' || userRole === 'organization_officer' || userDept.includes('التنظيم')) {
      return 'organization';
    }
    return defaultDepartment;
  }, [userRole, userDept, defaultDepartment]);

  const [department, setDepartment] = useState<DepartmentType>(defaultDepartment);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today');

  // Compute available departments based on caller / reception isolation
  const isReceptionMode = defaultDepartment === 'reception' || userAuthorizedDept === 'reception' || (allowedDepartments && allowedDepartments.includes('reception') && !allowedDepartments.includes('admin'));

  const availableDepartments: { id: DepartmentType; label: string }[] = useMemo(() => {
    if (allowedDepartments && allowedDepartments.length > 0) {
      const labels: Record<DepartmentType, string> = {
        reception: 'قسم الاستعلامات والمراجعين',
        interviews: 'قسم مقابلات النائب',
        admin: 'قسم الإدارة والمعاملات',
        organization: 'قسم التنظيم'
      };
      return allowedDepartments.map(id => ({ id, label: labels[id] || id }));
    }
    if (isReceptionMode) {
      return [
        { id: 'reception', label: 'قسم الاستعلامات والمراجعين' },
        { id: 'interviews', label: 'قسم مقابلات النائب' }
      ];
    }
    return [
      { id: 'reception', label: 'الاستعلامات' },
      { id: 'interviews', label: 'المقابلات' },
      { id: 'admin', label: 'الإدارة' },
      { id: 'organization', label: 'التنظيم' }
    ];
  }, [isReceptionMode, allowedDepartments]);

  // Set default department whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (defaultDepartment) {
        setDepartment(defaultDepartment);
      }
      setSelectedRecordIds(new Set());
    }
  }, [isOpen, defaultDepartment]);

  const effectiveDepartment: DepartmentType = department;
  
  // Custom date range
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  
  // Search query within the report
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected IDs for inclusion
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());

  // Visible columns selection
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    name: true,
    phone: true,
    location: true,
    details: true,
    date: true,
    status: true,
    notes: true
  });

  const printableRef = useRef<HTMLDivElement>(null);

  // Compute date thresholds
  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === 'today') {
      return { start: todayStr, end: todayStr };
    }
    if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      return { start: weekAgo.toISOString().split('T')[0], end: todayStr };
    }
    if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setDate(now.getDate() - 30);
      return { start: monthAgo.toISOString().split('T')[0], end: todayStr };
    }
    return { start: startDate, end: endDate };
  }, [period, startDate, endDate, todayStr]);

  // Extract items based on selected department and date
  const rawItems = useMemo(() => {
    const isWithinDate = (dStr?: string) => {
      if (!dStr) return true;
      const cleanDate = dStr.split(' ')[0].split('T')[0];
      return cleanDate >= dateRange.start && cleanDate <= dateRange.end;
    };

    if (effectiveDepartment === 'reception') {
      return citizens.filter(c => isWithinDate(c.CreatedAt)).map(c => ({
        id: c.Citizen_ID,
        name: c.FullName,
        phone: c.Phone1 + (c.Phone2 ? ` / ${c.Phone2}` : ''),
        location: `${c.District || 'ذي قار'} - ${c.SubDistrict || ''}`,
        details: `المهنة: ${c.Job || 'كاسب'} | التحصيل: ${c.Education || 'إعدادية'}`,
        date: c.CreatedAt || todayStr,
        status: c.Rating || 'لائق',
        notes: c.ReferralSource ? `المعرف: ${c.ReferralSource}` : 'مباشر بدون معرف'
      }));
    }

    if (effectiveDepartment === 'organization') {
      return organizationRecords.filter(o => isWithinDate(o.UpdatedAt)).map(o => ({
        id: o.Citizen_ID,
        name: o.FullName,
        phone: o.Phone1,
        location: `${o.District} - ${o.SubDistrict || ''}`,
        details: `الثقل: ${o.InfluenceType} | المركز: ${o.ElectionCenter || 'غير محدد'} (محطة ${o.StationNumber || '1'})`,
        date: o.UpdatedAt || todayStr,
        status: o.OrgRating,
        notes: `النقاط: ${o.EvaluationPoints} | ${o.Notes || 'موقف إيجابي'}`
      }));
    }

    if (effectiveDepartment === 'interviews') {
      return interviews.filter(i => isWithinDate(i.InterviewDate)).map(i => ({
        id: i.Interview_ID,
        name: i.FullName,
        phone: i.Phone1,
        location: i.Address,
        details: i.Subject,
        date: `${i.InterviewDate} (${i.InterviewTime || '10:00 ص'})`,
        status: i.Status,
        notes: i.DeputyNotes || 'توجيه بالإجراء والمتابعة'
      }));
    }

    // Admin
    return requests.filter(r => isWithinDate(r.CreatedAt)).map(r => ({
      id: r.Request_ID,
      name: r.CitizenName,
      phone: r.CitizenPhone || '',
      location: r.Entity,
      details: r.Details,
      date: r.CreatedAt,
      status: r.ProcessingStatus,
      notes: r.DeputyNotes || 'متابعة رسمية'
    }));
  }, [effectiveDepartment, citizens, organizationRecords, interviews, requests, dateRange, todayStr]);

  // Filtered items by search query
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rawItems;
    return rawItems.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.phone.includes(q) ||
      item.location.toLowerCase().includes(q) ||
      item.details.toLowerCase().includes(q)
    );
  }, [rawItems, searchQuery]);

  // Check all / uncheck all
  const isAllSelected = filteredItems.length > 0 && filteredItems.every(item => selectedRecordIds.has(item.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRecordIds(new Set());
    } else {
      const nextSet = new Set(selectedRecordIds);
      filteredItems.forEach(item => nextSet.add(item.id));
      setSelectedRecordIds(nextSet);
    }
  };

  const toggleSelectItem = (id: string) => {
    const nextSet = new Set(selectedRecordIds);
    if (nextSet.has(id)) {
      nextSet.delete(id);
    } else {
      nextSet.add(id);
    }
    setSelectedRecordIds(nextSet);
  };

  // Final items to include in print / export (all matching if none checked, or only checked)
  const itemsToPrint = useMemo(() => {
    if (selectedRecordIds.size === 0) {
      return filteredItems;
    }
    return filteredItems.filter(item => selectedRecordIds.has(item.id));
  }, [filteredItems, selectedRecordIds]);

  const departmentArabicName = {
    reception: 'قسم الاستعلامات وشؤون المراجعين',
    organization: 'قسم التنظيم والموقف الجماهيري',
    interviews: 'قسم مقابلات النائب',
    admin: 'قسم الإدارة ومتابعة المعاملات الحكومية'
  }[effectiveDepartment];

  const periodArabicName = {
    today: `أعمال اليوم (${todayStr})`,
    week: `تقرير الأسبوع (من ${dateRange.start} إلى ${dateRange.end})`,
    month: `تقرير الشهر (من ${dateRange.start} إلى ${dateRange.end})`,
    custom: `تقرير الفترة من ${dateRange.start} إلى ${dateRange.end}`
  }[period];

  // Direct Print
  const handleDirectPrint = () => {
    addAuditLog(
      'طباعة تقرير أعمال رسمي',
      departmentArabicName,
      `طباعة تقرير ${periodArabicName} بعدد ${itemsToPrint.length} سجل`
    );
    window.print();
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = itemsToPrint.map((item, idx) => {
      const row: Record<string, any> = { 'ت': idx + 1 };
      if (visibleColumns.id) row['الرقم التعريفي'] = item.id;
      if (visibleColumns.name) row['اسم المواطن'] = item.name;
      if (visibleColumns.phone) row['رقم الهاتف'] = item.phone;
      if (visibleColumns.location) row['القضاء / الجهة'] = item.location;
      if (visibleColumns.details) row['تفاصيل العمل والمعاملة'] = item.details;
      if (visibleColumns.date) row['تاريخ المراجعة'] = item.date;
      if (visibleColumns.status) row['الموقف / الحالة'] = item.status;
      if (visibleColumns.notes) row['الملاحظات والتوجيه'] = item.notes;
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير الأعمال');
    
    const fileName = `تقرير_${effectiveDepartment}_${dateRange.start}_إلى_${dateRange.end}.xlsx`;
    XLSX.writeFile(wb, fileName);

    addAuditLog(
      'تصدير تقرير إكسل',
      departmentArabicName,
      `تصدير ملف إكسل رسمي (${fileName}) يحتوي على ${itemsToPrint.length} قيد`
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs font-['Tajawal',sans-serif] overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Top Header */}
        <div className="p-4 bg-gradient-to-l from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">
                منظومة تقارير وإحصائيات الأعمال والطباعة الرسمية
              </h3>
              <p className="text-[11px] text-blue-200">
                سحب وتحديد وطباعة أعمال الموظفين يومياً، أسبوعياً، شهرياً ومن تاريخ إلى تاريخ (A4 / Excel / PDF)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters and Control Panel */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          
          {/* Row 1: Department & Period Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Department Selector / RBAC Lock */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>تحديد القسم المطلوب للتقرير:</span>
                </label>
                {isReceptionMode ? (
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded border border-purple-200">
                    خاص بقسم الاستعلامات ومقابلات النائب (مستقل عن الإدارة)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    كافة الأقسام متاحة
                  </span>
                )}
              </div>

              <div className={`grid gap-1.5 ${availableDepartments.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
                {availableDepartments.map(dept => (
                  <button
                    key={dept.id}
                    onClick={() => {
                      setDepartment(dept.id);
                      setSelectedRecordIds(new Set());
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                      effectiveDepartment === dept.id
                        ? isReceptionMode ? 'bg-purple-700 text-white shadow-xs' : 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {dept.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Period */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>الفترة الزمنية للتقرير:</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'today', label: 'اليوم' },
                  { id: 'week', label: 'أسبوعياً' },
                  { id: 'month', label: 'شهرياً' },
                  { id: 'custom', label: 'تحديد فترة' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPeriod(p.id as any)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                      period === p.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Custom Date Range (when custom is selected) */}
          {period === 'custom' && (
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-900">من تاريخ:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-900">إلى تاريخ:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold mr-auto">
                الفترة المختارة تشمل جميع السجلات المسجلة ضمن هذين التاريخين
              </span>
            </div>
          )}

          {/* Row 3: Column Selection (تحديد ما يتم طباعته) */}
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                <span>تحديد الأعمدة المراد تضمينها في التقرير والطباعة:</span>
              </span>
              <span className="text-slate-500 font-normal">
                (يمكنك تفعيل أو إلغاء أي عمود حسب الحاجة)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'id', label: 'الرقم التعريفي' },
                { key: 'name', label: 'اسم المواطن' },
                { key: 'phone', label: 'رقم الهاتف' },
                { key: 'location', label: 'القضاء / العنوان' },
                { key: 'details', label: 'تفاصيل المعاملة' },
                { key: 'date', label: 'تاريخ التسجيل' },
                { key: 'status', label: 'الموقف / التقييم' },
                { key: 'notes', label: 'الملاحظات والتوجيه' }
              ].map(col => (
                <button
                  key={col.key}
                  onClick={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key as keyof typeof visibleColumns] }))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    visibleColumns[col.key as keyof typeof visibleColumns]
                      ? 'bg-blue-50 text-blue-800 border border-blue-300 font-bold'
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}
                >
                  {visibleColumns[col.key as keyof typeof visibleColumns] ? (
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>{col.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search bar inside records */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="تصفية السجلات باسم المواطن، الهاتف، القضاء، أو الرقم التعريفي..."
                className="w-full pr-9 pl-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={toggleSelectAll}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
            >
              {isAllSelected ? (
                <>
                  <Square className="w-3.5 h-3.5 text-blue-600" />
                  <span>إلغاء تحديد الكل</span>
                </>
              ) : (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>تحديد كل السجلات</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Printable & Table View Area */}
        <div className="p-4 flex-1 overflow-y-auto" ref={printableRef}>
          
          {/* Printable Official Header (Visible in print) */}
          <div className="hidden print:block mb-4 p-4 border-b-2 border-slate-900 text-center font-['Tajawal']" dir="rtl">
            <div className="flex justify-between items-center mb-2">
              <div className="text-right text-xs space-y-0.5">
                <p className="font-bold">جمهورية العراق</p>
                <p className="font-bold">مجلس النواب العراقي</p>
                <p className="font-bold text-blue-900">مكتب النائب المهندسة علا عودة الناشي</p>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full border-2 border-slate-900 flex items-center justify-center font-bold text-xs">
                  شعار المكتب
                </div>
                <p className="text-[11px] font-bold mt-1">تقرير أعمال رسمي</p>
              </div>
              <div className="text-left text-xs font-mono space-y-0.5" dir="ltr">
                <p>Date: {todayStr}</p>
                <p>Time: {new Date().toLocaleTimeString('ar-IQ')}</p>
                <p>Dept: {department.toUpperCase()}</p>
              </div>
            </div>
            <h2 className="text-base font-black text-slate-900 mt-2">
              {departmentArabicName} - {periodArabicName}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              إجمالي السجلات المعتمدة: ({itemsToPrint.length}) سجل رسمي
            </p>
          </div>

          {/* Screen Summary Bar */}
          <div className="mb-3 flex items-center justify-between text-xs text-slate-600 bg-blue-50/60 p-2.5 rounded-xl border border-blue-200">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-900">
                {departmentArabicName} - {periodArabicName}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-mono font-bold text-[11px]">
                {itemsToPrint.length} سجل محدد للطباعة
              </span>
            </div>
            {selectedRecordIds.size > 0 && (
              <span className="text-[11px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded">
                (تم تحديد {selectedRecordIds.size} من أصل {filteredItems.length} يدوياً)
              </span>
            )}
          </div>

          {/* Table */}
          {itemsToPrint.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              لا توجد سجلات مطابقة للفترة المحددة ({periodArabicName}) في {departmentArabicName}.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[11px]">
                    <th className="p-2.5 text-center w-10 print:hidden">اختيار</th>
                    <th className="p-2.5 text-center w-8">ت</th>
                    {visibleColumns.id && <th className="p-2.5 text-right font-bold">الرمز</th>}
                    {visibleColumns.name && <th className="p-2.5 text-right font-bold">اسم المواطن</th>}
                    {visibleColumns.phone && <th className="p-2.5 text-right font-bold">رقم الهاتف</th>}
                    {visibleColumns.location && <th className="p-2.5 text-right font-bold">القضاء / العنوان</th>}
                    {visibleColumns.details && <th className="p-2.5 text-right font-bold">تفاصيل المعاملة / العمل</th>}
                    {visibleColumns.date && <th className="p-2.5 text-center font-bold">تاريخ المراجعة</th>}
                    {visibleColumns.status && <th className="p-2.5 text-center font-bold">الموقف</th>}
                    {visibleColumns.notes && <th className="p-2.5 text-right font-bold">التوجيه والملاحظات</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {itemsToPrint.map((item, idx) => {
                    const isSelected = selectedRecordIds.has(item.id);
                    return (
                      <tr 
                        key={item.id} 
                        className={`transition-colors hover:bg-blue-50/40 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                        }`}
                      >
                        <td className="p-2 text-center print:hidden">
                          <button
                            onClick={() => toggleSelectItem(item.id)}
                            className="text-slate-400 hover:text-blue-600 cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="p-2 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                        {visibleColumns.id && (
                          <td className="p-2 font-mono font-bold text-blue-700 whitespace-nowrap">{item.id}</td>
                        )}
                        {visibleColumns.name && (
                          <td className="p-2 font-bold text-slate-900">{item.name}</td>
                        )}
                        {visibleColumns.phone && (
                          <td className="p-2 font-mono text-slate-700 whitespace-nowrap" dir="ltr">{item.phone}</td>
                        )}
                        {visibleColumns.location && (
                          <td className="p-2 text-slate-700">{item.location}</td>
                        )}
                        {visibleColumns.details && (
                          <td className="p-2 text-slate-700 max-w-xs">{item.details}</td>
                        )}
                        {visibleColumns.date && (
                          <td className="p-2 text-center font-mono text-[11px] text-slate-600 whitespace-nowrap">{item.date}</td>
                        )}
                        {visibleColumns.status && (
                          <td className="p-2 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              {item.status}
                            </span>
                          </td>
                        )}
                        {visibleColumns.notes && (
                          <td className="p-2 text-slate-600 text-[11px]">{item.notes}</td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Printable Official Signatures Footer (Visible in print) */}
          <div className="hidden print:flex justify-between items-center mt-12 pt-6 border-t border-slate-300 text-xs font-bold text-slate-800">
            <div className="text-center space-y-8">
              <p>مسؤول القسم المختص</p>
              <p className="text-slate-400">....................................</p>
            </div>
            <div className="text-center space-y-8">
              <p>مدير المكتب والتدقيق</p>
              <p className="text-slate-400">....................................</p>
            </div>
            <div className="text-center space-y-8">
              <p>مكتب النائب المهندسة علا الناشي</p>
              <p className="text-slate-400">الختم والتوقيع الرسمي</p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">إجمالي المشمولين في التقرير:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">{itemsToPrint.length}</span>
            <span className="text-slate-400">سجل رسمي</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Direct Print A4 */}
            <button
              onClick={handleDirectPrint}
              disabled={itemsToPrint.length === 0}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة مباشرة (A4 رسمي)</span>
            </button>

            {/* Save as PDF */}
            <button
              onClick={handleDirectPrint}
              disabled={itemsToPrint.length === 0}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>تحميل ملف PDF</span>
            </button>

            {/* Export to Excel (.xlsx) */}
            <button
              onClick={handleExportExcel}
              disabled={itemsToPrint.length === 0}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تحميل ملف إكسل (.xlsx)</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
