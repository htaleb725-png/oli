import React, { useState } from 'react';
import { OrgTeamMember } from '../types';
import { 
  Users, 
  Search, 
  Plus, 
  ShieldCheck, 
  MapPin, 
  Phone, 
  Printer, 
  FileSpreadsheet, 
  Award, 
  Eye, 
  Trash2,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface OrgTeamMembersManagerProps {
  teamMembers: OrgTeamMember[];
  onOpenCard: (member: OrgTeamMember) => void;
  onDeleteMember: (id: string) => void;
  onAddMemberManually: () => void;
}

export const OrgTeamMembersManager: React.FC<OrgTeamMembersManagerProps> = ({
  teamMembers,
  onOpenCard,
  onDeleteMember,
  onAddMemberManually
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const filteredMembers = teamMembers.filter(m => {
    const matchesRole = roleFilter === 'all' || m.Role === roleFilter;
    const matchesSearch = 
      m.FullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.Citizen_ID.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.Phone && m.Phone.includes(searchQuery)) ||
      (m.District && m.District.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.Notes && m.Notes.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesRole && matchesSearch;
  });

  const exportExcel = () => {
    const rows = filteredMembers.map((m, idx) => ({
      'ت': idx + 1,
      'الرمز التنظيمي': m.id,
      'الرقم التعريفي للمواطن': m.Citizen_ID,
      'اسم عضو الفريق / المفتاح': m.FullName,
      'رقم الهاتف': m.Phone || '',
      'القضاء / المنطقة': m.District || '',
      'الناحية / الحي': m.SubDistrict || '',
      'المركز الانتخابي': m.ElectionCenter || '',
      'الدور التنظيمي': m.Role,
      'مرات التردد على المكتب': m.OfficeVisitCount || '',
      'تاريخ الاعتماد': m.JoinedDate,
      'الحالة': m.Status,
      'الملاحظات': m.Notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'فريق العمل والمفاتيح');
    XLSX.writeFile(wb, `سجل_فريق_العمل_والمفاتيح_الانتخابية_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-4 text-right">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            <h3 className="text-base font-bold text-slate-900">
              ملفات فريق العمل والمفاتيح الانتخابية المستقلة ({filteredMembers.length})
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            ملفات تنظيمية مستقلة للمواطنين الذين وافقوا على الانضمام للفريق بعد حل ومتابعة طلباتهم.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير إكسل</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة القائمة</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم العضو، الهاتف، القضاء، أو الدور التنظيمي..."
            className="w-full pr-9 pl-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
          />
        </div>

        <div className="sm:w-64">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
          >
            <option value="all">-- تصفية بحسب الدور (الكل) --</option>
            <option value="مفتاح نهائي">مفتاح نهائي</option>
            <option value="منسق منطقة / حي">منسق منطقة / حي</option>
            <option value="عضو فريق مبادرات شبابية">عضو فريق مبادرات شبابية</option>
            <option value="كادر تنظيمي عام">كادر تنظيمي عام</option>
          </select>
        </div>
      </div>

      {/* Grid of Independent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredMembers.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
            لا يوجد أعضاء فريق مطابقين لمعايير البحث
          </div>
        ) : (
          filteredMembers.map((member) => (
            <div
              key={member.id}
              className="bg-white rounded-xl border border-purple-200/80 shadow-xs hover:shadow-md transition-all p-4 space-y-3 relative group overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                    {member.FullName}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[11px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                      {member.Citizen_ID}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{member.id}</span>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                  <Award className="w-3 h-3 text-purple-600" />
                  <span>{member.Role}</span>
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{member.District || 'ذي قار'} {member.SubDistrict ? ` - ${member.SubDistrict}` : ''}</span>
                </div>

                {member.Phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono" dir="ltr">{member.Phone}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>تاريخ الاعتماد: {member.JoinedDate}</span>
                  </span>
                  <span className="text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded text-[10px]">
                    التردد: {member.OfficeVisitCount || '2 - 3 مرات'}
                  </span>
                </div>
              </div>

              {member.Notes && (
                <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg line-clamp-2">
                  {member.Notes}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onOpenCard(member)}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>فتح الملف المستقل والطباعة</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`هل أنت متأكد من حذف عضوية ${member.FullName} من الفريق؟`)) {
                      onDeleteMember(member.id);
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="حذف العضوية"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
};
