import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Citizen } from '../types';
import {
  ShieldAlert,
  Search,
  UserX,
  UserCheck,
  Plus,
  X,
  AlertTriangle,
  Calendar,
  Phone,
  MapPin,
  FileWarning,
  Users,
  CheckCircle2,
  Info,
  Trash2
} from 'lucide-react';

export const BlacklistModule: React.FC = () => {
  const {
    citizens,
    requests,
    blockCitizen,
    unblockCitizen,
    currentUser,
    setSelectedCitizenForHistory
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Add to Blacklist modal state
  const [addMode, setAddMode] = useState<'existing' | 'manual'>('existing');
  const [citizenSearch, setCitizenSearch] = useState('');
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualDistrict, setManualDistrict] = useState('الناصرية - المركز');
  const [blockReason, setBlockReason] = useState('');

  // Inline confirmation & notification banner (NO window.alert / window.confirm)
  const [pendingUnblockId, setPendingUnblockId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 5000);
  };

  // All currently blocked citizens
  const blockedCitizens = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return citizens
      .filter((c) => c && c.IsBlocked)
      .filter((c) => {
        if (!q) return true;
        return (
          (c.FullName && c.FullName.toLowerCase().includes(q)) ||
          (c.Citizen_ID && c.Citizen_ID.toLowerCase().includes(q)) ||
          (c.Phone1 && c.Phone1.includes(q)) ||
          (c.BlockReason && c.BlockReason.toLowerCase().includes(q)) ||
          (c.District && c.District.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (b.BlockedAt || '').localeCompare(a.BlockedAt || ''));
  }, [citizens, searchQuery]);

  // Existing non-blocked citizens for search dropdown
  const searchableCitizens = useMemo(() => {
    const q = citizenSearch.toLowerCase().trim();
    if (!q) return [];
    return citizens
      .filter((c) => c && !c.IsBlocked)
      .filter(
        (c) =>
          (c.FullName && c.FullName.toLowerCase().includes(q)) ||
          (c.Citizen_ID && c.Citizen_ID.toLowerCase().includes(q)) ||
          (c.Phone1 && c.Phone1.includes(q))
      )
      .slice(0, 12);
  }, [citizens, citizenSearch]);

  const handleBlockExisting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCitizen) {
      showNotice('error', 'يرجى اختيار مواطن من القائمة أولاً.');
      return;
    }
    if (!blockReason.trim()) {
      showNotice('error', 'يرجى كتابة سبب الحظر والإدراج في القائمة السوداء.');
      return;
    }
    blockCitizen(selectedCitizen.Citizen_ID, blockReason.trim(), currentUser?.FullName || 'مدير النظام');
    showNotice('success', `تم إدراج المواطن «${selectedCitizen.FullName}» في القائمة السوداء وتعميم الحظر على كامل المنظومة.`);
    setShowAddModal(false);
    setSelectedCitizen(null);
    setCitizenSearch('');
    setBlockReason('');
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = manualName.trim();
    if (!cleanName) {
      showNotice('error', 'يرجى كتابة الاسم الكامل للشخص المراد حظره.');
      return;
    }
    if (!blockReason.trim()) {
      showNotice('error', 'يرجى كتابة سبب الحظر.');
      return;
    }

    // Check if citizen already exists by exact normalized name or phone
    const normInput = cleanName.toLowerCase().replace(/[إأآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ');
    const cleanPhone = manualPhone.trim();
    const existing = citizens.find((c) => {
      if (!c) return false;
      const normCit = (c.FullName || '').trim().toLowerCase().replace(/[إأآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ');
      return normCit === normInput || (cleanPhone.length >= 8 && c.Phone1 && c.Phone1.replace(/\s+/g, '') === cleanPhone.replace(/\s+/g, ''));
    });

    const targetId = existing?.Citizen_ID || `BLK-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    blockCitizen(
      targetId,
      blockReason.trim(),
      currentUser?.FullName || 'مدير النظام',
      {
        FullName: cleanName,
        Phone1: cleanPhone,
        District: manualDistrict.trim() || 'الناصرية - المركز'
      }
    );

    showNotice('success', `تم حظر «${cleanName}» وإضافته إلى القائمة السوداء بنجاح، وسيتم منعه تلقائياً في الاستعلامات والإدارة وكافة الأقسام.`);
    setShowAddModal(false);
    setManualName('');
    setManualPhone('');
    setManualDistrict('الناصرية - المركز');
    setBlockReason('');
  };

  const handleConfirmUnblock = (cit: Citizen) => {
    if (pendingUnblockId !== cit.Citizen_ID) {
      setPendingUnblockId(cit.Citizen_ID);
      return;
    }
    unblockCitizen(cit.Citizen_ID);
    setPendingUnblockId(null);
    showNotice('success', `تم إلغاء الحظر عن المواطن «${cit.FullName}» بنجاح وإعادته إلى القائمة المسموح بها.`);
  };

  const getCitizenRequestsCount = (citizenId: string) => {
    return requests.filter((r) => r.Citizen_ID === citizenId).length;
  };

  const canManageBlacklist =
    currentUser?.Role === 'developer' ||
    currentUser?.Role === 'director' ||
    currentUser?.Role === 'deputy' ||
    currentUser?.Role === 'admin' ||
    currentUser?.Role === 'admin_officer' ||
    currentUser?.Role === 'audit';

  return (
    <div className="space-y-4 text-right font-['Tajawal',sans-serif]" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-red-950 via-red-900 to-rose-900 rounded-2xl p-5 text-white shadow-lg border border-red-800/60 relative overflow-hidden">
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-400/40 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldAlert className="w-6 h-6 text-red-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-white">سجل القائمة السوداء والأشخاص المحظورين</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-500/30 text-red-100 border border-red-400/40">
                  {blockedCitizens.length} محظور حالياً
                </span>
              </div>
              <p className="text-xs text-red-100/80 mt-1 max-w-2xl leading-relaxed">
                يُمنع تلقائياً وفورياً تسجيل أي مراجعة أو معاملة جديدة لأي شخص مدرج في هذه القائمة، وتظهر رسالة تحذير حمراء فورية في الاستعلامات والإدارة ومقاطعة البيانات على جميع الأجهزة.
              </p>
            </div>
          </div>

          {canManageBlacklist && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-red-50 text-red-800 font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة شخص للقائمة السوداء</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Status Banner */}
      {banner && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border shadow-xs animate-in fade-in ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
          <button type="button" onClick={() => setBanner(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Bar & Info Strip */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، الرقم المرجعي، رقم الهاتف، أو سبب الحظر..."
            className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:bg-white focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <Info className="w-4 h-4 text-red-500 shrink-0" />
          <span>تنبيه الحظر فعّال تلقائياً في الاستعلامات، الإدارة، ومقاطعة البيانات.</span>
        </div>
      </div>

      {/* Blacklist Table / Cards */}
      {blockedCitizens.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-base font-black text-slate-800 dark:text-white">
            {searchQuery ? 'لا توجد نتائج مطابقة لبحثك في القائمة السوداء' : 'القائمة السوداء فارغة حالياً'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {searchQuery
              ? 'جرب تعديل كلمات البحث أو مسح الفلتر لعرض كافة المحظورين.'
              : 'لم يتم إدراج أي مواطن في قائمة الحظر حتى الآن. يمكنك إضافة أي شخص عبر الزر أعلاه أو عبر مقاطعة البيانات.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {blockedCitizens.map((cit) => {
            const reqCount = getCitizenRequestsCount(cit.Citizen_ID);
            const isConfirming = pendingUnblockId === cit.Citizen_ID;
            return (
              <div
                key={cit.Citizen_ID}
                className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-red-200 dark:border-red-900/60 hover:border-red-400 shadow-xs hover:shadow-md transition-all p-4 flex flex-col justify-between gap-3 relative overflow-hidden"
              >
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-600 via-rose-500 to-red-700" />

                <div className="space-y-2.5 pt-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <UserX className="w-4 h-4 text-red-600 shrink-0" />
                        <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                          {cit.FullName}
                        </h3>
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] font-bold">
                        {cit.Citizen_ID}
                      </span>
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 text-[10px] font-black shrink-0 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      محظور
                    </span>
                  </div>

                  {/* Block Reason Box */}
                  <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/80 dark:border-red-900/50 space-y-1">
                    <div className="text-[10px] font-black text-red-700 dark:text-red-400 flex items-center gap-1">
                      <FileWarning className="w-3 h-3" />
                      <span>سبب الإدراج في القائمة السوداء:</span>
                    </div>
                    <p className="text-xs font-bold text-red-950 dark:text-red-200 leading-relaxed">
                      {cit.BlockReason || 'غير محدد'}
                    </p>
                  </div>

                  {/* Citizen Details */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono" dir="ltr">{cit.Phone1 || 'غير مسجل'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{cit.District || 'غير محدد'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{cit.BlockedAt || 'غير محدد'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">بواسطة: {cit.BlockedBy || 'الإدارة'}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCitizenForHistory(cit)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    السجل ({reqCount} معاملة)
                  </button>

                  {canManageBlacklist && (
                    <div className="flex items-center gap-1.5">
                      {isConfirming && (
                        <button
                          type="button"
                          onClick={() => setPendingUnblockId(null)}
                          className="px-2 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                        >
                          تراجع
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleConfirmUnblock(cit)}
                        className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
                          isConfirming
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isConfirming ? <Trash2 className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        <span>{isConfirming ? 'تأكيد إلغاء الحظر' : 'إلغاء الحظر'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add to Blacklist Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-red-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-red-300" />
                <div>
                  <h3 className="text-sm font-black">إدراج شخص جديد في القائمة السوداء</h3>
                  <p className="text-[11px] text-red-200">منع استقبال المعاملات والمراجعات بشكل فوري</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedCitizen(null);
                  setCitizenSearch('');
                  setBlockReason('');
                }}
                className="p-1.5 rounded-lg bg-red-800/70 hover:bg-red-700 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="p-4 pb-0">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAddMode('existing')}
                  className={`py-2 rounded-lg transition-all cursor-pointer ${
                    addMode === 'existing'
                      ? 'bg-white dark:bg-slate-900 text-red-700 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  اختيار مواطن مسجل بالنظام
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('manual')}
                  className={`py-2 rounded-lg transition-all cursor-pointer ${
                    addMode === 'manual'
                      ? 'bg-white dark:bg-slate-900 text-red-700 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  إضافة اسم جديد يدوياً
                </button>
              </div>
            </div>

            {addMode === 'existing' ? (
              <form onSubmit={handleBlockExisting} className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    ابحث عن المواطن المسجل *
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={citizenSearch}
                      onChange={(e) => {
                        setCitizenSearch(e.target.value);
                        setSelectedCitizen(null);
                      }}
                      placeholder="اكتب اسم المواطن أو رقم الهاتف أو الكود..."
                      className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {searchableCitizens.length > 0 && !selectedCitizen && (
                    <div className="max-h-44 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                      {searchableCitizens.map((c) => (
                        <button
                          key={c.Citizen_ID}
                          type="button"
                          onClick={() => {
                            setSelectedCitizen(c);
                            setCitizenSearch(c.FullName);
                          }}
                          className="w-full px-3 py-2 text-right hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-between text-xs cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{c.FullName}</div>
                            <div className="text-[10px] text-slate-500">
                              {c.District} • {c.Phone1 || 'بدون هاتف'}
                            </div>
                          </div>
                          <span className="font-mono text-[10px] text-blue-600 font-bold">{c.Citizen_ID}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedCitizen && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-black text-red-900">{selectedCitizen.FullName}</span>
                        <span className="text-[10px] text-red-700 block">
                          كود: {selectedCitizen.Citizen_ID} • {selectedCitizen.Phone1 || 'بدون هاتف'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCitizen(null);
                          setCitizenSearch('');
                        }}
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    سبب الحظر والإدراج في القائمة السوداء *
                  </label>
                  <textarea
                    rows={3}
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="مثال: تزوير وثائق، تكرار طلبات بطريقة غير قانونية، تجاوز لفظي، استفادة سابقة غير مستحقة..."
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedCitizen || !blockReason.trim()}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <UserX className="w-4 h-4" />
                    <span>تأكيد الإدراج في القائمة السوداء</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleManualAdd} className="p-5 space-y-3.5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    الاسم الكامل (ثلاثي أو رباعي) *
                  </label>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="اكتب الاسم الكامل..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">رقم الهاتف (إن وجد)</label>
                    <input
                      type="tel"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      placeholder="0780..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">القضاء / السكن</label>
                    <input
                      type="text"
                      value={manualDistrict}
                      onChange={(e) => setManualDistrict(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    سبب الحظر والإدراج في القائمة السوداء *
                  </label>
                  <textarea
                    rows={3}
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="اكتب سبب الحظر بالتفصيل..."
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={!manualName.trim() || !blockReason.trim()}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <UserX className="w-4 h-4" />
                    <span>إضافة وحظر فوري</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
