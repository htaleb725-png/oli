import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CustomSection, CustomSectionRecord, CustomFieldDefinition } from '../types';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Download, 
  Printer, 
  Upload, 
  Image as ImageIcon, 
  X, 
  FileText, 
  Calendar, 
  Hash, 
  Layers,
  ChevronDown,
  Eye,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface DynamicSectionViewProps {
  section?: CustomSection;
  sectionId?: string;
}

export const DynamicSectionView: React.FC<DynamicSectionViewProps> = ({ section: propSection, sectionId }) => {
  const { 
    customSections,
    customRecords, 
    addCustomRecord, 
    updateCustomRecord, 
    deleteCustomRecord,
    currentUser,
    systemSettings,
    setActiveSection
  } = useApp();

  const section = propSection || customSections.find(s => s.id === sectionId);

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CustomSectionRecord | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  if (!section) {
    return (
      <div className="p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
        <h3 className="text-base font-black text-slate-800 dark:text-white">هذا القسم المخصص غير متوفر أو تم حذفه من قبل المطور</h3>
        <button
          onClick={() => setActiveSection('dashboard')}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs cursor-pointer shadow-sm"
        >
          العودة للشاشة الرئيسية
        </button>
      </div>
    );
  }

  // Filter records belonging to this section
  const sectionRecords = customRecords.filter(r => r.sectionId === section.id);

  // Search filter
  const filteredRecords = sectionRecords.filter(record => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(record.data || {}).some(val => 
      typeof val === 'string' && val.toLowerCase().includes(q)
    );
  });

  const handleOpenAdd = () => {
    const initial: Record<string, any> = {};
    section.fields.forEach(f => {
      initial[f.id] = f.type === 'number' ? '' : '';
    });
    setFormData(initial);
    setFormErrors({});
    setEditingRecord(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (rec: CustomSectionRecord) => {
    setFormData({ ...rec.data });
    setFormErrors({});
    setEditingRecord(rec);
    setShowAddModal(true);
  };

  const handleImageUpload = (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 2MB for storage)
    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، يرجى اختيار صورة أصغر من 2 ميغابايت');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFormData(prev => ({
        ...prev,
        [fieldId]: base64
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    section.fields.forEach(f => {
      if (f.required && (!formData[f.id] || String(formData[f.id]).trim() === '')) {
        errors[f.id] = `حقل "${f.label}" مطلوب`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (editingRecord) {
      updateCustomRecord({
        ...editingRecord,
        data: formData,
        updatedAt: new Date().toISOString()
      });
    } else {
      addCustomRecord({
        sectionId: section.id,
        data: formData,
        createdBy: currentUser?.FullName || 'موظف النظام'
      });
    }

    setShowAddModal(false);
    setFormData({});
  };

  const handleDelete = (id: string) => {
    if (window.confirm('هل أنت متأكد من رغبتك بحذف هذا السجل نهائياً؟')) {
      deleteCustomRecord(id);
    }
  };

  const exportToExcel = () => {
    if (sectionRecords.length === 0) {
      alert('لا توجد سجلات لتصديرها');
      return;
    }

    const rows = sectionRecords.map((r, idx) => {
      const rowObj: Record<string, any> = {
        '#': idx + 1,
        'تاريخ الإدخال': r.createdAt,
        'مسؤول الإدخال': r.createdBy || '-'
      };
      section.fields.forEach(f => {
        rowObj[f.label] = r.data[f.id] || '-';
      });
      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, section.title.slice(0, 30));
    XLSX.writeFile(workbook, `${section.title}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Button styling based on uiCustomizations
  const btnSizeClass = systemSettings.uiCustomizations?.buttonSize === 'large' 
    ? 'h-11 px-5 text-sm' 
    : systemSettings.uiCustomizations?.buttonSize === 'compact' 
      ? 'h-8 px-3 text-xs' 
      : 'h-9 px-4 text-xs';

  const inputSizeClass = systemSettings.uiCustomizations?.inputFieldSize === 'large'
    ? 'py-3 text-sm'
    : systemSettings.uiCustomizations?.inputFieldSize === 'compact'
      ? 'py-1.5 text-xs'
      : 'py-2 text-xs';

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-2xl font-black shadow-inner">
            {section.icon || '📁'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                قسم مخصص ديناميكي
              </span>
              <span className="text-xs text-slate-400">
                {sectionRecords.length} سجل مسجل
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black mt-1">
              {section.title}
            </h2>
            {section.description && (
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                {section.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportToExcel}
            className={`rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer ${btnSizeClass}`}
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>تصدير Excel</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className={`rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95 ${btnSizeClass}`}
          >
            <Plus className="w-4 h-4" />
            <span>إضافة سجل جديد</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في سجلات القسم..."
            className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="text-xs font-bold text-slate-500">
          عرض {filteredRecords.length} من أصل {sectionRecords.length}
        </div>
      </div>

      {/* Records Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-2xl">
              📂
            </div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              لا توجد سجلات مسجلة في هذا القسم حتى الآن
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              اضغط على زر &quot;إضافة سجل جديد&quot; للبدء بإدخال البيانات مع الصور والمرفقات والقوائم المنسدلة.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer hover:bg-amber-400"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة أول سجل</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-black">
                <tr>
                  <th className="p-3.5 text-center w-12">#</th>
                  {section.fields.map(f => (
                    <th key={f.id} className="p-3.5 whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                  <th className="p-3.5 whitespace-nowrap">تاريخ الإدخال</th>
                  <th className="p-3.5 whitespace-nowrap">بواسطة</th>
                  <th className="p-3.5 text-center w-24">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRecords.map((record, index) => (
                  <tr 
                    key={record.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors text-slate-800 dark:text-slate-200"
                  >
                    <td className="p-3.5 text-center font-mono text-slate-400">
                      {index + 1}
                    </td>

                    {section.fields.map(field => {
                      const val = record.data?.[field.id];

                      if (field.type === 'image') {
                        return (
                          <td key={field.id} className="p-3.5">
                            {val ? (
                              <button
                                type="button"
                                onClick={() => setViewingImage(val)}
                                className="group relative w-10 h-10 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:scale-105 transition-transform cursor-pointer"
                                title="عرض الصورة بالحجم الكامل"
                              >
                                <img src={val} alt={field.label} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px]">
                                  <Eye className="w-3.5 h-3.5" />
                                </div>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                        );
                      }

                      return (
                        <td key={field.id} className="p-3.5 font-medium whitespace-nowrap">
                          {val !== undefined && val !== null && String(val) !== '' 
                            ? String(val) 
                            : <span className="text-slate-400">-</span>
                          }
                        </td>
                      );
                    })}

                    <td className="p-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {record.createdAt}
                    </td>

                    <td className="p-3.5 text-slate-500 whitespace-nowrap">
                      {record.createdBy || '-'}
                    </td>

                    <td className="p-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(record)}
                          className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 flex items-center justify-center transition-colors cursor-pointer"
                          title="تعديل السجل"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(record.id)}
                          className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 flex items-center justify-center transition-colors cursor-pointer"
                          title="حذف السجل"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Record Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                  {editingRecord ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {editingRecord ? `تعديل سجل في ${section.title}` : `إضافة سجل جديد إلى ${section.title}`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    املأ الحقول التالية مع إمكانية رفع الصور والمرفقات
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Dynamic Form */}
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {section.fields.map(field => {
                  const error = formErrors[field.id];

                  if (field.type === 'dropdown') {
                    const options = field.options || [];
                    return (
                      <div key={field.id} className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          {field.label} {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        <select
                          value={formData[field.id] || ''}
                          onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          className={`w-full px-3.5 bg-slate-50 dark:bg-slate-800/90 border rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500 ${inputSizeClass} ${
                            error ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <option value="">-- اختر من القائمة --</option>
                          {options.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                        {error && <p className="text-[11px] text-rose-500 font-bold">{error}</p>}
                      </div>
                    );
                  }

                  if (field.type === 'image') {
                    const imgVal = formData[field.id];
                    return (
                      <div key={field.id} className="sm:col-span-2 space-y-1.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          {field.label} (أيقونة رفع وحفظ الصور) {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        
                        <div className="flex items-center gap-4">
                          {imgVal ? (
                            <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-amber-500 shadow-md">
                              <img src={imgVal} alt="Uploaded" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, [field.id]: '' }))}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs cursor-pointer shadow-md"
                                title="إلغاء الصورة"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 text-xs">
                              <ImageIcon className="w-6 h-6 mb-1 text-slate-400" />
                              <span>لا توجد صورة</span>
                            </div>
                          )}

                          <div className="flex-1 space-y-2">
                            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer transition-all shadow-sm">
                              <Upload className="w-4 h-4" />
                              <span>{imgVal ? 'استبدال الصورة' : 'رفع صورة من الجهاز أو الكاميرا'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(field.id, e)}
                                className="hidden"
                              />
                            </label>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              يدعم صيغ JPG و PNG. يتم الحفظ مشفراً في قاعدة البيانات.
                            </p>
                          </div>
                        </div>
                        {error && <p className="text-[11px] text-rose-500 font-bold">{error}</p>}
                      </div>
                    );
                  }

                  if (field.type === 'textarea') {
                    return (
                      <div key={field.id} className="sm:col-span-2 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          {field.label} {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        <textarea
                          rows={3}
                          value={formData[field.id] || ''}
                          onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          placeholder={field.placeholder || `أدخل ${field.label}...`}
                          className={`w-full px-3.5 bg-slate-50 dark:bg-slate-800/90 border rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500 py-2 ${
                            error ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                          }`}
                        />
                        {error && <p className="text-[11px] text-rose-500 font-bold">{error}</p>}
                      </div>
                    );
                  }

                  return (
                    <div key={field.id} className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        value={formData[field.id] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                        placeholder={field.placeholder || `أدخل ${field.label}...`}
                        className={`w-full px-3.5 bg-slate-50 dark:bg-slate-800/90 border rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500 ${inputSizeClass} ${
                          error ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                        }`}
                      />
                      {error && <p className="text-[11px] text-rose-500 font-bold">{error}</p>}
                    </div>
                  );
                })}
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
                >
                  {editingRecord ? 'حفظ التعديلات' : 'إضافة وحفظ السجل الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Image Preview Modal */}
      {viewingImage && (
        <div 
          onClick={() => setViewingImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md cursor-pointer animate-in fade-in"
        >
          <div className="relative max-w-3xl max-h-[85vh] overflow-hidden rounded-3xl bg-black border border-slate-800 shadow-2xl">
            <button
              onClick={() => setViewingImage(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 text-white hover:bg-white/40 flex items-center justify-center text-sm font-bold z-10"
            >
              ✕
            </button>
            <img 
              src={viewingImage} 
              alt="Full Preview" 
              className="w-full h-full object-contain max-h-[85vh]" 
            />
          </div>
        </div>
      )}
    </div>
  );
};
