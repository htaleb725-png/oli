import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Citizen } from '../types';
import * as XLSX from 'xlsx';
import {
  ShieldAlert,
  Search,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  FileSpreadsheet,
  Printer,
  Plus,
  Clock,
  Phone,
  MapPin,
  AlertTriangle,
  Eye,
  Check,
  X
} from 'lucide-react';

export const BlacklistModule: React.FC = () => {
  const {
    citizens,
    requests,
    blockCitizen,
    unblockCitizen,
    updateCitizen,
    deleteCitizen,
    currentUser,
    setSelectedCitizenForHistory
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTarget, setEditingTarget] = useState<Citizen | null>(null);
  const [editReasonInput, setEditReasonInput] = useState('');

  // Manual Add to Blacklist
  const [manualCitizenId, setManualCitizenId] = useState('');
  const [manualFullName, setManualFullName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualDistrict, setManualDistrict] = useState('');
  const [manualReason, setManualReason] = useState('');

  // Blocked citizens list
  const blockedCitizens = useMemo(() => {
    return citizens.filter(c => c.IsBlocked);
  }, [citizens]);

  // Filtered by search
  const filteredBlocked = useMemo(() => {
    if (!searchTerm.trim()) return blockedCitizens;
    const q = searchTerm.toLowerCase().trim();
    return blockedCitizens.filter(c =>
      (c.FullName && c.FullName.toLowerCase().includes(q)) ||
      (c.Citizen_ID && c.Citizen_ID.toLowerCase().includes(q)) ||
      (c.Phone1 && c.Phone1.includes(q)) ||
      (c.BlockReason && c.BlockReason.toLowerCase().includes(q)) ||
      (c.District && c.District.toLowerCase().includes(q))
    );
  }, [blockedCitizens, searchTerm]);

  // Handle Unblock
  const handleUnblock = (citizen: Citizen) => {
    if (window.confirm(`هل أنت متأكد من إلغاء حظر المواطن (${citizen.FullName}) وإعادته للقائمة المسموح بها؟`)) {
      unblockCitizen(citizen.Citizen_ID);
    }
  };

  // Handle Edit Reason
  const handleOpenEdit = (citizen: Citizen) => {
    setEditingTarget(citizen);
    setEditReasonInput(citizen.BlockReason || '');
  };

  const handleSaveEditReason = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarget) return;
    if (!editReasonInput.trim()) {
      alert('يرجى كتابة سبب الحظر.');
      return;
    }
    updateCitizen({
      ...editingTarget,
      BlockReason: editReasonInput.trim()
    });
    setEditingTarget(null);
  };

  // Handle Manual Add
  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualFullName.trim() || !manualReason.trim()) {
      alert('يرجى إدخال الاسم الكامل وسبب الحظر.');
      return;
    }

    // Check if citizen exists
    const existing = citizens.find(c => 
      c.FullName.trim().toLowerCase() === manualFullName.trim().toLowerCase() ||
      (manualPhone && c.Phone1 === manualPhone.trim())
    );

    if (existing) {
      blockCitizen(existing.Citizen_ID, manualReason.trim(), currentUser?.FullName || 'موظف الإدارة');
    } else {
      // Add and immediately block
      const newCit = {
        Citizen_ID: `ONA-${Date.now().toString().slice(-5)}`,
        FullName: manualFullName.trim(),
        Phone1: manualPhone.trim() || '07000000000',
        District: manualDistrict.trim() || 'بغداد',
        SubDistrict: 'المركز',
        Gender: 'ذكر' as const,
        Rating: 'غير لائق',
        CreatedAt: new Date().toLocaleDateString('ar-IQ'),
        CreatedBy: currentUser?.FullName || 'الإدارة',
        IsBlocked: true,
        BlockReason: manualReason.trim(),
        BlockedAt: new Date().toLocaleDateString('ar-IQ'),
        BlockedBy: currentUser?.FullName || 'موظف الإدارة'
      };
      updateCitizen(newCit as Citizen);
    }

    setShowAddModal(false);
    setManualFullName('');
    setManualPhone('');
    setManualDistrict('');
    setManualReason('');
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (blockedCitizens.length === 0) {
      alert('لا توجد سجلات محظورة للتصدير.');
      return;
    }

    const data = filteredBlocked.map((c, idx) => ({
      'ت': idx + 1,
      'رقم الهوية ID': c.Citizen_ID,
      'الاسم الكامل للمحظور': c.FullName,
      'العشيرة': c.Surname || '-',
      'رقم الهاتف': c.Phone1 || '-',
      'السكن': c.District || '-',
      'سبب الحظر': c.BlockReason || '-',
      'تاريخ الحظر': c.BlockedAt || c.CreatedAt || '-',
      'الموظف القائم بالحظر': c.BlockedBy || 'الإدارة'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!dir'] = 'rtl';
    ws['!cols'] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 30 },
      { wch: 18 },
      { wch: 16 },
      { wch: 20 },
      { wch: 40 },
      { wch: 18 },
      { wch: 22 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'القائمة السوداء');
    XLSX.writeFile(wb, `سجل_الأشخاص_المحظورين_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Header Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-red-950 via-rose-950 to-slate-900 text-white shadow-lg border border-red-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-red-500/20 text-red-300 border border-red-400/30">
                <ShieldAlert className="w-6 h-6" />
              </span>
              <div>
                <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <span>سجل القائمة السوداء والأشخاص المحظورين</span>
                  <span className="text-[10px] bg-red-500/30 text-red-200 px-2.5 py-0.5 rounded-full border border-red-400/30 font-bold">
                    منظومة التنبيه الرقابي
                  </span>
                </h2>
                <p className="text-xs text-red-200/80">
                  إدارة المراجعين المحظورين من تقديم الطلبات أو المتابعة الإدارية مع توثيق الأسباب والتنبيه التلقائي
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-red-600/30 px-3.5 py-1.5 rounded-xl border border-red-400/30 font-black">
              إجمالي المحظورين: {blockedCitizens.length} شخص
            </span>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-red-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ إدراج شخص بالقائمة السوداء</span>
            </button>
          </div>
        </div>
      </div>

      {/* Warning Alert Note */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-xs text-amber-950 dark:text-amber-100 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold">تنبيه أمني وإداري تلقائي مفعّل:</h4>
          <p className="text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
            عند محاولة أي موظف (في قسم الاستعلامات أو الإدارة) إدخال أو تسجيل طلب لأي شخص مسجل في هذه القائمة، تظهر له رسالة تحذيرية حمراء فورية توضح أن هذا الشخص محظور وتستعرض سبب الحظر وتاريخه لمنع تمرير المعاملة دون إذن مدير المكتب.
          </p>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم، رقم الهوية ID، الهاتف، أو سبب الحظر..."
            className="w-full h-9 pr-9 pl-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير إكسل (Excel)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>طباعة القائمة</span>
          </button>
        </div>
      </div>

      {/* Cards List of Blocked Citizens */}
      <div className="space-y-3">
        {filteredBlocked.length === 0 ? (
          <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2 shadow-xs">
            <UserCheck className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              {searchTerm ? 'لا توجد نتائج مطابقة للبحث في القائمة السوداء' : 'لا يوجد أشخاص محظورون حالياً في المنظومة'}
            </h4>
            <p className="text-xs text-slate-400">
              كافة المراجعين في وضع نظامي سليم، يمكنك حظر أي مراجع من قسم العمل اليومي أو مقاطعة البيانات.
            </p>
          </div>
        ) : (
          filteredBlocked.map((cit) => {
            const citReqs = requests.filter(r => r.Citizen_ID === cit.Citizen_ID);

            return (
              <div
                key={cit.Citizen_ID}
                className="p-4 rounded-2xl border-2 border-red-300 dark:border-red-900 bg-red-50/30 dark:bg-red-950/20 shadow-xs space-y-3 hover:shadow-md transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-red-200 dark:border-red-900/60">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-xs text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950 px-2.5 py-0.5 rounded-md border border-red-300 dark:border-red-800">
                      {cit.Citizen_ID}
                    </span>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      {cit.FullName}
                      {cit.Surname && (
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">({cit.Surname})</span>
                      )}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shadow-2xs">
                      🚫 محظور
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                    {cit.BlockedAt && (
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-red-500" />
                        <span>تاريخ الحظر: {cit.BlockedAt}</span>
                      </span>
                    )}
                    {cit.BlockedBy && (
                      <span className="text-[10px] bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 px-2 py-0.5 rounded font-bold">
                        بواسطة: {cit.BlockedBy}
                      </span>
                    )}
                  </div>
                </div>

                {/* Block Reason Card */}
                <div className="p-3 rounded-xl bg-red-100/80 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-xs">
                  <span className="font-black text-red-900 dark:text-red-200 block mb-1">
                    ⚠️ سبب الحظر الإداري / الأمني:
                  </span>
                  <p className="text-red-950 dark:text-red-100 font-semibold leading-relaxed">
                    {cit.BlockReason || 'لم يتم تحديد سبب محدد'}
                  </p>
                </div>

                {/* Additional Details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-red-100 dark:border-red-950">
                  <div>
                    <span className="text-slate-400 block text-[10px]">الهاتف:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                      {cit.Phone1 || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">السكن:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {cit.District} {cit.SubDistrict ? `(${cit.SubDistrict})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">المهنة / التحصيل:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {cit.Job || 'كاسب'} - {cit.Education || 'إعدادية'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">عدد المعاملات السابقة:</span>
                    <span className="font-bold text-blue-700 dark:text-blue-400">
                      {citReqs.length} معاملة
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-red-100 dark:border-red-900/40 flex items-center justify-end gap-2 flex-wrap">
                  {/* Edit Reason Button */}
                  <button
                    onClick={() => handleOpenEdit(cit)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5 text-blue-600" />
                    <span>تعديل سبب الحظر</span>
                  </button>

                  {/* Unblock Button */}
                  <button
                    onClick={() => handleUnblock(cit)}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-transform active:scale-95"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>إلغاء الحظر وإعادته للمسموح بهم ✓</span>
                  </button>

                  {/* Full Archive */}
                  <button
                    onClick={() => setSelectedCitizenForHistory(cit)}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                    title="السجل والأرشيف"
                  >
                    <Eye className="w-4 h-4 text-slate-500" />
                  </button>

                  {/* Delete from system */}
                  <button
                    onClick={() => {
                      if (window.confirm(`هل أنت متأكد من حذف سجل المواطن (${cit.FullName}) نهائياً من قاعدة البيانات؟`)) {
                        deleteCitizen(cit.Citizen_ID);
                      }
                    }}
                    className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                    title="حذف نهائي"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Edit Block Reason */}
      {editingTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4 text-right animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" />
                <span>تعديل سبب الحظر</span>
              </h3>
              <button onClick={() => setEditingTarget(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSaveEditReason} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  المواطن: {editingTarget.FullName} ({editingTarget.Citizen_ID})
                </label>
                <textarea
                  rows={3}
                  required
                  value={editReasonInput}
                  onChange={(e) => setEditReasonInput(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs"
                >
                  حفظ التعديل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manual Add to Blacklist */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-red-300 dark:border-red-800 max-w-lg w-full p-6 shadow-2xl space-y-4 text-right animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-red-100 dark:bg-red-950 text-red-600">
                  <ShieldAlert className="w-5 h-5" />
                </span>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  إدراج شخص بالقائمة السوداء
                </h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleManualAdd} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الاسم الكامل (ثلاثي أو رباعي): <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualFullName}
                  onChange={(e) => setManualFullName(e.target.value)}
                  placeholder="مثال: علي حسن كاظم التميمي..."
                  className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف:</label>
                  <input
                    type="text"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="07XXXXXXXXX"
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">السكن / المحافظة:</label>
                  <input
                    type="text"
                    value={manualDistrict}
                    onChange={(e) => setManualDistrict(e.target.value)}
                    placeholder="البصرة - الزبير..."
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  سبب الحظر: <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="اكتب سبب الحظر الإداري أو الأمني بالتفصيل..."
                  className="w-full p-3 bg-red-50/50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black"
                >
                  تأكيد الإدراج بالقائمة السوداء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
