import React, { useRef } from 'react';
import { OrgTeamMember } from '../types';
import { X, Printer, UserCheck, ShieldCheck, MapPin, Phone, Calendar, Award } from 'lucide-react';

interface OrgTeamMemberCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: OrgTeamMember | null;
}

export const OrgTeamMemberCardModal: React.FC<OrgTeamMemberCardModalProps> = ({
  isOpen,
  onClose,
  member
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !member) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-6 text-right my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                الملف المستقل لعضو الفريق / المفتاح النهائي
              </h3>
              <p className="text-xs text-slate-500">
                قسم التنظيم والموقف الجماهيري - بطاقة الكادر الميداني المعتمد
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Card Area */}
        <div 
          ref={cardRef} 
          className="border-2 border-purple-500/30 rounded-2xl p-5 bg-gradient-to-br from-slate-50 via-white to-purple-50/40 relative overflow-hidden shadow-sm space-y-4"
        >
          {/* Watermark / Badge */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-3">
            <div>
              <span className="text-[10px] font-bold tracking-wider text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
                مجلس النواب العراقي | مكتب النائب المهندسة علا عودة الناشي
              </span>
              <h4 className="text-sm font-extrabold text-slate-900 mt-1">
                استمارة اعتماد مفتاح انتخابي / كادر تنظيمي
              </h4>
            </div>
            <div className="text-left font-mono">
              <div className="text-[11px] font-bold text-purple-700">{member.id}</div>
              <div className="text-[10px] text-slate-400">الرمز التنظيمي</div>
            </div>
          </div>

          {/* Member Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block mb-0.5">الاسم الرباعي واللقب:</span>
              <strong className="text-sm text-slate-900 font-bold block">{member.FullName}</strong>
              <span className="text-[10px] font-mono text-indigo-600 font-bold">الرقم التعريفي: {member.Citizen_ID}</span>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block mb-0.5">الدور التنظيمي المعتمد:</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Award className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-extrabold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  {member.Role}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block mb-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                <span>المنطقة / القضاء:</span>
              </span>
              <span className="font-bold text-slate-800">
                {member.District || 'ذي قار'} {member.SubDistrict ? ` - ${member.SubDistrict}` : ''}
              </span>
              {member.ElectionCenter && (
                <div className="text-[10px] text-slate-500 mt-1">
                  المركز الانتخابي: <strong>{member.ElectionCenter}</strong>
                </div>
              )}
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block mb-0.5 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>رقم الهاتف المباشر:</span>
              </span>
              <span className="font-mono text-xs font-bold text-slate-900" dir="ltr">
                {member.Phone || 'غير مدخل'}
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block mb-0.5 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>تاريخ الانضمام والاعتماد:</span>
              </span>
              <span className="font-mono text-xs font-bold text-slate-800">
                {member.JoinedDate}
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block mb-0.5">عدد مرات التردد على المكتب:</span>
              <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
                {member.OfficeVisitCount || '2 - 3 مرات'}
              </span>
            </div>
          </div>

          {member.Notes && (
            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 text-xs">
              <span className="text-[11px] font-bold text-purple-900 block mb-0.5">ملاحظات مسؤول التنظيم والموقف:</span>
              <p className="text-slate-700 leading-relaxed">{member.Notes}</p>
            </div>
          )}

          {/* Footer Seals */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-bold">
            <div>ختم مسؤول قسم التنظيم: ......................</div>
            <div>مصادقة مدير المكتب: ......................</div>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
          >
            إغلاق
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة بطاقة الملف المستقل</span>
          </button>
        </div>

      </div>
    </div>
  );
};
