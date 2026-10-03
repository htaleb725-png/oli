import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { OrganizationRecord, Citizen, OrgFinalResult, OrgFinalEvaluation, OrgTeamMember } from '../types';
import { 
  Users2, 
  Search, 
  Plus, 
  Clock,
  SendHorizontal,
  UserCheck,
  Eye,
  Filter,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  XCircle,
  BarChart3,
  ShieldCheck,
  FileSpreadsheet,
  Award,
  FileText
} from 'lucide-react';
import { AiRequestDrafterModal } from './AiRequestDrafterModal';
import { OrgFinalEvaluationModal } from './OrgFinalEvaluationModal';
import { OrgStatisticsAndReports } from './OrgStatisticsAndReports';
import { OrgTeamMembersManager } from './OrgTeamMembersManager';
import { OrgTeamMemberCardModal } from './OrgTeamMemberCardModal';
import { OfficeIconTilesGrid } from './OfficeIconTilesGrid';

const INITIAL_TEAM_MEMBERS: OrgTeamMember[] = [
  {
    id: 'TM-001',
    Citizen_ID: 'ONA-10492',
    FullName: 'محمد جاسم خلف علي الخفاجي',
    Phone: '07812345678',
    District: 'قضاء الناصرية',
    SubDistrict: 'حي سومر',
    ElectionCenter: 'مدرسة سومر الابتدائية',
    Role: 'مفتاح نهائي',
    JoinedDate: '2026-02-12',
    OfficeVisitCount: '3 - 5 مرات',
    Notes: 'وجيه منطقة ومؤيد فاعل، انضم كعضو فريق بعد إنجاز شمول الرعاية الاجتماعية بالكامل.',
    Status: 'نشط'
  },
  {
    id: 'TM-002',
    Citizen_ID: 'ONA-10494',
    FullName: 'حسين فاضل عباس طاهر التميمي',
    Phone: '07712398765',
    District: 'قضاء سوق الشيوخ',
    SubDistrict: 'مركز القضاء',
    ElectionCenter: 'ثانوية الفرات للبنين',
    Role: 'مفتاح نهائي',
    JoinedDate: '2026-02-16',
    OfficeVisitCount: '4 - 6 مرات',
    Notes: 'ممثل خريجين وناشط شبابي، انضم للفريق بعد متابعة طلب تعيين الحقول النفطية.',
    Status: 'نشط'
  }
];

