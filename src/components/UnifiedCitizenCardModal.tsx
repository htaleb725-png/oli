import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Citizen, OfficeRequest, Interview } from '../types';
import { 
  X, 
  User, 
  Phone, 
  MapPin, 
  Briefcase, 
  Calendar, 
  Clock, 
  Printer, 
  Handshake, 
  FolderKanban, 
  Plus, 
  SendHorizontal, 
  CheckCircle2, 
  ShieldCheck,
  FileText,
  Building2,
  ScrollText,
  FileCheck,
  Users,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface Props {
  citizen: Citizen | null;
  onClose: () => void;
  onBookInterview?: (citizen: Citizen) => void;
  onAddNewRequest?: (citizen: Citizen) => void;
  receptionMode?: boolean;
}

export const UnifiedCitizenCardModal: React.FC<Props> = ({
  citizen,
  onClose,
  onBookInterview,
  onAddNewRequest,
  receptionMode = false
}) => {
  const { 
    requests, 
    interviews, 
    officialLetters,
    documents,
    organizationRecords,
    setPrintableBadgeCitizen, 
    setPrintableCitizenCard, 
    addRequest, 
    currentUser,
    addAuditLog 
  } = useApp();

  const isReception = receptionMode || currentUser?.Role === 'reception' || currentUser?.Role === 'reception_officer' || currentUser?.Department?.includes('الاستعلامات');

  const [directorNote, setDirectorNote] = useState('');
  const [isForwarding, setIsForwarding] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'requests' | 'interviews' | 'letters' | 'org'>('all');

  if (!citizen) return null;

  // Data from all departments (matched by ID, exact name, or phone)
  const citizenRequests: OfficeRequest[] = requests.filter(r => 
    (r.Citizen_ID && citizen.Citizen_ID && r.Citizen_ID === citizen.Citizen_ID) ||
    (r.CitizenName && citizen.FullName && r.CitizenName.trim() === citizen.FullName.trim()) ||
    (r.CitizenPhone && citizen.Phone1 && r.CitizenPhone.trim() === citizen.Phone1.trim())
  );

  // Group requests by ministry/entity for Reception view
  const ministryBreakdown = React.useMemo(() => {
    const map: Record<string, number> = {};
    citizenRequests.forEach(req => {
      const entity = req.Entity?.trim() || 'جهة حكومية غير محددة';
      map[entity] = (map[entity] || 0) + 1;
    });
    return Object.entries(map).map(([ministry, count]) => ({ ministry, count }));
  }, [citizenRequests]);

  const citizenInterviews: Interview[] = interviews.filter(i => i.Citizen_ID === citizen.Citizen_ID);
  const citizenLetters = officialLetters.filter(l => 
    l.Citizen_ID === citizen.Citizen_ID || 
    (l.Recipient && l.Recipient.includes(citizen.FullName)) ||
    (l.Subject && l.Subject.includes(citizen.FullName))
  );
  const citizenDocs = documents.filter(d => d.Citizen_ID === citizen.Citizen_ID);
  const citizenOrg = organizationRecords.find(o => o.Citizen_ID === citizen.Citizen_ID);

  const completedRequestsCount = citizenRequests.filter(r => r.ProcessingStatus === 'منجز').length;
  const inProgressRequestsCount = citizenRequests.filter(r => r.ProcessingStatus === 'قيد الإجراء' || r.ProcessingStatus === 'مرسل إلى الوزارة/الهيئة').length;
  const pendingReviewCount = citizenRequests.filter(r => r.ProcessingStatus === 'قيد التدقيق').length;

  const handleForwardToAdmin = () => {
    if (!citizen) return;
    setIsForwarding(true);

    const note = directorNote.trim() || 'إحالة وتوجيه من مدير المكتب لقسم الإدارة والمعاملات لفتح إضبارة ومتابعة الطلب فوراً';

    addRequest({
      Citizen_ID: citizen.Citizen_ID,
      CitizenName: citizen.FullName,
      CitizenPhone: citizen.Phone1,
      Entity: 'ديوان محافظة ذي قار / الدوائر ذات العلاقة',
      RequestStatus: 'مستلم',
      ProcessingStatus: 'قيد التدقيق',
      Priority: 'عاجل',
      Details: `إحالة مباشرة من مدير المكتب للمراجع ${citizen.FullName}. التوجيه: ${note}`,
      DeputyNotes: note,
      CreatedBy: currentUser ? `${currentUser.FullName} (${currentUser.RoleArabic})` : 'مدير المكتب التنفيذي'
    });

    addAuditLog(
      'إحالة من بطاقة المراجع',
      'مدير المكتب',
      `تمت إحالة المراجع ${citizen.FullName} (${citizen.Citizen_ID}) إلى قسم الإدارة مع الهامش: ${note}`
    );

    setSuccessNotice('تمت بنجاح إحالة المعاملة إلى قسم الإدارة وتثبيت التوجيه والهامش.');
    setIsForwarding(false);
    setDirectorNote('');
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-['Tajawal',sans-serif]" dir="rtl">
      <div className="relative w-full max-w-4xl bg-white text-slate-800 rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col text-right animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar - Elegant Executive Design */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 font-bold text-lg shadow-inner shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white truncate">{citizen.FullName}</h3>
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-blue-500/25 text-blue-200 border border-blue-400/30 shrink-0">
                  {citizen.Citizen_ID}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                  {isReception ? 'سجل الاستعلامات والمراجعين' : 'سجل موحد معتمد بكافة الأقسام'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-2.5 flex-wrap">
                <span>📍 {citizen.District} {citizen.SubDistrict ? `• ${citizen.SubDistrict}` : ''}</span>
                <span>•</span>
                <span className="font-mono" dir="ltr">📞 {citizen.Phone1}</span>
                <span>•</span>
                <span>المهنة: {citizen.Job || 'كاسب'}</span>
                <span>•</span>
                <span>مسجل الاستعلامات: {citizen.CreatedBy || 'الاستعلامات'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/90 hover:bg-rose-900/80 hover:text-rose-200 text-slate-300 flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="إغلاق البطاقة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-3 px-5 text-emerald-900 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Synchronized Department Counters Bar & Tabs: Only shown for administration/executive view */}
        {!isReception && (
          <>
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-right">
                <span className="text-[10px] font-bold text-blue-700 block">إجمالي الطلبات في النظام</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-blue-900">{citizenRequests.length}</span>
                  <span className="text-[10px] text-blue-600 font-bold">طلبات</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-right">
                <span className="text-[10px] font-bold text-emerald-700 block">الطلبات المنجزة</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-emerald-900">{completedRequestsCount}</span>
                  <span className="text-[10px] text-emerald-600 font-bold">منجز</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-right">
                <span className="text-[10px] font-bold text-amber-700 block">قيد الإجراء والمتابعة</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-amber-900">{inProgressRequestsCount + pendingReviewCount}</span>
                  <span className="text-[10px] text-amber-600 font-bold">معاملة</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-right">
                <span className="text-[10px] font-bold text-teal-700 block">مقابلات النائب</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-teal-900">{citizenInterviews.length}</span>
                  <span className="text-[10px] text-teal-600 font-bold">لقاء برلماني</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-right col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-purple-700 block">الكتب والوثائق المؤرشفة</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-purple-900">{citizenLetters.length + citizenDocs.length}</span>
                  <span className="text-[10px] text-purple-600 font-bold">مستند</span>
                </div>
              </div>
            </div>

            {/* Filter Tabs to switch or view all */}
            <div className="flex items-center gap-1.5 px-4 pt-3 border-b border-slate-200 overflow-x-auto text-xs font-bold">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-t-xl transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                العرض الشامل لكافة الأقسام
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`px-3 py-1.5 rounded-t-xl transition-all cursor-pointer ${
                  activeTab === 'requests'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                قسم الإدارة والطلبات ({citizenRequests.length})
              </button>
              <button
                onClick={() => setActiveTab('interviews')}
                className={`px-3 py-1.5 rounded-t-xl transition-all cursor-pointer ${
                  activeTab === 'interviews'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                مقابلات النائب ({citizenInterviews.length})
              </button>
              <button
                onClick={() => setActiveTab('letters')}
                className={`px-3 py-1.5 rounded-t-xl transition-all cursor-pointer ${
                  activeTab === 'letters'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                المكنة والكتب الصادرة ({citizenLetters.length})
              </button>
              <button
                onClick={() => setActiveTab('org')}
                className={`px-3 py-1.5 rounded-t-xl transition-all cursor-pointer ${
                  activeTab === 'org'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                قسم التنظيم والموقف الجماهيري
              </button>
            </div>
          </>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {isReception ? (
            /* ---------------- RECEPTION MODE: كم طلب مقدم فقط وإلى أي وزارة (طلب المستخدم الصريح) ---------------- */
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* 1. بطاقة معلومات المراجع الأساسية (الاستعلامات) */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">بيانات المراجع المسجلة</h4>
                      <p className="text-[10px] text-slate-500 font-mono">
                        رقم الإضبارة: <span className="font-bold text-blue-700">{citizen.Citizen_ID}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    تاريخ التسجيل: {citizen.CreatedAt ? citizen.CreatedAt.split(' ')[0] : 'اليوم'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">الاسم الرباعي واللقب</span>
                    <strong className="text-slate-900 font-bold">{citizen.FullName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">رقم الهاتف الأساسي</span>
                    <strong className="text-slate-900 font-mono font-bold" dir="ltr">{citizen.Phone1}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">الهاتف البديل</span>
                    <strong className="text-slate-900 font-mono" dir="ltr">{citizen.Phone2 || 'غير مسجل'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">العشيرة / اللقب</span>
                    <strong className="text-slate-900">{citizen.Surname || 'عام'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">القضاء والسكن</span>
                    <strong className="text-slate-900">{citizen.District} {citizen.SubDistrict ? `- ${citizen.SubDistrict}` : ''}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">المهنة / التوصيف</span>
                    <strong className="text-slate-900">{citizen.Job || 'كاسب'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">التحصيل الدراسي</span>
                    <strong className="text-slate-900">{citizen.Education || 'إعدادية فما دون'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">طريقة الحضور</span>
                    <strong className="text-slate-900">
                      {citizen.AttendanceType === 'بيد شخص آخر (معتمد)' ? `بيد المعتمد (${citizen.ProxyName || 'وكيل'})` : 'حضر شخصياً'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* 2. سجل كم طلب مقدم وإلى أي وزارة (طلب المستخدم: خلي تظهر كم طلب مقدم فقط والى اي وزارة) */}
              <div className="bg-gradient-to-br from-blue-50/80 via-white to-slate-50 rounded-2xl border border-blue-200 p-4 sm:p-5 space-y-4 shadow-2xs">
                
                {/* Header with clear request counters */}
                <div className="flex items-center justify-between pb-3 border-b border-blue-100 flex-wrap gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-blue-950">
                        سجل الطلبات والوزارات الحكومية الموجه إليها
                      </h4>
                      <p className="text-[11px] text-blue-700">
                        بيان رسمي بحجم الطلبات والجهات الوزارية التي تقدم إليها المراجع
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="px-3.5 py-1.5 rounded-xl bg-white border border-blue-200 text-right shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 block">إجمالي عدد الطلبات</span>
                      <span className="text-base font-black text-blue-800">{citizenRequests.length} طلبات</span>
                    </div>
                    <div className="px-3.5 py-1.5 rounded-xl bg-white border border-blue-200 text-right shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 block">الوزارات والجهات</span>
                      <span className="text-base font-black text-indigo-900">{ministryBreakdown.length} وزارة / جهة</span>
                    </div>
                  </div>
                </div>

                {/* توزيع الطلبات حسب كل وزارة */}
                {ministryBreakdown.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>الوزارات والجهات المقدم إليها (كم طلب لكل وزارة):</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {ministryBreakdown.map((item, idx) => (
                        <div 
                          key={idx} 
                          className="bg-white rounded-xl border border-blue-200/90 p-2.5 px-3 flex items-center justify-between shadow-2xs hover:border-blue-300 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                            <span className="text-xs font-bold text-slate-900 truncate" title={item.ministry}>
                              {item.ministry}
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-black text-xs shrink-0 mr-2 shadow-2xs">
                            {item.count} {item.count === 1 ? 'طلب واحد' : item.count === 2 ? 'طلبان' : `${item.count} طلبات`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* قائمة وتفاصيل الطلبات المسجلة */}
                <div className="space-y-2 pt-2 border-t border-blue-100">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-black text-slate-800">
                      قائمة الطلبات بالتفصيل والجهة الموجهة إليها ({citizenRequests.length}):
                    </span>
                    {onAddNewRequest && (
                      <button
                        onClick={() => onAddNewRequest(citizen)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3 h-3" />
                        <span>إضافة طلب جديد</span>
                      </button>
                    )}
                  </div>

                  {citizenRequests.length === 0 ? (
                    <div className="p-6 rounded-xl bg-white border border-dashed border-slate-300 text-center space-y-2 text-slate-500 text-xs">
                      <p className="font-bold text-slate-600">لا توجد طلبات أو معاملات مقدمة لهذا المراجع حتى الآن.</p>
                      <p className="text-[11px] text-slate-400">يمكنك تسجيل طلب أو معاملة جديدة له مباشرة عبر زر (إضافة طلب) من شاشة الاستعلامات.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {citizenRequests.map((req, idx) => (
                        <div 
                          key={req.Request_ID || idx}
                          className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 p-3.5 transition-all shadow-2xs space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-800 font-black text-xs flex items-center justify-center border border-blue-200">
                                {idx + 1}
                              </span>
                              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-950 font-black text-xs">
                                <Building2 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                                <span>الجهة: {req.Entity || 'جهة حكومية غير محددة'}</span>
                              </div>
                              <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {req.Request_ID}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                req.ProcessingStatus === 'منجز' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                req.ProcessingStatus === 'مرفوض' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                                'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                الحالة: {req.ProcessingStatus || 'قيد الإجراء'}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {req.CreatedAt ? req.CreatedAt.split(' ')[0] : 'اليوم'}
                            </span>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-800 font-medium leading-relaxed">
                            <span className="text-slate-400 text-[10px] block mb-0.5 font-bold">موضوع / تفاصيل الطلب المقدم:</span>
                            {req.Details || 'طلب رسمي مقدم عبر الاستعلامات'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            /* ---------------- FULL MULTI-DEPARTMENT MODE (ADMIN & EXECUTIVE) ---------------- */
            <>
              {/* Section 1: Detailed Personal Card (قسم الاستعلامات) */}
              {(activeTab === 'all' || activeTab === 'requests') && (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2.5">
                  <h4 className="text-xs font-black text-slate-900 flex items-center justify-between pb-1.5 border-b border-slate-200">
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-blue-600" />
                      <span>1. بيانات المراجع الأساسية (قسم الاستعلامات)</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      تاريخ التسجيل: {citizen.CreatedAt ? citizen.CreatedAt.split(' ')[0] : 'اليوم'}
                    </span>
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">الاسم الرباعي واللقب</span>
                      <strong className="text-slate-900 font-bold">{citizen.FullName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">رقم الهاتف الأساسي</span>
                      <strong className="text-slate-900 font-mono font-bold" dir="ltr">{citizen.Phone1}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">الهاتف البديل</span>
                      <strong className="text-slate-900 font-mono" dir="ltr">{citizen.Phone2 || 'غير مسجل'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">العشيرة / اللقب</span>
                      <strong className="text-slate-900">{citizen.Surname || 'عام'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">القضاء والسكن</span>
                      <strong className="text-slate-900">{citizen.District} - {citizen.SubDistrict || 'المركز'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">المهنة / التوصيف</span>
                      <strong className="text-slate-900">{citizen.Job || 'كاسب'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">التحصيل الدراسي</span>
                      <strong className="text-slate-900">{citizen.Education || 'إعدادية فما دون'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">المعرّف والتزكية</span>
                      <strong className="text-slate-900">{citizen.ReferralSource || 'مباشر - الاستعلامات'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 2: MP Interviews (قسم مقابلات النائب) */}
              {(activeTab === 'all' || activeTab === 'interviews') && (
                <div className="bg-white rounded-2xl border border-teal-200 p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-teal-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                        <Handshake className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">2. مقابلات النائب المهندسة علا الناشي ({citizenInterviews.length})</h4>
                        <p className="text-[10px] text-slate-500">سجل مواعيد اللقاء المباشر، الأولويات، وتوجيهات النائب</p>
                      </div>
                    </div>

                    {onBookInterview && (
                      <button
                        onClick={() => onBookInterview(citizen)}
                        className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ حجز موعد مقابلة جديد</span>
                      </button>
                    )}
                  </div>

                  {citizenInterviews.length === 0 ? (
                    <div className="p-4 rounded-xl bg-teal-50/40 border border-dashed border-teal-200 text-center text-slate-500 text-xs">
                      لا توجد مواعيد مقابلة مسجلة سابقة مع النائب لهذا المراجع.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {citizenInterviews.map((intv) => (
                        <div key={intv.Interview_ID} className="p-3 rounded-xl bg-teal-50/50 border border-teal-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-teal-800 bg-white px-2 py-0.5 rounded border border-teal-200">
                                {intv.Interview_ID}
                              </span>
                              <strong className="text-slate-900">{intv.Subject}</strong>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                                {intv.Status}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                intv.Priority === 'عاجل' || intv.Priority === 'خاص جداً'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {intv.Priority}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center gap-3 flex-wrap">
                              <span>📅 تاريخ المقابلة: <strong>{intv.InterviewDate}</strong></span>
                              {intv.InterviewTime && <span>⏰ التوقيت: <strong>{intv.InterviewTime}</strong></span>}
                              {intv.Address && <span>📍 السكن: <strong>{intv.Address}</strong></span>}
                            </div>
                            {intv.DeputyNotes && (
                              <div className="text-[11px] text-teal-950 bg-white p-2 rounded-lg border border-teal-200 font-medium">
                                توجيه وهامش النائب: <strong>{intv.DeputyNotes}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Section 3: Requests in System (قسم الإدارة والمعاملات) */}
              {(activeTab === 'all' || activeTab === 'requests') && (
                <div className="bg-white rounded-2xl border border-blue-200 p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-blue-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                        <FolderKanban className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">3. طلبات ومعاملات قسم الإدارة الموجهة للوزارات ({citizenRequests.length})</h4>
                        <p className="text-[10px] text-slate-500">حالة الإنجاز، أرقام الإضابير، والجهات الحكومية المختصة</p>
                      </div>
                    </div>

                    {onAddNewRequest && (
                      <button
                        onClick={() => onAddNewRequest(citizen)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ فتح معاملة جديدة</span>
                      </button>
                    )}
                  </div>

                  {citizenRequests.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-slate-500 text-xs">
                      لا توجد طلبات إدارية مسجلة لهذا المراجع في قسم الإدارة.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {citizenRequests.map((req) => (
                        <div key={req.Request_ID} className="p-3.5 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-slate-200 transition-colors space-y-2 text-xs">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                                {req.Request_ID}
                              </span>
                              <strong className="text-slate-900 text-xs sm:text-sm">[{req.Entity}]</strong>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                req.ProcessingStatus === 'منجز' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                req.ProcessingStatus === 'مرفوض' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                                'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {req.ProcessingStatus || 'قيد الإجراء'}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                                الأولوية: {req.Priority || 'عام'}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {req.CreatedAt}
                            </span>
                          </div>

                          <p className="text-slate-800 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200 font-medium">
                            {req.Details}
                          </p>

                          {req.DeputyNotes && (
                            <div className="text-[11px] text-blue-900 bg-blue-50 p-2 rounded-lg border border-blue-200 font-medium">
                              هامش وتوجيه النائب: <strong>{req.DeputyNotes}</strong>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Section 4: Machine & Official Letters (قسم المكنة والطباعة) */}
              {(activeTab === 'all' || activeTab === 'letters') && (
                <div className="bg-white rounded-2xl border border-purple-200 p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-purple-100">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
                      <ScrollText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">4. الكتب الرسمية والمخاطبات الصادرة (قسم المكنة والطباعة)</h4>
                      <p className="text-[10px] text-slate-500">الكتب الصادرة الموجهة للوزارات والمؤسسات الرسمية</p>
                    </div>
                  </div>

                  {citizenLetters.length === 0 ? (
                    <div className="p-3.5 rounded-xl bg-purple-50/30 border border-dashed border-purple-200 text-center text-slate-500 text-xs">
                      لا توجد كتب رسمية صادرة باسم المراجع حالياً.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {citizenLetters.map((letter) => (
                        <div key={letter.Letter_ID} className="p-3 rounded-xl bg-purple-50/50 border border-purple-200 flex items-center justify-between gap-2 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-purple-800 bg-white px-2 py-0.5 rounded border border-purple-200">
                                {letter.LetterNumber || letter.Letter_ID}
                              </span>
                              <strong className="text-slate-900">{letter.Subject}</strong>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              الجهة الموجه إليها: <strong>{letter.Recipient || letter.To_Entity}</strong> | التاريخ: {letter.LetterDate}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                            {letter.Status || 'صادر'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Section 5: Organization (قسم التنظيم والجماهير) */}
              {(activeTab === 'all' || activeTab === 'org') && (
                <div className="bg-white rounded-2xl border border-amber-200 p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-amber-100">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">5. الموقف التنظيمي والجماهيري (قسم التنظيم)</h4>
                      <p className="text-[10px] text-slate-500">التقييم الجماهيري، العشيرة، مركز الاقتراع، وتوصيف العلاقة</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-amber-50/40 p-3 rounded-xl border border-amber-200/80">
                    <div>
                      <span className="text-slate-500 text-[10px] block">التقييم الجماهيري</span>
                      <strong className="text-amber-900 font-bold">{citizenOrg?.OrgRating || citizen.Rating || 'لائق'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">مركز الاقتراع</span>
                      <strong className="text-slate-900">{citizenOrg?.ElectionCenter || 'غير مثبت'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">العشيرة والوجاهة</span>
                      <strong className="text-slate-900">{citizen.Surname || 'عام'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">عضوية الفريق / المعتمد</span>
                      <strong className="text-slate-900">{citizenOrg?.isTeamMember ? 'نعم - كادر معتمد' : 'مراجع جماهيري'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 6: Director Executive Actions Bar */}
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-100/50 to-orange-500/10 rounded-2xl border border-amber-300 p-4 space-y-3">
                <h4 className="text-xs font-black text-amber-950 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>إجراءات وتوجيه مدير المكتب التنفيذي للمراجع:</span>
                </h4>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={directorNote}
                    onChange={(e) => setDirectorNote(e.target.value)}
                    placeholder="اكتب توجيه أو هامش مدير المكتب لإحالته فوراً للإدارة والمعاملات..."
                    className="flex-1 px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 font-medium text-right shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={handleForwardToAdmin}
                    disabled={isForwarding}
                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                  >
                    <SendHorizontal className="w-4 h-4" />
                    <span>إحالة المعاملة للإدارة مع الهامش</span>
                  </button>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setPrintableBadgeCitizen(citizen)}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-blue-600" />
              <span>طباعة باج / وصل مراجعة</span>
            </button>

            <button
              onClick={() => setPrintableCitizenCard(citizen)}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>طباعة بطاقة المراجع الرسمية</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
          >
            إغلاق البطاقة
          </button>
        </div>

      </div>
    </div>
  );
};
