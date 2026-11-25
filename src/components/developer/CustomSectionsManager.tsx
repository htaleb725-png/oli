import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CustomSection,
  CustomSubSection,
  CustomFieldDefinition,
  CustomFieldType,
  UserRole,
  SYSTEM_SECTIONS_REGISTRY
} from '../../types';
import {
  FolderPlus,
  Trash2,
  Edit3,
  Plus,
  Layers,
  ExternalLink,
  AlertTriangle,
  FolderKanban,
  Upload,
  Image as ImageIcon,
  ListFilter,
  ShieldCheck,
  LayoutGrid,
  Link2
} from 'lucide-react';
import { SOCIAL_CARE_LEGACY_CUSTOM_ID } from '../../utils/permissions';

const ACCESS_ROLES: { id: UserRole; label: string }[] = [
  { id: 'director', label: 'المدير التنفيذي' },
  { id: 'deputy', label: 'النائب' },
  { id: 'admin', label: 'قسم الإدارة' },
  { id: 'reception', label: 'قسم الاستعلامات' },
  { id: 'social_care', label: 'قسم الرعاية الاجتماعية' },
  { id: 'interviews_officer', label: 'قسم المقابلات' },
  { id: 'organization', label: 'قسم التنظيم' },
  { id: 'audit', label: 'قسم الرقابة' },
  { id: 'archive', label: 'الأرشيف' }
];

const DEFAULT_SECTION_FIELDS: CustomFieldDefinition[] = [
  {
    id: 'f_1',
    name: 'title',
    label: 'عنوان المعاملة / السجل',
    type: 'text',
    required: true,
    placeholder: 'أدخل العنوان الرئيسي...'
  },
  {
    id: 'f_2',
    name: 'category',
    label: 'التصنيف / النوع',
    type: 'dropdown',
    required: true,
    options: ['طلب مباشر', 'مذكرة إدارية', 'متابعة ميدانية', 'أخرى']
  },
  {
    id: 'f_3',
    name: 'attachment',
    label: 'صورة المرفق أو الهامش',
    type: 'image',
    required: false,
    helpText: 'رفع صورة المستند وحفظها سحابياً مع السجل'
  },
  {
    id: 'f_4',
    name: 'notes',
    label: 'شرح وتفاصيل السجل',
    type: 'textarea',
    required: false,
    placeholder: 'اكتب الشرح أو الملاحظات...'
  }
];

