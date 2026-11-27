import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { generatePwaPngIcons } from '../../utils/pwaIconHelper';
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
  Eye,
  EyeOff,
  Trash2,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { SOCIAL_CARE_LEGACY_CUSTOM_ID } from '../../utils/permissions';

interface DefaultTileConfig {
  id: string;
  defaultTitle: string;
  defaultSubtitle: string;
  defaultIcon: string;
}

const DEFAULT_SYSTEM_TILES: DefaultTileConfig[] = [
  { id: 'tile_reception', defaultTitle: 'قسم الاستعلامات والمراجعين', defaultSubtitle: 'تسجيل واستعلام وتوثيق المراجعين', defaultIcon: 'UserPlus' },
  { id: 'tile_admin', defaultTitle: 'قسم الإدارة والمعاملات', defaultSubtitle: 'المعاملات الحكومية والمخاطبات والكتب', defaultIcon: 'FolderKanban' },
  { id: 'tile_social_care', defaultTitle: 'قسم الرعاية الاجتماعية (مستقل)', defaultSubtitle: 'شبكة الحماية الاجتماعية، المعين المتفرغ، والباحث الاجتماعي', defaultIcon: 'HeartHandshake' },
  { id: 'tile_director', defaultTitle: 'قسم مدير المكتب التنفيذي', defaultSubtitle: 'اعتماد وتوجيه وارد الاستعلامات والإشراف', defaultIcon: 'Briefcase' },
  { id: 'tile_interviews', defaultTitle: 'قسم مقابلات النائب', defaultSubtitle: 'جدول مواعيد النائب وتوثيق الهوامش', defaultIcon: 'Handshake' },
  { id: 'tile_organization', defaultTitle: 'قسم التنظيم والجماهير', defaultSubtitle: 'شؤون العشائر والموقف الجماهيري', defaultIcon: 'Users2' },
  { id: 'tile_search_archive', defaultTitle: 'قسم البحث الشامل والأرشيف', defaultSubtitle: 'البحث الفوري واستخراج السجلات وطباعة الهوية', defaultIcon: 'Search' },
  { id: 'tile_drive_requests', defaultTitle: 'أرشيف طلبات Google Drive', defaultSubtitle: 'مزامنة وتنزيل وأرشفة المستندات السحابية', defaultIcon: 'CloudDownload' },
  { id: 'tile_reports', defaultTitle: 'قسم التقارير والإحصائيات', defaultSubtitle: 'مؤشرات الإنجاز، التحليلات، وسحب Excel', defaultIcon: 'BarChart3' },
  { id: 'tile_audit', defaultTitle: 'قسم الرقابة والتدقيق والمتابعة', defaultSubtitle: 'الحوكمة وسجل النشاطات والمتابعة الميدانية', defaultIcon: 'ShieldCheck' },
  { id: 'tile_whatsapp', defaultTitle: 'مراسلات الواتساب التلقائية', defaultSubtitle: 'إشعار وتحديث المراجعين فورياً بالرسائل', defaultIcon: 'MessageSquare' },
  { id: 'tile_blacklist', defaultTitle: 'سجل القائمة السوداء والمحظورين', defaultSubtitle: 'إدارة الأشخاص المحظورين والرقابة الأمنية', defaultIcon: 'ShieldAlert' },
];

const TILE_COLOR_OPTIONS = [
  { id: '', label: 'اللون الافتراضي' },
  { id: 'blue', label: 'أزرق رسمي' },
  { id: 'emerald', label: 'زمردي أخضر' },
  { id: 'amber', label: 'عنبري ذهبي' },
  { id: 'purple', label: 'بنفسجي ملكي' },
  { id: 'indigo', label: 'نيلي حديث' },
  { id: 'rose', label: 'عنابي / وردي' },
  { id: 'teal', label: 'فيروزي' },
  { id: 'orange', label: 'برتقالي' }
];

