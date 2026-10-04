import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Palette, 
  Image as ImageIcon, 
  Upload, 
  RotateCcw, 
  CheckCircle2, 
  Save, 
  Edit3, 
  Layers,
  Sparkles,
  Building2,
  Trash2,
  Check
} from 'lucide-react';

interface DefaultTileConfig {
  id: string;
  defaultTitle: string;
  defaultSubtitle: string;
  defaultIcon: string;
}

const DEFAULT_SYSTEM_TILES: DefaultTileConfig[] = [
  { id: 'tile_reception', defaultTitle: 'قسم الاستعلامات والمراجعين', defaultSubtitle: 'تسجيل واستعلام وتوثيق المراجعين', defaultIcon: 'UserPlus' },
  { id: 'tile_admin', defaultTitle: 'قسم الإدارة والمعاملات', defaultSubtitle: 'المعاملات الحكومية والمخاطبات والكتب', defaultIcon: 'FolderKanban' },
  { id: 'tile_director', defaultTitle: 'قسم مدير المكتب التنفيذي', defaultSubtitle: 'اعتماد وتوجيه وارد الاستعلامات والإشراف', defaultIcon: 'Briefcase' },
  { id: 'tile_interviews', defaultTitle: 'قسم مقابلات النائب', defaultSubtitle: 'جدول مواعيد النائب وتوثيق الهوامش', defaultIcon: 'Handshake' },
  { id: 'tile_organization', defaultTitle: 'قسم التنظيم والجماهير', defaultSubtitle: 'شؤون العشائر والموقف الجماهيري', defaultIcon: 'Users2' },
  { id: 'tile_machine', defaultTitle: 'قسم المكنة والطباعة', defaultSubtitle: 'طباعة الكتب الرسمية والصادر والوارد', defaultIcon: 'Printer' },
  { id: 'tile_search_archive', defaultTitle: 'قسم البحث الشامل والأرشيف', defaultSubtitle: 'البحث الفوري واستخراج السجلات وطباعة الهوية', defaultIcon: 'Search' },
  { id: 'tile_drive_requests', defaultTitle: 'أرشيف طلبات Google Drive', defaultSubtitle: 'مزامنة وتنزيل وأرشفة المستندات السحابية', defaultIcon: 'CloudDownload' },
  { id: 'tile_reports', defaultTitle: 'قسم التقارير والإحصائيات', defaultSubtitle: 'مؤشرات الإنجاز، التحليلات، وسحب Excel', defaultIcon: 'BarChart3' },
  { id: 'tile_audit', defaultTitle: 'قسم الرقابة والتدقيق والمتابعة', defaultSubtitle: 'الحوكمة وسجل النشاطات والمتابعة الميدانية', defaultIcon: 'ShieldCheck' },
  { id: 'tile_whatsapp', defaultTitle: 'مراسلات الواتساب التلقائية', defaultSubtitle: 'إشعار وتحديث المراجعين فورياً بالرسائل', defaultIcon: 'MessageSquare' },
];