export const OrganizationModule: React.FC = () => {
  const { 
    organizationRecords, 
    addOrganizationRecord, 
    updateOrganizationRecord, 
    citizens,
    updateCitizen,
    requests,
    setSelectedCitizenForHistory,
    setActiveSection
  } = useApp();

  const [activeTab, setActiveTab] = useState<'records' | 'reports' | 'team_members' | 'referred_citizens'>('records');
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [finalResultFilter, setFinalResultFilter] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [influenceFilter, setInfluenceFilter] = useState('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAiDrafterModal, setShowAiDrafterModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OrganizationRecord | null>(null);

  // Evaluation modal states
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [evaluatingRecord, setEvaluatingRecord] = useState<OrganizationRecord | null>(null);
  const [evaluatingCitizen, setEvaluatingCitizen] = useState<Citizen | null>(null);

  // Independent team member card modal
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedMemberForCard, setSelectedMemberForCard] = useState<OrgTeamMember | null>(null);

  // Team members state with localStorage persistence
  const [teamMembers, setTeamMembers] = useState<OrgTeamMember[]>(() => {
    try {
      const saved = localStorage.getItem('ola_alnashi_office_team_members');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_TEAM_MEMBERS;
    } catch {
      return INITIAL_TEAM_MEMBERS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ola_alnashi_office_team_members', JSON.stringify(teamMembers));
    } catch (e) {
      console.error('Failed to persist team members', e);
    }
  }, [teamMembers]);

  // Form states for general org rating
  const [citizenId, setCitizenId] = useState('');
  const [editOrgName, setEditOrgName] = useState('');
  const [editOrgPhone, setEditOrgPhone] = useState('');
  const [orgRating, setOrgRating] = useState('مؤيد');
  const [influence, setInfluence] = useState('وجيه منطقة');
  const [points, setPoints] = useState(90);
  const [electionCenter, setElectionCenter] = useState('');
  const [stationNumber, setStationNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Extract unique districts
  const districts = Array.from(
    new Set(organizationRecords.map(r => r.District).filter(Boolean))
  ) as string[];

  const filteredRecords = organizationRecords.filter(rec => {
    const matchesSearch = 
      rec.FullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.Citizen_ID.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.District && rec.District.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (rec.InfluenceType && rec.InfluenceType.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRating = ratingFilter === 'all' || rec.OrgRating === ratingFilter;
    const matchesDistrict = districtFilter === 'all' || rec.District === districtFilter;
    const matchesInfluence = influenceFilter === 'all' || rec.InfluenceType === influenceFilter;
    
    const recResult = rec.finalEvaluation?.finalResult;
    const matchesFinalResult = 
      finalResultFilter === 'all' || 
      (finalResultFilter === 'unassigned' ? !recResult : recResult === finalResultFilter);

    return matchesSearch && matchesRating && matchesDistrict && matchesInfluence && matchesFinalResult;
  });

  // Filter citizens referred to Organization Manager
  const referredCitizens = citizens.filter(c => 
    c.CurrentStage === 'مدير التنظيم' || (c.WorkflowHistory && c.WorkflowHistory.some(w => w.ToStage === 'مدير التنظيم'))
  );

  const handleSaveGeneralOrg = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingRecord) {
      const finalName = editOrgName.trim() || editingRecord.FullName;
      const finalPhone = editOrgPhone.trim() || editingRecord.Phone1;

      updateOrganizationRecord({
        ...editingRecord,
        FullName: finalName,
        Phone1: finalPhone,
        OrgRating: orgRating as any,
        InfluenceType: influence,
        EvaluationPoints: points,
        ElectionCenter: electionCenter || undefined,
        StationNumber: stationNumber || undefined,
        Notes: notes || undefined
      });

      const cit = citizens.find(c => c.Citizen_ID === editingRecord.Citizen_ID);
      if (cit) {
        updateCitizen({
          ...cit,
          FullName: finalName,
          Phone1: finalPhone
        });
      }

      setEditingRecord(null);
    } else {
      const cit = citizens.find(c => c.Citizen_ID === citizenId);
      if (!cit) {
        alert('يرجى اختيار مراجع مسجل بالنظام أولاً.');
        return;
      }

      addOrganizationRecord({
        Citizen_ID: cit.Citizen_ID,
        FullName: cit.FullName,
        District: cit.District,
        SubDistrict: cit.SubDistrict,
        Phone1: cit.Phone1,
        OrgRating: orgRating as any,
        InfluenceType: influence,
        EvaluationPoints: points,
        ElectionCenter: electionCenter || undefined,
        StationNumber: stationNumber || undefined,
        Notes: notes || undefined
      });

      setShowAddModal(false);
    }

    setNotes('');
    setElectionCenter('');
    setStationNumber('');
  };

  const openEdit = (rec: OrganizationRecord) => {
    setEditingRecord(rec);
    setCitizenId(rec.Citizen_ID);
    setEditOrgName(rec.FullName || '');
    setEditOrgPhone(rec.Phone1 || rec.Phone || '');
    setOrgRating(rec.OrgRating);
    setInfluence(rec.InfluenceType || 'وجيه منطقة');
    setPoints(rec.EvaluationPoints || 90);
    setElectionCenter(rec.ElectionCenter || '');
    setStationNumber(rec.StationNumber || '');
    setNotes(rec.Notes || '');
    setShowAddModal(true);
  };

  const openCreateForCitizen = (cit: Citizen) => {
    const existing = organizationRecords.find(r => r.Citizen_ID === cit.Citizen_ID);
    if (existing) {
      openEdit(existing);
    } else {
      setEditingRecord(null);
      setCitizenId(cit.Citizen_ID);
      setOrgRating('مؤيد');
      setInfluence('وجيه منطقة');
      setPoints(90);
      setElectionCenter('');
      setStationNumber('');
      setNotes('');
      setShowAddModal(true);
    }
  };

  // Open evaluation modal for a specific record
  const handleOpenEvaluation = (rec: OrganizationRecord) => {
    const cit = citizens.find(c => c.Citizen_ID === rec.Citizen_ID) || null;
    setEvaluatingRecord(rec);
    setEvaluatingCitizen(cit);
    setShowEvaluationModal(true);
  };

  // Open evaluation modal for a citizen directly
  const handleOpenEvaluationForCitizen = (cit: Citizen) => {
    const rec = organizationRecords.find(r => r.Citizen_ID === cit.Citizen_ID) || null;
    setEvaluatingCitizen(cit);
    setEvaluatingRecord(rec);
    setShowEvaluationModal(true);
  };

  // Open new evaluation modal with selector
  const handleOpenNewEvaluation = () => {
    setEvaluatingRecord(null);
    setEvaluatingCitizen(citizens[0] || null);
    setShowEvaluationModal(true);
  };

  // Save evaluation handler
  const handleSaveEvaluation = (record: OrganizationRecord, teamMemberToOpen?: OrgTeamMember | null) => {
    const exists = organizationRecords.some(r => r.Citizen_ID === record.Citizen_ID);
    if (exists) {
      updateOrganizationRecord(record);
    } else {
      addOrganizationRecord(record);
    }

    if (teamMemberToOpen) {
      setTeamMembers(prev => {
        const filtered = prev.filter(m => m.Citizen_ID !== teamMemberToOpen.Citizen_ID);
        return [teamMemberToOpen, ...filtered];
      });
      // Automatically open the independent team member card!
      setSelectedMemberForCard(teamMemberToOpen);
      setShowCardModal(true);
    }
  };

  const handleDeleteTeamMember = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الملف من سجل فريق العمل؟')) {
      setTeamMembers(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleAddMemberManually = () => {
    if (citizens.length === 0) {
      alert('لا يوجد مراجعين مسجلين لاختيارهم');
      return;
    }
    const citizenName = prompt('أدخل الاسم أو اختر من القائمة، أو انقر موافق لفتح استمارة تقييم متابعة');
    if (citizenName) {
      const match = citizens.find(c => c.FullName.includes(citizenName));
      if (match) {
        handleOpenEvaluationForCitizen(match);
      } else {
        handleOpenNewEvaluation();
      }
    } else {
      handleOpenNewEvaluation();
    }
  };

  // Render final result badge helper
  const renderFinalResultBadge = (rec: OrganizationRecord) => {
    const ev = rec.finalEvaluation;
    if (!ev || !ev.finalResult) {
      return (
        <button
          onClick={() => handleOpenEvaluation(rec)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-dashed border-slate-300 hover:border-indigo-300 transition-colors cursor-pointer"
          title="تسجيل النتيجة النهائية للطلب"
        >
          <Plus className="w-3 h-3" />
          <span>قيد التقييم (تسجيل)</span>
        </button>
      );
    }

    switch (ev.finalResult) {
      case 'تم اكمال الطلب بالكامل':
        return (
          <div className="flex flex-col items-start gap-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>تم إكمال الطلب بالكامل</span>
            </span>
            <span className="text-[9px] text-slate-500 pr-1 font-medium">
              النتيجة: {ev.case1_citizenObtainedGoal || 'نعم'} | راضي: {ev.case1_citizenSatisfied || 'نعم'}
            </span>
          </div>
        );
      case 'تم حل الطلب جزئيا':
        return (
          <div className="flex flex-col items-start gap-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
              <AlertCircle className="w-3 h-3 text-blue-600" />
              <span>تم حل الطلب جزئياً</span>
            </span>
            <span className="text-[9px] text-slate-500 pr-1 font-medium">
              السبب: {ev.case2_incompleteReason?.slice(0, 18) || 'عدم اختصاص'}...
            </span>
          </div>
        );
      case 'الطلب يحتاج متابعة':
        return (
          <div className="flex flex-col items-start gap-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>الطلب يحتاج متابعة</span>
            </span>
            <span className="text-[9px] text-slate-500 pr-1 font-medium">
              {ev.case3_followupTypes?.[0] || 'متابعة'} {ev.case3_wantsToJoinTeam === 'نعم' ? '• (مفتاح فريق)' : ''}
            </span>
          </div>
        );
      case 'لم يتم حل الطلب':
        return (
          <div className="flex flex-col items-start gap-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
              <XCircle className="w-3 h-3 text-rose-600" />
              <span>لم يتم حل الطلب</span>
            </span>
            <span className="text-[9px] text-slate-500 pr-1 font-medium">
              السبب: {ev.case4_failureReason || 'خارج الاختصاص'} ({ev.case4_citizenStance || 'متفهم'})
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 text-right">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <Users2 className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">قسم التنظيم والموقف الجماهيري</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              المحطة الرابعة في المسار الإداري
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            تقييم النتيجة النهائية للطلبات (مكتمل بالكامل، جزئي، يحتاج متابعة، لم يحل)، إدارة ملفات فريق العمل والمفاتيح الانتخابية، والتقارير والإحصائيات التراكمية.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
          <button
            onClick={() => setActiveSection('dashboard')}
            className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="الانتقال إلى لوحة تحكم وإحصائيات قسم التنظيم والجماهير"
          >
            <BarChart3 className="w-4 h-4 text-purple-600" />
            <span>لوحة إحصائيات التنظيم</span>
          </button>

          {/* Main Action: New Request Outcome Evaluation */}
          <button
            onClick={handleOpenNewEvaluation}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="تقييم وتوثيق مخرجات الطلب النهائية للمواطن"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>تسجيل النتيجة النهائية للطلب</span>
          </button>

          <button
            onClick={() => setShowAiDrafterModal(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="توليد طلب تنظيمي رسمي بالذكاء الاصطناعي"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>توليد طلب بالذكاء الاصطناعي</span>
          </button>

          <button
            onClick={() => {
              setEditingRecord(null);
              setCitizenId(citizens[0]?.Citizen_ID || '');
              setShowAddModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ تقييم تنظيمي</span>
          </button>
        </div>
      </div>

      {/* 5-Column Desktop Icon Grid for Organization & Public Stance */}
      <OfficeIconTilesGrid
        title="أيقونات ومهام قسم التنظيم والموقف الجماهيري"
        subtitle="انقر على أي أيقونة للاستعراض المباشر أو تسجيل التقييمات النهائية والكوادر"
        columns={5}
        items={[
          {
            id: 'org_records_tab',
            title: 'سجلات الموقف والنتائج',
            subtitle: 'الموقف الجماهيري للمراجعين',
            icon: Users2,
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            iconBg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
            badge: filteredRecords.length,
            badgeColor: 'bg-indigo-600 text-white',
            isActive: activeTab === 'records',
            onClick: () => setActiveTab('records')
          },
          {
            id: 'org_referred_tab',
            title: 'الوارد والمحال للتنظيم',
            subtitle: 'المراجعون المحالون لقسم التنظيم',
            icon: SendHorizontal,
            iconColor: 'text-amber-600 dark:text-amber-400',
            iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
            badge: referredCitizens.length,
            badgeColor: 'bg-amber-600 text-white',
            isActive: activeTab === 'referred_citizens',
            onClick: () => setActiveTab('referred_citizens')
          },
          {
            id: 'org_evaluation_tab',
            title: 'تسجيل النتيجة النهائية للطلب',
            subtitle: 'مكتمل / جزئي / متابعة / لم يحل',
            icon: CheckCircle2,
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
            onClick: () => handleOpenNewEvaluation()
          },
          {
            id: 'org_team_tab',
            title: 'سجل فريق العمل والكوادر',
            subtitle: 'المفاتيح الانتخابية والنشطاء',
            icon: UserCheck,
            iconColor: 'text-purple-600 dark:text-purple-400',
            iconBg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
            badge: teamMembers.length,
            badgeColor: 'bg-purple-600 text-white',
            isActive: activeTab === 'team_members',
            onClick: () => setActiveTab('team_members')
          },
          {
            id: 'org_reports_tab',
            title: 'إحصائيات وتقارير النتائج',
            subtitle: 'الرسوم البيانية وتوزيع الأقضية',
            icon: BarChart3,
            iconColor: 'text-rose-600 dark:text-rose-400',
            iconBg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
            isActive: activeTab === 'reports',
            onClick: () => setActiveTab('reports')
          }
        ]}
      />

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'records'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>سجلات الموقف والنتائج التنظيمية ({filteredRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'reports'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-emerald-500" />
          <span>إحصائيات وتقارير النتائج</span>
        </button>

        <button
          onClick={() => setActiveTab('team_members')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 relative ${
            activeTab === 'team_members'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-purple-500" />
          <span>فريق العمل والمفاتيح المستقلة ({teamMembers.length})</span>
          {teamMembers.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('referred_citizens')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 relative ${
            activeTab === 'referred_citizens'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <SendHorizontal className="w-4 h-4 text-amber-500" />
          <span>الوارد المحال من الإدارة ومدير المكتب ({referredCitizens.length})</span>
          {referredCitizens.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-ping"></span>
          )}
        </button>
      </div>

      {/* Tab 1: Records Table */}
      {activeTab === 'records' && (
        <div className="space-y-3">
          {/* Quick Filters */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث بالاسم، الرمز، القضاء، أو الثقل..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs text-right focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <select
                  value={finalResultFilter}
                  onChange={(e) => setFinalResultFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-semibold"
                >
                  <option value="all">كل النتائج النهائية للطلبات</option>
                  <option value="تم اكمال الطلب بالكامل">تم إكمال الطلب بالكامل</option>
                  <option value="تم حل الطلب جزئيا">تم حل الطلب جزئياً</option>
                  <option value="الطلب يحتاج متابعة">الطلب يحتاج متابعة</option>
                  <option value="لم يتم حل الطلب">لم يتم حل الطلب</option>
                  <option value="unassigned">قيد التقييم (بدون نتيجة مسجلة)</option>
                </select>
              </div>

              <div>
                <select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="all">جميع المواقف التنظيمية</option>
                  <option value="مؤيد">مؤيد</option>
                  <option value="متردد">متردد</option>
                  <option value="معارض">معارض</option>
                  <option value="كادر قيادي">كادر قيادي</option>
                  <option value="شخصية مؤثرة">شخصية مؤثرة</option>
                </select>
              </div>

              <div>
                <select
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="all">جميع الأقضية والمناطق</option>
                  {districts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold text-slate-800">
                سجلات التنظيم والنتائج النهائية الموثقة ({filteredRecords.length})
              </span>
              <span className="text-[11px] text-slate-400">
                تحديث لحظي وتوثيق معتمد
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">الرقم التعريفي</th>
                    <th className="p-3.5">المواطن المراجع</th>
                    <th className="p-3.5">النتيجة النهائية للطلب</th>
                    <th className="p-3.5">الموقف التنظيمي</th>
                    <th className="p-3.5">الثقل الاجتماعي</th>
                    <th className="p-3.5">المركز والمحطة</th>
                    <th className="p-3.5 text-center">الإجراءات والتقييم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        لا توجد سجلات تنظيمية مطابقة لخيارات البحث المحددة.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec) => {
                      const memberMatch = teamMembers.find(m => m.Citizen_ID === rec.Citizen_ID);
                      const isTeam = rec.isTeamMember || !!memberMatch;

                      return (
                        <tr key={rec.Citizen_ID} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-indigo-600 text-[11px] whitespace-nowrap">
                            {rec.Citizen_ID}
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{rec.FullName}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>{rec.District || 'ذي قار'}</span>
                              <span>•</span>
                              <span className="font-mono" dir="ltr">{rec.Phone1 || rec.Phone || '—'}</span>
                            </div>
                          </td>
                          <td className="p-3.5">
                            {renderFinalResultBadge(rec)}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                              rec.OrgRating === 'مؤيد' || rec.OrgRating === 'كادر قيادي'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : rec.OrgRating === 'معارض'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {rec.OrgRating}
                            </span>
                          </td>
                          <td className="p-3.5 font-semibold text-slate-800">
                            <div>{rec.InfluenceType || 'مواطن'}</div>
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                              <span>النقاط:</span>
                              <span className="font-mono font-bold text-indigo-600">{rec.EvaluationPoints || 0}</span>
                            </div>
                          </td>
                          <td className="p-3.5 text-slate-600 text-[11px]">
                            <div>{rec.ElectionCenter || 'غير محدد'}</div>
                            {rec.StationNumber && (
                              <span className="text-[10px] text-slate-400 block">{rec.StationNumber}</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* Evaluation Button */}
                              <button
                                onClick={() => handleOpenEvaluation(rec)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                                title="تسجيل أو تعديل استبيان النتيجة النهائية للطلب"
                              >
                                <FileText className="w-3 h-3" />
                                <span>{rec.finalEvaluation ? 'النتيجة' : '+ تقييم النتيجة'}</span>
                              </button>

                              {/* Independent team member badge/card */}
                              {isTeam && (
                                <button
                                  onClick={() => {
                                    if (memberMatch) {
                                      setSelectedMemberForCard(memberMatch);
                                      setShowCardModal(true);
                                    } else {
                                      const mockMember: OrgTeamMember = {
                                        id: `TM-${rec.Citizen_ID.replace('ONA-', '')}`,
                                        Citizen_ID: rec.Citizen_ID,
                                        FullName: rec.FullName,
                                        Phone: rec.Phone1,
                                        District: rec.District,
                                        SubDistrict: rec.SubDistrict,
                                        ElectionCenter: rec.ElectionCenter,
                                        Role: rec.teamMemberRole || 'مفتاح نهائي',
                                        JoinedDate: rec.UpdatedAt || '2026-02-01',
                                        Status: 'نشط'
                                      };
                                      setSelectedMemberForCard(mockMember);
                                      setShowCardModal(true);
                                    }
                                  }}
                                  className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                                  title="عرض بطاقة المفتاح التنظيمي المستقل"
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>ملف المفتاح</span>
                                </button>
                              )}

                              {/* General Edit */}
                              <button
                                onClick={() => openEdit(rec)}
                                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-bold cursor-pointer transition-colors"
                                title="تعديل الموقف التنظيمي"
                              >
                                تعديل
                              </button>

                              {/* Citizen History Modal */}
                              <button
                                onClick={() => {
                                  const cit = citizens.find(c => c.Citizen_ID === rec.Citizen_ID);
                                  if (cit) setSelectedCitizenForHistory(cit);
                                }}
                                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
                                title="السجل التراكمي للمواطن"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Statistics and Reports */}
      {activeTab === 'reports' && (
        <OrgStatisticsAndReports
          records={organizationRecords}
          teamMembers={teamMembers}
          onOpenEvaluation={handleOpenEvaluation}
          onOpenTeamMemberCard={(member) => {
            setSelectedMemberForCard(member);
            setShowCardModal(true);
          }}
        />
      )}

      {/* Tab 3: Team Members Manager */}
      {activeTab === 'team_members' && (
        <OrgTeamMembersManager
          teamMembers={teamMembers}
          onOpenCard={(member) => {
            setSelectedMemberForCard(member);
            setShowCardModal(true);
          }}
          onDeleteMember={handleDeleteTeamMember}
          onAddMemberManually={handleAddMemberManually}
        />
      )}

      {/* Tab 4: Referred Citizens */}
      {activeTab === 'referred_citizens' && (
        <div className="space-y-3">
          {referredCitizens.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center text-slate-500 text-xs shadow-xs">
              لا يوجد مراجعين محالين حالياً إلى قسم التنظيم والموقف الجماهيري.
            </div>
          ) : (
            referredCitizens.map((cit) => {
              const orgRec = organizationRecords.find(r => r.Citizen_ID === cit.Citizen_ID);
              const latestDirective = cit.WorkflowHistory && cit.WorkflowHistory.length > 0
                ? cit.WorkflowHistory[cit.WorkflowHistory.length - 1]
                : null;

              return (
                <div
                  key={cit.Citizen_ID}
                  className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 shadow-xs space-y-3 transition-all text-right"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                        {cit.Citizen_ID}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900">{cit.FullName}</h4>
                      {cit.Surname && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          عشيرة: {cit.Surname}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        <span>محال إلى مدير التنظيم</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {orgRec ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                          الموقف: {orgRec.OrgRating} ({orgRec.InfluenceType || 'مواطن'})
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-bold text-[11px]">
                          بانتظار تسجيل التقييم التنظيمي
                        </span>
                      )}
                    </div>
                  </div>

                  {latestDirective && (
                    <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 text-xs text-indigo-950 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-indigo-600 font-bold">
                        <span>آخر إحالة من: {latestDirective.ActionBy} ({latestDirective.FromStage} ← {latestDirective.ToStage})</span>
                        <span className="font-mono">{latestDirective.Timestamp}</span>
                      </div>
                      <p className="font-medium text-slate-800">
                        توجيه الإحالة: {latestDirective.DirectiveNotes || 'لا توجد ملاحظات إضافية'}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] mb-0.5">الهاتف</span>
                      <span className="font-mono font-bold text-slate-900" dir="ltr">{cit.Phone1}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] mb-0.5">السكن</span>
                      <span className="font-semibold text-slate-900">{cit.District} - {cit.SubDistrict}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] mb-0.5">المهنة</span>
                      <span className="font-semibold text-slate-900">{cit.Job || 'كاسب'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
                    <button
                      onClick={() => setSelectedCitizenForHistory(cit)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>السجل التراكمي</span>
                    </button>

                    <button
                      onClick={() => handleOpenEvaluationForCitizen(cit)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تسجيل النتيجة النهائية للطلب</span>
                    </button>

                    <button
                      onClick={() => openCreateForCitizen(cit)}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{orgRec ? 'تعديل التقييم والبيانات الانتخابية' : '+ تثبيت التقييم التنظيمي'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add / Edit General Org Modal */}
      {(showAddModal || editingRecord) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-xl p-5 md:p-6 space-y-4 max-h-[90vh] overflow-y-auto text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users2 className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingRecord ? `تعديل الموقف التنظيمي (${editingRecord.FullName})` : 'إضافة وتوثيق الموقف التنظيمي'}
                  </h3>
                  <p className="text-[11px] text-slate-500">تحديد الولاء، الثقل الاجتماعي، والبيانات الانتخابية</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingRecord(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGeneralOrg} className="space-y-3 text-right">
              {!editingRecord ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-0.5">اختر المراجع *</label>
                  <select
                    value={citizenId}
                    onChange={(e) => setCitizenId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  >
                    <option value="">-- اختر مراجع مسجل بالاستعلامات --</option>
                    {citizens.map((c) => (
                      <option key={c.Citizen_ID} value={c.Citizen_ID}>
                        {c.FullName} ({c.Citizen_ID}) - {c.District}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">بيانات المراجع التنظيمية:</span>
                    <span className="font-mono text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {editingRecord.Citizen_ID}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-0.5">الاسم الرباعي واللقب</label>
                      <input
                        type="text"
                        value={editOrgName}
                        onChange={(e) => setEditOrgName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-0.5">رقم الهاتف</label>
                      <input
                        type="tel"
                        value={editOrgPhone}
                        onChange={(e) => setEditOrgPhone(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-0.5">الموقف التنظيمي</label>
                  <select
                    value={orgRating}
                    onChange={(e) => setOrgRating(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700"
                  >
                    <option value="مؤيد">مؤيد</option>
                    <option value="متردد">متردد</option>
                    <option value="معارض">معارض</option>
                    <option value="كادر قيادي">كادر قيادي</option>
                    <option value="شخصية مؤثرة">شخصية مؤثرة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-0.5">الثقل الاجتماعي</label>
                  <select
                    value={influence}
                    onChange={(e) => setInfluence(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="شيخ عشيرة">شيخ عشيرة</option>
                    <option value="وجيه منطقة">وجيه منطقة</option>
                    <option value="ناشط مدني">ناشط مدني</option>
                    <option value="أكاديمي">أكاديمي</option>
                    <option value="كاسب">كاسب</option>
                    <option value="متقاعد">متقاعد</option>
                    <option value="خريج">خريج</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-0.5">نقاط التقييم (0 - 100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs text-left font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-0.5">المركز الانتخابي</label>
                  <input
                    type="text"
                    value={electionCenter}
                    onChange={(e) => setElectionCenter(e.target.value)}
                    placeholder="مدرسة النصر الابتدائية"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-0.5">رقم المحطة</label>
                  <input
                    type="text"
                    value={stationNumber}
                    onChange={(e) => setStationNumber(e.target.value)}
                    placeholder="محطة 3"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-0.5">ملاحظات إضافية ومواقف ميدانية</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="ملاحظات حول الحضور، التأثير على العائلة، والجاهزية للمؤتمرات..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingRecord(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                >
                  حفظ البيانات التنظيمية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Org Final Evaluation Modal */}
      <OrgFinalEvaluationModal
        isOpen={showEvaluationModal}
        onClose={() => {
          setShowEvaluationModal(false);
          setEvaluatingRecord(null);
          setEvaluatingCitizen(null);
        }}
        citizen={evaluatingCitizen}
        initialRecord={evaluatingRecord}
        requests={requests}
        citizens={citizens}
        onSave={handleSaveEvaluation}
      />

      {/* Independent Team Member Card Modal */}
      <OrgTeamMemberCardModal
        isOpen={showCardModal}
        onClose={() => {
          setShowCardModal(false);
          setSelectedMemberForCard(null);
        }}
        member={selectedMemberForCard}
      />

      {/* AI Request Drafter Modal */}
      <AiRequestDrafterModal
        isOpen={showAiDrafterModal}
        onClose={() => setShowAiDrafterModal(false)}
      />
    </div>
  );
};
