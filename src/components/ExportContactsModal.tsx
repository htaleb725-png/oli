import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import * as XLSX from 'xlsx';
import { 
  PhoneCall, 
  Copy, 
  Download, 
  Printer, 
  X, 
  Search, 
  Check, 
  Users, 
  Filter 
} from 'lucide-react';

interface ExportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSection?: string;
}

export const ExportContactsModal: React.FC<ExportContactsModalProps> = ({
  isOpen,
  onClose,
  defaultSection = 'all',
}) => {
  const { citizens, requests, addAuditLog } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [copiedType, setCopiedType] = useState<'numbers' | 'full' | null>(null);

  // Helper to format any Iraqi phone number to standard international: +964XXXXXXXXXX
  const formatToInternational = (rawPhone: string): string => {
    if (!rawPhone) return '';
    // Remove non-digit characters
    let cleaned = rawPhone.replace(/\D/g, '');
    
    // If starts with 00964 -> replace with +964
    if (cleaned.startsWith('00964')) {
      return '+' + cleaned.substring(2);
    }
    // If starts with 964 -> add +
    if (cleaned.startsWith('964')) {
      return '+' + cleaned;
    }
    // If starts with 07 -> remove 0 and add +964
    if (cleaned.startsWith('07')) {
      return '+964' + cleaned.substring(1);
    }
    // If starts with 7 -> add +964
    if (cleaned.startsWith('7')) {
      return '+964' + cleaned;
    }
    // Otherwise fallback
    return cleaned ? `+964${cleaned}` : '';
  };

  // Build contact items from citizens
  const contacts = citizens.map(c => {
    const citRequests = requests.filter(r => r.Citizen_ID === c.Citizen_ID);
    return {
      id: c.Citizen_ID,
      name: c.FullName,
      rawPhone: c.Phone1,
      formattedPhone: formatToInternational(c.Phone1),
      phone2: c.Phone2 ? formatToInternational(c.Phone2) : '',
      district: c.District || 'الناصرية',
      job: c.Job || 'كاسب',
      requestsCount: citRequests.length,
      createdAt: c.CreatedAt
    };
  });

  // Filtered contacts
  const filteredContacts = contacts.filter(c => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || (
      c.name.toLowerCase().includes(q) ||
      c.formattedPhone.includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.district.toLowerCase().includes(q)
    );

    const matchesDistrict = districtFilter === 'all' || c.district === districtFilter;
    return matchesSearch && matchesDistrict;
  });

  // Unique districts
  const districts = Array.from(new Set(citizens.map(c => c.District).filter(Boolean)));

  // Copy all formatted numbers to clipboard
  const handleCopyNumbersOnly = () => {
    const numbersList = filteredContacts
      .map(c => c.formattedPhone)
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(numbersList);
    setCopiedType('numbers');
    addAuditLog('سحب أرقام الهواتف', 'سحب وتصدير الأرقام', `نسخ ${filteredContacts.length} رقم هاتف دولي`);
    setTimeout(() => setCopiedType(null), 2500);
  };

  // Copy names & numbers
  const handleCopyNameAndNumbers = () => {
    const fullList = filteredContacts
      .map(c => `${c.name} - ${c.formattedPhone}`)
      .join('\n');

    navigator.clipboard.writeText(fullList);
    setCopiedType('full');
    addAuditLog('سحب الأسماء والأرقام', 'سحب وتصدير الأرقام', `نسخ ${filteredContacts.length} جهة اتصال`);
    setTimeout(() => setCopiedType(null), 2500);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const rows = filteredContacts.map(c => ({
      'الرقم التعريفي': c.id,
      'اسم المواطن': c.name,
      'رقم الهاتف الدولي': c.formattedPhone,
      'الهاتف الثاني': c.phone2,
      'القضاء / السكن': c.district,
      'المهنة': c.job,
      'عدد الطلبات': c.requestsCount,
      'تاريخ التسجيل': c.createdAt
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'أرقام المواطنين');
    XLSX.writeFile(wb, `سجل_ارقام_المواطنين_الدولية_${new Date().toISOString().slice(0, 10)}.xlsx`);

    addAuditLog('تصدير إكسل للأرقام', 'سحب وتصدير الأرقام', `تصدير ملف إكسل لـ ${rows.length} رقم مواطن`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto text-right font-['Tajawal',sans-serif]">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs">
              <PhoneCall className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                سحب وتصدير أرقام وأسماء المواطنين
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-100 font-mono" dir="ltr">
                  +964XXXXXXXXXX
                </span>
              </h3>
              <p className="text-xs text-emerald-100">
                سحب فوري لأرقام المواطنين بالتنسيق الدولي الموحد المناسب للواتساب والرسائل الجماعية
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

        {/* Toolbar & Filters */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم، الرقم الدولي، أو القضاء..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            {/* District Filter */}
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">كافة الأقضية ({districts.length})</option>
              {districts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handleCopyNumbersOnly}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              {copiedType === 'numbers' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedType === 'numbers' ? 'تم نسخ الأرقام!' : 'نسخ الأرقام فقط'}</span>
            </button>

            <button
              onClick={handleCopyNameAndNumbers}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              {copiedType === 'full' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedType === 'full' ? 'تم نسخ القائمة!' : 'نسخ الأسماء مع الأرقام'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير Excel</span>
            </button>
          </div>
        </div>

        {/* Example Callout */}
        <div className="px-4 py-2 bg-emerald-50/70 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300">
          <span>نمط التنسيق الدولي المطبق: <strong className="font-mono" dir="ltr">+9647819935806</strong></span>
          <span>إجمالي جهات الاتصال المستخرجة: <strong>{filteredContacts.length} مواطن</strong></span>
        </div>

        {/* Table View */}
        <div className="overflow-y-auto flex-1 p-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-3">ت</th>
                  <th className="p-3">اسم المواطن</th>
                  <th className="p-3 text-center">رقم الهاتف الدولي (+964)</th>
                  <th className="p-3 text-center">القضاء / السكن</th>
                  <th className="p-3 text-center">المهنة</th>
                  <th className="p-3 text-center">الطلبات</th>
                  <th className="p-3 text-center">نسخ سريع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {filteredContacts.length > 0 ? (
                  filteredContacts.map((contact, idx) => (
                    <tr key={contact.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-bold">{contact.name}</td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400" dir="ltr">
                        {contact.formattedPhone || <span className="text-slate-400 font-normal">غير متوفر</span>}
                      </td>
                      <td className="p-3 text-center">{contact.district}</td>
                      <td className="p-3 text-center">{contact.job}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-bold text-[10px]">
                          {contact.requestsCount}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {contact.formattedPhone && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(contact.formattedPhone);
                              alert(`تم نسخ الرقم: ${contact.formattedPhone}`);
                            }}
                            className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 transition-colors cursor-pointer"
                            title="نسخ الرقم"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                      لا توجد أرقام مطابقة لمعايير البحث الحالية
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            جاهز للاستخدام في منصات الواتساب وحملات الرسائل النصية المباشرة
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
