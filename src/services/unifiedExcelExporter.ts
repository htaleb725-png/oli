import * as XLSX from 'xlsx';
import { 
  Citizen, 
  OfficeRequest, 
  Interview, 
  ChequeRecord, 
  OrganizationRecord, 
  OfficialLetter, 
  CustomSection, 
  CustomSectionRecord 
} from '../types';

export interface UnifiedExportParams {
  citizens: Citizen[];
  requests: OfficeRequest[];
  interviews: Interview[];
  cheques: ChequeRecord[];
  organizationRecords: OrganizationRecord[];
  officialLetters: OfficialLetter[];
  customSections: CustomSection[];
  customRecords: CustomSectionRecord[];
  officeName?: string;
  exporterName?: string;
}

/**
 * Universal Comprehensive Excel Exporter (.xlsx)
 * يقوم بتصدير قاعدة بيانات المنظومة بالكامل بمختلف أقسامها وجداولها وسجلاتها في ملف Excel موحد متعدد الصفحات
 * مخصص لمدير الإدارة، مدير المكتب التنفيذي، والمطور
 */
export function exportUnifiedSystemExcel(params: UnifiedExportParams): boolean {
  try {
    const wb = XLSX.utils.book_new();
    const currentDate = new Date().toLocaleDateString('ar-IQ').replace(/\//g, '-');
    const officeLabel = params.officeName || 'مكتب_النائب';

    // 1. ورقة سجل المراجعين والمواطنين
    const citizensRows = params.citizens.map((c, idx) => ({
      'ت': idx + 1,
      'رقم المراجع': c.Citizen_ID,
      'الاسم الكامل': c.FullName,
      'الاسم الأول': c.FirstName,
      'اسم الأب': c.FatherName,
      'اسم الجد': c.GrandFatherName,
      'اللقب والعشيرة': c.Surname || '',
      'رقم الهاتف الأساسي': c.Phone1,
      'رقم الهاتف الثاني': c.Phone2 || '',
      'القضاء': c.District,
      'الناحية / الحي': c.SubDistrict,
      'الجنس': c.Gender,
      'المهنة / الوظيفة': c.Job,
      'التحصيل الدراسي': c.Education,
      'التقييم الشعبي': c.Rating,
      'جهة التزكية / الوسيط': c.ReferralSource || '',
      'حالة الحضور': c.AttendanceType || 'شخصياً',
      'اسم المعتمد/الوكيل': c.ProxyName || '',
      'رقم المعتمد': c.ProxyPhone || '',
      'رابط/صورة المراجع الشخصية': c.PhotoUrl || 'لا توجد صورة',
      'تاريخ التسجيل': c.CreatedAt,
      'الموظف الذي سجل المواطن': c.CreatedBy || 'الاستعلامات'
    }));
    const wsCitizens = XLSX.utils.json_to_sheet(citizensRows.length ? citizensRows : [{ 'الحالة': 'لا توجد سجلات مراجعين' }]);
    XLSX.utils.book_append_sheet(wb, wsCitizens, 'المراجعين_Citizens');

    // 2. ورقة الطلبات والمعاملات الرسمية
    const requestsRows = params.requests.map((r, idx) => ({
      'ت': idx + 1,
      'رقم المعاملة / الطلب': r.Request_ID,
      'رقم المراجع': r.Citizen_ID,
      'اسم المواطن': r.CitizenName,
      'هاتف المواطن': r.CitizenPhone || '',
      'الجهة المعنية / الدائرة': r.Entity,
      'حالة المعاملة': r.ProcessingStatus,
      'حالة الاستلام': r.RequestStatus,
      'الأولوية': r.Priority,
      'تفاصيل وموضوع الطلب': r.Details,
      'قرار وتوجيه مدير المكتب': r.DirectorDecision || '',
      'هوامش وتوجيهات النائب': r.DeputyNotes || '',
      'مرفق الطلب': r.AttachmentRequest || '',
      'مرفق الإجابة': r.AttachmentResponse || '',
      'صورة الاسكنر المرفقة': r.AttachedRequestImage || (r.ScanAttachments?.length ? `${r.ScanAttachments.length} صور مرفقة` : 'لا يوجد'),
      'الموظف الذي قام برفع الاسكنر': r.ScanUploadedBy || '',
      'تاريخ رفع الاسكنر': r.ScanUploadedAt || '',
      'تاريخ إنشاء المعاملة': r.CreatedAt,
      'الموظف الذي أدخل الطلب': r.CreatedBy || 'الإدارة'
    }));
    const wsRequests = XLSX.utils.json_to_sheet(requestsRows.length ? requestsRows : [{ 'الحالة': 'لا توجد طلبات' }]);
    XLSX.utils.book_append_sheet(wb, wsRequests, 'المعاملات_Requests');

    // 3. ورقة مقابلات النائب
    const interviewsRows = params.interviews.map((i, idx) => ({
      'ت': idx + 1,
      'رقم المقابلة': i.Interview_ID,
      'رقم المراجع': i.Citizen_ID,
      'اسم المواطن': i.FullName,
      'رقم الهاتف': i.Phone1,
      'موضوع المقابلة': i.Subject,
      'العنوان والسكن': i.Address,
      'جهة التزكية': i.Referrer || '',
      'تاريخ المقابلة': i.InterviewDate,
      'الوقت': i.InterviewTime || '',
      'الأسبقية': i.Priority,
      'الحالة': i.Status,
      'هوامش وتوجيهات النائب': i.DeputyNotes || '',
      'نتيجة المقابلة': i.Outcome || '',
      'حُوّل إلى معاملة رسمية': i.ConvertedToRequest ? 'نعم' : 'لا'
    }));
    const wsInterviews = XLSX.utils.json_to_sheet(interviewsRows.length ? interviewsRows : [{ 'الحالة': 'لا توجد مقابلات' }]);
    XLSX.utils.book_append_sheet(wb, wsInterviews, 'المقابلات_Interviews');

    // 4. ورقة صكوك المساعدات والمنح المالية
    const chequesRows = params.cheques.map((ch, idx) => ({
      'ت': idx + 1,
      'رقم الصك': ch.ChequeNumber,
      'رقم المراجع': ch.Citizen_ID,
      'اسم المواطن': ch.CitizenName,
      'المبلغ': ch.Amount,
      'المبلغ كتابة': ch.AmountInWords || '',
      'المصرف / البنك': ch.BankName,
      'الغرض من المساعدة': ch.Purpose,
      'تاريخ الإصدار': ch.IssueDate,
      'الحالة': ch.Status,
      'الموظف المسؤول': ch.CreatedBy || 'المالية'
    }));
    const wsCheques = XLSX.utils.json_to_sheet(chequesRows.length ? chequesRows : [{ 'الحالة': 'لا توجد صكوك مسجلة' }]);
    XLSX.utils.book_append_sheet(wb, wsCheques, 'الصكوك_المالية_Cheques');

    // 5. ورقة الموقف الجماهيري وشؤون العشائر
    const orgRows = params.organizationRecords.map((o, idx) => ({
      'ت': idx + 1,
      'رقم المراجع': o.Citizen_ID,
      'اسم المواطن': o.FullName,
      'القضاء': o.District,
      'الناحية': o.SubDistrict,
      'الهاتف': o.Phone1,
      'التقييم الجماهيري': o.OrgRating,
      'نوع التأثير': o.InfluenceType,
      'نقاط التقييم': o.EvaluationPoints,
      'المركز الانتخابي': o.ElectionCenter,
      'رقم المحطة': o.StationNumber,
      'الملاحظات': o.Notes || '',
      'آخر تحديث': o.UpdatedAt
    }));
    const wsOrg = XLSX.utils.json_to_sheet(orgRows.length ? orgRows : [{ 'الحالة': 'لا توجد سجلات تنظيمية' }]);
    XLSX.utils.book_append_sheet(wb, wsOrg, 'التنظيم_الجماهيري_Org');

    // 6. ورقة الكتب الرسمية والصادر والوارد
    const lettersRows = params.officialLetters.map((l, idx) => ({
      'ت': idx + 1,
      'رقم الكتاب': l.LetterNumber,
      'تاريخ الكتاب': l.LetterDate,
      'الجهة المعنية': l.Recipient,
      'موضوع الكتاب': l.Subject,
      'نص الكتاب': l.Body,
      'المواطن المستفيد': l.CitizenName || '',
      'الحالة': l.Status,
      'اسم الطباع / المدخل': l.ClerkName
    }));
    const wsLetters = XLSX.utils.json_to_sheet(lettersRows.length ? lettersRows : [{ 'الحالة': 'لا توجد كتب رسمية' }]);
    XLSX.utils.book_append_sheet(wb, wsLetters, 'الكتب_الرسمية_Letters');

    // 7. أوراق الأقسام المخصصة التي صممها المطور (مثل قسم الرعاية وغيرها)
    params.customSections.forEach((sec) => {
      const recordsForSec = params.customRecords.filter(r => r.sectionId === sec.id);
      const safeSheetName = sec.title.replace(/[\\/?*:[\]]/g, '').slice(0, 31) || `قسم_${sec.id.slice(-4)}`;

      const secRows = recordsForSec.map((rec, idx) => {
        const rowObj: Record<string, any> = {
          'ت': idx + 1,
          'معرف السجل': rec.id,
          'تاريخ الإدخال': rec.createdAt,
          'الموظف الذي أضاف السجل': rec.createdBy || 'المستخدم'
        };

        // Populate defined custom fields
        sec.fields?.forEach(f => {
          const val = rec.data?.[f.id] ?? rec.data?.[f.name] ?? '';
          if (f.type === 'image') {
            rowObj[`صورة: ${f.label}`] = val ? String(val) : 'لا توجد صورة';
          } else {
            rowObj[f.label] = typeof val === 'object' ? JSON.stringify(val) : val;
          }
        });

        return rowObj;
      });

      const wsCustomSec = XLSX.utils.json_to_sheet(secRows.length ? secRows : [{ 'الحالة': `لا توجد سجلات في ${sec.title}` }]);
      XLSX.utils.book_append_sheet(wb, wsCustomSec, safeSheetName);
    });

    // Write file and trigger download
    const fileName = `قاعدة_بيانات_${officeLabel}_الشاملة_${currentDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
    return true;
  } catch (err) {
    console.error('Unified Excel export error:', err);
    return false;
  }
}
