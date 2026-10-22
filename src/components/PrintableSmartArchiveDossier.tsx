import React, { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../context/AppContext';
import {
  Printer,
  X,
  Archive,
  CheckCircle2,
  Calendar,
  Phone,
  MapPin,
  FileText,
  Clock,
  Award,
  ShieldCheck,
  FolderArchive,
  Download,
  Building2,
  CheckCheck
} from 'lucide-react';

export const PrintableSmartArchiveDossier: React.FC = () => {
  const {
    printableArchiveCitizen,
    setPrintableArchiveCitizen,
    systemSettings,
    currentUser,
    addAuditLog
  } = useApp();

  // Auto trigger print when opened for a true 1-click experience
  useEffect(() => {
    if (printableArchiveCitizen) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [printableArchiveCitizen]);

  if (!printableArchiveCitizen) return null;

  const { citizen, requests, archiveTimestamp, archiveCode, archivedBy, notes } = printableArchiveCitizen;
  const completedRequests = requests.filter(r => r.ProcessingStatus === 'منجز' || r.IsArchived);

  const handlePrint = () => {
    addAuditLog(
      'طباعة وثيقة الأرشفة الذكية PDF',
      'الأرشيف طويل الأمد',
      `تمت طباعة/تحميل النسخة الاحتياطية PDF للمراجع ${citizen.FullName} [${archiveCode}] بواسطة ${currentUser?.FullName}`
    );
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-['Tajawal',sans-serif]" dir="rtl">
      <div className="relative w-full max-w-4xl bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-200">
        
        {/* Top Control Bar (Hidden when printing/saving to PDF) */}
        <div className="no-print bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <Archive className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-white">معاينة وثيقة الأرشفة الذكية والنسخة الاحتياطية (PDF)</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/30 text-purple-200 border border-purple-400/40">
                  {archiveCode}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                نقل تلقائي إلى الأرشيف طويل الأمد • توليد فوري للنسخة الاحتياطية PDF بنقرة واحدة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>طباعة / حفظ PDF فوراً</span>
            </button>

            <button
              onClick={() => setPrintableArchiveCitizen(null)}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-rose-900/60 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              title="إغلاق المعاينة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Document Area */}
        <div className="print-container p-6 sm:p-10 space-y-6 text-right font-['Cairo',sans-serif] bg-white">
          
          {/* Header Bar */}
          <div className="border-b-2 border-slate-900 pb-5">
            <div className="flex items-center justify-between">
              
              {/* Right: Iraqi Republic and Office */}
              <div className="text-right space-y-1">
                <div className="font-extrabold text-base text-slate-950">جمهورية العراق</div>
                <div className="font-bold text-sm text-slate-800">مجلس النواب العراقي - الدورة الخامسة</div>
                <div className="font-bold text-xs text-slate-700">مكتب النائب المهندسة علا عودة الناشي</div>
                <div className="text-[11px] text-slate-500">{systemSettings.province} • قسم الأرشيف والمعلومات المركزية</div>
              </div>

              {/* Center Emblem */}
              <div className="text-center space-y-1">
                <div className="w-16 h-16 mx-auto flex items-center justify-center">
                  <img
                    src={systemSettings.parliamentEmblemUrl}
                    alt="شعار جمهورية العراق"
                    className="max-h-16 object-contain"
                    crossOrigin="anonymous"
                  />
                </div>
                <div className="text-[10px] font-black tracking-widest text-slate-800">الأرشيف الإلكتروني الدائم</div>
              </div>

              {/* Left: Metadata & QR */}
              <div className="flex items-center gap-3">
                <div className="text-left space-y-0.5 text-xs text-slate-700 font-mono">
                  <div>رمز الأرشيف: <strong className="text-purple-950 font-bold text-sm">{archiveCode}</strong></div>
                  <div>تاريخ الأرشفة: <span className="font-sans text-[11px]">{archiveTimestamp}</span></div>
                  <div>المسؤول: <span className="font-sans text-[11px]">{archivedBy}</span></div>
                  <div>التصنيف: <strong className="text-emerald-700 font-sans">أرشيف دائم طويل الأمد</strong></div>
                </div>
                <div className="p-1 bg-white border border-slate-300 rounded-xl shadow-xs shrink-0">
                  <QRCodeSVG
                    value={`https://parliament.iq/archive/dossier/${archiveCode}?citizen=${citizen.Citizen_ID}&name=${encodeURIComponent(citizen.FullName)}`}
                    size={68}
                  />
                </div>
              </div>

            </div>

            {/* Document Title Banner */}
            <div className="mt-4 pt-2.5 border-t border-slate-200 text-center">
              <h2 className="text-lg sm:text-xl font-black text-slate-950 tracking-wide bg-gradient-to-r from-purple-50 via-slate-100 to-indigo-50 py-2 rounded-xl border border-purple-200 shadow-2xs">
                إضبارة أرشفة ذكية طويلة الأمد ونسخة احتياطية موثقة
              </h2>
              <p className="text-[11px] text-slate-600 mt-1">
                وثيقة أرشفة رقمية رسمية تتضمن سجل المراجع وكافة الطلبات والمعاملات المكتملة والمحفوظة في السجل الدائم
              </p>
            </div>
          </div>

          {/* Citizen Master Profile */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-purple-200">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <FolderArchive className="w-4 h-4 text-purple-700" />
                <span>أولاً: بيانات المراجع المحفوظة في الأرشيف الدائم</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-mono">
                كود ONA: {citizen.Citizen_ID}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div className="col-span-2">
                <span className="text-slate-500 block text-[11px]">الاسم الرباعي واللقب:</span>
                <strong className="text-sm font-black text-slate-950">{citizen.FullName}</strong>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">رقم الهاتف للتواصل:</span>
                <strong className="text-slate-900 font-mono" dir="ltr">{citizen.Phone1}</strong>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">القضاء والناحية:</span>
                <strong className="text-slate-900">{citizen.District} {citizen.SubDistrict ? `• ${citizen.SubDistrict}` : ''}</strong>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">المهنة / العمل:</span>
                <strong className="text-slate-900">{citizen.Job || 'كاسب'}</strong>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">نوع الحضور والتسجيل:</span>
                <strong className="text-slate-900">{citizen.AttendanceType || 'شخصياً'}</strong>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">تاريخ التسجيل الأولي:</span>
                <span className="text-slate-900 font-mono text-[11px]">{citizen.CreatedAt}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">الموظف المسجل:</span>
                <span className="text-slate-900 font-medium">{citizen.CreatedBy || 'الاستعلامات'}</span>
              </div>
            </div>
          </div>

          {/* Completed Requests Long-Term Archive Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-purple-200">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-emerald-700" />
                <span>ثانياً: سجل المعاملات والطلبات المكتملة المنقولة للأرشيف طويل الأمد ({completedRequests.length} معاملة منجزة)</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                موقف المعاملات: منجزة ومؤرشفة
              </span>
            </div>

            {completedRequests.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-slate-500 text-xs">
                تمت أرشفة بيانات المراجع بالكامل في الأرشيف الدائم (لا توجد طلبات معلقة أو جميع الطلبات قيد الإجراء).
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-300">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                    <tr>
                      <th className="p-2.5 w-12 text-center">ت</th>
                      <th className="p-2.5">رقم المعاملة</th>
                      <th className="p-2.5">الجهة الحكومية المعنية</th>
                      <th className="p-2.5">العدد الصادر وتاريخه</th>
                      <th className="p-2.5">موضوع وتفاصيل الطلب</th>
                      <th className="p-2.5 text-center">الموقف الأرشيفي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {completedRequests.map((req, idx) => (
                      <tr key={req.Request_ID} className="hover:bg-slate-50">
                        <td className="p-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2.5 font-mono font-bold text-blue-900">{req.Request_ID}</td>
                        <td className="p-2.5 font-bold text-slate-900">{req.Entity}</td>
                        <td className="p-2.5 text-slate-700">
                          {req.OutgoingNumber ? (
                            <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              صادر: {req.OutgoingNumber} ({req.OutgoingDate || 'معتمد'})
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">غير مدرج</span>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-800 max-w-xs font-medium">
                          <div>{req.Details}</div>
                          {req.DeputyNotes && (
                            <div className="text-[10px] text-blue-800 mt-1 font-bold">
                              الهامش والتوجيه: {req.DeputyNotes}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            منجز ومؤرشف ✓
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notes and Archival Statement */}
          {notes && (
            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 text-xs text-purple-950">
              <span className="font-bold block mb-0.5">ملاحظات الأرشفة الذكية:</span>
              <p>{notes}</p>
            </div>
          )}

          {/* Archival Certification & Official Stamps Box */}
          <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-3 gap-4 text-center text-xs">
            <div className="space-y-8">
              <div>
                <span className="block font-bold text-slate-700 text-[11px]">تنظيم مسؤول الأرشيف طويل الأمد</span>
                <span className="block font-medium text-slate-900 mt-1">{archivedBy}</span>
              </div>
              <div className="text-[10px] text-slate-400">التوقيع والختم الرقمي</div>
            </div>

            <div className="space-y-4">
              <div className="inline-block p-2 rounded-2xl border-2 border-purple-600 bg-purple-50/50">
                <ShieldCheck className="w-6 h-6 mx-auto text-purple-700 mb-1" />
                <span className="block font-black text-[10px] text-purple-900">ختم الأرشفة الإلكترونية الدائمة</span>
                <span className="block font-mono text-[9px] text-purple-700 font-bold">{archiveCode}</span>
                <span className="block text-[8px] text-slate-500">نسخة احتياطية رقمية مؤمنة</span>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <span className="block font-bold text-slate-700 text-[11px]">مصادقة مدير المكتب التنفيذي</span>
                <span className="block font-bold text-slate-950 mt-1">مدير مكتب النائب</span>
              </div>
              <div className="text-[10px] text-slate-400">التوقيع والختم الرسمي</div>
            </div>
          </div>

          {/* Security & Print Footer */}
          <div className="pt-2 text-center text-[10px] text-slate-400 border-t border-slate-200 flex items-center justify-between">
            <span>تم استخراج وتوليد هذه الوثيقة آلياً من منظومة إدارة المراجعين والمكاتب البرلمانية v4.3.0</span>
            <span className="font-mono">DIGITAL BACKUP • {archiveCode} • VERIFIED</span>
          </div>

        </div>

      </div>
    </div>
  );
};
