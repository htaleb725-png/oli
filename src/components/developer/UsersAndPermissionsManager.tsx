import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  User,
  UserRole,
  SYSTEM_PERMISSIONS,
  SYSTEM_SECTIONS_REGISTRY
} from '../../types';
import {
  KeyRound,
  Users,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  ShieldCheck,
  HeartHandshake,
  CheckCircle2,
  X,
  LogIn,
  Search,
  Layers,
  AlertCircle,
  RefreshCw,
  Loader2,
  CloudUpload
} from 'lucide-react';
import { SOCIAL_CARE_LEGACY_CUSTOM_ID } from '../../utils/permissions';

interface UsersAndPermissionsManagerProps {
  /** 'developer' gives full access including developer accounts & user switching; 'director' protects developer accounts from edits/deletion */
  mode?: 'developer' | 'director';
}

const ROLE_OPTIONS: { value: UserRole; label: string; department: string; defaultSections: string[] }[] = [
  { value: 'director', label: 'مدير المكتب التنفيذي', department: 'الإدارة التنفيذية العليا', defaultSections: ['director', 'reception', 'admin', 'social_care', 'interviews', 'organization', 'drive_requests', 'search_archive', 'reports', 'whatsapp', 'audit', 'blacklist'] },
  { value: 'deputy', label: 'النائب / المعالي', department: 'مكتب النائب', defaultSections: ['interviews', 'director', 'social_care', 'reports', 'search_archive'] },
  { value: 'admin', label: 'قسم الإدارة والمعاملات', department: 'قسم الإدارة', defaultSections: ['admin', 'drive_requests', 'search_archive', 'reports', 'whatsapp', 'blacklist'] },
  { value: 'reception', label: 'قسم الاستعلامات', department: 'قسم الاستعلامات', defaultSections: ['reception', 'search_archive'] },
  { value: 'social_care', label: 'قسم الرعاية الاجتماعية (مستقل)', department: 'قسم الرعاية الاجتماعية', defaultSections: ['social_care', 'search_archive'] },
  { value: 'interviews_officer', label: 'قسم المقابلات', department: 'قسم المقابلات', defaultSections: ['interviews', 'search_archive', 'reports', 'whatsapp'] },
  { value: 'organization', label: 'قسم التنظيم والعشائر', department: 'قسم التنظيم', defaultSections: ['organization', 'search_archive', 'reports', 'whatsapp'] },
  { value: 'audit', label: 'قسم الرقابة والتدقيق', department: 'قسم الرقابة والتدقيق', defaultSections: ['audit', 'search_archive', 'reports', 'blacklist'] },
  { value: 'archive', label: 'قسم الأرشيف والبحث', department: 'قسم الأرشيف', defaultSections: ['search_archive', 'reports'] },
  { value: 'developer', label: 'مطور النظام (صلاحية مطلقة)', department: 'قسم تكنولوجيا المعلومات والبرمجة', defaultSections: ['master_admin', 'apps_script', 'director', 'reception', 'admin', 'social_care', 'interviews', 'organization', 'drive_requests', 'search_archive', 'reports', 'whatsapp', 'audit', 'blacklist'] }
];