export const SystemIconsStudio: React.FC = () => {
  const { systemSettings, updateSettings } = useApp();

  const [tilesConfig, setTilesConfig] = useState<Record<string, { title: string; subtitle?: string; iconUrl?: string }>>(
    systemSettings.customTilesConfig || {}
  );

  // App Identity states
  const [appName, setAppName] = useState(systemSettings.appName || 'برنامج مكتب النائب علا الناشي');
  const [deputyName, setDeputyName] = useState(systemSettings.deputyName || 'النائب المهندسة علا عودة الناشي');
  const [deputyTitle, setDeputyTitle] = useState(systemSettings.deputyTitle || 'عضو مجلس النواب العراقي');
  const [logoUrl, setLogoUrl] = useState(systemSettings.logoUrl || '');
  const [parliamentEmblemUrl, setParliamentEmblemUrl] = useState(systemSettings.parliamentEmblemUrl || '');

  const [activeTileId, setActiveTileId] = useState<string | null>(null);
  const [editTileTitle, setEditTileTitle] = useState('');
  const [editTileSubtitle, setEditTileSubtitle] = useState('');
  const [editTileIconUrl, setEditTileIconUrl] = useState('');

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Handle Logo Upload (Base64)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Parliament Emblem Upload
  const handleEmblemUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setParliamentEmblemUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Tile Icon Image Upload
  const handleTileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditTileIconUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenEditTile = (tile: DefaultTileConfig) => {
    setActiveTileId(tile.id);
    const existing = tilesConfig[tile.id];
    setEditTileTitle(existing?.title || tile.defaultTitle);
    setEditTileSubtitle(existing?.subtitle || tile.defaultSubtitle);
    setEditTileIconUrl(existing?.iconUrl || '');
  };

  const handleSaveTileEdit = () => {
    if (!activeTileId) return;
    const updated = {
      ...tilesConfig,
      [activeTileId]: {
        title: editTileTitle.trim(),
        subtitle: editTileSubtitle.trim(),
        iconUrl: editTileIconUrl.trim() || undefined
      }
    };
    setTilesConfig(updated);
    setActiveTileId(null);
  };

  const handleResetTile = (tileId: string) => {
    const next = { ...tilesConfig };
    delete next[tileId];
    setTilesConfig(next);
  };

  const handleSaveAllIdentityAndTiles = () => {
    updateSettings({
      appName: appName.trim(),
      deputyName: deputyName.trim(),
      deputyTitle: deputyTitle.trim(),
      logoUrl: logoUrl.trim(),
      parliamentEmblemUrl: parliamentEmblemUrl.trim(),
      customTilesConfig: tilesConfig
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-500/10 via-fuchsia-500/10 to-indigo-500/5 border border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black shadow-md shadow-purple-600/20">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>استوديو تخصيص أسماء وأيقونات وهوية المنظومة للمطور</span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold border border-purple-200">
                تحكم مطلق 100% 🎨
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              يمكنك هنا تغيير اسم وصورة وشعار أي قسم أو أيقونة في المنظومة بالكامل، وتعديل اسم النائب والبرنامج وصورته بدون الرجوع للكود البرمجي مع حفظها فورياً للجميع.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveAllIdentityAndTiles}
          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>حفظ التعديلات وتطبيقها فوراً</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>تم حفظ وتطبيق كافة الأسماء والصور والأيقونات بنجاح على المنظومة بأكملها!</span>
          </div>
        </div>
      )}

      {/* Part 1: Main Program Identity & Logos */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <Building2 className="w-4 h-4 text-purple-600" />
          <span>هوية البرنامج الرسمية وصور الشعار (App Branding & Logos):</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              اسم المنظومة / التطبيق
            </label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              اسم النائب الرسمي
            </label>
            <input
              type="text"
              value={deputyName}
              onChange={(e) => setDeputyName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              الصفة التشريعية / العنوان
            </label>
            <input
              type="text"
              value={deputyTitle}
              onChange={(e) => setDeputyTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
            />
          </div>
        </div>

        {/* Logos uploaders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Main App Logo */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                صورة شعار المنظومة (App Logo)
              </span>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                >
                  إزالة الصورة
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <Building2 className="w-7 h-7 text-slate-400" />
                )}
              </div>

              <div className="flex-1 space-y-1.5">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>رفع صورة شعار من جهازك</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="أو ضع رابط صورة مباشر..."
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-left font-mono"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Parliament Emblem */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                شعار مجلس النواب / الدولة (Emblem)
              </span>
              {parliamentEmblemUrl && (
                <button
                  type="button"
                  onClick={() => setParliamentEmblemUrl('')}
                  className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                >
                  إزالة الصورة
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {parliamentEmblemUrl ? (
                  <img src={parliamentEmblemUrl} alt="Emblem" className="w-full h-full object-contain p-1" />
                ) : (
                  <Sparkles className="w-7 h-7 text-amber-500" />
                )}
              </div>

              <div className="flex-1 space-y-1.5">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>رفع صورة الشعار الرسمي</span>
                  <input type="file" accept="image/*" onChange={handleEmblemUpload} className="hidden" />
                </label>
                <input
                  type="url"
                  value={parliamentEmblemUrl}
                  onChange={(e) => setParliamentEmblemUrl(e.target.value)}
                  placeholder="أو ضع رابط صورة مباشر..."
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-left font-mono"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Part 2: Department Tiles Studio (تعديل أسماء وأيقونات الأقسام) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>تخصيص أسماء وأيقونات بطاقات الأقسام (Department Icons & Titles):</span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              انقر على زر "تعديل" أمام أي قسم لتغيير اسمه، نصه التوضيحي، أو رفع صورة خاصة للأيقونة.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DEFAULT_SYSTEM_TILES.map((tile) => {
            const custom = tilesConfig[tile.id];
            const currentTitle = custom?.title || tile.defaultTitle;
            const currentSubtitle = custom?.subtitle || tile.defaultSubtitle;
            const customImg = custom?.iconUrl;

            return (
              <div 
                key={tile.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  custom 
                    ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800' 
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                    {customImg ? (
                      <img src={customImg} alt={currentTitle} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-black text-purple-600 font-mono">
                        {tile.defaultTitle.slice(0, 2)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h5 className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {currentTitle}
                      </h5>
                      {custom && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 font-bold">
                          مخصص
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {currentSubtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEditTile(tile)}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-purple-600 text-xs font-bold transition-colors cursor-pointer"
                    title="تعديل هذا القسم"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {custom && (
                    <button
                      type="button"
                      onClick={() => handleResetTile(tile.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 text-xs font-bold transition-colors cursor-pointer"
                      title="استعادة الاسم والأيقونة الافتراضية"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Tile Modal */}
      {activeTileId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-purple-600" />
                <span>تخصيص اسم وصورة أيقونة القسم</span>
              </h4>
              <button
                type="button"
                onClick={() => setActiveTileId(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  اسم أو عنوان القسم *
                </label>
                <input
                  type="text"
                  value={editTileTitle}
                  onChange={(e) => setEditTileTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  الوصف التوضيحي للقسم
                </label>
                <input
                  type="text"
                  value={editTileSubtitle}
                  onChange={(e) => setEditTileSubtitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Icon Image Customizer */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  صورة مخصصة للأيقونة (اختياري)
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {editTileIconUrl ? (
                      <img src={editTileIconUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5 text-purple-600" />
                    <span>رفع صورة من الحاسوب</span>
                    <input type="file" accept="image/*" onChange={handleTileImageUpload} className="hidden" />
                  </label>
                  {editTileIconUrl && (
                    <button
                      type="button"
                      onClick={() => setEditTileIconUrl('')}
                      className="text-xs text-rose-500 hover:underline cursor-pointer"
                    >
                      إزالة
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveTileId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveTileEdit}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
