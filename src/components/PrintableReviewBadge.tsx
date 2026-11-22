import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../context/AppContext';
import { Printer, X, Award, CheckCircle } from 'lucide-react';
import { printElementIsolated } from '../utils/printReceiptHelper';

export const PrintableReviewBadge: React.FC = () => {
  const { printableBadgeCitizen, setPrintableBadgeCitizen, systemSettings, addAuditLog, currentUser } = useApp();
  const printRef = useRef<HTMLDivElement>(null);

  if (!printableBadgeCitizen) return null;

  const handlePrint = () => {
    addAuditLog(
      'طباعة وصل مراجعة مواطن',
      'الاستعلامات',
      `طباعة وصل مراجعة وباج للمواطن ${printableBadgeCitizen.FullName} (${printableBadgeCitizen.Citizen_ID})`
    );
    if (printRef.current) {
      printElementIsolated(printRef.current, {
        title: `وصل مراجعة - ${printableBadgeCitizen.FullName}`,
        compact: true
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
      <div className="relative w-full max-w-md bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Controls header */}
        <div className="no-print bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h4 className="font-bold text-sm">معاينة وصل مراجعة المواطن</h4>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة فورية</span>
            </button>
            <button
              onClick={() => setPrintableBadgeCitizen(null)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Official Parliamentary Receipt Card (Printed 1:1 via printElementIsolated) */}
        <div ref={printRef} className="print-container p-4 bg-white text-slate-900 font-['Cairo',sans-serif]">
          <div className="border-2 border-slate-900 rounded-xl p-1.5">
            <div className="border border-amber-700 rounded-lg p-5 space-y-4 text-center">
              <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between gap-2">
                <div className="text-right space-y-0.5">
                  <div className="text-xs font-black text-slate-950">جمهورية العراق</div>
                  <div className="text-[11px] font-bold text-slate-700">مجلس النواب العراقي</div>
                  <div className="text-xs font-extrabold text-amber-800">{systemSettings.appName}</div>
                </div>
                <div className="w-12 h-12 flex items-center justify-center shrink-0">
                  <img
                    src={systemSettings.parliamentEmblemUrl}
                    alt="شعار جمهورية العراق"
                    className="max-h-12 max-w-12 object-contain"
                    crossOrigin="anonymous"
                  />
                </div>
              </div>

              <div className="py-2.5 px-3 bg-slate-900 text-white rounded-xl border border-amber-500/60">
                <span className="text-[10px] text-amber-300 font-bold block">
                  وصل مراجعة ورقم تعريفي رسمي معتمد
                </span>
                <div className="text-xl font-black text-white tracking-wider font-mono tabular-nums mt-0.5">
                  {printableBadgeCitizen.Citizen_ID}
                </div>
              </div>

              <div className="flex justify-center py-1">
                <div className="p-2.5 bg-white border-2 border-slate-900 rounded-xl">
                  <QRCodeSVG
                    value={`CITIZEN_ID:${printableBadgeCitizen.Citizen_ID}|NAME:${printableBadgeCitizen.FullName}|PHONE:${printableBadgeCitizen.Phone1}`}
                    size={112}
                  />
                </div>
              </div>

              <div className="space-y-2 text-right text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-300">
                <div className="flex justify-between gap-2 border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500 font-bold">اسم المراجع:</span>
                  <strong className="text-slate-950 font-black">{printableBadgeCitizen.FullName}</strong>
                </div>
                <div className="flex justify-between gap-2 border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500 font-bold">رقم الهاتف:</span>
                  <span className="text-slate-950 font-mono tabular-nums font-bold" dir="ltr">
                    {printableBadgeCitizen.Phone1 || 'غير مسجل'}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500 font-bold">عنوان السكن:</span>
                  <span className="text-slate-900 font-bold">
                    {[printableBadgeCitizen.District, printableBadgeCitizen.ResidentialArea || printableBadgeCitizen.SubDistrict].filter(Boolean).join(' - ')}
                  </span>
                </div>
                <div className="flex justify-between gap-2 pt-0.5">
                  <span className="text-slate-500 font-bold">تاريخ التسجيل:</span>
                  <span className="text-slate-800 font-mono tabular-nums font-bold">
                    {printableBadgeCitizen.CreatedAt?.split('T')[0] || new Date().toISOString().split('T')[0]}
                  </span>
                </div>
              </div>

              <div className="text-[10.5px] text-amber-950 bg-amber-50 border border-amber-300 rounded-lg p-2 font-bold leading-relaxed">
                يرجى إبراز هذا الوصل عند المراجعة القادمة لسرعة متابعة المعاملة وإنجازها.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