export const UsersAndPermissionsManager: React.FC<UsersAndPermissionsManagerProps> = ({
  mode = 'developer'
}) => {
  const {
    users,
    addUser,
    updateUser,
    deleteUser,
    switchUser,
    currentUser,
    customSections,
    syncUsersToAllDatabasesNow
  } = useApp();

  const isDeveloper = mode === 'developer' && currentUser?.Role === 'developer';

  // Form state (supports both Add and Edit in one clean component)
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('admin');
  const [department, setDepartment] = useState('قسم الإدارة');
  const [jobTitle, setJobTitle] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['view_all']);
  const [allowedSections, setAllowedSections] = useState<string[]>(['admin', 'drive_requests', 'search_archive']);
  const [status, setStatus] = useState<'active' | 'frozen'>('active');

  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setErrorMsg(null);
    setTimeout(() => setFeedback(null), 6500);
  };

  const formatSyncSummary = (res: { serverOk: boolean; firebaseOk: boolean; sheetsOk: boolean }): string => {
    const targets: string[] = [];
    if (res.serverOk) targets.push('قاعدة بيانات الخادم');
    if (res.firebaseOk) targets.push('قاعدة البيانات الرئيسية');
    if (res.sheetsOk) targets.push('الأرشيف الاحتياطي');
    if (targets.length === 0) {
      return 'تم الحفظ في قاعدة البيانات بنجاح';
    }
    return `تم الحفظ في قاعدة البيانات بنجاح (${targets.join(' + ')})`;
  };

  const handleSyncAllUsersNow = async () => {
    setIsSyncingAll(true);
    setErrorMsg(null);
    try {
      const res = await syncUsersToAllDatabasesNow();
      showNotice(`تمت مزامنة (${res.count}) حسابات — ${formatSyncSummary(res)}`);
    } catch (err: any) {
      setErrorMsg(`تعذر إتمام المزامنة: ${err?.message || 'خطأ غير متوقع'}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  // All selectable sections: built-in registry + dynamic custom sections (excluding sec_social_welfare since it is standalone 'social_care')
  const selectableCustomSections = useMemo(() => {
    return customSections.filter(cs => cs.id !== SOCIAL_CARE_LEGACY_CUSTOM_ID);
  }, [customSections]);

  const availableRoleOptions = useMemo(() => {
    return isDeveloper ? ROLE_OPTIONS : ROLE_OPTIONS.filter(r => r.value !== 'developer');
  }, [isDeveloper]);

  const resetForm = () => {
    setEditingUserId(null);
    setFullName('');
    setUsername('');
    setPassword('');
    setRole('admin');
    setDepartment('قسم الإدارة');
    setJobTitle('');
    setPermissions(['view_all']);
    setAllowedSections(['admin', 'drive_requests', 'search_archive']);
    setStatus('active');
    setErrorMsg(null);
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    const preset = ROLE_OPTIONS.find(r => r.value === newRole);
    if (preset) {
      setDepartment(preset.department);
      if (!editingUserId) {
        setAllowedSections(preset.defaultSections);
        if (newRole === 'social_care') {
          setPermissions(prev => Array.from(new Set([...prev, 'access_social_care'])));
        } else if (newRole === 'director') {
          setPermissions(SYSTEM_PERMISSIONS.map(p => p.id));
        }
      }
    }
  };

  const togglePermission = (permId: string) => {
    setPermissions(prev => {
      const exists = prev.includes(permId);
      const next = exists ? prev.filter(p => p !== permId) : [...prev, permId];
      // Keep access_social_care in sync with allowedSections 'social_care'
      if (permId === 'access_social_care') {
        if (!exists && !allowedSections.includes('social_care')) {
          setAllowedSections(s => [...s, 'social_care']);
        } else if (exists) {
          setAllowedSections(s => s.filter(x => x !== 'social_care'));
        }
      }
      return next;
    });
  };

  const toggleSection = (secId: string) => {
    setAllowedSections(prev => {
      const exists = prev.includes(secId);
      const next = exists ? prev.filter(s => s !== secId) : [...prev, secId];
      // Keep access_social_care permission synchronized with 'social_care' section
      if (secId === 'social_care') {
        if (!exists && !permissions.includes('access_social_care')) {
          setPermissions(p => [...p, 'access_social_care']);
        } else if (exists) {
          setPermissions(p => p.filter(x => x !== 'access_social_care'));
        }
      }
      return next;
    });
  };

  const startEditUser = (u: User) => {
    if (u.Role === 'developer' && !isDeveloper) {
      setErrorMsg('لا يمكن تعديل حساب مطور النظام إلا من قبل المطور نفسه.');
      return;
    }
    setEditingUserId(u.User_ID);
    setFullName(u.FullName || '');
    setUsername(u.Username || '');
    setPassword(u.Password || '');
    setRole(u.Role);
    setDepartment(u.Department || '');
    setJobTitle(u.JobTitle || '');
    setPermissions(u.Permissions || []);
    const fallbackPreset = ROLE_OPTIONS.find(r => r.value === u.Role)?.defaultSections || [];
    setAllowedSections(u.AllowedSections && u.AllowedSections.length > 0 ? u.AllowedSections : fallbackPreset);
    setStatus(u.Status || 'active');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim() || !password.trim()) {
      setErrorMsg('يرجى إدخال اسم الموظف، اسم المستخدم، وكلمة المرور.');
      return;
    }

    const roleMeta = ROLE_OPTIONS.find(r => r.value === role);
    const roleArabic = roleMeta ? roleMeta.label : department;

    // Ensure social_care permission and AllowedSections stay consistent
    let finalPermissions = [...permissions];
    let finalSections = [...allowedSections];
    if (role === 'social_care' || finalSections.includes('social_care') || finalPermissions.includes('access_social_care')) {
      if (finalSections.includes('social_care') || role === 'social_care') {
        if (!finalSections.includes('social_care')) finalSections.push('social_care');
        if (!finalPermissions.includes('access_social_care')) finalPermissions.push('access_social_care');
      }
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      if (editingUserId) {
        const existing = users.find(u => u.User_ID === editingUserId);
        if (!existing) return;
        if (existing.Role === 'developer' && !isDeveloper) {
          setErrorMsg('حساب مطور النظام محمي ولا يمكن تعديله.');
          return;
        }
        const res = await updateUser({
          ...existing,
          FullName: fullName.trim(),
          Username: username.trim(),
          Password: password.trim(),
          Role: role,
          RoleArabic: roleArabic,
          Department: department.trim() || roleArabic,
          JobTitle: jobTitle.trim() || roleArabic,
          Permissions: finalPermissions,
          AllowedSections: finalSections,
          Status: status
        });
        showNotice(`تم تحديث حساب "${fullName.trim()}" — ${formatSyncSummary(res)}`);
        resetForm();
      } else {
        const duplicate = users.some(u => (u.Username || '').toLowerCase() === username.trim().toLowerCase());
        if (duplicate) {
          setErrorMsg('اسم المستخدم موجود مسبقاً لموظف آخر، يرجى اختيار اسم مختلف.');
          return;
        }
        const res = await addUser({
          FullName: fullName.trim(),
          Username: username.trim(),
          Password: password.trim(),
          Role: role,
          RoleArabic: roleArabic,
          Department: department.trim() || roleArabic,
          JobTitle: jobTitle.trim() || roleArabic,
          Permissions: finalPermissions,
          AllowedSections: finalSections,
          Status: status
        });
        showNotice(`تم إنشاء حساب "${fullName.trim()}" — ${formatSyncSummary(res)}`);
        resetForm();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFreeze = async (u: User) => {
    if (u.Role === 'developer' && !isDeveloper) {
      setErrorMsg('لا يمكن تجميد حساب مطور النظام.');
      return;
    }
    const nextStatus = u.Status === 'frozen' ? 'active' : 'frozen';
    const res = await updateUser({ ...u, Status: nextStatus });
    showNotice(
      (nextStatus === 'frozen' ? `تم تجميد حساب ${u.FullName}` : `تم إعادة تفعيل حساب ${u.FullName}`) +
        ` — ${formatSyncSummary(res)}`
    );
  };

  const handleDeleteUser = async (u: User) => {
    if (u.Role === 'developer') {
      setErrorMsg('حساب مطور النظام محمي ولا يمكن حذفه.');
      return;
    }
    if (u.User_ID === currentUser?.User_ID) {
      setErrorMsg('لا يمكنك حذف حسابك النشط حالياً.');
      return;
    }
    await deleteUser(u.User_ID);
    if (editingUserId === u.User_ID) resetForm();
    showNotice(`تم حذف حساب الموظف ${u.FullName} ومزامنة الحذف.`);
  };

  const handleQuickToggleSocialCare = (u: User) => {
    if (u.Role === 'developer' && !isDeveloper) return;
    const hasAccess =
      u.Role === 'social_care' ||
      u.Role === 'social_care_officer' ||
      u.AllowedSections?.includes('social_care') ||
      u.Permissions?.includes('access_social_care');

    const currentSecs = u.AllowedSections || ROLE_OPTIONS.find(r => r.value === u.Role)?.defaultSections || [];
    const currentPerms = u.Permissions || [];

    const nextSecs = hasAccess
      ? currentSecs.filter(s => s !== 'social_care' && s !== `custom_section_${SOCIAL_CARE_LEGACY_CUSTOM_ID}`)
      : Array.from(new Set([...currentSecs, 'social_care']));

    const nextPerms = hasAccess
      ? currentPerms.filter(p => p !== 'access_social_care')
      : Array.from(new Set([...currentPerms, 'access_social_care']));

    updateUser({
      ...u,
      AllowedSections: nextSecs,
      Permissions: nextPerms
    });

    showNotice(
      hasAccess
        ? `تم سحب صلاحية قسم الرعاية الاجتماعية من ${u.FullName}`
        : `تم منح صلاحية قسم الرعاية الاجتماعية للموظف ${u.FullName}`
    );
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (deptFilter !== 'all') {
        if (deptFilter === 'social_care') {
          const isSc =
            u.Role === 'social_care' ||
            u.Role === 'social_care_officer' ||
            u.AllowedSections?.includes('social_care') ||
            u.Permissions?.includes('access_social_care');
          if (!isSc) return false;
        } else if (u.Role !== deptFilter && !(u.Department || '').includes(deptFilter)) {
          return false;
        }
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        return (
          (u.FullName || '').toLowerCase().includes(q) ||
          (u.Username || '').toLowerCase().includes(q) ||
          (u.Department || '').toLowerCase().includes(q) ||
          (u.RoleArabic || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, deptFilter, searchTerm]);

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{feedback}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="p-1 hover:bg-emerald-100 rounded cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="p-1 hover:bg-rose-100 rounded cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Form Column (5 Cols): Add / Edit User + Section Access Matrix + Granular Permissions */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs h-fit">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>{editingUserId ? 'تعديل حساب وصلاحيات الموظف' : 'إضافة موظف وتحديد الأقسام والصلاحيات'}</span>
            </h3>
            {editingUserId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 cursor-pointer"
              >
                إلغاء التعديل
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم الموظف الكامل *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: أ. حيدر الكعبي"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم المستخدم *</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 text-left"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الرمز السري / كلمة المرور *</label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="مثال: 4455"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 text-left"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">القسم الأساسي / الدور الوظيفي *</label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableRoleOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">المسمى الوظيفي / الشعبة</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="مثال: قسم الرعاية الاجتماعية"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Standalone Social Care Explicit Access Toggle */}
            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 space-y-1.5">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                      منح صلاحية الدخول إلى قسم الرعاية الاجتماعية (مستقل)
                    </div>
                    <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                      لا يظهر هذا القسم لبقية الموظفين إلا عند تفعيل هذا الخيار صراحةً
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={allowedSections.includes('social_care') || role === 'social_care' || role === 'developer' || role === 'director'}
                  disabled={role === 'social_care' || role === 'developer' || role === 'director'}
                  onChange={() => toggleSection('social_care')}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                />
              </label>
            </div>

            {/* Section Access Matrix (Built-in + Custom Sections) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>الأقسام المسموح للموظف بدخولها ({allowedSections.length}):</span>
                </label>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = [
                        ...SYSTEM_SECTIONS_REGISTRY.filter(s => isDeveloper || !s.developerOnly).map(s => s.id),
                        ...selectableCustomSections.map(cs => `custom_section_${cs.id}`)
                      ];
                      setAllowedSections(allIds);
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                  >
                    تحديد الكل
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setAllowedSections([])}
                    className="text-rose-600 dark:text-rose-400 hover:underline font-bold cursor-pointer"
                  >
                    إلغاء الكل
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                {SYSTEM_SECTIONS_REGISTRY.filter(s => isDeveloper || !s.developerOnly).map(sec => {
                  const checked = allowedSections.includes(sec.id);
                  return (
                    <label
                      key={sec.id}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
                        checked
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSection(sec.id)}
                        className="w-3.5 h-3.5 accent-indigo-600 shrink-0"
                      />
                      <span className="truncate">{sec.label}</span>
                    </label>
                  );
                })}

                {selectableCustomSections.map(cs => {
                  const key = `custom_section_${cs.id}`;
                  const checked = allowedSections.includes(key);
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
                        checked
                          ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-200'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSection(key)}
                        className="w-3.5 h-3.5 accent-purple-600 shrink-0"
                      />
                      <span className="truncate">{cs.title}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Granular Permissions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>الصلاحيات الإجرائية الدقيقة ({permissions.length}):</span>
                </label>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPermissions(SYSTEM_PERMISSIONS.map(p => p.id))}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                  >
                    منح الكل
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setPermissions([])}
                    className="text-rose-600 dark:text-rose-400 hover:underline font-bold cursor-pointer"
                  >
                    مسح
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                {SYSTEM_PERMISSIONS.map(perm => {
                  const checked = permissions.includes(perm.id);
                  return (
                    <label
                      key={perm.id}
                      title={perm.description}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
                        checked
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePermission(perm.id)}
                        className="w-3.5 h-3.5 accent-blue-600 shrink-0"
                      />
                      <span className="truncate">{perm.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingUserId ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>
                {isSaving
                  ? 'جاري الحفظ والمزامنة مع قاعدة البيانات...'
                  : editingUserId
                  ? 'حفظ وتحديث صلاحيات الموظف'
                  : 'إنشاء الحساب وتفعيل الصلاحيات'}
              </span>
            </button>
          </form>
        </div>

        {/* Right Staff Directory Column (7 Cols) */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>كادر وموظفي المكتب المسجلين ({users.length})</span>
            </h3>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSyncAllUsersNow}
                disabled={isSyncingAll}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs transition-colors"
                title="رفع ومزامنة كافة حسابات الموظفين وصلاحياتهم إلى قاعدة البيانات ليتمكنوا من الدخول من الرابط المشترك"
              >
                {isSyncingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
                <span>{isSyncingAll ? 'جاري المزامنة...' : 'مزامنة الحسابات الآن'}</span>
              </button>
              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث بالاسم أو القسم..."
                  className="w-full pr-8 pl-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Department Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: 'الكل', count: users.length },
              { id: 'admin', label: 'الإدارة', count: users.filter(u => u.Role === 'admin' || u.Role === 'admin_officer').length },
              { id: 'reception', label: 'الاستعلامات', count: users.filter(u => u.Role === 'reception' || u.Role === 'reception_officer').length },
              { id: 'social_care', label: 'الرعاية الاجتماعية', count: users.filter(u => u.Role === 'social_care' || u.Role === 'social_care_officer' || u.AllowedSections?.includes('social_care') || u.Permissions?.includes('access_social_care')).length },
              { id: 'organization', label: 'التنظيم', count: users.filter(u => u.Role === 'organization').length },
              { id: 'audit', label: 'الرقابة', count: users.filter(u => u.Role === 'audit').length }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDeptFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  deptFilter === tab.id
                    ? 'bg-slate-900 dark:bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono tabular-nums text-[10px] opacity-80">({tab.count})</span>
              </button>
            ))}
          </div>

          {/* Users List */}
          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pl-1">
            {filteredUsers.map(u => {
              const isDevRow = u.Role === 'developer';
              const isProtected = isDevRow && !isDeveloper;
              const hasSocialCare =
                u.Role === 'developer' ||
                u.Role === 'director' ||
                u.Role === 'deputy' ||
                u.Role === 'social_care' ||
                u.Role === 'social_care_officer' ||
                u.AllowedSections?.includes('social_care') ||
                u.Permissions?.includes('access_social_care');

              return (
                <div
                  key={u.User_ID}
                  className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                    editingUserId === u.User_ID
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600'
                      : u.Status === 'frozen'
                      ? 'bg-slate-100/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-70'
                      : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-xs text-slate-900 dark:text-white">{u.FullName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          {u.RoleArabic || u.Department}
                        </span>
                        {u.Status === 'frozen' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                            مجمّد
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex items-center gap-3 flex-wrap">
                        <span>User: {u.Username}</span>
                        {!isProtected && <span>Pass: {u.Password || '••••'}</span>}
                        <span>ID: {u.User_ID}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Quick Toggle for Standalone Social Care Permission */}
                      {!isProtected && u.Role !== 'developer' && u.Role !== 'director' && u.Role !== 'deputy' && u.Role !== 'social_care' && (
                        <button
                          type="button"
                          onClick={() => handleQuickToggleSocialCare(u)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
                            hasSocialCare
                              ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-emerald-400 hover:text-emerald-700'
                          }`}
                          title="منح أو سحب صلاحية قسم الرعاية الاجتماعية المستقل"
                        >
                          <HeartHandshake className="w-3 h-3" />
                          <span>{hasSocialCare ? 'صلاحية الرعاية مفعلة ✓' : 'منح الرعاية الاجتماعية'}</span>
                        </button>
                      )}

                      {isDeveloper && u.User_ID !== currentUser?.User_ID && (
                        <button
                          type="button"
                          onClick={() => switchUser(u)}
                          className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                          title="دخول سريع بحساب هذا الموظف للمعاينة"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {!isProtected && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditUser(u)}
                            className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 cursor-pointer"
                            title="تعديل الحساب والصلاحيات"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleFreeze(u)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer"
                            title={u.Status === 'frozen' ? 'إعادة تفعيل الحساب' : 'تجميد الحساب مؤقتاً'}
                          >
                            {u.Status === 'frozen' ? <Unlock className="w-3.5 h-3.5 text-emerald-600" /> : <Lock className="w-3.5 h-3.5 text-amber-600" />}
                          </button>

                          {!isDevRow && u.User_ID !== currentUser?.User_ID && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 cursor-pointer"
                              title="حذف الحساب"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Assigned Sections & Permissions Summary */}
                  <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    {hasSocialCare && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        الرعاية الاجتماعية (مستقل)
                      </span>
                    )}
                    {(u.AllowedSections || []).filter(s => s !== 'social_care').slice(0, 6).map(secId => {
                      const reg = SYSTEM_SECTIONS_REGISTRY.find(r => r.id === secId);
                      const custom = customSections.find(cs => `custom_section_${cs.id}` === secId);
                      return (
                        <span
                          key={secId}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800"
                        >
                          {reg?.label || custom?.title || secId}
                        </span>
                      );
                    })}
                    {(u.AllowedSections || []).length > 7 && (
                      <span className="text-[10px] font-mono text-slate-500">
                        +{(u.AllowedSections || []).length - 7} أقسام
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
