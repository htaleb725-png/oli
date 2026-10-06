import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { CustomSection, CustomSectionRecord, CustomFieldDefinition, CustomFieldType } from '../types';
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
  AlertCircle,
  ArrowRight,
  BarChart3,
  LayoutDashboard,
  Table as TableIcon,
  Sliders,
  Settings2,
  FolderOpen,
  PieChart as PieIcon,
  Clock,
  Sparkles,
  ShieldCheck,
  Check
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Cell, 
  PieChart, 
  Pie 
} from 'recharts';
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
    updateCustomSection,
    currentUser,
    systemSettings,
    setActiveSection
  } = useApp();

  const isDeveloper = currentUser?.Role === 'developer';
  const isAuthorizedToEditSchema = isDeveloper || currentUser?.Role === 'director' || currentUser?.Role === 'admin';

  const section = propSection || customSections.find(s => s.id === sectionId);

  // Sub-navigation within this department
  const [activeTab, setActiveTab] = useState<'dashboard' | 'records' | 'gallery'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CustomSectionRecord | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showFieldBuilderModal, setShowFieldBuilderModal] = useState(false);

  // Field Builder state (for adding new field)
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');
  const [newFieldOptionsRaw, setNewFieldOptionsRaw] = useState('');

  // Form state
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  if (!section) {
    return (
      <div className="p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-4" dir="rtl">
        <h3 className="text-base font-black text-slate-800 dark:text-white">هذا القسم المخصص غير متوفر أو تم حذفه من قبل المطور</h3>
        <button
          onClick={() => setActiveSection('dashboard')}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-sm flex items-center gap-2 mx-auto"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للشاشة الرئيسية</span>
        </button>
      </div>
    );
  }

  // Filter records belonging to this section
  const sectionRecords = useMemo(() => {
    return customRecords.filter(r => r.sectionId === section.id);
  }, [customRecords, section.id]);

  // Search filter
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return sectionRecords;
    const q = searchQuery.toLowerCase();
    return sectionRecords.filter(record => 
      Object.values(record.data || {}).some(val => 
        typeof val === 'string' && val.toLowerCase().includes(q)
      ) || (record.createdBy && record.createdBy.toLowerCase().includes(q))
    );
  }, [sectionRecords, searchQuery]);

  // Statistics calculation for the department dashboard
  const stats = useMemo(() => {
    const total = sectionRecords.length;
    const todayStr = new Date().toLocaleDateString('ar-IQ');
    const todayCount = sectionRecords.filter(r => r.createdAt && r.createdAt.includes(todayStr)).length;
    
    // Count records with images
    const imageFieldIds = section.fields.filter(f => f.type === 'image').map(f => f.id);
    const withImagesCount = sectionRecords.filter(r => 
      imageFieldIds.some(fId => Boolean(r.data?.[fId]))
    ).length;

    // First dropdown field breakdown
    const firstDropdownField = section.fields.find(f => f.type === 'dropdown');
    let breakdown: { name: string; count: number }[] = [];
    if (firstDropdownField) {
      const counts: Record<string, number> = {};
      sectionRecords.forEach(r => {
        const val = r.data?.[firstDropdownField.id] || 'غير محدد';
        counts[val] = (counts[val] || 0) + 1;
      });
      breakdown = Object.entries(counts).map(([name, count]) => ({ name, count }));
    }

    return {
      total,
      todayCount,
      withImagesCount,
      breakdown,
      firstDropdownLabel: firstDropdownField?.label || 'الفئات'
    };
  }, [sectionRecords, section.fields]);

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

    if (file.size > 3 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، يرجى اختيار صورة أصغر من 3 ميغابايت');
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

  // Add new field to this section schema
  const handleAddNewField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim()) return;

    const newFieldId = `f_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const parsedOptions = newFieldType === 'dropdown' 
      ? newFieldOptionsRaw.split(',').map(o => o.trim()).filter(Boolean)
      : undefined;

    const newField: CustomFieldDefinition = {
      id: newFieldId,
      name: newFieldId,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      placeholder: newFieldPlaceholder.trim() || undefined,
      options: parsedOptions
    };

    const updatedSection: CustomSection = {
      ...section,
      fields: [...section.fields, newField],
      updatedAt: new Date().toISOString()
    };

    updateCustomSection(updatedSection);
    setNewFieldLabel('');
    setNewFieldPlaceholder('');
    setNewFieldOptionsRaw('');
    setNewFieldRequired(false);
    setShowFieldBuilderModal(false);
  };

  // Delete field from this section schema
  const handleDeleteField = (fieldId: string, fieldLabel: string) => {
    if (section.fields.length <= 1) {
      alert('يجب الإبقاء على حقل واحد على الأقل في هذا القسم');
      return;
    }
    if (window.confirm(`هل أنت متأكد من حذف الحقل "${fieldLabel}"؟ لن تظهر بيانات هذا الحقل في السجلات الجديدة.`)) {
      const updatedSection: CustomSection = {
        ...section,
        fields: section.fields.filter(f => f.id !== fieldId),
        updatedAt: new Date().toISOString()
      };
      updateCustomSection(updatedSection);
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
        if (f.type !== 'image') {
          rowObj[f.label] = r.data[f.id] || '-';
        } else {
          rowObj[f.label] = r.data[f.id] ? 'يحتوي على صورة/مستند' : 'بدون صورة';
        }
      });
      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, section.title.slice(0, 30));
    XLSX.writeFile(workbook, `${section.title}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrintReport = () => {
    window.print();
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

  const COLORS = ['#f59e0b', '#0ea5e9', '#10b981', '#8b5cf6', '#ec4899', '#f97316'];

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      {/* Top Isolated Department Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 text-white">
        
        {/* Left Side: Back Button & Section Identity */}
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => setActiveSection('dashboard')}
            className="group px-4 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 text-amber-400 font-black text-xs border border-amber-500/30 shadow-lg transition-all cursor-pointer flex items-center gap-2 active:scale-95"
            title="الرجوع إلى لوحة الأقسام والشاشة الرئيسية"
          >
            <ArrowRight className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>زر رجوع للأقسام الرئيسية</span>
          </button>

          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center text-3xl font-black shadow-inner">
            {section.icon || '📁'}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>قسم إداري مستقل متكامل</span>
              </span>
              <span className="text-xs text-slate-400 font-bold">
                {sectionRecords.length} سجل مقيد
              </span>
              <span className="text-xs text-slate-500">|</span>
              <span className="text-xs text-slate-400">
                {section.fields.length} حقل مخصص
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black mt-1 tracking-tight text-white flex items-center gap-2">
              <span>{section.title}</span>
            </h2>
            {section.description && (
              <p className="text-xs text-slate-400 mt-1 max-w-xl line-clamp-1">
                {section.description}
              </p>
            )}
          </div>
        </div>

        {/* Right Side: Quick Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isAuthorizedToEditSchema && (
            <button
              onClick={() => setShowFieldBuilderModal(true)}
              className={`rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold flex items-center gap-1.5 transition-all cursor-pointer ${btnSizeClass}`}
              title="تعديل، إضافة أو حذف حقول هذا القسم بدون كود"
            >
              <Settings2 className="w-4 h-4 text-indigo-400" />
              <span>إدارة حقول القسم</span>
            </button>
          )}

          <button
            onClick={exportToExcel}
            className={`rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer ${btnSizeClass}`}
            title="تصدير السجلات إلى ملف Excel شامل"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>تصدير Excel</span>
          </button>

          <button
            onClick={handlePrintReport}
            className={`rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer ${btnSizeClass}`}
            title="طباعة تقرير القسم"
          >
            <Printer className="w-4 h-4 text-sky-400" />
            <span>طباعة</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className={`rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95 ${btnSizeClass}`}
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل قيد جديد</span>
          </button>
        </div>
      </div>

      {/* Department Navigation Tabs (داش بورد واحصائيات / السجلات / معرض الصور) */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-xl">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>داش بورد وإحصائيات القسم</span>
        </button>

        <button
          onClick={() => setActiveTab('records')}
          className={`flex-1 py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'records'
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <TableIcon className="w-4 h-4" />
          <span>سجل البيانات والبحث ({sectionRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('gallery')}
          className={`flex-1 py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'gallery'
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>معرض الصور والمرفقات</span>
        </button>
      </div>

      {/* TAB 1: Department Dashboard & Statistics (داش بورد واحصائيات) */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Action Icons Grid inside the Department */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button
              onClick={handleOpenAdd}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-amber-500/60 hover:shadow-lg transition-all text-right group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">تسجيل جديد</h4>
              <p className="text-[11px] text-slate-500 mt-1">إدخال معاملة جديدة بالقسم</p>
            </button>

            <button
              onClick={() => setActiveTab('records')}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-sky-500/60 hover:shadow-lg transition-all text-right group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">بحث واستعلام</h4>
              <p className="text-[11px] text-slate-500 mt-1">فلترة واستعراض السجلات</p>
            </button>

            <button
              onClick={() => setActiveTab('gallery')}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-500/60 hover:shadow-lg transition-all text-right group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <ImageIcon className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">الصور والوثائق</h4>
              <p className="text-[11px] text-slate-500 mt-1">{stats.withImagesCount} مستند محفوظ</p>
            </button>

            {isAuthorizedToEditSchema && (
              <button
                onClick={() => setShowFieldBuilderModal(true)}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-500/60 hover:shadow-lg transition-all text-right group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Sliders className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">تخصيص الحقول</h4>
                <p className="text-[11px] text-slate-500 mt-1">إضافة/حذف حقول بدون كود</p>
              </button>
            )}
          </div>

          {/* Department KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">إجمالي السجلات المقيدة</span>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                  {section.icon || '📁'}
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                {stats.total}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>محفوظة مباشرة بقاعدة البيانات</span>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">سجلات اليوم</span>
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                {stats.todayCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                مدخلات اليوم في قسم {section.title}
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">مستندات وصور مرفقة</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                  <ImageIcon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                {stats.withImagesCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                معاملات تتضمن صوراً أو وثائق
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">حقول القسم الفعالة</span>
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
                  <Sliders className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                {section.fields.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                قابلة للتوسعة والإضافة في أي وقت
              </div>
            </div>
          </div>

          {/* Interactive Visual Statistics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Breakdown by Status / Dropdown Field */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    توزيع السجلات حسب: {stats.firstDropdownLabel}
                  </h4>
                  <p className="text-[11px] text-slate-500">إحصائية مرئية تفاعلية للقسم</p>
                </div>
                <BarChart3 className="w-4 h-4 text-amber-500" />
              </div>

              {stats.breakdown.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs text-center space-y-2">
                  <FolderOpen className="w-8 h-8 opacity-40" />
                  <span>لا توجد بيانات كافية للرسم البياني بعد</span>
                </div>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.breakdown}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]}>
                        {stats.breakdown.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Quick Schema Overview for this Section */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      مخطط حقول القسم الحالي ({section.fields.length} حقول)
                    </h4>
                    <p className="text-[11px] text-slate-500">الحقول النشطة التي يملأها الموظف عند التسجيل</p>
                  </div>
                  {isAuthorizedToEditSchema && (
                    <button
                      onClick={() => setShowFieldBuilderModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إدراج حقل جديد</span>
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-52 overflow-y-auto pr-1">
                  {section.fields.map(f => (
                    <div key={f.id} className="py-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="font-bold text-slate-800 dark:text-slate-200">{f.label}</span>
                        {f.required && (
                          <span className="text-[10px] text-rose-500 font-bold">(إلزامي)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500">
                          {f.type === 'text' && 'نص'}
                          {f.type === 'number' && 'رقم'}
                          {f.type === 'dropdown' && 'قائمة خيارات'}
                          {f.type === 'image' && 'صورة / مستند'}
                          {f.type === 'date' && 'تاريخ'}
                          {f.type === 'textarea' && 'ملاحظات مطولة'}
                          {f.type === 'checkbox' && 'مربع تأكيد'}
                        </span>
                        {isAuthorizedToEditSchema && (
                          <button
                            onClick={() => handleDeleteField(f.id, f.label)}
                            className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                            title="حذف هذا الحقل من القسم"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span>يتم حفظ جميع التغييرات في الحقول مباشرة بقاعدة البيانات</span>
                <span className="text-amber-500 font-bold">بدون الحاجة لأي كود برمجي</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Records Table & Search */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex-wrap">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث سريع في كافة حقول وسجلات القسم..."
                className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500">
                عرض {filteredRecords.length} من أصل {sectionRecords.length}
              </span>
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة سجل جديد</span>
              </button>
            </div>
          </div>

          {/* Records Table */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {filteredRecords.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-2xl">
                  {section.icon || '📂'}
                </div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  لا توجد سجلات مسجلة في قسم {section.title} حتى الآن
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  اضغط على زر &quot;إضافة سجل جديد&quot; للبدء بإدخال البيانات مع الصور والمرفقات والقوائم المنسدلة.
                </p>
                <button
                  onClick={handleOpenAdd}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer hover:bg-amber-400"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة أول سجل الآن</span>
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
                            <td key={field.id} className="p-3.5 font-medium whitespace-nowrap max-w-xs truncate">
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
        </div>
      )}

      {/* TAB 3: Photo & Document Gallery (معرض الصور والمرفقات) */}
      {activeTab === 'gallery' && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h4 className="text-sm font-black text-slate-900 dark:text-white mb-2">
              معرض المستندات والوثائق والصور المرفقة بقسم {section.title}
            </h4>
            <p className="text-xs text-slate-500 mb-6">
              استعراض كافة الصور والمستندات المحفوظة مع إمكانية التكبير والمعاينة الفورية
            </p>

            {stats.withImagesCount === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                <ImageIcon className="w-10 h-10 mx-auto opacity-30 mb-2" />
                <span>لا توجد صور أو وثائق مرفقة في هذا القسم بعد</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {sectionRecords.map(record => {
                  const imageField = section.fields.find(f => f.type === 'image' && Boolean(record.data?.[f.id]));
                  if (!imageField) return null;
                  const imgUrl = record.data[imageField.id];

                  return (
                    <div
                      key={record.id}
                      onClick={() => setViewingImage(imgUrl)}
                      className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 aspect-square cursor-pointer hover:border-amber-500 transition-all hover:scale-105 shadow-sm"
                    >
                      <img src={imgUrl} alt="Attached" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col justify-end p-2 transition-opacity text-white text-[10px]">
                        <span className="font-bold truncate">{record.data[section.fields[0]?.id] || 'سجل'}</span>
                        <span className="text-[9px] text-slate-300 font-mono">{record.createdAt}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Record Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in" dir="rtl">
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
                          {field.label} (أيقونة رفع وحفظ الصور والمستندات) {field.required && <span className="text-rose-500">*</span>}
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
                              يدعم صيغ JPG و PNG. يتم الحفظ مشفراً في قاعدة البيانات Firestore.
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

      {/* Field Designer & Schema Builder Modal (إضافة وحذف وإدراج حقول بدون كود) */}
      {showFieldBuilderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in" dir="rtl">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    تخصيص وإدارة حقول {section.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    أضف حقولاً جديدة أو احذف حقولاً موجودة ويتم حفظها مباشرة بقاعدة البيانات
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFieldBuilderModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Existing Fields List */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-700 dark:text-slate-300">
                الحقول الموجودة حالياً ({section.fields.length}):
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 max-h-48 overflow-y-auto">
                {section.fields.map(f => (
                  <div key={f.id} className="py-2 px-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{f.label}</span>
                      <span className="mr-2 text-[10px] text-slate-500">({f.type})</span>
                      {f.required && <span className="mr-2 text-[10px] text-rose-500 font-bold">*إلزامي</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteField(f.id, f.label)}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>حذف</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Form to Add New Field */}
            <form onSubmit={handleAddNewField} className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                <span>إدراج حقل جديد لهذا القسم</span>
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم الحقل (العنوان المعروض للموظف) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    placeholder="مثال: رقم بطاقة الرعاية، اسم المختار، صلة القرابة..."
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نوع الحقل
                    </label>
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value as CustomFieldType)}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                    >
                      <option value="text">نص عادي (Text)</option>
                      <option value="number">رقم (Number)</option>
                      <option value="dropdown">قائمة خيارات منسدلة (Dropdown)</option>
                      <option value="image">صورة / مستند مرفق (Image)</option>
                      <option value="date">تاريخ (Date)</option>
                      <option value="textarea">ملاحظات وشرح مطول (Textarea)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نص توضيحي داخل الحقل (Placeholder)
                    </label>
                    <input
                      type="text"
                      value={newFieldPlaceholder}
                      onChange={(e) => setNewFieldPlaceholder(e.target.value)}
                      placeholder="أدخل القيمة..."
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {newFieldType === 'dropdown' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      خيارات القائمة المنسدلة (مفصولة بفارزة ,)
                    </label>
                    <input
                      type="text"
                      value={newFieldOptionsRaw}
                      onChange={(e) => setNewFieldOptionsRaw(e.target.value)}
                      placeholder="مشمول, قيد التدقيق, مستبعد, استثناء خاص"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={newFieldRequired}
                    onChange={(e) => setNewFieldRequired(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    حقل إلزامي (يجب على الموظف إدخاله لإتمام الحفظ)
                  </span>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFieldBuilderModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  إضافة الحقل وحفظه بقاعدة البيانات
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
