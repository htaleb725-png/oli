import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Printer, 
  Plus, 
  Search,
  CheckCircle2,
  FileText,
  User,
  Clock,
  Sparkles,
  Download,
  BarChart2,
  HardDrive
} from 'lucide-react';
import { OfficeRequest } from '../types';
import { OfficeIconTilesGrid } from './OfficeIconTilesGrid';

interface OfficialLetter {
  id: string;
  letterNumber: string;
  letterDate: string;
  recipient: string;
  subject: string;
  body: string;
  citizenName?: string;
  citizenId?: string;
  status: 'مسودة' | 'جاهز للطباعة' | 'تم التوقيع والإرسال';
  clerkName: string;
}

export const MachineModule: React.FC = () => {
  const { systemSettings, citizens, requests, updateRequest, addAuditLog, currentUser, setActiveSection } = useApp();

  const [activeTab, setActiveTab] = useState<'letters' | 'requests_print'>('requests_print');
  const [requestSearchQuery, setRequestSearchQuery] = useState('حسن طالب');
  const [selectedRequestForPrint, setSelectedRequestForPrint] = useState<OfficeRequest | null>(null);
  const [autoStatusAlert, setAutoStatusAlert] = useState<string | null>(null);

  const [letters, setLetters] = useState<OfficialLetter[]>([
    {
      id: 'LTR-2026-001',
      letterNumber: 'ن/ع/2026/104',
      letterDate: '2026-03-01',
      recipient: 'معالي وزير العمل والشؤون الاجتماعية المحترم',
      subject: 'طلب شمول براتب الإعانة الاجتماعية (حالة إنسانية حرجة)',
      body: 'تهديكم النائب المهندسة علا عودة الناشي أطيب التحايا، وبالنظر للظروف المعيشية الصعبة والعجز الصحي للمواطن (كرار علي حسين عبد) من سكنة محافظة ذي قار - قضاء الشطرة، يرجى التفضل بالموافقة الكريمة على شمول المومأ إليه براتب الإعانة الاجتماعية وفق الضوابط والتعليمات النافذة، خدمةً لأبناء شعبنا الكريم... مع فائق الشكر والتقدير.',
      citizenName: 'كرار علي حسين عبد',
      citizenId: 'ONA-10492',
      status: 'جاهز للطباعة',
      clerkName: 'موظف المكنة'
    },
    {
      id: 'LTR-2026-002',
      letterNumber: 'ن/ع/2026/105',
      letterDate: '2026-03-02',
      recipient: 'السيد رئيس هيئة الحشد الشعبي المحترم',
      subject: 'طلب تخصيص قطعة أرض لعائلة شهيد',
      body: 'تهديكم النائب المهندسة علا الناشي أطيب التحايا، نرفق طياً أوليات عائلة الشهيد البطل، يرجى الإيعاز إلى مديرية الإسكان والبلديات لاستكمال إجراءات التخصيص المستحق إكراماً لتضحياتهم الجليلة.',
      citizenName: 'حسين جبار فالح محمد',
      citizenId: 'ONA-10494',
      status: 'تم التوقيع والإرسال',
      clerkName: 'مدير المكنة'
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetterForPrint, setSelectedLetterForPrint] = useState<OfficialLetter | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [letterNumber, setLetterNumber] = useState(`ن/ع/2026/${Math.floor(100 + Math.random() * 900)}`);
  const [letterDate, setLetterDate] = useState(new Date().toISOString().split('T')[0]);
  const [recipient, setRecipient] = useState('معالي وزير التربية المحترم');
  const [subject, setSubject] = useState('طلب استثناء ونقل ملاك تعليمي');
  const [body, setBody] = useState('تهديكم النائب المهندسة علا عودة الناشي أطيب التحايا...\nيرجى التفضل بالموافقة على...');
  const [citizenId, setCitizenId] = useState('');

  const filteredLetters = letters.filter(l => 
    l.letterNumber.includes(searchQuery) ||
    l.recipient.includes(searchQuery) ||
    l.subject.includes(searchQuery) ||
    (l.citizenName && l.citizenName.includes(searchQuery))
  );

  const handleCreateLetter = (e: React.FormEvent) => {
    e.preventDefault();
    const cit = citizens.find(c => c.Citizen_ID === citizenId);

    const newLetter: OfficialLetter = {
      id: `LTR-2026-00${letters.length + 1}`,
      letterNumber,
      letterDate,
      recipient,
      subject,
      body,
      citizenName: cit ? cit.FullName : undefined,
      citizenId: cit ? cit.Citizen_ID : undefined,
      status: 'جاهز للطباعة',
      clerkName: currentUser?.FullName || 'موظف المكنة'
    };

    setLetters([newLetter, ...letters]);
    setShowAddModal(false);
    setSelectedLetterForPrint(newLetter);
  };

  const handlePrint = (letter: OfficialLetter) => {
    addAuditLog(
      'طباعة كتاب رسمي',
      'مدير المكنة',
      `طباعة الكتاب الرسمي رقم ${letter.letterNumber} الموجه إلى ${letter.recipient}`
    );
    setSelectedLetterForPrint(letter);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Auto-receive logic requested by user:
  // "اريد مثلا اجيت على قسم الطباعة وبحثت حسن طالب كريم صاحب الطلب من انطي حفظ او طباعة مباشرة اذا بالبينات غير مستلم تتحدث الحالة الى مستلم"
  const handlePrintOrSaveCitizenRequest = (req: OfficeRequest, actionType: 'طباعة' | 'حفظ') => {
    let updatedReq = { ...req };
    let statusChanged = false;

    if (req.RequestStatus === 'غير مستلم' || !req.RequestStatus) {
      updatedReq.RequestStatus = 'مستلم';
      updatedReq.ProcessingStatus = 'تم الطباعة';
      statusChanged = true;
      updateRequest(updatedReq);
    }

    addAuditLog(
      `${actionType} طلب مواطن بالمكنة`,
      'قسم الطباعة والمكنة',
      `${actionType} طلب للمواطن (${req.CitizenName}) - ${req.Entity}${statusChanged ? ' [تم تحديث الحالة تلقائياً من غير مستلم إلى مستلم]' : ''}`
    );

    if (statusChanged) {
      setAutoStatusAlert(`تم بنجاح ${actionType} الطلب، وتحديث حالة طلب المواطن (${req.CitizenName}) تلقائياً من "غير مستلم" إلى "مستلم"!`);
      setTimeout(() => setAutoStatusAlert(null), 5000);
    } else {
      setAutoStatusAlert(`تمت العملية بنجاح للمواطن (${req.CitizenName}). الحالة الحالية: (${req.RequestStatus}).`);
      setTimeout(() => setAutoStatusAlert(null), 3500);
    }

    if (actionType === 'طباعة') {
      setSelectedRequestForPrint(updatedReq);
      setTimeout(() => {
        window.print();
      }, 300);
    }
  };

  // Filter requests for citizen search
  const filteredCitizenRequests = requests.filter(r => {
    const q = requestSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.CitizenName && r.CitizenName.toLowerCase().includes(q)) ||
      (r.Entity && r.Entity.toLowerCase().includes(q)) ||
      (r.Request_ID && r.Request_ID.toLowerCase().includes(q)) ||
      (r.CitizenPhone && r.CitizenPhone.includes(q))
    );
  });

  return (
    <div className="space-y-4 text-right">
      {/* Alert Banner for Auto Status Update */}
      {autoStatusAlert && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-bold">{autoStatusAlert}</span>
          </div>
          <button 
            onClick={() => setAutoStatusAlert(null)}
            className="text-xs text-emerald-600 font-bold hover:underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">قسم مدير المكنة والطباعة البرلمانية</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              تحديث واستلام فوري
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            طباعة طلبات المراجعين مع التحديث التلقائي لحالة الاستلام، وتوليد وتنسيق الكتب الرسمية بالترويسة البرلمانية.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveSection('dashboard')}
            className="px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="الانتقال إلى لوحة تحكم وإحصائيات المكنة والطباعة"
          >
            <BarChart2 className="w-4 h-4 text-teal-600" />
            <span>لوحة إحصائيات المكنة</span>
          </button>

          {/* Tab switcher */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('requests_print')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'requests_print'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              طباعة طلبات المراجعين (تحديث مستلم)
            </button>
            <button
              onClick={() => setActiveTab('letters')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'letters'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              الكتب الرسمية البرلمانية
            </button>
          </div>
        </div>
      </div>

      {/* 5-Column Desktop Icon Grid for Machine & Official Letters */}
      <OfficeIconTilesGrid
        title="أيقونات ومهام وحدة المكنة والطباعة"
        subtitle="انقر على أي أيقونة للاستعراض المباشر أو طباعة الطلبات والكتب الرسمية"
        columns={5}
        items={[
          {
            id: 'mac_requests_print',
            title: 'طباعة طلبات المراجعين',
            subtitle: 'تحديث تلقائي لحالة الاستلام',
            icon: Printer,
            iconColor: 'text-teal-600 dark:text-teal-400',
            iconBg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
            badge: requests.length,
            badgeColor: 'bg-teal-600 text-white',
            isActive: activeTab === 'requests_print',
            onClick: () => setActiveTab('requests_print')
          },
          {
            id: 'mac_letters',
            title: 'الكتب الرسمية البرلمانية',
            subtitle: 'المخاطبات والكتب الصادرة',
            icon: FileText,
            iconColor: 'text-blue-600 dark:text-blue-400',
            iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
            badge: letters.length,
            badgeColor: 'bg-blue-600 text-white',
            isActive: activeTab === 'letters',
            onClick: () => setActiveTab('letters')
          },
          {
            id: 'mac_new_letter',
            title: 'إنشاء كتاب رسمي جديد',
            subtitle: 'صياغة خطاب برلماني موجه للوزارات',
            icon: Plus,
            iconColor: 'text-amber-600 dark:text-amber-400',
            iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
            onClick: () => {
              setActiveTab('letters');
              setShowAddModal(true);
            }
          },
          {
            id: 'mac_drive_archive',
            title: 'أرشيف طلبات Google Drive',
            subtitle: 'سحب وطباعة الطلبات السحابية',
            icon: HardDrive,
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
            onClick: () => setActiveSection('drive_requests')
          },
          {
            id: 'mac_stats',
            title: 'لوحة إحصائيات المكنة',
            subtitle: 'مؤشرات إنتاجية الطباعة والكتب',
            icon: BarChart2,
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            iconBg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
            onClick: () => setActiveSection('dashboard')
          }
        ]}
      />

      {/* TAB 1: CITIZEN REQUESTS AUTO-RECEIVE & PRINT */}
      {activeTab === 'requests_print' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Search className="w-4 h-4 text-teal-600" />
                  بحث عن صاحب الطلب (مثال: حسن طالب كريم)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  عند الضغط على "حفظ" أو "طباعة"، إذا كانت حالة الطلب (غير مستلم) ستتحدث تلقائياً وفورياً إلى (مستلم)
                </p>
              </div>

              <div className="relative w-full sm:w-80">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={requestSearchQuery}
                  onChange={(e) => setRequestSearchQuery(e.target.value)}
                  placeholder="اكتب اسم المواطن (مثال: حسن طالب)..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>

            {/* Table of matching requests */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-2">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">رقم الإضبارة</th>
                    <th className="p-3">اسم صاحب الطلب</th>
                    <th className="p-3">الجهة المعنية / الوزارة</th>
                    <th className="p-3 text-center">حالة الطلب الحالية</th>
                    <th className="p-3 text-center">موقف المعاملة</th>
                    <th className="p-3 text-center">إجراءات الطباعة والحفظ الذكي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {filteredCitizenRequests.length > 0 ? (
                    filteredCitizenRequests.map((req, idx) => {
                      const isUnreceived = req.RequestStatus === 'غير مستلم' || !req.RequestStatus;
                      return (
                        <tr key={`${req.Request_ID}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-mono font-bold text-teal-600 dark:text-teal-400">{req.Request_ID}</td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 dark:text-slate-100">{req.CitizenName}</span>
                            {req.CitizenPhone && (
                              <span className="block text-[11px] font-mono text-slate-400">{req.CitizenPhone}</span>
                            )}
                          </td>
                          <td className="p-3">{req.Entity}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              req.RequestStatus === 'مستلم'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 animate-pulse'
                            }`}>
                              {req.RequestStatus || 'غير مستلم'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px]">
                              {req.ProcessingStatus}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Direct Save Button */}
                              <button
                                onClick={() => handlePrintOrSaveCitizenRequest(req, 'حفظ')}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                                title="حفظ وتحديث الحالة إلى مستلم فورياً"
                              >
                                حفظ كـ مستلم
                              </button>

                              {/* Direct Print Button */}
                              <button
                                onClick={() => handlePrintOrSaveCitizenRequest(req, 'طباعة')}
                                className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                                title="طباعة الورقة وتحديث الحالة تلقائياً إلى مستلم"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>طباعة وتحديث الحالة</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                        لا توجد طلبات مطابقة للاسم الذي تم البحث عنه
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Printable Citizen Request Paper Modal */}
      {selectedRequestForPrint && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col border border-slate-200">
            <div className="no-print bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-teal-400" />
                <h4 className="font-bold text-xs">معاينة طلب المواطن - تم تحديث الحالة تلقائياً إلى مستلم</h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة الآن</span>
                </button>
                <button
                  onClick={() => setSelectedRequestForPrint(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="print-container p-8 sm:p-12 space-y-6 text-right font-['Cairo',sans-serif] bg-white flex-1 overflow-y-auto">
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <div className="text-right space-y-0.5">
                  <div className="text-xs font-bold text-slate-900">جمهورية العراق</div>
                  <div className="text-xs font-bold text-slate-800">مجلس النواب العراقي</div>
                  <div className="text-sm font-extrabold text-teal-900">{systemSettings.deputyTitle}</div>
                  <div className="text-[11px] text-slate-600">مكتب محافظة ذي قار - قسم المكنة والطباعة</div>
                </div>

                <div className="text-left font-mono text-xs space-y-1" dir="ltr">
                  <div><strong>رقم الطلب:</strong> {selectedRequestForPrint.Request_ID}</div>
                  <div><strong>التاريخ:</strong> {new Date().toLocaleDateString('ar-IQ')}</div>
                  <div><strong className="text-emerald-700">الحالة:</strong> مستلم (منجز بالطباعة)</div>
                </div>
              </div>

              <div className="pt-2">
                <h3 className="text-base font-extrabold text-slate-950">
                  إلى / {selectedRequestForPrint.Entity} المحترم
                </h3>
                <h4 className="text-sm font-bold text-slate-800 mt-1">
                  م / طلب المواطن ({selectedRequestForPrint.CitizenName})
                </h4>
              </div>

              <div className="text-sm text-slate-900 leading-relaxed whitespace-pre-line py-4 min-h-[180px]">
                {selectedRequestForPrint.Details}
              </div>

              {selectedRequestForPrint.DeputyNotes && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900">
                  <strong>توجيه النائب:</strong> {selectedRequestForPrint.DeputyNotes}
                </div>
              )}

              <div className="pt-6 border-t border-slate-300 flex items-end justify-between">
                <div className="text-xs text-slate-500 font-mono">
                  هاتف المراجع: {selectedRequestForPrint.CitizenPhone || '---'}
                </div>

                <div className="text-center space-y-1">
                  <div className="text-sm font-extrabold text-slate-950">المهندسة علا عودة الناشي</div>
                  <div className="text-xs font-bold text-teal-800">عضو مجلس النواب العراقي</div>
                  <div className="pt-3 text-[10px] font-mono text-slate-400">[التوقيع والختم المعتمد]</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OFFICIAL LETTERS */}
      {activeTab === 'letters' && (
        <>
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setLetterNumber(`ن/ع/2026/${Math.floor(100 + Math.random() * 900)}`);
                setShowAddModal(true);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>صياغة كتاب رسمي جديد</span>
            </button>
          </div>
        </>
      )}

      {/* Search */}
      <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-4 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم الكتاب، الجهة الموجه إليها، الموضوع، أو اسم المواطن..."
            className="w-full pr-9 pl-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs text-right focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
          />
        </div>
      </div>

      {/* Letters Table */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <span className="text-xs font-bold text-slate-800">
            سجل الكتب الرسمية والمخاطبات ({filteredLetters.length})
          </span>
          <span className="text-[11px] text-slate-500">
            معاينة وطباعة رسمية A4 فورية مع الترويسة والباركود
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5">رقم الكتاب الصادر</th>
                <th className="p-2.5">الجهة الموجه إليها</th>
                <th className="p-2.5">الموضوع</th>
                <th className="p-2.5">المواطن المعني</th>
                <th className="p-2.5">التاريخ</th>
                <th className="p-2.5">الموقف</th>
                <th className="p-2.5 text-center">الطباعة والمعاينة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLetters.map((letter) => (
                <tr key={letter.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-2.5 font-mono font-bold text-blue-700">{letter.letterNumber}</td>
                  <td className="p-2.5 font-bold text-slate-900">{letter.recipient}</td>
                  <td className="p-2.5 max-w-xs text-slate-600">{letter.subject}</td>
                  <td className="p-2.5">
                    {letter.citizenName ? (
                      <div>
                        <span className="text-slate-900 font-semibold">{letter.citizenName}</span>
                        <div className="text-[10px] text-amber-700 font-mono">{letter.citizenId}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400">عام</span>
                    )}
                  </td>
                  <td className="p-2.5 font-mono text-[11px] text-slate-500">{letter.letterDate}</td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      letter.status === 'تم التوقيع والإرسال'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-teal-50 text-teal-700 border-teal-200'
                    }`}>
                      {letter.status}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setSelectedLetterForPrint(letter)}
                        className="px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>معاينة وطباعة</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Letter Modal / Printable Preview */}
      {selectedLetterForPrint && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white text-slate-900 rounded-2xl shadow-xl overflow-hidden my-auto max-h-[90vh] flex flex-col border border-slate-200">
            {/* Header controls */}
            <div className="no-print bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-teal-400" />
                <h4 className="font-bold text-xs">معاينة الكتاب الرسمي البرلماني A4</h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrint(selectedLetterForPrint)}
                  className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة فورية</span>
                </button>
                <button
                  onClick={() => setSelectedLetterForPrint(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Official Letter Body for A4 Print */}
            <div className="print-container p-8 sm:p-12 space-y-6 text-right font-['Cairo',sans-serif] bg-white flex-1 overflow-y-auto">
              {/* Header with Parliament Emblem */}
              <div className="border-b-2 border-slate-900 pb-5 flex items-center justify-between">
                <div className="text-right space-y-0.5">
                  <div className="text-xs font-bold text-slate-900">جمهورية العراق</div>
                  <div className="text-xs font-bold text-slate-800">مجلس النواب العراقي</div>
                  <div className="text-sm font-extrabold text-amber-900">{systemSettings.deputyTitle}</div>
                  <div className="text-[11px] text-slate-600">مكتب محافظة ذي قار</div>
                </div>

                <div className="w-16 h-16 flex items-center justify-center">
                  <img 
                    src={systemSettings.parliamentEmblemUrl} 
                    alt="شعار مجلس النواب" 
                    className="max-h-16 object-contain"
                    crossOrigin="anonymous"
                  />
                </div>

                <div className="text-left font-mono text-xs space-y-1" dir="ltr">
                  <div><strong>Ref:</strong> {selectedLetterForPrint.letterNumber}</div>
                  <div><strong>Date:</strong> {selectedLetterForPrint.letterDate}</div>
                </div>
              </div>

              {/* Recipient */}
              <div className="pt-4 pb-2">
                <h3 className="text-base font-extrabold text-slate-950 underline decoration-2 underline-offset-4">
                  إلى / {selectedLetterForPrint.recipient}
                </h3>
                <h4 className="text-sm font-bold text-slate-800 mt-2">
                  م / {selectedLetterForPrint.subject}
                </h4>
              </div>

              {/* Letter Text */}
              <div className="text-sm text-slate-900 leading-relaxed whitespace-pre-line py-4 min-h-[220px] text-justify">
                {selectedLetterForPrint.body}
              </div>

              {/* Signature Footer */}
              <div className="pt-8 border-t border-slate-200 flex items-end justify-between">
                <div className="text-xs text-slate-500 font-mono">
                  نسخة منه إلى:<br />
                  - قسم المتابعة والتوثيق<br />
                  - الأرشيف العام
                </div>

                <div className="text-center space-y-1">
                  <div className="text-sm font-extrabold text-slate-950">المهندسة علا عودة الناشي</div>
                  <div className="text-xs font-bold text-amber-800">عضو مجلس النواب العراقي</div>
                  <div className="pt-4 text-xs font-mono text-slate-400">التوقيع والختم الرسمي</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Letter Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-xl p-5 md:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">صياغة كتاب برلماني رسمي جديد</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 text-xs">✕</button>
            </div>

            <form onSubmit={handleCreateLetter} className="space-y-3 text-right">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الرقم الإشاري للكتاب</label>
                  <input
                    type="text"
                    value={letterNumber}
                    onChange={(e) => setLetterNumber(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono text-right focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ</label>
                  <input
                    type="date"
                    value={letterDate}
                    onChange={(e) => setLetterDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الجهة الموجه إليها الكتاب (إلى / ...)</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="معالي وزير الصحة المحترم"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الموضوع (م / ...)</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="طلب تخصيص جهاز رنين مغناطيسي لمستشفى الشطرة العام"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ربط بمواطن أو معاملة (اختياري)</label>
                <select
                  value={citizenId}
                  onChange={(e) => setCitizenId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="">-- عام (بدون ربط بمواطن محدد) --</option>
                  {citizens.map((c) => (
                    <option key={c.Citizen_ID} value={c.Citizen_ID}>
                      {c.FullName} ({c.Citizen_ID})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">متن ونص الكتاب الرسمي</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right leading-relaxed focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">إلغاء</button>
                <button type="submit" className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs">حفظ ومعاينة الطباعة</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
