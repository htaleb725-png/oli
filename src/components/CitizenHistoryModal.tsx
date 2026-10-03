import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, 
  Clock, 
  Award
} from 'lucide-react';

export const CitizenHistoryModal: React.FC = () => {
  const { 
    selectedCitizenForHistory, 
    setSelectedCitizenForHistory, 
    requests, 
    interviews, 
    organizationRecords,
    documents,
    setPrintableCitizenCard,
    setPrintableBadgeCitizen,
    canPrintOfficialCard,
    currentUser
  } = useApp();

  if (!selectedCitizenForHistory) return null;

  const citizen = selectedCitizenForHistory;
  const citizenRequests = requests.filter(r => r.Citizen_ID === citizen.Citizen_ID);
  const citizenInterviews = interviews.filter(i => i.Citizen_ID === citizen.Citizen_ID);
  const citizenOrg = organizationRecords.find(o => o.Citizen_ID === citizen.Citizen_ID);
  const citizenDocs = documents.filter(d => d.Citizen_ID === citizen.Citizen_ID);

  // Combine milestones into sorted chronological timeline
  const timelineItems: Array<{
    id: string;
    date: string;
    title: string;
    type: 'registration' | 'request' | 'interview' | 'org' | 'document';
    details: string;
    badge?: string;
    badgeColor?: string;
  }> = [
    {
      id: 'init-reg',
      date: citizen.CreatedAt,
      title: 'تسجيل المراجع لأول مرة بالمنظومة',
      type: 'registration',
      details: `تم إنشاء الرقم التعريفي الثابت (${citizen.Citizen_ID}) بواسطة ${citizen.CreatedBy || 'الاستعلامات'}. السكن: ${citizen.District} - ${citizen.SubDistrict}. التقييم الأولي: ${citizen.Rating}`,
      badge: 'تسجيل مبدئي',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    },
    ...citizenRequests.map(r => ({
      id: r.Request_ID,
      date: r.CreatedAt,
      title: `تقديم طلب إداري: [${r.Entity}]`,
      type: 'request' as const,
      details: `${r.Details} | المسار الحالي: ${r.ProcessingStatus} ${r.DeputyNotes ? `| توجيه النائب: ${r.DeputyNotes}` : ''}`,
      badge: r.Priority,
      badgeColor: r.Priority === 'عاجل' || r.Priority === 'خاص جداً' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-blue-100 text-blue-800 border-blue-200'
    })),
    ...citizenInterviews.map(i => ({
      id: i.Interview_ID,
      date: `${i.InterviewDate} ${i.InterviewTime || ''}`,
      title: `مقابلة مباشرة مع النائب المهندسة علا الناشي`,
      type: 'interview' as const,
      details: `موضوع المقابلة: ${i.Subject} | توجيه النائب: ${i.DeputyNotes || 'لا توجد ملاحظات'} | الموقف: ${i.Status}`,
      badge: i.Priority,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200'
    })),
    ...citizenDocs.map(d => ({
      id: d.Doc_ID,
      date: d.UploadedAt,
      title: `أرشفة مستند: ${d.Title}`,
      type: 'document' as const,
      details: `نوع المستند: ${d.Category} | الحجم: ${d.FileSize} | رُفع بواسطة: ${d.UploadedBy}`,
      badge: 'وثيقة سحابية',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200'
    }))
  ];

  // Sort descending by date
  timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700">
              <Clock className="w-5 h-5" />
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{citizen.FullName}</h3>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {citizen.Citizen_ID}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                الخط الزمني الشامل وسجل التقييم التراكمي عبر زيارات المكتب
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canPrintOfficialCard(currentUser) && (
              <button
                onClick={() => setPrintableCitizenCard(citizen)}
                className="text-xs px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Award className="w-4 h-4" />
                <span>طباعة بطاقة المعلومات</span>
              </button>
            )}

            <button
              onClick={() => setPrintableBadgeCitizen(citizen)}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            >
              وصل مراجعة
            </button>

            <button
              onClick={() => setSelectedCitizenForHistory(null)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">
          {/* Quick Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-right shadow-xs">
              <span className="text-xs text-slate-500 block">إجمالي الطلبات</span>
              <span className="text-2xl font-bold text-blue-600 mt-1 block">{citizenRequests.length}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-right shadow-xs">
              <span className="text-xs text-slate-500 block">المقابلات البرلمانية</span>
              <span className="text-2xl font-bold text-amber-600 mt-1 block">{citizenInterviews.length}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-right shadow-xs">
              <span className="text-xs text-slate-500 block">الوثائق المؤرشفة</span>
              <span className="text-2xl font-bold text-purple-600 mt-1 block">{citizenDocs.length}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-right shadow-xs">
              <span className="text-xs text-slate-500 block">الموقف التنظيمي</span>
              <span className="text-lg font-bold text-emerald-600 mt-1 block">{citizenOrg?.OrgRating || 'لم يُحدد'}</span>
            </div>
          </div>

          {/* Timeline Stream */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-800 border-r-2 border-blue-600 pr-2.5">
              التسلسل الزمني للنشاطات والمراجعات
            </h4>

            <div className="relative border-r border-slate-200 pr-6 mr-3 space-y-4">
              {timelineItems.map((item) => (
                <div key={item.id} className="relative group text-right">
                  {/* Timeline Dot */}
                  <div className="absolute -right-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-blue-600 group-hover:scale-125 transition-transform"></div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs transition-colors space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h5 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                        <span>{item.title}</span>
                      </h5>
                      <div className="flex items-center gap-2">
                        {item.badge && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-mono" dir="ltr">
                          {item.date}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.details}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
