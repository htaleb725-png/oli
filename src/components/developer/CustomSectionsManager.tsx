import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CustomSection, CustomFieldDefinition, CustomFieldType } from '../../types';
import { 
  FolderPlus, 
  Trash2, 
  Edit3, 
  Plus, 
  Layers, 
  ExternalLink, 
  AlertTriangle,
  FolderKanban,
  CheckCircle,
  X,
  FileText,
  Image as ImageIcon,
  Calendar,
  Hash,
  ListFilter
} from 'lucide-react';

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

  // Form states
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionDescription, setSectionDescription] = useState('');
  const [sectionColor, setSectionColor] = useState('blue');
  const [fields, setFields] = useState<CustomFieldDefinition[]>([
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
  ]);

  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');

  const handleAddField = () => {
    if (!newFieldLabel.trim()) return;
    const newField: CustomFieldDefinition = {
      id: `f_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: `field_${Date.now().toString().slice(-4)}`,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      placeholder: newFieldPlaceholder.trim() || undefined,
      options: newFieldType === 'dropdown' 
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

  const handleOpenCreateModal = () => {
    setEditingSection(null);
    setSectionTitle('');
    setSectionDescription('');
    setSectionColor('blue');
    setFields([
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
        options: ['عام', 'خاص', 'عاجل']
      },
      {
        id: 'f_3',
        name: 'attachment',
        label: 'صورة المرفق أو المعاملة',
        type: 'image',
        required: false
      },
      {
        id: 'f_4',
        name: 'details',
        label: 'محتوى وتفاصيل القسم',
        type: 'textarea',
        required: false
      }
    ]);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (sec: CustomSection) => {
    setEditingSection(sec);
    setSectionTitle(sec.title);
    setSectionDescription(sec.description || '');
    setSectionColor(sec.badgeColor || 'blue');
    setFields(sec.fields || []);
    setIsCreateModalOpen(true);
  };

  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionTitle.trim()) return;

    if (editingSection) {
      updateCustomSection({
        ...editingSection,
        title: sectionTitle.trim(),
        description: sectionDescription.trim(),
        badgeColor: sectionColor,
        fields
      });
    } else {
      addCustomSection({
        title: sectionTitle.trim(),
        description: sectionDescription.trim(),
        badgeColor: sectionColor,
        fields
      });
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
      {/* Header & Description */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-indigo-600" />
            <span>باني الأقسام المخصصة والحقول الديناميكية للمطور</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            يمكنك كمطور إضافة أي قسم مخصص جديد للمنظومة مع حقول مخصصة (نصوص، قوائم منسدلة، رفع صور وربطها بالمحتوى، تواريخ). 
            عند حذف أي قسم، يتم حذف كافة السجلات المرتبطة به تلقائياً وبشكل قطعي دون الرجوع للكود.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <FolderPlus className="w-4 h-4" />
          <span>إنشاء قسم جديد مخصص</span>
        </button>
      </div>

      {/* Sections List */}
      {customSections.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
            <Layers className="w-7 h-7" />
          </div>
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">لا توجد أقسام مخصصة مضافة حالياً</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            أنت المطور ولديك الصلاحية الكاملة لإضافة أي قسم إداري جديد، مع تخصيص حقوله (قوائم منسدلة، رفع صور، نصوص) ليظهر فورياً في لوحة المنظومة.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-all cursor-pointer mt-2"
          >
            + إضافة أول قسم مخصص الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customSections.map((sec) => {
            const recordsCount = customRecords.filter(r => r.sectionId === sec.id).length;
            return (
              <div 
                key={sec.id} 
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {recordsCount} سجل مخزن
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ID: {sec.id}
                    </span>
                  </div>

                  <h4 className="text-base font-black text-slate-900 dark:text-white mt-2">
                    {sec.title}
                  </h4>
                  {sec.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {sec.description}
                    </p>
                  )}

                  {/* Fields Summary */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
                      الحقول المخصصة ({sec.fields?.length || 0}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {sec.fields?.map((f) => (
                        <span 
                          key={f.id}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          {f.label} ({f.type === 'dropdown' ? 'قائمة' : f.type === 'image' ? 'صورة' : f.type === 'textarea' ? 'نص' : f.type})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(sec)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                      title="تعديل بيانات وحقول القسم"
                    >
                      <Edit3 className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmSection(sec)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 text-xs font-bold transition-colors cursor-pointer"
                      title="حذف القسم وجميع بياناته المسجلة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSection(`custom_section_${sec.id}`)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>فتح واستعراض القسم</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create or Edit Section */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-indigo-600" />
                <span>{editingSection ? 'تعديل بيانات وحقول القسم المخصص' : 'إنشاء قسم مخصص جديد بدون الرجوع للكود'}</span>
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
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  اسم أو عنوان القسم *
                </label>
                <input
                  type="text"
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                  placeholder="مثال: قسم المنح والمساعدات الخاصة، قسم الرقابة الصحية، الخ..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  وصف مختصر لمهام القسم
                </label>
                <input
                  type="text"
                  value={sectionDescription}
                  onChange={(e) => setSectionDescription(e.target.value)}
                  placeholder="توضيح موجز لاختصاصات هذا القسم..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              {/* Fields Builder */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ListFilter className="w-4 h-4 text-indigo-600" />
                    <span>حقول القسم المخصصة ({fields.length}):</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    يمكنك إضافة نصوص، قوائم منسدلة، أو حقل رفع صور
                  </span>
                </div>

                {/* Existing Fields List */}
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
                            ({f.type === 'dropdown' ? `قائمة: ${f.options?.join(', ')}` : f.type === 'image' ? 'أيقونة رفع صور وحفظها' : f.type})
                          </span>
                          {f.required && (
                            <span className="text-[10px] text-rose-500 font-bold mr-1">* إجباري</span>
                          )}
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

                {/* Add Field Inline Box */}
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
                      <option value="image">أيقونة رفع صور وحفظها (Image Upload)</option>
                      <option value="date">تاريخ (Date)</option>
                      <option value="textarea">شرح أو نص متعدد الأسطر (Textarea)</option>
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
                  {editingSection ? 'حفظ التعديلات على القسم' : 'اعتماد وإنشاء القسم فورياً'}
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
                تنبيه: سيتم حذف كافة السجلات والبيانات والصور المرتبطة بهذا القسم من قاعدة البيانات السحابية Firebase و Google Sheets بصورة قطعية.
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
