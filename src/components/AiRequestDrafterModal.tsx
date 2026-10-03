import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SearchableSelect } from './SearchableSelect';
import { 
  Sparkles, 
  Printer, 
  Save, 
  X, 
  FileText, 
  User, 
  Phone, 
  Building2, 
  RotateCcw,
  CheckCircle2,
  Copy
} from 'lucide-react';

interface AiRequestDrafterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCitizenName?: string;
  initialPhone?: string;
  initialEntity?: string;
}

export const AiRequestDrafterModal: React.FC<AiRequestDrafterModalProps> = ({
  isOpen,
  onClose,
  initialCitizenName = '',
  initialPhone = '',
  initialEntity = '',
}) => {
  const { systemSettings, dropdowns, addRequest, addCitizen, citizens, currentUser, addAuditLog } = useApp();

  const [applicantName, setApplicantName] = useState(initialCitizenName);
  const [applicantPhone, setApplicantPhone] = useState(initialPhone);
  const [applicantAddress, setApplicantAddress] = useState('ذي قار - الناصرية');
  const [targetEntity, setTargetEntity] = useState(initialEntity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)');
  const [requestSubject, setRequestSubject] = useState('طلب شمول براتب شبكة الحماية الاجتماعية');
  const [citizenNeeds, setCitizenNeeds] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // Entities list from dropdowns
  const ministryOptions = dropdowns
    .filter(d => d.Category === 'Entity')
    .map(d => d.ItemValue);

  // AI drafting template generator (Arabic Parliamentary legal style)
  const handleGenerateAI = () => {
    if (!applicantName.trim() || !targetEntity.trim()) return;

    setIsGenerating(true);
    setTimeout(() => {
      const todayDate = new Date().toLocaleDateString('ar-IQ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const draft = `بسم الله الرحمن الرحيم
جمهورية العراق - مجلس النواب العراقي
مكتب النائب علا عودة الناشي
عضو مجلس النواب العراقي

التاريخ: ${todayDate}
العدد: ص / ....................

إلى / ${targetEntity} المحترم
م / ${requestSubject || 'طلب مواطن'}

تحية طيبة وتقدير عالي ...

نرفع إلى أنظاركم الكريمة طلب المواطن (${applicantName})، الساكن في (${applicantAddress})، حامل هاتف رقم (${applicantPhone || '---'}).

وحيث إن المواطن المذكور يمر بظروف استثنائية وبحاجة ماسة إلى النظر في مظلوميته المتمثلة في:
"${citizenNeeds.trim() || 'النظر بعين العطف والموافقة على تسيير المعاملة الأصولية لشموله بالحقوق القانونية المكفولة دستورياً للمواطنين الكرام'}".

واستناداً إلى الدور الرقابي والتمثيلي لمجلس النواب العراقي، وحرصاً على دعم الفئات المستحقة وتخفيف الأعباء المعيشية والإدارية عن كاهل أهلنا الأعزاء، نرجو تفضلكم بالموافقة والتوجيه بإجراء اللازم أصولياً وتسهيل إنجاز مطلبه وفق الضوابط والتعليمات النافذة.

شاكرين تعاونكم المستمر وحرصكم الدائم على خدمة الصالح العام.
وتفضلوا بقبول فائق الشكر والاحترام ...


مكتب النائب 
علا عودة الناشي
عضو مجلس النواب العراقي

----------------------------------------------------------------------------------
* هامش معالي الوزير / السيد المدير العام المحترم:
.......................................................................................................................................
.......................................................................................................................................`;

      setGeneratedDraft(draft);
      setIsGenerating(false);
    }, 450);
  };

  const handlePrint = () => {
    addAuditLog(
      'طباعة طلب ذكي',
      'توليد الطلبات بالذكاء الاصطناعي',
      `طباعة طلب للمواطن ${applicantName} موجه إلى ${targetEntity}`
    );
    window.print();
  };

  const handleSaveToSystem = () => {
    if (!applicantName.trim()) return;

    // Check if citizen exists
    let citizen = citizens.find(c => c.FullName === applicantName.trim() || (applicantPhone && c.Phone1 === applicantPhone));
    let citId = citizen ? citizen.Citizen_ID : '';

    if (!citizen) {
      const newCit = addCitizen({
        FirstName: applicantName.split(' ')[0] || applicantName,
        FatherName: applicantName.split(' ')[1] || '',
        GrandFatherName: applicantName.split(' ')[2] || '',
        GreatGrandFatherName: applicantName.split(' ')[3] || '',
        Surname: '',
        FullName: applicantName.trim(),
        Phone1: applicantPhone.trim() || '07800000000',
        Job: 'كاسب',
        Education: 'غير محدد',
        Gender: 'ذكر',
        Rating: 'لائق',
        District: 'الناصرية',
        SubDistrict: 'مركز القضاء',
        ReferralSource: 'طلب ذكي بالذكاء الاصطناعي',
        RegisteredVia: 'إدارة'
      });
      citId = newCit.Citizen_ID;
    }

    addRequest({
      Citizen_ID: citId,
      CitizenName: applicantName.trim(),
      CitizenPhone: applicantPhone.trim(),
      Entity: targetEntity,
      RequestStatus: 'مستلم',
      ProcessingStatus: 'قيد الإجراء',
      Priority: 'عاجل',
      Details: `${requestSubject}: ${citizenNeeds.trim() || 'تم توليد وتنسيق الطلب رسمياً'}`,
      GeneratedAiDraft: generatedDraft,
      CreatedBy: currentUser ? currentUser.FullName : 'النظام الذكي'
    });

    setIsSaved(true);
    addAuditLog(
      'حفظ طلب ذكي بالنظام',
      'توليد الطلبات بالذكاء الاصطناعي',
      `حفظ طلب رسمي للمواطن ${applicantName} موجه لـ ${targetEntity}`
    );
    setTimeout(() => setIsSaved(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto text-right font-['Tajawal',sans-serif]">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                صياغة وتوليد الطلبات الرسمية بالذكاء الاصطناعي
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 font-black">
                  نسخة برلمانية
                </span>
              </h3>
              <p className="text-xs text-blue-100">
                أدخل ما يريده المواطن والجهة المعنية لتوليد كتاب رسمي برلماني جاهز للطباعة فوراً
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls & Inputs (5 Cols) */}
          <div className="lg:col-span-5 space-y-3.5 text-xs">
            <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 p-3 rounded-xl space-y-1">
              <span className="font-bold text-blue-900 dark:text-blue-300">ملاحظة الصياغة:</span>
              <p className="text-[11px] text-blue-700 dark:text-blue-400">
                يقوم المحرك الذكي بصياغة الكتاب بلغة قانونية برلمانية راقية تحمل صفة النائب علا عودة الناشي.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                اسم مقدم الطلب الرباعي *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="مثال: حسن طالب كريم الخفاجي"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  رقم الهاتف
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={applicantPhone}
                    onChange={(e) => setApplicantPhone(e.target.value)}
                    placeholder="078XXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  السكن / القضاء
                </label>
                <input
                  type="text"
                  value={applicantAddress}
                  onChange={(e) => setApplicantAddress(e.target.value)}
                  placeholder="ذي قار - القضاء"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                الجهة المعنية أو الوزارة (ابحث واكتب مباشرة) *
              </label>
              <SearchableSelect
                options={ministryOptions}
                value={targetEntity}
                onChange={(val) => setTargetEntity(val)}
                placeholder="اكتب أول حروف مثل: داخلي، عمل، تربية..."
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                موضوع الطلب
              </label>
              <input
                type="text"
                value={requestSubject}
                onChange={(e) => setRequestSubject(e.target.value)}
                placeholder="مثال: طلب شمول برعاية / طلب نقل / طلب تبليط"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                ما الذي يريده المواطن باختصار؟
              </label>
              <textarea
                rows={3}
                value={citizenNeeds}
                onChange={(e) => setCitizenNeeds(e.target.value)}
                placeholder="اكتب بكلماتك البسيطة ما قاله المراجع، وسيتولى الذكاء الاصطناعي تحويلها إلى صياغة برلمانية رفيعة..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleGenerateAI}
              disabled={isGenerating || !applicantName.trim()}
              className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isGenerating || !applicantName.trim()
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGenerating ? 'جاري الصياغة والتوليد الذكي...' : 'توليد الطلب بالذكاء الاصطناعي ✨'}</span>
            </button>
          </div>

          {/* Preview & Print Area (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                معاينة الورقة الرسمية المجهزة للطباعة
              </span>

              {generatedDraft && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedDraft);
                      alert('تم نسخ نص الطلب بنجاح');
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs cursor-pointer"
                    title="نسخ النص"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={handleSaveToSystem}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {isSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{isSaved ? 'تم الحفظ بالنظام' : 'حفظ بالمنظومة'}</span>
                  </button>

                  <button
                    onClick={handlePrint}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة الطلب فوراً</span>
                  </button>
                </div>
              )}
            </div>

            {/* Renderable Printable Page Frame */}
            <div 
              id="ai-printable-request"
              className="flex-1 min-h-[380px] p-6 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white text-slate-900 shadow-inner overflow-y-auto font-['Tajawal',sans-serif] relative"
              style={{
                borderImage: 'linear-gradient(to bottom, #1e3a8a, #0f172a) 1',
              }}
            >
              {generatedDraft ? (
                <div className="space-y-4 text-right">
                  {/* Decorative Header */}
                  <div className="border-b-2 border-slate-800 pb-3 flex items-center justify-between">
                    <div className="text-right space-y-0.5">
                      <p className="text-xs font-bold text-slate-900">جمهورية العراق</p>
                      <p className="text-xs font-bold text-slate-900">مجلس النواب العراقي</p>
                      <p className="text-xs font-black text-blue-900">مكتب النائب علا عودة الناشي</p>
                    </div>

                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full border border-slate-400 flex items-center justify-center text-slate-800 font-bold text-[10px] mx-auto">
                        شعار المجلس
                      </div>
                      <span className="text-[9px] text-slate-500 font-semibold">الدورة الانتخابية الخامسة</span>
                    </div>

                    <div className="text-left font-mono text-[11px] text-slate-700 space-y-0.5">
                      <p>التاريخ: {new Date().toLocaleDateString('ar-IQ')}</p>
                      <p>العدد: ص / ............</p>
                    </div>
                  </div>

                  {/* Body Text */}
                  <div className="whitespace-pre-line text-xs leading-relaxed text-slate-800 font-medium py-2">
                    {generatedDraft.replace(/بسم الله الرحمن الرحيم[\s\S]*?العدد: ص \/ \.{10,}/, '').trim()}
                  </div>

                  {/* Bottom Footer & Seal Frame */}
                  <div className="pt-4 border-t border-slate-300 flex items-end justify-between">
                    <div className="text-right text-[10px] text-slate-500">
                      <p>المحافظة: ذي قار - الناصرية</p>
                      <p>البريد والاتصال: {systemSettings.hotline || '07800000000'}</p>
                    </div>

                    <div className="text-center">
                      <p className="font-bold text-xs text-slate-900">النائب علا عودة الناشي</p>
                      <p className="text-[10px] text-slate-600">عضو مجلس النواب العراقي</p>
                      <div className="mt-1 w-24 h-10 border border-dashed border-slate-300 rounded flex items-center justify-center text-[9px] text-slate-400">
                        [ختم وتوقيع النائب]
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center text-blue-500">
                    <Sparkles className="w-7 h-7 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">الطلب لم يولد بعد</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      أدخل اسم المواطن، رقم هاتفه، والجهة المعنية من القائمة الجانبية ثم اضغط "توليد الطلب بالذكاء الاصطناعي".
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            توليد ذكي متوافق مع نظام أرشفة وطباعة مجلس النواب العراقي
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
