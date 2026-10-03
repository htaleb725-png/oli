import React, { useState, useEffect } from 'react';
import { 
  OrgFinalResult, 
  OrgFinalEvaluation, 
  OrganizationRecord, 
  Citizen, 
  OfficeRequest,
  OrgTeamMember 
} from '../types';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Star, 
  Users, 
  Save, 
  X, 
  FileText,
  UserCheck,
  ChevronDown
} from 'lucide-react';

interface OrgFinalEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  citizen?: Citizen | null;
  initialRecord?: OrganizationRecord | null;
  requests: OfficeRequest[];
  citizens: Citizen[];
  onSave: (record: OrganizationRecord, teamMemberToOpen?: OrgTeamMember | null) => void;
}

export const OrgFinalEvaluationModal: React.FC<OrgFinalEvaluationModalProps> = ({
  isOpen,
  onClose,
  citizen,
  initialRecord,
  requests,
  citizens,
  onSave
}) => {
  const [selectedCitizenId, setSelectedCitizenId] = useState(citizen?.Citizen_ID || initialRecord?.Citizen_ID || '');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  
  // The 4 main results:
  const [finalResult, setFinalResult] = useState<OrgFinalResult>('تم اكمال الطلب بالكامل');

  // Case 1 states:
  const [case1_goal, setCase1Goal] = useState<'نعم بالكامل' | 'نعم مع اجراء بسيط'>('نعم بالكامل');
  const [case1_satisfied, setCase1Satisfied] = useState<'نعم' | 'لا'>('نعم');
  const [case1_rating, setCase1Rating] = useState<number>(5);
  const [case1_returnedThanks, setCase1ReturnedThanks] = useState<'نعم' | 'لا'>('نعم');
  const [case1_notes, setCase1Notes] = useState('');

  // Case 2 states:
  const [case2_completed, setCase2Completed] = useState('');
  const [case2_uncompleted, setCase2Uncompleted] = useState('');
  const [case2_reason, setCase2Reason] = useState<string>('عدم اختصاص الجهة المعنية');
  const [case2_customReason, setCase2CustomReason] = useState('');
  const [case2_accepted, setCase2Accepted] = useState<'نعم' | 'لا'>('نعم');
  const [case2_officeNeedsExtra, setCase2OfficeNeedsExtra] = useState<'نعم' | 'لا'>('لا');
  const [case2_notes, setCase2Notes] = useState('');

  // Case 3 states:
  const [case3_followup, setCase3Followup] = useState<string[]>(['متابعة مع الجهة نفسها']);
  const [case3_officerNotes, setCase3OfficerNotes] = useState('');
  // دور مسؤول التنظيم:
  const [case3_serviceSatisfied, setCase3ServiceSatisfied] = useState<'نعم' | 'لا'>('نعم');
  const [case3_needsFollowup, setCase3NeedsFollowup] = useState<'نعم' | 'لا'>('نعم');
  const [case3_futureComm, setCase3FutureComm] = useState<'نعم' | 'لا'>('نعم');
  const [case3_seminarParticipation, setCase3SeminarParticipation] = useState<'نعم' | 'لا'>('نعم');
  const [case3_visitCount, setCase3VisitCount] = useState('2 - 3 مرات');
  const [case3_joinTeam, setCase3JoinTeam] = useState<'نعم' | 'لا'>('نعم');
  const [case3_teamRole, setCase3TeamRole] = useState('مفتاح نهائي');

  // Case 4 states:
  const [case4_reason, setCase4Reason] = useState<string>('خارج اختصاص المكتب');
  const [case4_customReason, setCase4CustomReason] = useState('');
  const [case4_explained, setCase4Explained] = useState<'نعم' | 'لا'>('نعم');
  const [case4_stance, setCase4Stance] = useState<'متفهم' | 'غير متفهم' | 'غير راضي'>('متفهم');
  const [case4_notes, setCase4Notes] = useState('');

  // Sync when initialRecord or citizen changes
  useEffect(() => {
    if (initialRecord) {
      setSelectedCitizenId(initialRecord.Citizen_ID);
      if (initialRecord.finalEvaluation) {
        const ev = initialRecord.finalEvaluation;
        setFinalResult(ev.finalResult || 'تم اكمال الطلب بالكامل');
        if (ev.requestId) setSelectedRequestId(ev.requestId);

        // Case 1
        if (ev.case1_citizenObtainedGoal) setCase1Goal(ev.case1_citizenObtainedGoal);
        if (ev.case1_citizenSatisfied) setCase1Satisfied(ev.case1_citizenSatisfied);
        if (ev.case1_personalRating) setCase1Rating(ev.case1_personalRating);
        if (ev.case1_citizenReturnedForThanks) setCase1ReturnedThanks(ev.case1_citizenReturnedForThanks);
        if (ev.case1_officerNotes) setCase1Notes(ev.case1_officerNotes);

        // Case 2
        if (ev.case2_completedPart) setCase2Completed(ev.case2_completedPart);
        if (ev.case2_uncompletedPart) setCase2Uncompleted(ev.case2_uncompletedPart);
        if (ev.case2_incompleteReason) setCase2Reason(ev.case2_incompleteReason);
        if (ev.case2_customReason) setCase2CustomReason(ev.case2_customReason);
        if (ev.case2_citizenAcceptedPartial) setCase2Accepted(ev.case2_citizenAcceptedPartial);
        if (ev.case2_officeNeedsExtraAction) setCase2OfficeNeedsExtra(ev.case2_officeNeedsExtraAction);
        if (ev.case2_officerNotes) setCase2Notes(ev.case2_officerNotes);

        // Case 3
        if (ev.case3_followupTypes) setCase3Followup(ev.case3_followupTypes);
        if (ev.case3_officerNotes) setCase3OfficerNotes(ev.case3_officerNotes);
        if (ev.case3_citizenSatisfiedWithService) setCase3ServiceSatisfied(ev.case3_citizenSatisfiedWithService);
        if (ev.case3_needsFollowup) setCase3NeedsFollowup(ev.case3_needsFollowup);
        if (ev.case3_agreedFutureCommunication) setCase3FutureComm(ev.case3_agreedFutureCommunication);
        if (ev.case3_participateInSeminarOrInitiative) setCase3SeminarParticipation(ev.case3_participateInSeminarOrInitiative);
        if (ev.case3_officeVisitFrequency) setCase3VisitCount(ev.case3_officeVisitFrequency);
        if (ev.case3_wantsToJoinTeam) setCase3JoinTeam(ev.case3_wantsToJoinTeam);
        if (ev.case3_teamRole) setCase3TeamRole(ev.case3_teamRole);

        // Case 4
        if (ev.case4_failureReason) setCase4Reason(ev.case4_failureReason);
        if (ev.case4_customFailureReason) setCase4CustomReason(ev.case4_customFailureReason);
        if (ev.case4_explainedReasonToCitizen) setCase4Explained(ev.case4_explainedReasonToCitizen);
        if (ev.case4_citizenStance) setCase4Stance(ev.case4_citizenStance as any);
        if (ev.case4_officerNotes) setCase4Notes(ev.case4_officerNotes);
      }
    } else if (citizen) {
      setSelectedCitizenId(citizen.Citizen_ID);
    }
  }, [initialRecord, citizen]);

  if (!isOpen) return null;

  const currentCitizen = citizens.find(c => c.Citizen_ID === selectedCitizenId) || citizen;
  const citizenRequests = requests.filter(r => r.Citizen_ID === selectedCitizenId);

  const toggleFollowupType = (type: string) => {
    setCase3Followup(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleSaveEvaluation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCitizen) {
      alert('يرجى اختيار مراجع أولاً لتسجيل النتيجة النهائية.');
      return;
    }

    const evaluation: OrgFinalEvaluation = {
      id: initialRecord?.finalEvaluation?.id || `EVAL-${Date.now().toString().slice(-5)}`,
      evaluatedAt: new Date().toISOString().split('T')[0],
      evaluatedBy: 'مسؤول قسم التنظيم',
      finalResult,
      requestId: selectedRequestId || citizenRequests[0]?.Request_ID,
      requestSubject: citizenRequests.find(r => r.Request_ID === selectedRequestId)?.Details?.slice(0, 60),

      // Case 1
      ...(finalResult === 'تم اكمال الطلب بالكامل' && {
        case1_citizenObtainedGoal: case1_goal,
        case1_citizenSatisfied: case1_satisfied,
        case1_personalRating: case1_rating,
        case1_citizenReturnedForThanks: case1_returnedThanks,
        case1_officerNotes: case1_notes
      }),

      // Case 2
      ...(finalResult === 'تم حل الطلب جزئيا' && {
        case2_completedPart: case2_completed,
        case2_uncompletedPart: case2_uncompleted,
        case2_incompleteReason: case2_reason === 'سبب اخر' && case2_customReason ? case2_customReason : case2_reason,
        case2_customReason: case2_customReason,
        case2_citizenAcceptedPartial: case2_accepted,
        case2_officeNeedsExtraAction: case2_officeNeedsExtra,
        case2_officerNotes: case2_notes
      }),

      // Case 3
      ...(finalResult === 'الطلب يحتاج متابعة' && {
        case3_followupTypes: case3_followup,
        case3_officerNotes: case3_officerNotes,
        case3_citizenSatisfiedWithService: case3_serviceSatisfied,
        case3_needsFollowup: case3_needsFollowup,
        case3_agreedFutureCommunication: case3_futureComm,
        case3_participateInSeminarOrInitiative: case3_seminarParticipation,
        case3_officeVisitFrequency: case3_visitCount,
        case3_wantsToJoinTeam: case3_joinTeam,
        case3_teamMemberFileOpened: case3_joinTeam === 'نعم',
        case3_teamRole: case3_joinTeam === 'نعم' ? case3_teamRole : undefined
      }),

      // Case 4
      ...(finalResult === 'لم يتم حل الطلب' && {
        case4_failureReason: case4_reason === 'سبب اخر' && case4_customReason ? case4_customReason : case4_reason,
        case4_customFailureReason: case4_customReason,
        case4_explainedReasonToCitizen: case4_explained,
        case4_citizenStance: case4_stance,
        case4_specialNote: `نتيجة الطلب غير منجز سبب عدم الانجاز: ${case4_reason === 'سبب اخر' && case4_customReason ? case4_customReason : case4_reason}`,
        case4_officerNotes: case4_notes
      })
    };

    let teamMemberToOpen: OrgTeamMember | null = null;
    if (finalResult === 'الطلب يحتاج متابعة' && case3_joinTeam === 'نعم') {
      teamMemberToOpen = {
        id: `TM-${Date.now().toString().slice(-5)}`,
        Citizen_ID: currentCitizen.Citizen_ID,
        FullName: currentCitizen.FullName,
        Phone: currentCitizen.Phone1,
        District: currentCitizen.District,
        SubDistrict: currentCitizen.SubDistrict,
        Role: case3_teamRole || 'مفتاح نهائي',
        JoinedDate: new Date().toISOString().split('T')[0],
        OfficeVisitCount: case3_visitCount,
        Notes: `انضم كعضو فريق بعد استبيان المتابعة للطلب. ملاحظة التنظيم: ${case3_officerNotes}`,
        Status: 'نشط'
      };
    }

    const updatedRecord: OrganizationRecord = {
      ...(initialRecord || {
        Citizen_ID: currentCitizen.Citizen_ID,
        FullName: currentCitizen.FullName,
        District: currentCitizen.District,
        SubDistrict: currentCitizen.SubDistrict,
        Phone1: currentCitizen.Phone1,
        OrgRating: finalResult === 'تم اكمال الطلب بالكامل' ? 'مؤيد' : 'محايد',
        InfluenceType: 'مواطن مسجل'
      }),
      finalEvaluation: evaluation,
      isTeamMember: case3_joinTeam === 'نعم' || initialRecord?.isTeamMember,
      teamMemberRole: case3_joinTeam === 'نعم' ? case3_teamRole : initialRecord?.teamMemberRole
    };

    onSave(updatedRecord, teamMemberToOpen);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-2xl p-5 sm:p-7 space-y-5 text-right my-8 max-h-[92vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                تقييم النتيجة النهائية للطلب واستبيان المتابعة
              </h3>
              <p className="text-xs text-slate-500">
                قسم التنظيم والموقف الجماهيري - دراسة مخرجات الطلب ومستوى رضا المواطن
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSaveEvaluation} className="space-y-5">
          {/* Citizen & Request Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1">المواطن صاحب المعاملة *</label>
              {citizen ? (
                <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-900">{citizen.FullName}</span>
                  <span className="font-mono text-indigo-700 font-bold">{citizen.Citizen_ID}</span>
                </div>
              ) : (
                <select
                  value={selectedCitizenId}
                  onChange={(e) => setSelectedCitizenId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="">-- اختر مراجع من القائمة --</option>
                  {citizens.map(c => (
                    <option key={c.Citizen_ID} value={c.Citizen_ID}>
                      {c.FullName} ({c.Citizen_ID}) - {c.District}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">الطلب المرتبط بالتقييم</label>
              <select
                value={selectedRequestId}
                onChange={(e) => setSelectedRequestId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">-- عام على مجمل المراجعات أو اختر طلباً --</option>
                {citizenRequests.map(r => (
                  <option key={r.Request_ID} value={r.Request_ID}>
                    {r.Request_ID} - {r.Entity} ({r.ProcessingStatus})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4 Main Results Selector with Instant Dynamic Switch */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              النتيجة النهائية للطلب * <span className="text-slate-400 font-normal">(بمجرد اختيار النتيجة تتغير الأسئلة بالكامل أدناه)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              
              {/* Option 1 */}
              <button
                type="button"
                onClick={() => setFinalResult('تم اكمال الطلب بالكامل')}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  finalResult === 'تم اكمال الطلب بالكامل'
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold">1. تم إكمال الطلب بالكامل</span>
                  <CheckCircle2 className={`w-4 h-4 ${finalResult === 'تم اكمال الطلب بالكامل' ? 'text-emerald-600' : 'text-slate-400'}`} />
                </div>
                <span className="text-[10px] text-slate-500">تم تحقيق النتيجة المرجوة بالكامل بنجاح</span>
              </button>

              {/* Option 2 */}
              <button
                type="button"
                onClick={() => setFinalResult('تم حل الطلب جزئيا')}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  finalResult === 'تم حل الطلب جزئيا'
                    ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold">2. تم حل الطلب جزئياً</span>
                  <Clock className={`w-4 h-4 ${finalResult === 'تم حل الطلب جزئيا' ? 'text-amber-600' : 'text-slate-400'}`} />
                </div>
                <span className="text-[10px] text-slate-500">تم إنجاز أجزاء من الطلب وبقيت أخرى</span>
              </button>

              {/* Option 3 */}
              <button
                type="button"
                onClick={() => setFinalResult('الطلب يحتاج متابعة')}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  finalResult === 'الطلب يحتاج متابعة'
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold">3. الطلب يحتاج متابعة</span>
                  <AlertCircle className={`w-4 h-4 ${finalResult === 'الطلب يحتاج متابعة' ? 'text-blue-600' : 'text-slate-400'}`} />
                </div>
                <span className="text-[10px] text-slate-500">يتطلب اتصالات ومخاطبات واستبيان للتنظيم</span>
              </button>

              {/* Option 4 */}
              <button
                type="button"
                onClick={() => setFinalResult('لم يتم حل الطلب')}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  finalResult === 'لم يتم حل الطلب'
                    ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 text-rose-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold">4. لم يتم حل الطلب</span>
                  <XCircle className={`w-4 h-4 ${finalResult === 'لم يتم حل الطلب' ? 'text-rose-600' : 'text-slate-400'}`} />
                </div>
                <span className="text-[10px] text-slate-500">تعذر الإنجاز لأسباب قانونية أو خارج الاختصاص</span>
              </button>

            </div>
          </div>

          {/* DYNAMIC FORM SECTIONS BASED ON SELECTED RESULT */}
          
          {/* ======================================================== */}
          {/* الحالة الأولى: تم حل الطلب بالكامل */}
          {/* ======================================================== */}
          {finalResult === 'تم اكمال الطلب بالكامل' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs pb-2 border-b border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>أسئلة الحالة الأولى: تم إكمال وحل الطلب بالكامل</span>
              </div>

              {/* Q1: هل المواطن حصل على النتيجة التي طلبها؟ */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  1. هل المواطن حصل على النتيجة التي طلبها؟
                </label>
                <div className="grid grid-cols-2 gap-2 max-w-md">
                  <label className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                    case1_goal === 'نعم بالكامل' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="case1_goal"
                      checked={case1_goal === 'نعم بالكامل'}
                      onChange={() => setCase1Goal('نعم بالكامل')}
                      className="hidden"
                    />
                    <span>نعم بالكامل</span>
                  </label>
                  <label className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                    case1_goal === 'نعم مع اجراء بسيط' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="case1_goal"
                      checked={case1_goal === 'نعم مع اجراء بسيط'}
                      onChange={() => setCase1Goal('نعم مع اجراء بسيط')}
                      className="hidden"
                    />
                    <span>نعم مع إجراء بسيط</span>
                  </label>
                </div>
              </div>

              {/* Q2: هل المواطن راضي عن النتيجة ؟ نعم أو لا مع تقييم شخصي بعد سؤال المواطن */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    2. هل المواطن راضي عن النتيجة؟
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCase1Satisfied('نعم')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        case1_satisfied === 'نعم' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      نعم
                    </button>
                    <button
                      type="button"
                      onClick={() => setCase1Satisfied('لا')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        case1_satisfied === 'لا' ? 'bg-rose-600 text-white' : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      لا
                    </button>
                  </div>
                </div>

                {/* تقييم شخصي بعد سؤال المواطن */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    تقييم شخصي بعد سؤال المواطن:
                  </label>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-300">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setCase1Rating(star)}
                        className="cursor-pointer transition-transform hover:scale-110 p-0.5"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= case1_rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-emerald-800 mr-2">
                      {case1_rating === 5 ? 'ممتاز (5/5)' : case1_rating === 4 ? 'جيد جداً (4/5)' : case1_rating === 3 ? 'جيد (3/5)' : case1_rating === 2 ? 'مقبول (2/5)' : 'ضعيف (1/5)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Q3: هل عاد المواطن للمكتب لتقديم الشكر وإبداء الامتنان؟ */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold text-slate-800">
                  3. هل عاد المواطن للمكتب لتقديم الشكر وإبداء الامتنان؟
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCase1ReturnedThanks('نعم')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      case1_returnedThanks === 'نعم' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 border border-slate-300'
                    }`}
                  >
                    نعم
                  </button>
                  <button
                    type="button"
                    onClick={() => setCase1ReturnedThanks('لا')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      case1_returnedThanks === 'لا' ? 'bg-slate-700 text-white' : 'bg-white text-slate-700 border border-slate-300'
                    }`}
                  >
                    لا
                  </button>
                </div>
              </div>

              {/* Q4: ملاحظة مسؤول التنظيم */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold text-slate-800">
                  ملاحظة مسؤول التنظيم (نص مفتوح):
                </label>
                <textarea
                  value={case1_notes}
                  onChange={(e) => setCase1Notes(e.target.value)}
                  placeholder="سجل انطباع المواطن، استعداده للمساندة، أية توصيات تنظيمية أو جماهيرية..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* الحالة الثانية: حل الطلب جزئياً */}
          {/* ======================================================== */}
          {finalResult === 'تم حل الطلب جزئيا' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs pb-2 border-b border-amber-200">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>أسئلة الحالة الثانية: تم حل الطلب جزئياً</span>
              </div>

              {/* Q1: ما الجزء الذي تم إنجازه */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  1. ما الجزء الذي تم إنجازه؟ (نص مفتوح) *
                </label>
                <input
                  type="text"
                  value={case2_completed}
                  onChange={(e) => setCase2Completed(e.target.value)}
                  placeholder="مثال: تمت الموافقة المبدئية، تم صرف الدفعة الأولى، تم التنسيق الميداني..."
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  required
                />
              </div>

              {/* Q2: ما الجزء الذي لم يُنجز */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  2. ما الجزء الذي لم يُنجز؟ (نص مفتوح) *
                </label>
                <input
                  type="text"
                  value={case2_uncompleted}
                  onChange={(e) => setCase2Uncompleted(e.target.value)}
                  placeholder="مثال: بانتظار التخصيص المالي، بانتظار توقيع الوزير، المعاملة متوقفة في الدائرة..."
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  required
                />
              </div>

              {/* Q3: سبب عدم إكمال الطلب */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold text-slate-800">
                  3. سبب عدم إكمال الطلب يتفرع إلى:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {['عدم اختصاص الجهة المعنية', 'نقص مستندات', 'يحتاج عرضا اضافيا', 'سبب اخر'].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setCase2Reason(reason)}
                      className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                        case2_reason === reason
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>

                {case2_reason === 'سبب اخر' && (
                  <div className="pt-2">
                    <input
                      type="text"
                      value={case2_customReason}
                      onChange={(e) => setCase2CustomReason(e.target.value)}
                      placeholder="اذكر السبب الآخر بالتحديد..."
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Q4 & Q5 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    4. هل المواطن قبل بالنتيجة الجزئية؟
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCase2Accepted('نعم')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        case2_accepted === 'نعم' ? 'bg-amber-600 text-white' : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      نعم
                    </button>
                    <button
                      type="button"
                      onClick={() => setCase2Accepted('لا')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        case2_accepted === 'لا' ? 'bg-rose-600 text-white' : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      لا
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    5. هل يحتاج المكتب إلى إجراء إضافي؟
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCase2OfficeNeedsExtra('نعم')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        case2_officeNeedsExtra === 'نعم' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      نعم
                    </button>
                    <button
                      type="button"
                      onClick={() => setCase2OfficeNeedsExtra('لا')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        case2_officeNeedsExtra === 'لا' ? 'bg-slate-700 text-white' : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      لا
                    </button>
                  </div>
                </div>
              </div>

              {/* Q6: ملاحظات مسؤول التنظيم */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold text-slate-800">
                  ملاحظات مسؤول التنظيم (نص مفتوح):
                </label>
                <textarea
                  value={case2_notes}
                  onChange={(e) => setCase2Notes(e.target.value)}
                  placeholder="سجل الخطوات اللاحقة وتوصية مسؤول التنظيم لاستكمال الجزء المتبقي..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* الحالة الثالثة: الطلب يحتاج الى متابعة */}
          {/* ======================================================== */}
          {finalResult === 'الطلب يحتاج متابعة' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-blue-900 font-bold text-xs pb-2 border-b border-blue-200">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <span>أسئلة الحالة الثالثة: الطلب يحتاج إلى متابعة</span>
              </div>

              {/* أنواع المتابعة */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  أنواع المتابعة (اختر نوع المتابعة أو أكثر):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {[
                    'متابعة مع الجهة نفسها',
                    'مخاطبة جهة اخرى',
                    'طلب مستند اضافي',
                    'اعادة مخاطبة'
                  ].map((type) => {
                    const isChecked = case3_followup.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleFollowupType(type)}
                        className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                          isChecked
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ملاحظات مسؤول التنظيم */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  ملاحظات مسؤول التنظيم (نص مفتوح):
                </label>
                <textarea
                  value={case3_officerNotes}
                  onChange={(e) => setCase3OfficerNotes(e.target.value)}
                  placeholder="تفاصيل المتابعة الميدانية أو التنسيق مع المديريات..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* دور مسؤول التنظيم بعد المتابعة / الاستبيان */}
              <div className="p-4 rounded-xl bg-white border border-blue-200 space-y-3.5 mt-3">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs pb-1.5 border-b border-slate-200">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  <span>دور واستبيان مسؤول التنظيم (التقييم الجماهيري للمواطن):</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* هل المواطن راضي عن الخدمة */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-bold text-slate-800">هل المواطن راضي عن الخدمة؟</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCase3ServiceSatisfied('نعم')}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                          case3_serviceSatisfied === 'نعم' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        نعم
                      </button>
                      <button
                        type="button"
                        onClick={() => setCase3ServiceSatisfied('لا')}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                          case3_serviceSatisfied === 'لا' ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        لا
                      </button>
                    </div>
                  </div>

                  {/* هل يحتاج الى متابعة */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-bold text-slate-800">هل يحتاج إلى متابعة؟</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCase3NeedsFollowup('نعم')}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                          case3_needsFollowup === 'نعم' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        نعم
                      </button>
                      <button
                        type="button"
                        onClick={() => setCase3NeedsFollowup('لا')}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                          case3_needsFollowup === 'لا' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        لا
                      </button>
                    </div>
                  </div>

                  {/* هل وافق على التواصل المستقبلي */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-bold text-slate-800">هل وافق على التواصل المستقبلي؟</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCase3FutureComm('نعم')}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                          case3_futureComm === 'نعم' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        نعم
                      </button>
                      <button
                        type="button"
                        onClick={() => setCase3FutureComm('لا')}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                          case3_futureComm === 'لا' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        لا
                      </button>
                    </div>
                  </div>

                  {/* هل اختار المشاركة في ندوة او مبادرة عامة */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-bold text-slate-800">هل يشارك في ندوة أو مبادرة عامة؟</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCase3SeminarParticipation('نعم')}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                          case3_seminarParticipation === 'نعم' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        نعم
                      </button>
                      <button
                        type="button"
                        onClick={() => setCase3SeminarParticipation('لا')}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                          case3_seminarParticipation === 'لا' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        لا
                      </button>
                    </div>
                  </div>
                </div>

                {/* عدد المرات التي يتردد بها على المكتب */}
                <div className="pt-1">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    عدد المرات التي يتردد بها على المكتب:
                  </label>
                  <select
                    value={case3_visitCount}
                    onChange={(e) => setCase3VisitCount(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="مرة واحدة (أول زيارة)">مرة واحدة (أول زيارة)</option>
                    <option value="2 - 3 مرات">2 - 3 مرات</option>
                    <option value="4 - 6 مرات">4 - 6 مرات</option>
                    <option value="أكثر من 6 مرات (متردد دائم)">أكثر من 6 مرات (متردد دائم)</option>
                  </select>
                </div>

                {/* هل ترغب بالانضمام الى فريقنا (كمفتاح نهائي) */}
                <div className="p-3 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-purple-900 block">
                        هل ترغب بالانضمام إلى فريقنا (كمفتاح نهائي)؟
                      </span>
                      <span className="text-[10px] text-purple-700">
                        ملاحظة: إذا اختار (نعم) يتم تلقائياً فتح ملف مستقل له في قسم فريق العمل والمفاتيح الانتخابية!
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCase3JoinTeam('نعم')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          case3_joinTeam === 'نعم'
                            ? 'bg-purple-600 text-white shadow-xs ring-2 ring-purple-300'
                            : 'bg-white text-slate-700 border border-slate-300'
                        }`}
                      >
                        نعم
                      </button>
                      <button
                        type="button"
                        onClick={() => setCase3JoinTeam('لا')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          case3_joinTeam === 'لا'
                            ? 'bg-slate-700 text-white'
                            : 'bg-white text-slate-700 border border-slate-300'
                        }`}
                      >
                        لا
                      </button>
                    </div>
                  </div>

                  {case3_joinTeam === 'نعم' && (
                    <div className="pt-2 border-t border-purple-200/60 flex flex-col sm:flex-row items-center gap-2 text-xs animate-in fade-in duration-200">
                      <span className="font-bold text-purple-900 shrink-0">الدور التنظيمي المقترح:</span>
                      <select
                        value={case3_teamRole}
                        onChange={(e) => setCase3TeamRole(e.target.value)}
                        className="w-full sm:w-auto flex-1 px-3 py-1 rounded-lg bg-white border border-purple-300 text-purple-900 font-bold text-xs outline-none"
                      >
                        <option value="مفتاح نهائي">مفتاح نهائي</option>
                        <option value="منسق منطقة / حي">منسق منطقة / حي</option>
                        <option value="عضو فريق مبادرات شبابية">عضو فريق مبادرات شبابية</option>
                        <option value="كادر تنظيمي عام">كادر تنظيمي عام</option>
                      </select>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ✓ سيتم فتح ملف مستقل له
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* الحالة الرابعة: لم يتم حل الطلب */}
          {/* ======================================================== */}
          {finalResult === 'لم يتم حل الطلب' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-rose-900 font-bold text-xs pb-2 border-b border-rose-200">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>أسئلة الحالة الرابعة: لم يتم حل الطلب</span>
              </div>

              {/* سبب عدم الإنجاز */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  لم يحل الطلب بسبب عدم الإنجاز (اختر السبب المحدد):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {[
                    'رفض الجهة المختصة',
                    'خارج اختصاص المكتب',
                    'نقص مستندات',
                    'عدم مكانية قانونية',
                    'عدم استجابة الطلب',
                    'تعذر تنفيذ الطلب',
                    'سبب اخر'
                  ].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setCase4Reason(r)}
                      className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                        case4_reason === r
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                {case4_reason === 'سبب اخر' && (
                  <div className="pt-2">
                    <input
                      type="text"
                      value={case4_customReason}
                      onChange={(e) => setCase4CustomReason(e.target.value)}
                      placeholder="اكتب سبب عدم الإنجاز بالتفصيل..."
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-slate-800 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                      required
                    />
                  </div>
                )}
              </div>

              {/* هل تم شرح سبب عدم الإنجاز وموقف المواطن */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    هل تم شرح سبب عدم الإنجاز للمواطن؟
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCase4Explained('نعم')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        case4_explained === 'نعم' ? 'bg-rose-600 text-white' : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      نعم
                    </button>
                    <button
                      type="button"
                      onClick={() => setCase4Explained('لا')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        case4_explained === 'لا' ? 'bg-slate-700 text-white' : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      لا
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    موقف المواطن من النتيجة:
                  </label>
                  <div className="flex items-center gap-1.5">
                    {['متفهم', 'غير متفهم', 'غير راضي'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setCase4Stance(st as any)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          case4_stance === st
                            ? st === 'متفهم' ? 'bg-emerald-600 text-white' : st === 'غير متفهم' ? 'bg-amber-600 text-white' : 'bg-rose-700 text-white'
                            : 'bg-white text-slate-700 border border-slate-300'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ملاحظة تظهر رسمياً */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>تنبيه النظام:</strong> تظهر نتيجة الطلب: 
                  <span className="font-bold text-rose-700 mx-1">غير منجز</span>
                  - سبب عدم الإنجاز: 
                  <span className="font-bold text-slate-900 mx-1">
                    {case4_reason === 'سبب اخر' && case4_customReason ? case4_customReason : case4_reason}
                  </span>
                </span>
              </div>

              {/* ملاحظات مسؤول التنظيم */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  ملاحظات مسؤول التنظيم (نص مفتوح):
                </label>
                <textarea
                  value={case4_notes}
                  onChange={(e) => setCase4Notes(e.target.value)}
                  placeholder="سجل توجيهات النائب أو المسار البديل أو الإجراء الذي تم لتهدئة وشرح الموقف للمواطن..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
            >
              إلغاء وتراجع
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>حفظ النتيجة النهائية والترحيل</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
