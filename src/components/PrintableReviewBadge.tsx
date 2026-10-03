import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../context/AppContext';
import { Printer, X, Award, CheckCircle } from 'lucide-react';

export const PrintableReviewBadge: React.FC = () => {
  const { printableBadgeCitizen, setPrintableBadgeCitizen, systemSettings, addAuditLog, currentUser } = useApp();

  if (!printableBadgeCitizen) return null;

  const handlePrint = () => {
    addAuditLog(
      'طباعة وصل مراجعة مواطن',
      'الاستعلامات',
      `طباعة وصل مراجعة وباج للمواطن ${printableBadgeCitizen.FullName} (${printableBadgeCitizen.Citizen_ID})`
    );
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Controls header */}
        <div className="no-print bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h4 className="font-bold text-sm">معاينة باج / وصل مراجعة المواطن</h4>
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

        {/* Badge Card Layout */}
        <div className="print-container p-6 space-y-4 text-center font-['Cairo',sans-serif]">
          <div className="border-b-2 border-slate-800 pb-3 flex items-center justify-between">
            <div className="text-right">
              <div className="text-[11px] font-bold text-slate-900">جمهورية العراق</div>
              <div className="text-[10px] text-slate-600">مجلس النواب العراقي</div>
              <div className="text-xs font-extrabold text-amber-800">{systemSettings.appName}</div>
            </div>
            <div className="w-10 h-10 flex items-center justify-center">
              <img 
                src={systemSettings.parliamentEmblemUrl} 
                alt="شعار العراق" 
                className="max-h-10 object-contain"
                crossOrigin="anonymous"
              />
            </div>
          </div>

          <div className="py-2 bg-slate-100 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
              بطاقة مراجعة ورقم تعريفي ثابت
            </span>
            <div className="text-xl font-black text-slate-950 tracking-wider font-mono mt-0.5">
              {printableBadgeCitizen.Citizen_ID}
            </div>
          </div>

          <div className="flex justify-center py-2">
            <div className="p-2 bg-white border-2 border-slate-900 rounded-xl shadow-xs">
              <QRCodeSVG 
                value={`CITIZEN_ID:${printableBadgeCitizen.Citizen_ID}|NAME:${printableBadgeCitizen.FullName}|PHONE:${printableBadgeCitizen.Phone1}`} 
                size={110} 
              />
            </div>
          </div>

          <div className="space-y-1.5 text-right text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500">اسم المراجع:</span>
              <strong className="text-slate-950">{printableBadgeCitizen.FullName}</strong>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500">الهاتف:</span>
              <span className="text-slate-950 font-mono font-semibold" dir="ltr">{printableBadgeCitizen.Phone1}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500">السكن:</span>
              <span className="text-slate-900">{printableBadgeCitizen.District} - {printableBadgeCitizen.SubDistrict}</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="text-slate-500">تاريخ التسجيل:</span>
              <span className="text-slate-700 font-mono">{printableBadgeCitizen.CreatedAt}</span>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 leading-tight pt-1">
            يرجى إبراز هذا الوصل أو الرمز التعريفي عند المراجعة القادمة لتسهيل وسرعة استرجاع أوليات المعاملة.
          </div>
        </div>
      </div>
    </div>
  );
};
