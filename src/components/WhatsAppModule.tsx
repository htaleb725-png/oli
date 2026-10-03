import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  MessageSquare, 
  Send, 
  Copy, 
  Check, 
  Search, 
  Phone, 
  User, 
  MapPin, 
  FolderKanban, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  Sparkles, 
  ExternalLink,
  ChevronLeft,
  X,
  Smartphone,
  ShieldCheck,
  Tag,
  Share2,
  RefreshCw,
  Filter
} from 'lucide-react';
import { OfficeIconTilesGrid } from './OfficeIconTilesGrid';

export const WhatsAppModule: React.FC = () => {
  const { 
    citizens, 
    requests, 
    interviews, 
    addAuditLog, 
    setSelectedCitizenForHistory,
    setActiveSection
  } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'with_phone' | 'urgent' | 'completed' | 'interviews'>('all');
  const [selectedCitizenId, setSelectedCitizenId] = useState<string>(citizens[0]?.Citizen_ID || '');
  
  // Messaging state
  const [selectedTemplate, setSelectedTemplate] = useState('completed');
  const [customMessage, setCustomMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [overridePhone, setOverridePhone] = useState('');
  const [useOverridePhone, setUseOverridePhone] = useState(false);

  // High performance filtered citizen list for massive databases
  const filteredCitizens = useMemo(() => {
    let list = citizens;

    // Filter by type
    if (filterType === 'with_phone') {
      list = list.filter(c => Boolean(c.Phone1 && c.Phone1.trim().length > 5));
    } else if (filterType === 'urgent') {
      const urgentCitizenIds = new Set(
        requests.filter(r => r.Priority === 'عاجل' || r.Priority === 'خاص جداً').map(r => r.Citizen_ID)
      );
      list = list.filter(c => urgentCitizenIds.has(c.Citizen_ID));
    } else if (filterType === 'completed') {
      const completedCitizenIds = new Set(
        requests.filter(r => r.ProcessingStatus === 'منجز').map(r => r.Citizen_ID)
      );
      list = list.filter(c => completedCitizenIds.has(c.Citizen_ID));
    } else if (filterType === 'interviews') {
      const interviewCitizenIds = new Set(
        interviews.filter(i => i.Status === 'مجدولة').map(i => i.Citizen_ID)
      );
      list = list.filter(c => interviewCitizenIds.has(c.Citizen_ID));
    }

    // Search query match
    if (!searchQuery.trim()) {
      return list;
    }

    const q = searchQuery.toLowerCase().trim();
    return list.filter(c => {
      const matchName = (c.FullName || '').toLowerCase().includes(q) ||
                        (c.FirstName || '').toLowerCase().includes(q) ||
                        (c.Surname || '').toLowerCase().includes(q);
      const matchPhone = (c.Phone1 || '').includes(q) || (c.Phone2 || '').includes(q);
      const matchId = (c.Citizen_ID || '').toLowerCase().includes(q);
      const matchDistrict = (c.District || '').toLowerCase().includes(q) || (c.SubDistrict || '').toLowerCase().includes(q);
      
      return matchName || matchPhone || matchId || matchDistrict;
    });
  }, [citizens, requests, interviews, searchQuery, filterType]);

  // Selected Citizen details
  const selectedCitizen = useMemo(() => {
    return citizens.find(c => c.Citizen_ID === selectedCitizenId) || filteredCitizens[0] || null;
  }, [citizens, selectedCitizenId, filteredCitizens]);

  // Related data for selected citizen
  const citizenRequests = useMemo(() => {
    if (!selectedCitizen) return [];
    return requests.filter(r => r.Citizen_ID === selectedCitizen.Citizen_ID);
  }, [selectedCitizen, requests]);

  const citizenInterviews = useMemo(() => {
    if (!selectedCitizen) return [];
    return interviews.filter(i => i.Citizen_ID === selectedCitizen.Citizen_ID);
  }, [selectedCitizen, interviews]);

  // Selected target phone number
  const targetPhone = useMemo(() => {
    if (useOverridePhone && overridePhone.trim()) {
      return overridePhone.trim();
    }
    return selectedCitizen?.Phone1 || selectedCitizen?.Phone2 || '';
  }, [useOverridePhone, overridePhone, selectedCitizen]);

  // Auto-generate template message
  const getTemplateMessage = () => {
    if (!selectedCitizen) return '';

    const latestReq = citizenRequests[0];
    const latestIntv = citizenInterviews[0];

    switch (selectedTemplate) {
      case 'completed':
        return `السلام عليكم ورحمة الله وبركاته،\nالأخ/الأخت الكريم/ة: ${selectedCitizen.FullName}\n\nنود إعلامكم من مكتب النائب المهندسة علا عودة الناشي بأنه تم بحمد الله إنجاز طلبكم الموجه إلى (${latestReq ? latestReq.Entity : 'الدائرة الحكومية المختصة'})، ويرجى التفضل بمراجعة مكتبنا في الناصرية لاستلام الكتاب الرسمي والتأييد المنجز.\n\n📌 رقم القيد التعريفي: ${selectedCitizen.Citizen_ID}\nمع خالص التقدير،\nمكتب النائب علا الناشي`;

      case 'interview':
        return `السلام عليكم ورحمة الله وبركاته،\nالأخ/الأخت الكريم/ة: ${selectedCitizen.FullName}\n\nتحية طيبة، يسرنا إعلامكم بتحديد موعد مقابلتكم المباشرة مع النائب المهندسة علا عودة الناشي:\n🗓️ الموعد: (${latestIntv?.InterviewDate || 'الخميس القادم'})\n⏰ الوقت: (${latestIntv?.InterviewTime || '10:30 صباحاً'})\n🏢 المكان: مقر مكتب النائب في الناصرية.\n\nيرجى جلب المستمسكات الثبوتية وإبراز رقم القيد (${selectedCitizen.Citizen_ID}) عند الاستعلامات.\n\nمكتب النائب علا الناشي`;

      case 'in_progress':
        return `السلام عليكم ورحمة الله وبركاته،\nالأخ/الأخت الكريم/ة: ${selectedCitizen.FullName}\n\nنحيطكم علماً بأن طلبكم ومعاملتكم المحالة إلى (${latestReq?.Entity || 'الوزارة المعنية'}) قيد المتابعة الحثيثة والتنسيق المستمر من قبل كادر مكتب النائب علا الناشي، وسنوافيكم فور ورود الإجابة الرسمية.\n\n📌 رقم القيد التعريفي: ${selectedCitizen.Citizen_ID}\nمكتب النائب علا الناشي`;

      case 'documents_required':
        return `السلام عليكم ورحمة الله وبركاته،\nالأخ/الأخت الكريم/ة: ${selectedCitizen.FullName}\n\nيرجى التفضل بمراجعة مكتب النائب علا الناشي أو تزويدنا بالأوليات والمستمسكات الثبوتية التكميلية لغرض استكمال مفاتحة (${latestReq?.Entity || 'الجهة المختصة'}) بخصوص طلبكم.\n\n📌 رقم القيد التعريفي: ${selectedCitizen.Citizen_ID}\nمكتب النائب علا الناشي`;

      case 'greeting':
        return `السلام عليكم ورحمة الله وبركاته،\nالأخ/الأخت الكريم/ة: ${selectedCitizen.FullName}\n\nيطيب لمكتب النائب المهندسة علا عودة الناشي أن يتقدم إليكم بأسمى آيات التهاني والتبريكات، متمنين لكم دوام التوفيق والسداد، ونؤكد دوام اعتزازنا بخدمة أهلنا الكرام في محافظة ذي قار.\n\nمكتب النائب علا الناشي`;

      case 'custom':
        return customMessage;

      default:
        return '';
    }
  };

  const messageText = selectedTemplate === 'custom' ? customMessage : getTemplateMessage();

  // Send WhatsApp Link builder
  const handleSendWhatsApp = (customPhoneTarget?: string) => {
    const rawPhone = customPhoneTarget || targetPhone;
    if (!rawPhone || rawPhone.trim().length < 6) {
      alert('يرجى التأكد من وجود رقم هاتف صحيح للمواطن أو إدخال رقم يدوي.');
      return;
    }

    // Clean phone number for Iraq (+964)
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('00964')) {
      cleanPhone = cleanPhone.substring(2);
    } else if (cleanPhone.startsWith('07')) {
      cleanPhone = '964' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('7') && cleanPhone.length === 10) {
      cleanPhone = '964' + cleanPhone;
    } else if (!cleanPhone.startsWith('964')) {
      cleanPhone = '964' + cleanPhone;
    }

    const encodedMsg = encodeURIComponent(messageText);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;

    if (selectedCitizen) {
      addAuditLog(
        'إرسال رسالة واتساب',
        'قسم الواتساب',
        `إرسال رسالة واتساب للمواطن ${selectedCitizen.FullName} على الرقم ${cleanPhone}`
      );
    }

    window.open(waUrl, '_blank');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 text-right font-['Tajawal',sans-serif] select-none">
      
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-900">منظومة تراسل الواتساب والمتابعة الفورية</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              قاعدة بيانات المراجعين ({citizens.length})
            </span>
          </div>
          <p className="text-xs text-slate-500">
            البحث السريع بالاسم والرقم، استعراض بيانات وسجل المواطن، وتوليد وإرسال رسائل WhatsApp الرسمية المباشرة.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <button 
            onClick={() => setActiveSection('search_archive')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FolderKanban className="w-3.5 h-3.5 text-slate-500" />
            <span>الأرشيف العام</span>
          </button>
        </div>
      </div>

      {/* 5-Column Desktop Icon Grid for WhatsApp Notifications */}
      <OfficeIconTilesGrid
        title="أيقونات قوالب المراسلات والإشعارات التلقائية"
        subtitle="انقر على أي قالب لتجهيز رسالة الواتساب الرسمية وإرسالها بضغطة زر واحدة"
        columns={5}
        items={[
          {
            id: 'wa_completed',
            title: 'إشعار بإنجاز المعاملة',
            subtitle: 'تبليغ المواطن بإنجاز طلبه',
            icon: CheckCircle2,
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
            isActive: selectedTemplate === 'completed',
            onClick: () => setSelectedTemplate('completed')
          },
          {
            id: 'wa_interview',
            title: 'موعد مقابلة النائب',
            subtitle: 'تأكيد زمان ومكان المقابلة',
            icon: Calendar,
            iconColor: 'text-teal-600 dark:text-teal-400',
            iconBg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
            isActive: selectedTemplate === 'interview',
            onClick: () => setSelectedTemplate('interview')
          },
          {
            id: 'wa_in_progress',
            title: 'معاملة قيد المتابعة',
            subtitle: 'متابعة حثيثة مع الوزارة',
            icon: Clock,
            iconColor: 'text-amber-600 dark:text-amber-400',
            iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
            isActive: selectedTemplate === 'in_progress',
            onClick: () => setSelectedTemplate('in_progress')
          },
          {
            id: 'wa_docs',
            title: 'طلب مستمسكات ثبوتية',
            subtitle: 'إكمال أوليات المعاملة',
            icon: AlertCircle,
            iconColor: 'text-rose-600 dark:text-rose-400',
            iconBg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
            isActive: selectedTemplate === 'documents_required',
            onClick: () => setSelectedTemplate('documents_required')
          },
          {
            id: 'wa_greeting',
            title: 'تهنئة وتواصل رسمي',
            subtitle: 'رسالة ودية من مكتب النائب',
            icon: Sparkles,
            iconColor: 'text-purple-600 dark:text-purple-400',
            iconBg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
            isActive: selectedTemplate === 'greeting',
            onClick: () => setSelectedTemplate('greeting')
          }
        ]}
      />

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* =========================================================
            LEFT COLUMN (5 Cols): Fast Search & Citizen Directory List
            ========================================================= */}
        <div className="lg:col-span-5 space-y-3 flex flex-col">
          
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3 flex-1">
            
            {/* Search Input Box */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                🔍 خانة البحث السريع (بالاسم، الهاتف، أو رقم القيد):
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="اكتب اسم المواطن، رقم الهاتف (078...)، أو المنطقة..."
                  className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[
                { id: 'all', label: `الكل (${citizens.length})` },
                { id: 'with_phone', label: 'لديه هاتف' },
                { id: 'urgent', label: 'معاملات عاجلة' },
                { id: 'completed', label: 'منجزة' },
                { id: 'interviews', label: 'مقابلات مجدولة' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    filterType === f.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Results Counter */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1 pt-1 border-t border-slate-100">
              <span>نتائج البحث المتاحة:</span>
              <span className="font-mono text-emerald-600 font-bold">
                {filteredCitizens.length} مواطن ومراجع
              </span>
            </div>

            {/* Citizens Directory Scrollable List */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredCitizens.length > 0 ? (
                filteredCitizens.map((c) => {
                  const isSelected = selectedCitizen?.Citizen_ID === c.Citizen_ID;
                  const citizenReqs = requests.filter(r => r.Citizen_ID === c.Citizen_ID);
                  const hasUrgent = citizenReqs.some(r => r.Priority === 'عاجل' || r.Priority === 'خاص جداً');
                  const hasCompleted = citizenReqs.some(r => r.ProcessingStatus === 'منجز');

                  return (
                    <div
                      key={c.Citizen_ID}
                      onClick={() => {
                        setSelectedCitizenId(c.Citizen_ID);
                        setUseOverridePhone(false);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer text-right flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-emerald-50/90 border-emerald-400 shadow-xs ring-1 ring-emerald-400'
                          : 'bg-white border-slate-200 hover:bg-slate-50/90 hover:border-slate-300'
                      }`}
                    >
                      {/* Left Side: Actions/Badges */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {c.Phone1 ? (
                          <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md" dir="ltr">
                            <Smartphone className="w-3 h-3" />
                            {c.Phone1}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                            بدون هاتف
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          {hasUrgent && (
                            <span className="w-2 h-2 rounded-full bg-rose-500" title="معاملة عاجلة"></span>
                          )}
                          {hasCompleted && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500" title="معاملة منجزة"></span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">
                            {citizenReqs.length} طلب
                          </span>
                        </div>
                      </div>

                      {/* Right Side: Citizen Info */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected 
                            ? 'bg-emerald-600 text-white shadow-2xs' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {c.FullName ? c.FullName.trim().charAt(0) : <User className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5">
                            <span>{c.FullName}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-normal">({c.Citizen_ID})</span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span>{c.District || 'ذي قار'} - {c.SubDistrict || 'الناصرية'}</span>
                            {c.Job && <span className="text-slate-400">• {c.Job}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">لا توجد نتائج مطابقة لبحثك</p>
                  <p className="text-[11px] text-slate-400 mt-1">تأكد من كتابة الاسم أو رقم الهاتف بشكل صحيح</p>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* =========================================================
            RIGHT COLUMN (7 Cols): Selected Citizen Profile & WhatsApp Sender
            ========================================================= */}
        <div className="lg:col-span-7 space-y-4">
          
          {selectedCitizen ? (
            <>
              {/* Selected Citizen Detailed Card */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      {selectedCitizen.FullName?.charAt(0) || <User className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900">{selectedCitizen.FullName}</h3>
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold font-mono">
                          {selectedCitizen.Citizen_ID}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{selectedCitizen.District || 'محافظة ذي قار'} - {selectedCitizen.SubDistrict || 'الناصرية'}</span>
                        {selectedCitizen.Job && <span>• {selectedCitizen.Job}</span>}
                        {selectedCitizen.Rating && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 text-[10px] font-semibold border border-amber-200">
                            {selectedCitizen.Rating}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      onClick={() => {
                        setSelectedCitizenForHistory(selectedCitizen);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="عرض سجل المعاملات الكامل"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>السجل الكامل</span>
                    </button>
                  </div>
                </div>

                {/* Phone Numbers & Quick Contacts Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold">الهاتف الرئيسي (واتساب):</div>
                        <div className="text-xs font-bold font-mono text-slate-900" dir="ltr">
                          {selectedCitizen.Phone1 || 'غير مسجل'}
                        </div>
                      </div>
                    </div>
                    {selectedCitizen.Phone1 && (
                      <button
                        onClick={() => handleSendWhatsApp(selectedCitizen.Phone1)}
                        className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                        title="مراسلة هذا الرقم مباشرة"
                      >
                        <Send className="w-3 h-3" />
                        <span>مراسلة</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t sm:border-t-0 sm:border-r border-slate-200 pt-2 sm:pt-0 sm:pr-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                        <Smartphone className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold">هاتف إضافي / بديل:</div>
                        <div className="text-xs font-bold font-mono text-slate-900" dir="ltr">
                          {selectedCitizen.Phone2 || 'لا يوجد'}
                        </div>
                      </div>
                    </div>
                    {selectedCitizen.Phone2 && (
                      <button
                        onClick={() => handleSendWhatsApp(selectedCitizen.Phone2)}
                        className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                        title="مراسلة الرقم الإضافي"
                      >
                        <Send className="w-3 h-3" />
                        <span>مراسلة</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Citizen Status Highlights (Latest Request & Interview) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold mb-1">
                      <FolderKanban className="w-3 h-3 text-purple-600" />
                      <span>آخر طلب ومعاملة مسجلة:</span>
                    </div>
                    {citizenRequests.length > 0 ? (
                      <div>
                        <div className="font-bold text-slate-800 text-[11px] truncate">
                          {citizenRequests[0].Entity} - {citizenRequests[0].Details}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            citizenRequests[0].ProcessingStatus === 'منجز'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {citizenRequests[0].ProcessingStatus || 'قيد الإجراء'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {citizenRequests[0].CreatedAt?.split('T')[0] || '2026-09-01'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-400 text-[11px]">لا توجد طلبات مسجلة حالياً</div>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold mb-1">
                      <Calendar className="w-3 h-3 text-blue-600" />
                      <span>موقف مقابلات النائب:</span>
                    </div>
                    {citizenInterviews.length > 0 ? (
                      <div>
                        <div className="font-bold text-slate-800 text-[11px] truncate">
                          مقابلة: {citizenInterviews[0].InterviewDate} ({citizenInterviews[0].InterviewTime})
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            {citizenInterviews[0].Status}
                          </span>
                          {citizenInterviews[0].DeputyDirective && (
                            <span className="text-[10px] text-slate-600 truncate">
                              توجيه: {citizenInterviews[0].DeputyDirective}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-400 text-[11px]">لا توجد مقابلات مجدولة حالياً</div>
                    )}
                  </div>
                </div>

              </div>

              {/* Template Selection & WhatsApp Composer */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
                
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-bold text-xs text-slate-800">اختيار قالب الرسالة وتجهيز النص:</h3>
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                    توليد تلقائي للبيانات
                  </span>
                </div>

                {/* Templates Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { id: 'completed', label: 'إنجاز المعاملة', desc: 'إشعار باستلام الكتاب' },
                    { id: 'interview', label: 'موعد مقابلة النائب', desc: 'تحديد الوقت والتاريخ' },
                    { id: 'in_progress', label: 'متابعة بالوزارة', desc: 'قيد الإجراء والمتابعة' },
                    { id: 'documents_required', label: 'طلب مستمسكات', desc: 'أوليات تكميلية' },
                    { id: 'greeting', label: 'تهنئة وتبريكات', desc: 'رسالة ودية رسمية' },
                    { id: 'custom', label: 'رسالة مخصصة', desc: 'كتابة نص حر' },
                  ].map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl.id)}
                      className={`p-2 rounded-xl text-right transition-all cursor-pointer border ${
                        selectedTemplate === tmpl.id
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-400 shadow-xs ring-1 ring-emerald-300 font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{tmpl.label}</div>
                      <div className="text-[10px] text-slate-400 font-normal truncate mt-0.5">{tmpl.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Custom Message Field */}
                {selectedTemplate === 'custom' && (
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">اكتب نص الرسالة المخصصة:</label>
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      rows={4}
                      placeholder="اكتب رسالتك للمواطن هنا..."
                      className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                {/* Manual Phone Override Option */}
                <div className="pt-1">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useOverridePhone}
                        onChange={(e) => setUseOverridePhone(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                      />
                      <span className="font-semibold text-[11px]">إرسال إلى رقم هاتف بديل / مخصص</span>
                    </label>
                  </div>

                  {useOverridePhone && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={overridePhone}
                        onChange={(e) => setOverridePhone(e.target.value)}
                        placeholder="أدخل رقم الهاتف البديل (مثال: 07801234567)"
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono text-right focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* WhatsApp Chat Preview Bubble */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-bold">معاينة الرسالة (كما ستظهر للمواطن):</span>
                    <span className="font-mono text-emerald-700 font-bold" dir="ltr">
                      المستلم: {targetPhone || 'لم يحدد رقم'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-xs leading-relaxed whitespace-pre-line text-right font-sans relative">
                    {messageText || 'يرجى كتابة نص الرسالة أو اختيار قالب جاهز.'}
                    <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-700 font-mono mt-2 pt-1 border-t border-emerald-100">
                      <span>الآن</span>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  </div>
                </div>

                {/* Main Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                  <button
                    onClick={() => handleSendWhatsApp()}
                    className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs hover:shadow"
                  >
                    <Send className="w-4 h-4" />
                    <span>إرسال عبر WhatsApp الرسمي</span>
                  </button>

                  <button
                    onClick={handleCopy}
                    className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">تم النسخ بنجاح</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-600" />
                        <span>نسخ النص</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-2xs">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">اختر مراجعاً من القائمة أو ابحث عنه</h3>
              <p className="text-xs text-slate-400 mt-1">
                استخدم خانة البحث على اليمين للوصول الفوري لأي مراجع في قاعدة البيانات
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
