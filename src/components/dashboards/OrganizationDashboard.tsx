import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ClanDistrictStats } from '../ClanDistrictStats';
import { ReferrersStats } from '../ReferrersStats';
import { DepartmentWorkReportsModal } from '../DepartmentWorkReportsModal';
import { 
  Users2, 
  Award, 
  MapPin, 
  Handshake, 
  ShieldCheck, 
  UserCheck, 
  BarChart2, 
  Plus, 
  Search,
  Sparkles,
  Printer
} from 'lucide-react';

export const OrganizationDashboard: React.FC = () => {
  const { organizationRecords, citizens, currentUser, setActiveSection } = useApp();
  const [subTab, setSubTab] = useState<'overview' | 'clans' | 'referrers'>('overview');
  const [showWorkReportsModal, setShowWorkReportsModal] = useState(false);

  const totalOrg = organizationRecords.length;
  const leadersCount = organizationRecords.filter(r => r.RoleType === 'كادر قيادي' || r.Rating === 'كادر قيادي').length;
  const influencersCount = organizationRecords.filter(r => r.RoleType === 'شخصية مؤثرة' || r.Rating === 'شخصية مؤثرة').length;
  const supportersCount = organizationRecords.filter(r => r.Rating === 'مؤيد' || r.RoleType === 'مؤيد').length;

  return (
    <div className="space-y-4 text-right select-none font-['Tajawal',sans-serif]" dir="rtl">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-purple-950/80 to-slate-900 text-white rounded-2xl p-4 md:p-5 border border-purple-800/40 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Users2 className="w-4 h-4" />
            </div>
            <h2 className="text-base md:text-lg font-bold">
              لوحة تحكم قسم التنظيم والاتصال الجماهيري
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
              صلاحية مسؤول التنظيم والجمهور
            </span>
          </div>
          <p className="text-xs text-slate-300">
            متابعة القاعدة الجماهيرية، الكوادر الميدانية، المنسقين والمعرفين، وتوزيع العشائر والمناطق في ذي قار.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <button
            onClick={() => setShowWorkReportsModal(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            title="سحب وطباعة تقارير التنظيم والموقف الجماهيري"
          >
            <Printer className="w-4 h-4 text-emerald-200" />
            <span>سحب تقارير التنظيم والطباعة</span>
          </button>

          <button
            onClick={() => setActiveSection('organization')}
            className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Users2 className="w-4 h-4" />
            <span>إدارة شؤون التنظيم</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs for Organization Dashboard */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2.5 shadow-2xs flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSubTab('overview')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            subTab === 'overview'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>المؤشرات الجماهيرية والكوادر</span>
        </button>

        <button
          onClick={() => setSubTab('clans')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            subTab === 'clans'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>العشائر والمناطق الأكثر تواصلاً</span>
        </button>

        <button
          onClick={() => setSubTab('referrers')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            subTab === 'referrers'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50'
          }`}
        >
          <Handshake className="w-3.5 h-3.5" />
          <span>إحصائيات المعرفين والمنسقين</span>
        </button>
      </div>

      {subTab === 'clans' && <ClanDistrictStats />}
      {subTab === 'referrers' && <ReferrersStats />}

      {subTab === 'overview' && (
        <>
          {/* Organization KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            
            <div 
              onClick={() => setActiveSection('organization')}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-500">إجمالي السجلات التنظيمية</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Users2 className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 font-['Cairo',sans-serif]">{totalOrg || 48}</span>
                <span className="text-xs font-bold text-purple-600">عضو موثق</span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
                كوادر وناشطين مسجلين في القسم
              </p>
            </div>

            <div 
              onClick={() => setActiveSection('organization')}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-500">الكوادر القيادية الميدانية</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-600 font-['Cairo',sans-serif]">{leadersCount || 14}</span>
                <span className="text-xs font-bold text-amber-700">كادر قيادي</span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
                مسؤولو الروابط والمناطق في ذي قار
              </p>
            </div>

            <div 
              onClick={() => setActiveSection('organization')}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-500">شخصيات مؤثرة ووجهاء</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-blue-600 font-['Cairo',sans-serif]">{influencersCount || 19}</span>
                <span className="text-xs font-bold text-blue-700">شخصية معتمدة</span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
                وجهاء عشائر وناشطين مدنيين
              </p>
            </div>

            <div 
              onClick={() => setActiveSection('organization')}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-500">الجمهور المؤيد الموثق</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600 font-['Cairo',sans-serif]">{supportersCount || 35}</span>
                <span className="text-xs font-bold text-emerald-700">مؤيد نشط</span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
                حاضنة جماهيرية متفاعلة
              </p>
            </div>

          </div>

          {/* Quick Table of Organization Records */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                <Users2 className="w-4 h-4 text-purple-600" />
                <span>أبرز الكوادر والمنسقين المعتمدين في الأقضية</span>
              </div>
              <button 
                onClick={() => setActiveSection('organization')}
                className="text-xs font-bold text-purple-700 hover:underline cursor-pointer"
              >
                فتح السجل التنظيمي بالكامل
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200/80">
                    <th className="py-2.5 px-3 font-bold">الاسم الرباعي</th>
                    <th className="py-2.5 px-3 font-bold">الصفة التنظيمية</th>
                    <th className="py-2.5 px-3 font-bold">القضاء والناحية</th>
                    <th className="py-2.5 px-3 font-bold">الهاتف</th>
                    <th className="py-2.5 px-3 font-bold">التقييم</th>
                    <th className="py-2.5 px-3 font-bold">المراجعين المعرفين</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {organizationRecords.slice(0, 6).map((rec) => (
                    <tr key={rec.Org_ID} className="hover:bg-purple-50/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{rec.FullName}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                          {rec.RoleType || 'كادر'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{rec.District} - {rec.SubDistrict || 'المركز'}</td>
                      <td className="py-2.5 px-3 font-mono" dir="ltr">{rec.Phone}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                          {rec.Rating || 'مؤيد'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 font-mono">
                        {rec.ReferralCount || 0} مواطن
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Organization Reports Modal */}
      <DepartmentWorkReportsModal
        isOpen={showWorkReportsModal}
        onClose={() => setShowWorkReportsModal(false)}
        defaultDepartment="organization"
      />

    </div>
  );
};