export const SystemIconsStudio: React.FC = () => {
  const { systemSettings, updateSettings, customSections, updateCustomSection, deleteCustomSection } = useApp();

  const [tilesConfig, setTilesConfig] = useState<
    Record<string, { title: string; subtitle?: string; iconUrl?: string; iconColor?: string; order?: number; hidden?: boolean }>
  >(systemSettings.customTilesConfig || {});

  // App Identity states
  const [appName, setAppName] = useState(systemSettings.appName || 'برنامج مكتب النائب علا الناشي');
  const [deputyName, setDeputyName] = useState(systemSettings.deputyName || 'النائب المهندسة علا عودة الناشي');
  const [deputyTitle, setDeputyTitle] = useState(systemSettings.deputyTitle || 'عضو مجلس النواب العراقي');
  const [logoUrl, setLogoUrl] = useState(systemSettings.logoUrl || '');
  const [parliamentEmblemUrl, setParliamentEmblemUrl] = useState(systemSettings.parliamentEmblemUrl || '');
  const [loadingEmblemUrl, setLoadingEmblemUrl] = useState(systemSettings.customImages?.loadingEmblem || '');

  const [activeTileId, setActiveTileId] = useState<string | null>(null);
  const [editTileTitle, setEditTileTitle] = useState('');
  const [editTileSubtitle, setEditTileSubtitle] = useState('');
  const [editTileIconUrl, setEditTileIconUrl] = useState('');
  const [editTileColor, setEditTileColor] = useState('');

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Hydrate studio state live whenever Supabase system_settings loads or updates from another device
  useEffect(() => {
    setTilesConfig(systemSettings.customTilesConfig || {});
    setAppName(systemSettings.appName || 'برنامج مكتب النائب علا الناشي');
    setDeputyName(systemSettings.deputyName || 'النائب المهندسة علا عودة الناشي');
    setDeputyTitle(systemSettings.deputyTitle || 'عضو مجلس النواب العراقي');
    setLogoUrl(systemSettings.logoUrl || '');
    setParliamentEmblemUrl(systemSettings.parliamentEmblemUrl || '');
    setLoadingEmblemUrl(systemSettings.customImages?.loadingEmblem || '');
  }, [
    systemSettings.settingsVersion,
    systemSettings.customTilesConfig,
    systemSettings.appName,
    systemSettings.deputyName,
    systemSettings.deputyTitle,
    systemSettings.logoUrl,
    systemSettings.parliamentEmblemUrl,
    systemSettings.customImages?.loadingEmblem
  ]);

  const sortedBuiltInTiles = [...DEFAULT_SYSTEM_TILES].sort((a, b) => {
    const idxA = DEFAULT_SYSTEM_TILES.findIndex(x => x.id === a.id);
    const idxB = DEFAULT_SYSTEM_TILES.findIndex(x => x.id === b.id);
    const ordA = tilesConfig[a.id]?.order ?? idxA;
    const ordB = tilesConfig[b.id]?.order ?? idxB;
    return ordA - ordB;
  });

  const handleMoveTileOrder = (tileId: string, direction: -1 | 1) => {
    const currentList = sortedBuiltInTiles.map(t => t.id);
    const pos = currentList.indexOf(tileId);
    const targetPos = pos + direction;
    if (pos < 0 || targetPos < 0 || targetPos >= currentList.length) return;

    const reordered = [...currentList];
    const [moved] = reordered.splice(pos, 1);
    reordered.splice(targetPos, 0, moved);

    const updated: Record<string, { title: string; subtitle?: string; iconUrl?: string; iconColor?: string; order?: number; hidden?: boolean }> = {
      ...tilesConfig
    };
    reordered.forEach((id, idx) => {
      const def = DEFAULT_SYSTEM_TILES.find(t => t.id === id);
      const prev = updated[id];
      updated[id] = {
        title: prev?.title || def?.defaultTitle || id,
        subtitle: prev?.subtitle || def?.defaultSubtitle,
        iconUrl: prev?.iconUrl,
        iconColor: prev?.iconColor,
        hidden: prev?.hidden,
        order: idx
      };
    });

    setTilesConfig(updated);
    void updateSettings({ customTilesConfig: updated });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const readFileAsDataUrl = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
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

  const handleOpenEditTile = (tile: DefaultTileConfig) => {
    setActiveTileId(tile.id);
    const existing = tilesConfig[tile.id];
    setEditTileTitle(existing?.title || tile.defaultTitle);
    setEditTileSubtitle(existing?.subtitle || tile.defaultSubtitle);
    setEditTileIconUrl(existing?.iconUrl || '');
    setEditTileColor(existing?.iconColor || '');
  };

  const handleSaveTileEdit = () => {
    if (!activeTileId) return;
    const prev = tilesConfig[activeTileId];
    const updated = {
      ...tilesConfig,
      [activeTileId]: {
        ...prev,
        title: editTileTitle.trim(),
        subtitle: editTileSubtitle.trim(),
        iconUrl: editTileIconUrl.trim() || undefined,
        iconColor: editTileColor || undefined
      }
    };
    setTilesConfig(updated);
    void updateSettings({ customTilesConfig: updated });
    setActiveTileId(null);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleToggleHideTile = (tile: DefaultTileConfig) => {
    const prev = tilesConfig[tile.id];
    const nextHidden = !prev?.hidden;
    const updated = {
      ...tilesConfig,
      [tile.id]: {
        title: prev?.title || tile.defaultTitle,
        subtitle: prev?.subtitle || tile.defaultSubtitle,
        iconUrl: prev?.iconUrl,
        iconColor: prev?.iconColor,
        order: prev?.order,
        hidden: nextHidden
      }
    };
    setTilesConfig(updated);
    void updateSettings({ customTilesConfig: updated });
  };

  const handleResetTile = (tileId: string) => {
    const next = { ...tilesConfig };
    delete next[tileId];
    setTilesConfig(next);
    void updateSettings({ customTilesConfig: next });
  };

  const handleSaveAllIdentityAndTiles = async () => {
    const cleanLogo = logoUrl.trim();
    const generatedIcons = cleanLogo ? await generatePwaPngIcons(cleanLogo) : null;

    updateSettings({
      appName: appName.trim(),
      deputyName: deputyName.trim(),
      deputyTitle: deputyTitle.trim(),
      logoUrl: cleanLogo,
      ...(generatedIcons
        ? { pwaIcon192: generatedIcons.icon192, pwaIcon512: generatedIcons.icon512 }
        : !cleanLogo
        ? { pwaIcon192: '', pwaIcon512: '' }
        : {}),
      parliamentEmblemUrl: parliamentEmblemUrl.trim(),
      customImages: {
        ...(systemSettings.customImages || {}),
        loadingEmblem: loadingEmblemUrl.trim() || undefined
      },
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
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              استوديو تخصيص الأيقونات والصور وهوية المنظومة للمطور
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              تعديل أو إخفاء أو استعادة أي أيقونة وقسم في النظام، تغيير جميع الشعارات وصورة شاشة التحميل، وتحديثها فورياً في السحابة.
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
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>تم حفظ وتعميم الأيقونات والتعديلات فوراً في جميع أنحاء التطبيق! سيظهر إشعار «تحديث جديد» لجميع المستخدمين الآخرين لتحديث الأيقونات وإعادة الدخول تلقائياً.</span>
        </div>
      )}

      {/* Part 1: Main Program Identity & All System Images */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <Building2 className="w-4 h-4 text-purple-600" />
          <span>هوية البرنامج الرسمية وجميع صور الشعارات:</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">اسم المنظومة / التطبيق</label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">اسم النائب الرسمي</label>
            <input
              type="text"
              value={deputyName}
              onChange={(e) => setDeputyName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">الصفة التشريعية / العنوان</label>
            <input
              type="text"
              value={deputyTitle}
              onChange={(e) => setDeputyTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
            />
          </div>
        </div>

        {/* 3 Image Uploaders: Main Logo, Parliament Emblem, Loading Screen Emblem */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
          {[
            { label: 'شعار المنظومة (App Logo)', val: logoUrl, setter: setLogoUrl },
            { label: 'شعار مجلس النواب الرسمي', val: parliamentEmblemUrl, setter: setParliamentEmblemUrl },
            { label: 'صورة شاشة التحميل بعد الدخول', val: loadingEmblemUrl, setter: setLoadingEmblemUrl }
          ].map((imgField, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{imgField.label}</span>
                {imgField.val && (
                  <button
                    type="button"
                    onClick={() => imgField.setter('')}
                    className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                  >
                    إزالة
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                  {imgField.val ? (
                    <img src={imgField.val} alt={imgField.label} className="w-full h-full object-contain p-1" />
                  ) : (
                    <Sparkles className="w-6 h-6 text-amber-500" />
                  )}
                </div>

                <div className="flex-1 space-y-1.5 min-w-0">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع صورة</span>
                    <input type="file" accept="image/*" onChange={(e) => readFileAsDataUrl(e, imgField.setter)} className="hidden" />
                  </label>
                  <input
                    type="url"
                    value={imgField.val}
                    onChange={(e) => imgField.setter(e.target.value)}
                    placeholder="أو رابط صورة مباشر..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-left font-mono"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Part 2: Built-in Department Tiles Studio */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>التحكم الكامل بأيقونات الأقسام الرسمية (تعديل الاسم، الصورة، أو الإخفاء):</span>
            </h4>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedBuiltInTiles.map((tile, tileIdx) => {
            const custom = tilesConfig[tile.id];
            const currentTitle = custom?.title || tile.defaultTitle;
            const currentSubtitle = custom?.subtitle || tile.defaultSubtitle;
            const customImg = custom?.iconUrl;
            const isHidden = Boolean(custom?.hidden);

            return (
              <div
                key={tile.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isHidden
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 opacity-70'
                    : custom
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
                      <span className="text-[10px] font-mono text-slate-400">#{tileIdx + 1}</span>
                      <h5 className="text-xs font-black text-slate-900 dark:text-white truncate">{currentTitle}</h5>
                      {isHidden && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">مخفية</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{currentSubtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={tileIdx === 0}
                    onClick={() => handleMoveTileOrder(tile.id, -1)}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-600 cursor-pointer disabled:opacity-30"
                    title="تقديم ترتيب الأيقونة لأعلى"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    disabled={tileIdx === sortedBuiltInTiles.length - 1}
                    onClick={() => handleMoveTileOrder(tile.id, 1)}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-600 cursor-pointer disabled:opacity-30"
                    title="تأخير ترتيب الأيقونة لأسفل"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditTile(tile)}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-purple-600 cursor-pointer"
                    title="تعديل الاسم واللون والوصف والصورة"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleHideTile(tile)}
                    className={`p-1.5 rounded-lg border cursor-pointer ${
                      isHidden
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600'
                    }`}
                    title={isHidden ? 'إعادة إظهار الأيقونة' : 'إخفاء هذه الأيقونة من الواجهة'}
                  >
                    {isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>

                  {custom && (
                    <button
                      type="button"
                      onClick={() => handleResetTile(tile.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 cursor-pointer"
                      title="استعادة الإعداد الافتراضي"
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

      {/* Part 3: Custom Sections Quick Icon & Delete Control */}
      {customSections.filter(cs => cs.id !== SOCIAL_CARE_LEGACY_CUSTOM_ID).length > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>أيقونات الأقسام المخصصة المضافة من قبل المطور:</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customSections.filter(cs => cs.id !== SOCIAL_CARE_LEGACY_CUSTOM_ID).map(sec => (
              <div key={sec.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {sec.iconUrl ? (
                      <img src={sec.iconUrl} alt={sec.title} className="w-full h-full object-cover" />
                    ) : (
                      <Layers className="w-4 h-4 text-indigo-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-900 dark:text-white truncate">{sec.title}</div>
                    <div className="text-[10px] text-slate-500 truncate">{sec.description || 'قسم مخصص'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <label className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-indigo-600 hover:bg-indigo-50 cursor-pointer" title="تغيير صورة الأيقونة">
                    <Upload className="w-3.5 h-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            updateCustomSection({ ...sec, iconUrl: reader.result });
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => deleteCustomSection(sec.id)}
                    className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                    title="حذف هذه الأيقونة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">اسم أو عنوان القسم *</label>
                <input
                  type="text"
                  value={editTileTitle}
                  onChange={(e) => setEditTileTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">الوصف التوضيحي للقسم</label>
                <input
                  type="text"
                  value={editTileSubtitle}
                  onChange={(e) => setEditTileSubtitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">لون الأيقونة (محفوظ في قاعدة البيانات)</label>
                <select
                  value={editTileColor}
                  onChange={(e) => setEditTileColor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                >
                  {TILE_COLOR_OPTIONS.map(opt => (
                    <option key={opt.id || 'default'} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">صورة مخصصة للأيقونة</label>
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
                    <span>رفع صورة من الجهاز</span>
                    <input type="file" accept="image/*" onChange={(e) => readFileAsDataUrl(e, setEditTileIconUrl)} className="hidden" />
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
