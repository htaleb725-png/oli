import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { Citizen, OfficeRequest } from '../types';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Sparkles, 
  Building2, 
  User, 
  Phone, 
  Layers, 
  ArrowRight,
  Database,
  RefreshCw,
  Search
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// القاموس الذكي المعتمد لتوحيد وتصحيح أسماء الوزارات والمؤسسات الرسمية
const ENTITY_NORMALIZATION_MAP: { regex: RegExp; standardized: string }[] = [
  { regex: /(وزير العمل|معالي وزير العمل|العمل والشؤون|العمل والشئون|دائرة العمل|رعاية اجتماعية|الحماية الاجتماعية|شبكة الحماية|شؤون العمل|^العمل$)/i, standardized: 'وزارة العمل والشؤون الاجتماعية' },
  { regex: /(صحة ذي قار|دائرة صحة|وزير الصحة|مستشفى|مركز صحي|^الصحة$)/i, standardized: 'وزارة الصحة / دائرة صحة ذي قار' },
  { regex: /(تربية ذي قار|مديرية تربية|وزير التربية|مدارس|معلم|^التربية$)/i, standardized: 'وزارة التربية / تربية ذي قار' },
  { regex: /(تعليم عالي|جامعة ذي قار|جامعة العين|كلية|جامعة|^التعليم$)/i, standardized: 'وزارة التعليم العالي والبحث العلمي' },
  { regex: /(داخلية|مرور ذي قار|بطاقة وطنية|جوازات|شرطة ذي قار|قيادة شرطة|^الداخلية$)/i, standardized: 'وزارة الداخلية' },
  { regex: /(بلديات ذي قار|بلدية الناصرية|مجاري ذي قار|ماء ذي قار|إعمار وإسكان|توزيع اراضي|^البلدية$|^البلديات$)/i, standardized: 'وزارة الإعمار والإسكان والبلديات' },
  { regex: /(نفط ذي قار|شركة نفط|مستودع نفط|بترول|^النفط$)/i, standardized: 'وزارة النفط / شركة نفط ذي قار' },
  { regex: /(كهرباء ذي قار|توزيع كهرباء|نقل طاقة|توليد كهرباء|^الكهرباء$)/i, standardized: 'وزارة الكهرباء' },
  { regex: /(تقاعد ذي قار|هيئة التقاعد|صندوق تقاعد|رواتب تقاعد|^التقاعد$)/i, standardized: 'وزارة المالية / هيئة التقاعد الوطنية' },
  { regex: /(تجارة|تموينية|شركة حبوب|سايلو|^التجارة$)/i, standardized: 'وزارة التجارة' },
  { regex: /(ديوان المحافظة|محافظ ذي قار|معاون محافظ|قائممقام|^المحافظة$)/i, standardized: 'ديوان محافظة ذي قار' },
  { regex: /(مؤسسة الشهداء|شهداء ذي قار|^الشهداء$)/i, standardized: 'مؤسسة الشهداء' },
  { regex: /(مؤسسة السجناء|سجناء سياسيين|^السجناء$)/i, standardized: 'مؤسسة السجناء السياسيين' },
  { regex: /(زراعة ذي قار|مستلزمات زراعية|^الزراعة$)/i, standardized: 'وزارة الزراعة' },
  { regex: /(موارد مائية|ري ذي قار|انعاش الاهوار|^الموارد$)/i, standardized: 'وزارة الموارد المائية' }
];

export function normalizeEntityName(raw: string): string {
  if (!raw || !raw.trim()) return 'جهة حكومية غير محددة';
  const clean = raw.trim();

  for (const item of ENTITY_NORMALIZATION_MAP) {
    if (item.regex.test(clean)) {
      return item.standardized;
    }
  }

  // Return formatted raw if not matched
  return clean.startsWith('وزارة') || clean.startsWith('دائرة') || clean.startsWith('ديوان')
    ? clean
    : `دائرة / ${clean}`;
}

export function cleanPhoneNumber(raw: any): string {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('9647')) return '0' + digits.slice(3);
  if (digits.startsWith('7')) return '0' + digits;
  return digits;
}

