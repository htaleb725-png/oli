import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../context/AppContext';
import { 
  Printer, 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  Calendar, 
  Phone, 
  MapPin, 
  UserCheck, 
  FileText,
  Clock,
  Award,
  Download
} from 'lucide-react';

export const PrintableIdCard: React.FC = () => {
  const { 
    printableCitizenCard, 
    setPrintableCitizenCard, 
    currentUser, 
    canPrintOfficialCard,
    systemSettings,
    requests,
    interviews,
    organizationRecords,
    addAuditLog
  } = useApp();

  if (!printableCitizenCard) return null;

  const isAllowed = canPrintOfficialCard(currentUser);

  const citizenRequests = requests.filter(r => r.Citizen_ID === printableCitizenCard.Citizen_ID);
  const citizenInterviews = interviews.filter(i => i.Citizen_ID === printableCitizenCard.Citizen_ID);
  const citizenOrg = organizationRecords.find(o => o.Citizen_ID === printableCitizenCard.Citizen_ID);

  const handlePrint = () => {
    if (!isAllowed) {
      alert('غير مصرح لك بطباعة هذه الوثيقة. هذه الميزة مقيدة بالمطور، المدير، وموظف الإدارة.');
      return;
    }
    addAuditLog(
      'طباعة بطاقة المعلومات الرسمية',
      'البحث الشامل',
      `تمت طباعة بطاقة المعلومات الشاملة للمواطن ${printableCitizenCard.FullName} (${printableCitizenCard.Citizen_ID}) بواسطة ${currentUser?.FullName}`
    );
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-auto border border-slate-200">
        {/* Top Control Bar (Hidden on print) */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="font-bold text-base text-white">معاينة بطاقة المعلومات الاحترافية الرسمية</h3>
              <p className="text-xs text-slate-400">
                صلاحية الطباعة مقيدة بـ: [المطور، المدير، موظف الإدارة]
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAllowed ? (
              <button
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الوثيقة الرسمية فوراً</span>
              </button>
            ) : (
              <span className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-1.5 border border-rose-500/30">
                <ShieldAlert className="w-4 h-4" />
                <span>طباعة مقيدة بالصلاحيات</span>
              </span>
            )}

            <button
              onClick={() => setPrintableCitizenCard(null)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Security Warning if unauthorized */}
        {!isAllowed ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">تنبيه أمني: ليس لديك صلاحية طباعة بطاقة المعلومات</h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              عذراً، بناءً على وثيقة الصلاحيات المعتمدة، فإن استخراج وطباعة بطاقة المعلومات الاحترافية مقتصرة حصرياً على:
              <strong className="text-rose-700 block mt-1">[مطور النظام، مدير المكتب، موظف قسم الإدارة]</strong>
            </p>
            <p className="text-xs text-slate-500">حسابك الحالي مسجل برتبة: ({currentUser?.RoleArabic})</p>
            <button
              onClick={() => setPrintableCitizenCard(null)}
              className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        ) : (
          /* Printable Document Area */
          <div className="print-container p-8 md:p-10 space-y-6 text-right font-['Cairo',sans-serif]">
            {/* Document Official Header */}
            <div className="border-b-2 border-slate-800 pb-5">
              <div className="flex items-center justify-between">
                {/* Right Header: Republic of Iraq */}
                <div className="text-right space-y-1">
                  <div className="font-bold text-base text-slate-950">جمهورية العراق</div>
                  <div className="font-bold text-sm text-slate-800">مجلس النواب العراقي - الدورة الخامسة</div>
                  <div className="font-semibold text-xs text-slate-600">مكتب النائب المهندسة علا عودة الناشي</div>
                  <div className="text-[11px] text-slate-500">{systemSettings.province}</div>
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
                  <div className="text-[10px] font-bold tracking-widest text-slate-700">مجلس النواب</div>
                </div>

                {/* Left Header: Reference & QR Code */}
                <div className="flex items-center gap-3">
                  <div className="text-left space-y-0.5 text-xs text-slate-700">
                    <div>الرمز التعريفي: <strong className="text-slate-950 font-mono text-sm">{printableCitizenCard.Citizen_ID}</strong></div>
                    <div>تاريخ الإصدار: <span>{new Date().toLocaleDateString('ar-IQ')}</span></div>
                    <div>تصنيف السجل: <span className="font-semibold text-amber-800">وثيقة رسمية</span></div>
                  </div>
                  <div className="p-1 bg-white border border-slate-300 rounded-lg shadow-xs">
                    <QRCodeSVG 
                      value={`https://parliament.iq/rep/ola-alnashi/citizen/${printableCitizenCard.Citizen_ID}?name=${encodeURIComponent(printableCitizenCard.FullName)}`}
                      size={64}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2 border-t border-slate-300 text-center">
                <h2 className="text-xl font-extrabold text-slate-950 tracking-wide bg-slate-100 py-1.5 rounded-lg border border-slate-300">
                  بطاقة المعلومات والسجل التراكمي للمواطن
                </h2>
              </div>
            </div>

            {/* Citizen Master Details Grid */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-r-4 border-amber-600 pr-2">
                <span>أولاً: البيانات الشخصية والاجتماعية الثابتة</span>
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div className="col-span-2">
                  <span className="text-slate-500 block text-[11px]">الاسم الرباعي واللقب:</span>
                  <strong className="text-sm font-bold text-slate-950">{printableCitizenCard.FullName}</strong>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">الرقم التعريفي (ID):</span>
                  <strong className="text-slate-950 font-mono text-sm">{printableCitizenCard.Citizen_ID}</strong>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">العشيرة / اللقب:</span>
                  <strong className="text-slate-900">{printableCitizenCard.Surname || 'غير محدد'}</strong>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">رقم الهاتف الأول:</span>
                  <span className="text-slate-950 font-mono font-semibold" dir="ltr">{printableCitizenCard.Phone1}</span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">رقم الهاتف الثاني:</span>
                  <span className="text-slate-950 font-mono font-semibold" dir="ltr">{printableCitizenCard.Phone2 || 'لا يوجد'}</span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">السكن (القضاء):</span>
                  <strong className="text-slate-900">{printableCitizenCard.District}</strong>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">الناحية / الحي:</span>
                  <strong className="text-slate-900">{printableCitizenCard.SubDistrict || 'المركز'}</strong>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">المهنة / العمل:</span>
                  <span className="text-slate-900 font-medium">{printableCitizenCard.Job}</span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">التحصيل الدراسي:</span>
                  <span className="text-slate-900 font-medium">{printableCitizenCard.Education}</span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">التقييم العام:</span>
                  <span className="inline-block px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold">
                    {printableCitizenCard.Rating}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">المعرّف / المصرّح:</span>
                  <span className="text-slate-900 font-medium">{printableCitizenCard.ReferralSource || 'مباشر'}</span>
                </div>
              </div>
            </div>

            {/* Requests History Table */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-r-4 border-sky-600 pr-2">
                <span>ثانياً: سجل المعاملات والطلبات المقدمة ({citizenRequests.length})</span>
              </h3>

              {citizenRequests.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-lg text-center text-xs text-slate-500 border border-slate-200">
                  لا توجد طلبات إدارية مسجلة حتى الآن لهذا المواطن.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border border-slate-300">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-2 border-l border-slate-300">رقم الطلب</th>
                        <th className="p-2 border-l border-slate-300">الجهة المعنية</th>
                        <th className="p-2 border-l border-slate-300">تفاصيل الطلب</th>
                        <th className="p-2 border-l border-slate-300">المسار الإداري</th>
                        <th className="p-2 border-l border-slate-300">الأولوية</th>
                        <th className="p-2">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {citizenRequests.map((req, idx) => (
                        <tr key={`${req.Request_ID}-${idx}`} className="hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold text-slate-900 border-l border-slate-300">{req.Request_ID}</td>
                          <td className="p-2 font-semibold text-slate-900 border-l border-slate-300">{req.Entity}</td>
                          <td className="p-2 text-slate-700 border-l border-slate-300 max-w-xs">{req.Details}</td>
                          <td className="p-2 border-l border-slate-300">
                            <span className="font-semibold text-slate-900">{req.ProcessingStatus}</span>
                          </td>
                          <td className="p-2 border-l border-slate-300">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.Priority === 'عاجل' || req.Priority === 'خاص جداً' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'
                            }`}>
                              {req.Priority}
                            </span>
                          </td>
                          <td className="p-2 text-slate-600 font-mono">{req.CreatedAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* MP Interviews & Directives */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-r-4 border-indigo-600 pr-2">
                <span>ثالثاً: سجل مقابلات النائب والتوجيهات الصادرة ({citizenInterviews.length})</span>
              </h3>

              {citizenInterviews.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-lg text-center text-xs text-slate-500 border border-slate-200">
                  لم تجرَ مقابلات برلمانية مباشرة مسجلة لهذا المواطن.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border border-slate-300">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-2 border-l border-slate-300">رقم المقابلة</th>
                        <th className="p-2 border-l border-slate-300">موضوع المقابلة</th>
                        <th className="p-2 border-l border-slate-300">توجيه وقرار النائب</th>
                        <th className="p-2 border-l border-slate-300">النتيجة</th>
                        <th className="p-2">تاريخ المقابلة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {citizenInterviews.map((intv) => (
                        <tr key={intv.Interview_ID} className="hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold text-slate-900 border-l border-slate-300">{intv.Interview_ID}</td>
                          <td className="p-2 text-slate-800 border-l border-slate-300">{intv.Subject}</td>
                          <td className="p-2 font-semibold text-amber-900 border-l border-slate-300">{intv.DeputyNotes || 'متابعة وإجراء اللازم'}</td>
                          <td className="p-2 text-slate-700 border-l border-slate-300">{intv.Status}</td>
                          <td className="p-2 text-slate-600 font-mono">{intv.InterviewDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Organizational Evaluation Notes */}
            {citizenOrg && (
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-xs flex items-start justify-between gap-4">
                <div>
                  <span className="font-bold text-amber-950 block mb-0.5">ملاحظات التقييم التنظيمي والجماهيري:</span>
                  <p className="text-amber-900">{citizenOrg.Notes}</p>
                </div>
                <div className="text-left shrink-0">
                  <span className="text-[11px] text-amber-800 block">الموقف التنظيمي:</span>
                  <span className="font-bold text-sm text-amber-950">{citizenOrg.OrgRating}</span>
                </div>
              </div>
            )}

            {/* Official Stamps & Signatures Footer */}
            <div className="pt-8 border-t-2 border-slate-800 grid grid-cols-3 gap-6 text-center text-xs">
              <div className="space-y-8">
                <div className="font-bold text-slate-900">موظف قسم الإدارة والأرشفة</div>
                <div className="text-slate-500 text-[11px]">التوقيع: ............................</div>
              </div>

              <div className="space-y-4">
                <div className="font-bold text-slate-900">ختم المكتب المعتمد</div>
                <div className="w-20 h-20 mx-auto rounded-full border-2 border-dashed border-slate-400 flex items-center justify-center text-[10px] text-slate-400">
                  الختم الرسمي
                </div>
              </div>

              <div className="space-y-8">
                <div className="font-bold text-slate-900">مدير مكتب النائب / النائب</div>
                <div className="text-slate-500 text-[11px]">التوقيع: ............................</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
