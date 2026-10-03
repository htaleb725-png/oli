import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  X, 
  Filter, 
  Save, 
  RotateCcw,
  Users,
  FileCheck
} from 'lucide-react';
import { Citizen, OfficeRequest } from '../types';

interface LegacyDataImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CleanedRow {
  citizenId: string;
  fullName: string;
  phone: string;
  rawEntity: string;
  normalizedEntity: string;
  rawReferrer: string;
  normalizedReferrer: string;
  district: string;
  details: string;
  totalCitizenRequestsCount: number;
}

export const LegacyDataImporterModal: React.FC<LegacyDataImporterModalProps> = ({ isOpen, onClose }) => {
  const { citizens, addCitizen, addRequest, addAuditLog, currentUser } = useApp();

  const [file, setFile] = useState<File | null>(null);
  const [cleanedRows, setCleanedRows] = useState<CleanedRow[]>([]);
  const [uniqueCitizensCount, setUniqueCitizensCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImported, setIsImported] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // Dictionary for Entity normalization
  const normalizeEntity = (raw: string): string => {
    if (!raw) return 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)';
    const text = raw.trim();
    if (text.includes('تربي')) return 'وزارة التربية';
    if (text.includes('صح')) return 'وزارة الصحة';
    if (text.includes('عمل') || text.includes('رعاي') || text.includes('حماي') || text.includes('شبك')) return 'وزارة العمل والشؤون الاجتماعية';
    if (text.includes('بلدي')) return 'مديرية بلديات ذي قار';
    if (text.includes('داخلي')) return 'وزارة الداخلية';
    if (text.includes('دفاع')) return 'وزارة الدفاع';
    if (text.includes('نفط')) return 'وزارة النفط';
    if (text.includes('كهربا')) return 'وزارة الكهرباء';
    if (text.includes('تعليم') || text.includes('جامع')) return 'وزارة التعليم العالي والبحث العلمي';
    if (text.includes('موار') || text.includes('ري')) return 'وزارة الموارد المائية';
    if (text.includes('اسكان') || text.includes('اعمار')) return 'وزارة الإعمار والإسكان والبلديات';
    if (text.includes('عدل')) return 'وزارة العدل';
    if (text.includes('تقاعد')) return 'هيئة التقاعد الوطنية';
    if (text.includes('شهدا')) return 'مؤسسة الشهداء';
    if (text.includes('سجنا')) return 'مؤسسة السجناء السياسيين';
    return text;
  };

  // Dictionary for Referrer normalization
  const normalizeReferrer = (raw: string): string => {
    if (!raw) return 'المكتب العام';
    const text = raw.trim();
    if (text.includes('هديل')) return 'ست هديل';
    if (text.includes('ابو علي') || text.includes('أبو علي')) return 'أبو علي';
    if (text.includes('ابو محمد') || text.includes('أبو محمد')) return 'أبو محمد';
    if (text.includes('منسق') || text.includes('تنسيق')) return 'منسق عام القضاء';
    return text;
  };

  // Format phone
  const normalizePhone = (phone: any): string => {
    if (!phone) return '07800000000';
    let str = String(phone).replace(/\D/g, '');
    if (str.startsWith('964')) str = '0' + str.slice(3);
    if (!str.startsWith('0') && str.startsWith('7')) str = '0' + str;
    return str || '07800000000';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);
    setProgressMsg('جاري قراءة ملف الإكسل وتحليله...');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        setProgressMsg('جاري تصفية وتوحيد الوزارات والمعرفين وتوليد المعرفات...');

        // Track how many requests per citizen name
        const nameFrequency: { [name: string]: number } = {};
        rawJson.forEach(row => {
          const name = String(row['الاسم'] || row['اسم المواطن'] || row['الاسم الرباعي'] || row['FullName'] || row['Name'] || Object.values(row)[0] || '').trim();
          if (name) {
            nameFrequency[name] = (nameFrequency[name] || 0) + 1;
          }
        });

        const citizensMap = new Map<string, string>();
        let currentSeq = citizens.length + 500;

        const cleaned: CleanedRow[] = rawJson.map((row, idx) => {
          const name = String(row['الاسم'] || row['اسم المواطن'] || row['الاسم الرباعي'] || row['FullName'] || row['Name'] || Object.values(row)[0] || `مواطن ${idx + 1}`).trim();
          const phone = normalizePhone(row['الهاتف'] || row['رقم الهاتف'] || row['الموبايل'] || row['Phone'] || '');
          const entity = String(row['الجهة'] || row['الوزارة'] || row['الدائرة'] || row['Entity'] || '');
          const referrer = String(row['المعرف'] || row['التزكية'] || row['المنسق'] || row['Referrer'] || '');
          const district = String(row['القضاء'] || row['السكن'] || row['المنطقة'] || 'الناصرية');
          const details = String(row['التفاصيل'] || row['الموضوع'] || row['الطلب'] || row['Details'] || 'طلب مسجل ضمن الأرشيف القديم');

          // Allocate unified Citizen_ID per citizen
          if (!citizensMap.has(name)) {
            currentSeq += 1;
            citizensMap.set(name, `CIT-${currentSeq}`);
          }
          const citId = citizensMap.get(name)!;

          return {
            citizenId: citId,
            fullName: name,
            phone: phone,
            rawEntity: entity,
            normalizedEntity: normalizeEntity(entity),
            rawReferrer: referrer,
            normalizedReferrer: normalizeReferrer(referrer),
            district: district,
            details: details,
            totalCitizenRequestsCount: nameFrequency[name] || 1
          };
        });

        setCleanedRows(cleaned);
        setUniqueCitizensCount(citizensMap.size);
        setIsProcessing(false);
      } catch (error) {
        console.error(error);
        alert('حدث خطأ أثناء قراءة ملف الإكسل. يرجى التأكد من صيغة الملف.');
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const handleImportToDatabase = () => {
    if (cleanedRows.length === 0) return;

    setIsProcessing(true);
    setProgressMsg('جاري إضافة المواطنين والطلبات إلى المنظومة المركزية...');

    // Group citizens to add only unique ones
    const addedCitizenIds = new Set<string>();

    cleanedRows.forEach(row => {
      if (!addedCitizenIds.has(row.citizenId)) {
        addCitizen({
          FirstName: row.fullName.split(' ')[0] || row.fullName,
          FatherName: row.fullName.split(' ')[1] || '',
          GrandFatherName: row.fullName.split(' ')[2] || '',
          GreatGrandFatherName: row.fullName.split(' ')[3] || '',
          Surname: '',
          FullName: row.fullName,
          Phone1: row.phone,
          Job: 'كاسب',
          Education: 'غير محدد',
          Gender: 'ذكر',
          Rating: 'لائق',
          District: row.district || 'الناصرية',
          SubDistrict: 'مركز القضاء',
          ReferralSource: row.normalizedReferrer,
          RegisteredVia: 'إدارة'
        });
        addedCitizenIds.add(row.citizenId);
      }

      // Add request
      addRequest({
        Citizen_ID: row.citizenId,
        CitizenName: row.fullName,
        CitizenPhone: row.phone,
        Entity: row.normalizedEntity,
        RequestStatus: 'مستلم',
        ProcessingStatus: 'قيد التدقيق',
        Priority: 'عام',
        Details: row.details,
        CreatedBy: currentUser ? currentUser.FullName : 'استيراد القاعدة القديمة'
      });
    });

    addAuditLog(
      'استيراد وتصفية قاعدة بيانات قديمة',
      'قسم الإدارة',
      `استيراد وتصفية ${cleanedRows.length} طلب و${addedCitizenIds.size} مواطن مع توحيد الوزارات والمعرفين`
    );

    setIsProcessing(false);
    setIsImported(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto text-right font-['Tajawal',sans-serif]">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                تصفية واستيراد قاعدة البيانات القديمة الذكية
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 font-bold">
                  تصحيح وتوحيد تلقائي
                </span>
              </h3>
              <p className="text-xs text-blue-100">
                رفع ملف Excel القديم وتصحيح الوزارات والمعرفين تلقائياً (مثلاً "تربية" إلى "وزارة التربية"، "هديل" إلى "ست هديل") واحتساب عدد الطلبات
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {!file ? (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center space-y-4 hover:border-blue-500 transition-colors bg-slate-50 dark:bg-slate-800/40">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-800 dark:text-slate-100">
                  اختر أو اسحب ملف قاعدة البيانات القديمة (Excel / CSV)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  يقوم النظام الذكي بالتعرف على الأعمدة وتوحيد أسماء الوزارات والمعرفين وتوليد كود ID موحد واحتساب الطلبات السابقة لكل شخص.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer transition-all">
                <Upload className="w-4 h-4" />
                <span>اختيار ملف Excel من الجهاز</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats & Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 p-3 rounded-xl text-right">
                  <span className="text-[11px] text-blue-700 dark:text-blue-400 block font-medium">إجمالي سجلات الطلبات</span>
                  <span className="text-lg font-black text-blue-900 dark:text-blue-200 font-mono">{cleanedRows.length}</span>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3 rounded-xl text-right">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-medium">عدد المواطنين المصفين (ID موحد)</span>
                  <span className="text-lg font-black text-emerald-900 dark:text-emerald-200 font-mono">{uniqueCitizensCount}</span>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 rounded-xl text-right">
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 block font-medium">تصحيح الوزارات التلقائي</span>
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300">نشط (تربية ➔ وزارة التربية)</span>
                </div>

                <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 p-3 rounded-xl text-right">
                  <span className="text-[11px] text-purple-700 dark:text-purple-400 block font-medium">توحيد المعرفين التلقائي</span>
                  <span className="text-xs font-bold text-purple-800 dark:text-purple-300">نشط (هديل ➔ ست هديل)</span>
                </div>
              </div>

              {/* Data Preview Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>معاينة البيانات بعد التصفية والتوحيد (أول 50 سجل)</span>
                  <span className="text-slate-500 font-normal">الملف: {file.name}</span>
                </div>

                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5">المعرف المولد</th>
                        <th className="p-2.5">اسم المواطن</th>
                        <th className="p-2.5">الهاتف</th>
                        <th className="p-2.5">الجهة المصححة</th>
                        <th className="p-2.5">المعرف الموحد</th>
                        <th className="p-2.5 text-center">عدد طلباته</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {cleanedRows.slice(0, 50).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-mono text-blue-600 dark:text-blue-400 font-bold">{row.citizenId}</td>
                          <td className="p-2.5 font-bold">{row.fullName}</td>
                          <td className="p-2.5 font-mono text-slate-500">{row.phone}</td>
                          <td className="p-2.5">
                            <span className="font-medium text-slate-900 dark:text-slate-100">{row.normalizedEntity}</span>
                            {row.rawEntity && row.rawEntity !== row.normalizedEntity && (
                              <span className="block text-[10px] text-amber-600 dark:text-amber-400">
                                الأصل: {row.rawEntity}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5">
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">{row.normalizedReferrer}</span>
                            {row.rawReferrer && row.rawReferrer !== row.normalizedReferrer && (
                              <span className="block text-[10px] text-slate-400">الأصل: {row.rawReferrer}</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                              {row.totalCitizenRequestsCount} طلب
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {isImported && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>
                    تم بنجاح استيراد وتصفية كافة السجلات وتثبيتها في النظام المركزي لمكتب النائب علا الناشي!
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <button
            onClick={() => {
              setFile(null);
              setCleanedRows([]);
              setIsImported(false);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            إعادة تعيين / رفع ملف آخر
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              إغلاق
            </button>

            {file && !isImported && (
              <button
                onClick={handleImportToDatabase}
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-md flex items-center gap-2"
              >
                {isProcessing ? (
                  <span>جاري الاستيراد...</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>تأكيد الاستيراد والتثبيت في المنظومة</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