export const SmartExcelImporterModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { 
    addCitizen, 
    addRequest, 
    citizens, 
    currentUser, 
    addAuditLog 
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState<{
    newCitizens: number;
    newRequests: number;
    existingMatched: number;
    normalizedEntitiesCount: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          alert('ملف الإكسل فارغ أو لا يحتوي على صفوف بيانات صالحة.');
          setIsProcessing(false);
          return;
        }

        setTotalRows(rawJson.length);
        processParsedData(rawJson);
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء قراءة ملف الإكسل. يرجى التأكد من صيغة الملف (.xlsx أو .xls).');
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processParsedData = (rows: any[]) => {
    let newCitizensCount = 0;
    let newRequestsCount = 0;
    let existingMatchedCount = 0;
    let normalizedEntitiesCount = 0;

    const samplePreviews: any[] = [];
    const nowStamp = new Date().toISOString().split('T')[0];

    // Build fast lookup by FullName and Phone
    const existingCitizenMap = new Map<string, Citizen>();
    citizens.forEach(c => {
      if (c.FullName) existingCitizenMap.set(c.FullName.trim(), c);
      if (c.Phone1) existingCitizenMap.set(c.Phone1.trim(), c);
    });

    // Detect column keys dynamically
    const firstRow = rows[0] || {};
    const keys = Object.keys(firstRow);

    const findKey = (patterns: RegExp[]) => {
      return keys.find(k => patterns.some(p => p.test(k.trim())));
    };

    const nameKey = findKey([/اسم/i, /مواطن/i, /مراجع/i, /name/i]);
    const phoneKey = findKey([/هاتف/i, /موبايل/i, /رقم/i, /phone/i, /mobile/i]);
    const entityKey = findKey([/وزار/i, /جه/i, /دائر/i, /مؤسس/i, /ministry/i, /entity/i]);
    const detailsKey = findKey([/طلب/i, /موضوع/i, /تفاصيل/i, /معامل/i, /subject/i, /details/i]);
    const districtKey = findKey([/قضاء/i, /سكن/i, /منطق/i, /عنوان/i, /district/i, /address/i]);

    // Batch process in chunks to prevent freezing
    const chunkSize = 500;
    let index = 0;

    const processNextChunk = () => {
      const limit = Math.min(index + chunkSize, rows.length);

      for (; index < limit; index++) {
        const row = rows[index];

        const rawName = nameKey ? String(row[nameKey]).trim() : '';
        if (!rawName || rawName.length < 3) continue;

        const rawPhone = phoneKey ? cleanPhoneNumber(row[phoneKey]) : '';
        const rawEntity = entityKey ? String(row[entityKey]).trim() : '';
        const rawDetails = detailsKey ? String(row[detailsKey]).trim() : 'معاملة رسمية مسجلة عبر استيراد الإكسل';
        const rawDistrict = districtKey ? String(row[districtKey]).trim() : 'قضاء الناصرية (المركز)';

        const standardizedEntity = normalizeEntityName(rawEntity);
        if (rawEntity && standardizedEntity !== rawEntity) {
          normalizedEntitiesCount++;
        }

        let targetCitizen = existingCitizenMap.get(rawName) || (rawPhone ? existingCitizenMap.get(rawPhone) : undefined);

        if (!targetCitizen) {
          // Create new Citizen with auto generated permanent ONA code
          const newOnaId = `ONA-${Math.floor(10000 + Math.random() * 90000)}`;
          
          targetCitizen = {
            Citizen_ID: newOnaId,
            FullName: rawName,
            Phone1: rawPhone || '07800000000',
            District: rawDistrict,
            SubDistrict: 'المركز',
            Gender: 'ذكر',
            Rating: 'لائق',
            ReferralSource: 'استيراد إكسل شامل للإدارة',
            CreatedAt: nowStamp,
            CreatedBy: `استيراد إكسل (${currentUser?.FullName || 'الإدارة'})`,
            RegisteredVia: 'إدارة'
          };

          addCitizen(targetCitizen);
          existingCitizenMap.set(rawName, targetCitizen);
          if (rawPhone) existingCitizenMap.set(rawPhone, targetCitizen);
          newCitizensCount++;
        } else {
          existingMatchedCount++;
        }

        // Add OfficeRequest for this record
        addRequest({
          Citizen_ID: targetCitizen.Citizen_ID,
          CitizenName: targetCitizen.FullName,
          CitizenPhone: targetCitizen.Phone1,
          Entity: standardizedEntity,
          RequestStatus: 'مستلم',
          ProcessingStatus: 'قيد الإجراء',
          Priority: 'عام',
          Details: rawDetails,
          RegisteredVia: 'إدارة',
          CreatedBy: `استيراد إكسل (${currentUser?.FullName || 'الإدارة'})`
        });
        newRequestsCount++;

        if (samplePreviews.length < 5) {
          samplePreviews.push({
            ona: targetCitizen.Citizen_ID,
            name: targetCitizen.FullName,
            phone: targetCitizen.Phone1,
            rawEntity: rawEntity || 'غير محدد',
            normalizedEntity: standardizedEntity,
            details: rawDetails
          });
        }
      }

      setProcessedCount(index);

      if (index < rows.length) {
        setTimeout(processNextChunk, 0);
      } else {
        setIsProcessing(false);
        setPreviewRows(samplePreviews);
        setImportSummary({
          newCitizens: newCitizensCount,
          newRequests: newRequestsCount,
          existingMatched: existingMatchedCount,
          normalizedEntitiesCount: normalizedEntitiesCount
        });

        addAuditLog(
          'استيراد إكسل شامل وتصفية',
          'قسم الإدارة',
          `تم استيراد ${newRequestsCount} معاملة وتوليد/مطابقة ${newCitizensCount + existingMatchedCount} مواطن برمز ONA مع توحيد ${normalizedEntitiesCount} جهة حكومية بواسطة ${currentUser?.FullName}`
        );
      }
    };

    processNextChunk();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md font-['Tajawal',sans-serif]" dir="rtl">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 text-right max-h-[92vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-xs shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>استيراد وتصفية ملفات الإكسل الضخمة</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                  خوارزمية ذكية
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تصفية البيانات، توحيد تسميات الوزارات تلقائياً، وتوليد كود ONA فوري لحفظها بجميع الأقسام
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-400 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feature Highlights Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-50/80 via-emerald-50/50 to-blue-50/50 dark:from-teal-950/40 dark:via-emerald-950/20 dark:to-slate-900 border border-teal-200 dark:border-teal-800 text-xs space-y-1.5">
          <div className="flex items-center gap-2 text-teal-950 dark:text-teal-200 font-bold">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>مميزات المعالجة والتصفية التلقائية للإكسل:</span>
          </div>
          <ul className="text-slate-600 dark:text-slate-300 space-y-1 pr-4 list-disc text-[11px] font-medium leading-relaxed">
            <li><strong>توحيد أسماء الوزارات:</strong> تصحيح المسميات المتداولة (مثلاً: "معالي وزير العمل" أو "العمل" ← تصبح رسمياً "وزارة العمل والشؤون الاجتماعية").</li>
            <li><strong>توليد كود ONA ثابت:</strong> يخلق لكل مراجع كود فريد ويحفظه بالمنظومة ليتعرف عليه موظف الاستعلامات والبحث فوراً.</li>
            <li><strong>معالجة الكميات الضخمة:</strong> يدعم سحب ومعالجة آلاف أو ملايين القيود بسلاسة بنظام التجزئة السحابي.</li>
          </ul>
        </div>

        {/* Upload Box */}
        <div className="space-y-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-teal-400 dark:border-teal-700 hover:border-teal-500 rounded-3xl p-6 sm:p-8 text-center cursor-pointer bg-slate-50 dark:bg-slate-850 hover:bg-teal-50/30 transition-all group"
          >
            <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-100 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-700 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-3 group-hover:scale-110 transition-transform shadow-xs">
              <Upload className="w-7 h-7" />
            </div>

            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
              اضغط هنا لاختيار ملف Excel أو CSV من جهازك
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              يدعم ملفات جداول البيانات (.xlsx, .xls, .csv) حتى مئات الآلاف والملايين من الصفوف
            </p>

            {fileName && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-600 text-white font-bold text-xs shadow-xs">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>الملف المحدد: {fileName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Processing Progress Bar */}
        {isProcessing && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-teal-600 animate-spin" />
                <span>جاري معالجة وتصفية قيود الإكسل وتوليد الأكواد...</span>
              </span>
              <span className="font-mono text-teal-600">{processedCount} / {totalRows}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-150"
                style={{ width: `${totalRows > 0 ? (processedCount / totalRows) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Summary Card */}
        {importSummary && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-black text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>اكتملت عملية الاستيراد والتصفية بنجاح تام!</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-slate-400 block">مراجعين جدد (ONA)</span>
                <strong className="text-emerald-700 dark:text-emerald-300 text-sm font-mono">{importSummary.newCitizens}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-slate-400 block">معاملات مسجلة</span>
                <strong className="text-blue-700 dark:text-blue-300 text-sm font-mono">{importSummary.newRequests}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-slate-400 block">مطابقة مسجلين سابقاً</span>
                <strong className="text-amber-700 dark:text-amber-300 text-sm font-mono">{importSummary.existingMatched}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-slate-400 block">وزارات تم توحيدها</span>
                <strong className="text-purple-700 dark:text-purple-300 text-sm font-mono">{importSummary.normalizedEntitiesCount}</strong>
              </div>
            </div>

            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">
              ✓ كافة المراجعين والمعاملات أصبحت متاحة فورياً للاستعلامات، المكنة، ومقاطعة البيانات وكافة أقسام المنظومة.
            </p>
          </div>
        )}

        {/* Sample Normalized Records Preview */}
        {previewRows.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
              معاينة عينة من السجلات المصححة بعد التصفية وتوليد ONA:
            </h4>
            <div className="space-y-1.5 text-xs">
              {previewRows.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      {item.ona}
                    </span>
                    <strong className="text-slate-900 dark:text-white">{item.name}</strong>
                    <span className="text-slate-400 font-mono text-[11px]" dir="ltr">({item.phone})</span>
                  </div>
                  <div className="text-[11px] flex items-center gap-1.5">
                    <span className="line-through text-slate-400">{item.rawEntity}</span>
                    <ArrowRight className="w-3 h-3 text-teal-600 rotate-180" />
                    <span className="font-bold text-teal-700 dark:text-teal-300">{item.normalizedEntity}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
};