export const CustomSectionsManager: React.FC = () => {
  const {
    customSections,
    addCustomSection,
    updateCustomSection,
    deleteCustomSection,
    customRecords,
    setActiveSection
  } = useApp();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<CustomSection | null>(null);
  const [deleteConfirmSection, setDeleteConfirmSection] = useState<CustomSection | null>(null);

  // Main section form states
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionDescription, setSectionDescription] = useState('');
  const [sectionColor, setSectionColor] = useState('blue');
  const [sectionIconUrl, setSectionIconUrl] = useState('');
  const [isMultiSectionHub, setIsMultiSectionHub] = useState(false);
  const [isStandaloneRestricted, setIsStandaloneRestricted] = useState(false);
  const [allowedRoles, setAllowedRoles] = useState<UserRole[]>([]);
  const [fields, setFields] = useState<CustomFieldDefinition[]>(DEFAULT_SECTION_FIELDS);
  const [subSections, setSubSections] = useState<CustomSubSection[]>([]);

  // Inline field creator state
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');

  // Inline sub-section creator state (for Multi-Section Hub icons)
  const [subTitle, setSubTitle] = useState('');
  const [subDesc, setSubDesc] = useState('');
  const [subIconUrl, setSubIconUrl] = useState('');
  const [subMode, setSubMode] = useState<'custom' | 'builtin'>('custom');
  const [subBuiltInTarget, setSubBuiltInTarget] = useState('reception');
  const [subCustomFieldLabels, setSubCustomFieldLabels] = useState('الاسم الكامل, رقم الهاتف, الموضوع, ملاحظات');

  const handleUploadImageFile = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddField = () => {
    if (!newFieldLabel.trim()) return;
    const newField: CustomFieldDefinition = {
      id: `f_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: `field_${Date.now().toString().slice(-4)}`,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      placeholder: newFieldPlaceholder.trim() || undefined,
      options:
        newFieldType === 'dropdown'
          ? newFieldOptions.split(',').map(s => s.trim()).filter(Boolean)
          : undefined
    };

    setFields(prev => [...prev, newField]);
    setNewFieldLabel('');
    setNewFieldType('text');
    setNewFieldRequired(false);
    setNewFieldOptions('');
    setNewFieldPlaceholder('');
  };

  const handleRemoveField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
  };

  const handleAddSubSection = () => {
    if (!subTitle.trim()) return;
    const subId = `sub_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

    let generatedFields: CustomFieldDefinition[] = [];
    if (subMode === 'custom') {
      const labels = subCustomFieldLabels
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      generatedFields = (labels.length > 0 ? labels : ['العنوان', 'التفاصيل']).map((lbl, i) => ({
        id: `${subId}_f_${i + 1}`,
        name: `field_${i + 1}`,
        label: lbl,
        type: lbl.includes('صورة') || lbl.includes('مرفق') ? 'image' : lbl.includes('تاريخ') ? 'date' : 'text',
        required: i === 0
      }));
      // Always include an image attachment field so users can upload photos
      if (!generatedFields.some(f => f.type === 'image')) {
        generatedFields.push({
          id: `${subId}_f_img`,
          name: 'attachment',
          label: 'صورة المرفق أو المستند',
          type: 'image',
          required: false
        });
      }
    }

    const newSub: CustomSubSection = {
      id: subId,
      title: subTitle.trim(),
      description: subDesc.trim() || undefined,
      iconUrl: subIconUrl.trim() || undefined,
      badgeColor: sectionColor,
      targetBuiltInSection: subMode === 'builtin' ? subBuiltInTarget : undefined,
      fields: generatedFields
    };

    setSubSections(prev => [...prev, newSub]);
    setSubTitle('');
    setSubDesc('');
    setSubIconUrl('');
    setSubMode('custom');
    setSubCustomFieldLabels('الاسم الكامل, رقم الهاتف, الموضوع, ملاحظات');
  };

  const handleRemoveSubSection = (subId: string) => {
    setSubSections(prev => prev.filter(s => s.id !== subId));
  };

  const toggleAllowedRole = (roleId: UserRole) => {
    setAllowedRoles(prev =>
      prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
    );
  };

  const handleOpenCreateModal = (startAsMultiHub = false) => {
    setEditingSection(null);
    setSectionTitle('');
    setSectionDescription('');
    setSectionColor('blue');
    setSectionIconUrl('');
    setIsMultiSectionHub(startAsMultiHub);
    setIsStandaloneRestricted(false);
    setAllowedRoles([]);
    setFields(DEFAULT_SECTION_FIELDS);
    setSubSections([]);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (sec: CustomSection) => {
    setEditingSection(sec);
    setSectionTitle(sec.title);
    setSectionDescription(sec.description || '');
    setSectionColor(sec.badgeColor || 'blue');
    setSectionIconUrl(sec.iconUrl || '');
    setIsMultiSectionHub(Boolean(sec.isMultiSectionHub));
    setIsStandaloneRestricted(Boolean(sec.isStandaloneRestricted));
    setAllowedRoles((sec.allowedRoles || []) as UserRole[]);
    setFields(sec.fields || []);
    setSubSections(sec.subSections || []);
    setIsCreateModalOpen(true);
  };

  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionTitle.trim()) return;

    const payload = {
      title: sectionTitle.trim(),
      description: sectionDescription.trim(),
      badgeColor: sectionColor,
      iconUrl: sectionIconUrl.trim() || undefined,
      isMultiSectionHub,
      subSections: isMultiSectionHub ? subSections : [],
      isStandaloneRestricted,
      allowedRoles: isStandaloneRestricted ? allowedRoles : [],
      fields
    };

    if (editingSection) {
      updateCustomSection({
        ...editingSection,
        ...payload
      });
    } else {
      addCustomSection(payload);
    }

    setIsCreateModalOpen(false);
    setEditingSection(null);
  };

  const handleExecuteDelete = () => {
    if (!deleteConfirmSection) return;
    deleteCustomSection(deleteConfirmSection.id);
    setDeleteConfirmSection(null);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header & Quick Create Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-indigo-600" />
            <span>باني الأقسام والأيقونات المتعددة للمطور (مزامنة تلقائية فورية)</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            أضف قسماً جديداً أو أنشئ <strong>أيقونة رئيسية تحتوي داخلها على عدة أقسام فرعية</strong> مع صلاحيات دخول مستقلة وصورة مخصصة، ويتم حفظها ومزامنتها تلقائياً في Firebase و Google Sheets دون تعديل أي سكربت.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => handleOpenCreateModal(false)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <FolderPlus className="w-4 h-4" />
            <span>إنشاء قسم جديد</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>إنشاء أيقونة متعددة الأقسام</span>
          </button>
        </div>
      </div>

      {/* Sections Grid */}
      {customSections.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
            <Layers className="w-7 h-7" />
          </div>
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">لا توجد أقسام مخصصة مضافة حالياً</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            أنشئ قسماً مستقلاً أو أيقونة حاوية لعدة أقسام فرعية ليظهر فوراً في المنظومة ويتزامن تلقائياً مع السحابة.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customSections.map((sec) => {
            const isSocialCareBase = sec.id === SOCIAL_CARE_LEGACY_CUSTOM_ID;
            const recordsCount = customRecords.filter(
              r => r.sectionId === sec.id || r.sectionId.startsWith(`${sec.id}__`)
            ).length;
            const subCount = sec.isMultiSectionHub ? (sec.subSections?.length || 0) : 0;

            return (
              <div
                key={sec.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center overflow-hidden shrink-0">
                        {sec.iconUrl ? (
                          <img src={sec.iconUrl} alt={sec.title} className="w-full h-full object-cover" />
                        ) : sec.isMultiSectionHub ? (
                          <LayoutGrid className="w-5 h-5 text-amber-600" />
                        ) : (
                          <Layers className="w-5 h-5 text-indigo-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                          {sec.title}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 font-mono tabular-nums">
                            {recordsCount} سجل
                          </span>
                          {sec.isMultiSectionHub && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                              أيقونة متعددة ({subCount} أقسام)
                            </span>
                          )}
                          {(sec.isStandaloneRestricted || isSocialCareBase) && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                              مقيّد بالصلاحية
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {sec.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {sec.description}
                    </p>
                  )}

                  {/* Sub-sections or Fields Summary */}
                  {sec.isMultiSectionHub && sec.subSections && sec.subSections.length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
                        الأقسام الفرعية داخل هذه الأيقونة ({sec.subSections.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {sec.subSections.map((sub) => (
                          <span
                            key={sub.id}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                          >
                            {sub.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
                        الحقول المخصصة ({sec.fields?.length || 0}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {sec.fields?.slice(0, 6).map((f) => (
                          <span
                            key={f.id}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            {f.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(sec)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                      title="تعديل بيانات وحقول وأقسام هذه الأيقونة"
                    >
                      <Edit3 className="w-4 h-4 text-blue-600" />
                    </button>
                    {!isSocialCareBase && (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmSection(sec)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 text-xs font-bold transition-colors cursor-pointer"
                        title="حذف القسم وجميع بياناته المسجلة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSection(isSocialCareBase ? 'social_care' : `custom_section_${sec.id}`)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>فتح واستعراض</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create or Edit Section / Multi-Section Icon Hub */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                {isMultiSectionHub ? <LayoutGrid className="w-5 h-5 text-amber-500" /> : <FolderPlus className="w-5 h-5 text-indigo-600" />}
                <span>
                  {editingSection
                    ? `تعديل: ${editingSection.title}`
                    : isMultiSectionHub
                    ? 'إنشاء أيقونة رئيسية تحتوي على عدة أقسام فرعية'
                    : 'إنشاء قسم مخصص جديد'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="space-y-4">
              {/* Type Selector: Single Section vs Multi-Section Hub */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsMultiSectionHub(false)}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
                    !isMultiSectionHub
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-950 dark:text-indigo-100'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <FolderPlus className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div>
                    <div className="text-xs font-black">قسم بيانات مباشر</div>
                    <div className="text-[11px] opacity-75">أيقونة تفتح قسماً مستقلاً بجداول وحقول مخصصة</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMultiSectionHub(true)}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
                    isMultiSectionHub
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-950 dark:text-amber-100'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <LayoutGrid className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <div className="text-xs font-black">أيقونة حاوية لعدة أقسام فرعية</div>
                    <div className="text-[11px] opacity-75">أيقونة واحدة تضم داخلها مجموعة أقسام مستقلة</div>
                  </div>
                </button>
              </div>

              {/* Title, Description & Icon Image */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    اسم الأيقونة / القسم *
                  </label>
                  <input
                    type="text"
                    value={sectionTitle}
                    onChange={(e) => setSectionTitle(e.target.value)}
                    placeholder="مثال: شؤون المواطنين والخدمات، اللجان الخاصة..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    وصف مختصر يظهر أسفل الأيقونة
                  </label>
                  <input
                    type="text"
                    value={sectionDescription}
                    onChange={(e) => setSectionDescription(e.target.value)}
                    placeholder="توضيح موجز لاختصاصات هذه الأيقونة..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Custom Icon Image Uploader */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {sectionIconUrl ? (
                      <img src={sectionIconUrl} alt="Icon" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">صورة مخصصة لأيقونة القسم (اختياري)</div>
                    <div className="text-[11px] text-slate-500">ارفع صورة من جهازك لتظهر مباشرة على بطاقة القسم</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع صورة</span>
                    <input type="file" accept="image/*" onChange={(e) => handleUploadImageFile(e, setSectionIconUrl)} className="hidden" />
                  </label>
                  {sectionIconUrl && (
                    <button
                      type="button"
                      onClick={() => setSectionIconUrl('')}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold cursor-pointer"
                    >
                      إزالة
                    </button>
                  )}
                </div>
              </div>

              {/* Access Control & Isolation */}
              <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-xs font-black text-emerald-950 dark:text-emerald-200">
                        تقييد ظهور هذا القسم بالصلاحية (قسم مستقل مخفي عن غير المخولين)
                      </div>
                      <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                        عند التفعيل، لا يظهر القسم إلا للمطور والمدير التنفيذي ومن تحددهم أدناه أو في قسم الصلاحيات
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isStandaloneRestricted}
                    onChange={(e) => setIsStandaloneRestricted(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                  />
                </label>

                {isStandaloneRestricted && (
                  <div className="pt-2 border-t border-emerald-200/70 dark:border-emerald-800/70">
                    <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1.5">
                      الأدوار المسموح لها برؤية هذا القسم (إضافة للمطور والمدير التنفيذي):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ACCESS_ROLES.map(r => {
                        const active = allowedRoles.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => toggleAllowedRole(r.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                              active
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* MULTI-SECTION HUB BUILDER */}
              {isMultiSectionHub ? (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <LayoutGrid className="w-4 h-4 text-amber-500" />
                      <span>الأقسام الفرعية داخل هذه الأيقونة ({subSections.length}):</span>
                    </h4>
                  </div>

                  {subSections.length > 0 && (
                    <div className="space-y-2">
                      {subSections.map((sub, idx) => (
                        <div
                          key={sub.id}
                          className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/70 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-[11px] shrink-0">
                              {idx + 1}
                            </span>
                            {sub.iconUrl && (
                              <img src={sub.iconUrl} alt={sub.title} className="w-8 h-8 rounded-lg object-cover border border-amber-300 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="font-black text-slate-900 dark:text-white truncate">{sub.title}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {sub.targetBuiltInSection
                                  ? `مرتبط بالقسم: ${SYSTEM_SECTIONS_REGISTRY.find(s => s.id === sub.targetBuiltInSection)?.label || sub.targetBuiltInSection}`
                                  : `قسم بيانات مستقل (${sub.fields?.length || 0} حقول)`}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubSection(sub.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950 cursor-pointer shrink-0"
                            title="حذف هذا القسم الفرعي"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Sub-Section Form */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-amber-500" />
                      <span>إضافة قسم فرعي جديد داخل هذه الأيقونة:</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={subTitle}
                        onChange={(e) => setSubTitle(e.target.value)}
                        placeholder="اسم القسم الفرعي (مثال: طلبات الكهرباء)..."
                        className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                      />
                      <input
                        type="text"
                        value={subDesc}
                        onChange={(e) => setSubDesc(e.target.value)}
                        placeholder="وصف مختصر للقسم الفرعي..."
                        className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <select
                        value={subMode}
                        onChange={(e) => setSubMode(e.target.value as 'custom' | 'builtin')}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      >
                        <option value="custom">قسم بيانات جديد مستقل (جداول + صور + سحابة)</option>
                        <option value="builtin">ربط مباشر بقسم موجود في النظام</option>
                      </select>

                      <div className="flex items-center gap-2">
                        <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer hover:bg-slate-100">
                          <Upload className="w-3.5 h-3.5 text-amber-600" />
                          <span>{subIconUrl ? 'تم اختيار صورة ✓' : 'صورة للقسم الفرعي'}</span>
                          <input type="file" accept="image/*" onChange={(e) => handleUploadImageFile(e, setSubIconUrl)} className="hidden" />
                        </label>
                      </div>
                    </div>

                    {subMode === 'builtin' ? (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                          <Link2 className="w-3.5 h-3.5" />
                          <span>اختر القسم المرتبط:</span>
                        </label>
                        <select
                          value={subBuiltInTarget}
                          onChange={(e) => setSubBuiltInTarget(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                        >
                          {SYSTEM_SECTIONS_REGISTRY.filter(s => !s.developerOnly).map(s => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          أسماء حقول هذا القسم الفرعي (افصل بينها بفاصلة ,):
                        </label>
                        <input
                          type="text"
                          value={subCustomFieldLabels}
                          onChange={(e) => setSubCustomFieldLabels(e.target.value)}
                          placeholder="الاسم الكامل, رقم الهاتف, الموضوع, التاريخ, ملاحظات"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAddSubSection}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs cursor-pointer"
                    >
                      + إضافة هذا القسم الفرعي للأيقونة
                    </button>
                  </div>
                </div>
              ) : (
                /* SINGLE SECTION FIELDS BUILDER */
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <ListFilter className="w-4 h-4 text-indigo-600" />
                      <span>حقول القسم المخصصة ({fields.length}):</span>
                    </h4>
                  </div>

                  <div className="space-y-2">
                    {fields.map((f, idx) => (
                      <div
                        key={f.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">{f.label}</span>
                            <span className="text-[10px] text-slate-400 mr-2">
                              ({f.type === 'dropdown' ? `قائمة: ${f.options?.join(', ')}` : f.type === 'image' ? 'رفع صورة' : f.type})
                            </span>
                            {f.required && <span className="text-[10px] text-rose-500 font-bold mr-1">* إجباري</span>}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveField(f.id)}
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950 transition-colors cursor-pointer"
                          title="حذف هذا الحقل"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 space-y-3">
                    <h5 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      + إضافة حقل جديد لهذا القسم:
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        value={newFieldLabel}
                        onChange={(e) => setNewFieldLabel(e.target.value)}
                        placeholder="عنوان الحقل (مثال: المبلغ، نوع الطلب)..."
                        className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                      />

                      <select
                        value={newFieldType}
                        onChange={(e) => setNewFieldType(e.target.value as CustomFieldType)}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                      >
                        <option value="text">حقل نصي (Text)</option>
                        <option value="number">حقل رقمي (Number)</option>
                        <option value="dropdown">قائمة منسدلة (Dropdown)</option>
                        <option value="image">رفع صورة وحفظها (Image)</option>
                        <option value="date">تاريخ (Date)</option>
                        <option value="textarea">نص متعدد الأسطر (Textarea)</option>
                      </select>

                      <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newFieldRequired}
                          onChange={(e) => setNewFieldRequired(e.target.checked)}
                          className="rounded text-indigo-600"
                        />
                        <span>حقل إجباري</span>
                      </label>
                    </div>

                    {newFieldType === 'dropdown' && (
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-indigo-900 dark:text-indigo-300">
                          خيارات القائمة المنسدلة (افصل بينها بفواصل ,)
                        </label>
                        <input
                          type="text"
                          value={newFieldOptions}
                          onChange={(e) => setNewFieldOptions(e.target.value)}
                          placeholder="خيار أول, خيار ثانٍ, خيار ثالث..."
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAddField}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                    >
                      + تأكيد إدراج الحقل في القسم
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-sm cursor-pointer"
                >
                  {editingSection ? 'حفظ التعديلات ومزامنتها فوراً' : 'اعتماد وإنشاء الأيقونة فوراً'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Section */}
      {deleteConfirmSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-base font-black text-slate-900 dark:text-white">
              تأكيد حذف القسم وكافة سجلاته
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              أنت على وشك حذف القسم <strong>({deleteConfirmSection.title})</strong>.
              <br />
              <strong className="text-rose-600 block mt-1">
                سيتم حذف هذا القسم وسجلاته فقط دون المساس بباقي قاعدة البيانات.
              </strong>
            </p>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmSection(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-sm cursor-pointer"
              >
                تأكيد الحذف النهائي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
