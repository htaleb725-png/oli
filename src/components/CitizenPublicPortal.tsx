import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Printer, 
  Download, 
  ShieldCheck, 
  Building2, 
  ArrowRight, 
  User, 
  Phone, 
  Share2, 
  Sparkles,
  ExternalLink,
  Lock
} from 'lucide-react';
import { OfficeRequest, Citizen } from '../types';

interface CitizenPublicPortalProps {
  onBackToStaffLogin?: () => void;
}

export const CitizenPublicPortal: React.FC<CitizenPublicPortalProps> = ({ onBackToStaffLogin }) => {
  const { citizens, requests, systemSettings, addAuditLog } = useApp();

  const [inputName, setInputName] = useState('');
  const [inputPhone, setInputPhone] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [matchedCitizen, setMatchedCitizen] = useState<Citizen | null>(null);
  const [matchedRequests, setMatchedRequests] = useState<OfficeRequest[]>([]);
  const [selectedReqForModal, setSelectedReqForModal] = useState<OfficeRequest | null>(null);

  // Normalize Arabic string for tolerant matching
  const cleanArabic = (text: string) => {
    return (text || '')
      .trim()
      .toLowerCase()
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim() || !inputPhone.trim()) return;

    const cleanedSearchName = cleanArabic(inputName);
    const cleanedSearchPhone = inputPhone.replace(/\D/g, '').slice(-10); // match last 10 digits

    // Find citizen
    const foundCit = citizens.find(c => {
      const citNameClean = cleanArabic(c.FullName);
      const citPhoneClean = (c.Phone1 || '').replace(/\D/g, '').slice(-10);
      const citPhone2Clean = (c.Phone2 || '').replace(/\D/g, '').slice(-10);

      // Name can match partially or fully (binary, ternary, quad)
      const nameMatch = citNameClean.includes(cleanedSearchName) || cleanedSearchName.includes(citNameClean);
      const phoneMatch = citPhoneClean.includes(cleanedSearchPhone) || (citPhone2Clean && citPhone2Clean.includes(cleanedSearchPhone));

      return nameMatch && phoneMatch;
    });

    setHasSearched(true);

    if (foundCit) {
      setMatchedCitizen(foundCit);
      const userRequests = requests.filter(r => r.Citizen_ID === foundCit.Citizen_ID);
      setMatchedRequests(userRequests);

      // Log citizen lookup in local storage and audit
      try {
        const existingInquiries = JSON.parse(localStorage.getItem('ola_citizen_inquiries') || '[]');
        existingInquiries.unshift({
          id: `INQ-${Date.now()}`,
          citizenName: foundCit.FullName,
          phone: foundCit.Phone1,
          inquiryDate: new Date().toLocaleString('ar-IQ'),
          matchedRequestsCount: userRequests.length,
        });
        localStorage.setItem('ola_citizen_inquiries', JSON.stringify(existingInquiries.slice(0, 100)));
      } catch (err) {
        console.error(err);
      }

      addAuditLog(
        'استعلام مواطن خارجي',
        'بوابة المواطنين',
        `استعلام المواطن ${foundCit.FullName} (هاتف: ${foundCit.Phone1}) عن طلباته`
      );
    } else {
      setMatchedCitizen(null);
      setMatchedRequests([]);
    }
  };

  const handlePrintCard = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-[#0a1428] to-slate-950 text-slate-100 font-['Tajawal',sans-serif] flex flex-col justify-between" dir="rtl">
      {/* Top Navigation Bar */}
      <header className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
              ع
            </div>
            <div>
              <h1 className="font-bold text-sm sm:text-base text-white">
                بوابة متابعة طلبات المواطنين
              </h1>
              <p className="text-[11px] text-slate-400">
                مكتب النائب علا عودة الناشي - مجلس النواب العراقي
              </p>
            </div>
          </div>

          {onBackToStaffLogin && (
            <button
              onClick={onBackToStaffLogin}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>دخول موظفي المكتب</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto w-full p-4 sm:p-6 flex-1 flex flex-col justify-center my-4 space-y-6">
        {/* Hero Card */}
        <div className="bg-gradient-to-br from-blue-900/40 via-slate-900/60 to-slate-900/80 border border-blue-500/20 rounded-3xl p-6 sm:p-8 text-center space-y-3 relative overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
            الاستعلام الإلكتروني المباشر عن مسار المعاملات
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            أهلاً بكم في المنصة الرسمية لمكتب النائب علا عودة الناشي. يرجى إدخال اسمك الرباعي ورقم الهاتف المسجل بالطلب للتحقق الفوري من موقف طلبك وتوجيهات النائب.
          </p>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  اسم المواطن (كما قُدم في الطلب) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    placeholder="مثال: حسن طالب كريم"
                    className="w-full pl-9 pr-3.5 py-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder:text-slate-500 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  رقم الهاتف المسجل بالطلب حصراً *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={inputPhone}
                    onChange={(e) => setInputPhone(e.target.value)}
                    placeholder="مثال: 07819935806"
                    className="w-full pl-9 pr-3.5 py-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder:text-slate-500 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    dir="ltr"
                    required
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>البحث والتحقق الفوري عن الطلبات</span>
            </button>
          </form>
        </div>

        {/* Results Area */}
        {hasSearched && (
          <div className="space-y-6">
            {matchedCitizen ? (
              <div className="space-y-4">
                {/* Official Digital Verification Card */}
                <div 
                  id="citizen-digital-card"
                  className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden text-right"
                >
                  {/* Decorative Background Pattern */}
                  <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-blue-600 via-amber-400 to-indigo-600" />
                  
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        سجل معتمد ومطابق رسمياً ✓
                      </span>
                      <h3 className="text-xl font-black text-white pt-1">
                        {matchedCitizen.FullName}
                      </h3>
                      <p className="text-xs text-slate-400 flex items-center gap-2">
                        <span>الرقم التعريفي: <strong className="text-blue-400 font-mono">{matchedCitizen.Citizen_ID}</strong></span>
                        <span>•</span>
                        <span>السكن: <strong>{matchedCitizen.District} - {matchedCitizen.SubDistrict}</strong></span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePrintCard}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>طباعة بطاقة الاستعلام</span>
                      </button>
                    </div>
                  </div>

                  {/* Requests Status Breakdown */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      الطلبات المسجلة في مكتب النائب ({matchedRequests.length})
                    </h4>

                    {matchedRequests.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {matchedRequests.map((req, idx) => (
                          <div 
                            key={`${req.Request_ID}-${idx}`}
                            className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-4 sm:p-5 space-y-3 hover:border-slate-600 transition-colors"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center text-xs font-mono font-bold">
                                  {idx + 1}
                                </span>
                                <div>
                                  <span className="font-bold text-sm text-white">{req.Entity}</span>
                                  <span className="block text-[11px] font-mono text-slate-400">
                                    رقم الإضبارة: {req.Request_ID}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  req.ProcessingStatus === 'منجز'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : req.ProcessingStatus === 'قيد الإجراء'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                }`}>
                                  الموقف: {req.ProcessingStatus}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-1 text-xs">
                              <p className="text-slate-300 font-medium leading-relaxed">
                                <span className="text-slate-400 font-normal">مضمون المعاملة: </span>
                                {req.Details}
                              </p>

                              {req.DeputyNotes && (
                                <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
                                  <span className="font-bold block text-[11px] text-amber-400 mb-0.5">
                                    توجيه وقرار النائب علا الناشي:
                                  </span>
                                  <p className="text-xs">{req.DeputyNotes}</p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400 border-t border-slate-700/50">
                              <span>تاريخ التسجيل: {req.CreatedAt}</span>
                              <span className="text-slate-300">المرحلة الحالية: {req.CurrentStage || 'قسم الإدارة'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-slate-400 text-xs bg-slate-800/40 rounded-2xl">
                        لا توجد طلبات مدخلة لهذا المواطن حالياً
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                    <p>مكتب النائب علا عودة الناشي - خدمة المواطن أولاً وأخيراً</p>
                    <p className="font-mono text-[11px]">تاريخ الاستعلام: {new Date().toLocaleString('ar-IQ')}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/80 border border-rose-500/30 rounded-3xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  عذراً، لم يتم العثور على سجل مطابق
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  تأكد من كتابة الاسم كما دُوّن في استمارة المراجعة ورقم الهاتف الذي قدمته لموظف الاستعلامات أو الإدارة. إذا استمر التعذر، تفضل بزيارة المكتب أو الاتصال بالخط الساخن.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Public Footer */}
      <footer className="p-4 border-t border-slate-800/80 bg-slate-950/80 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>مكتب النائب علا عودة الناشي - مجلس النواب العراقي © {new Date().getFullYear()}</span>
          <span>الخط الساخن للمكتب: {systemSettings.hotline || '07800000000'}</span>
        </div>
      </footer>
    </div>
  );
};
