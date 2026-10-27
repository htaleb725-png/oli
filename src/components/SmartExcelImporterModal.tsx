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
  Search,
  Check,
  CheckCheck,
  FileText,
  ShieldCheck
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

// تطبيع وتنظيف الأسماء العربية لمطابقة الذكاء الاصطناعي بدقة عالية
export function normalizeArabicName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة التشكيل والحركات
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/^(السيد|السيدة|المواطن|المواطنة|الحاج|الحاجة|المهندس|المهندسة|الدكتور|الدكتورة|الشيخ)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export const SmartExcelImporterModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { 
    citizens, 
    currentUser, 
    batchImportRecords,
    addAuditLog 
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [currentStepText, setCurrentStepText] = useState('');
  
  // Multi-sheet State
  const [availableSheets, setAvailableSheets] = useState<Array<{ name: string; rowCount: number; selected: boolean }>>([]);
  const [loadedWorkbook, setLoadedWorkbook] = useState<XLSX.WorkBook | null>(null);

  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState<{
    newCitizens: number;
    newRequests: number;
    existingMatched: number;
    deduplicatedWithinFile: number;
    normalizedEntitiesCount: number;
    sheetsProcessed: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportSummary(null);
    setPreviewRows([]);
    setIsProcessing(true);
    setCurrentStepText('جاري قراءة أوراق العمل وملف الإكسل بالكامل...');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        setLoadedWorkbook(workbook);

        // Analyze all sheets
        const sheetDetails: Array<{ name: string; rowCount: number; selected: boolean }> = [];
        let totalRecordsFound = 0;

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;
          // Fast estimation of row count
          const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 }) as any[][];
          const validRowEst = Math.max(0, raw.length - 1);
          sheetDetails.push({
            name: sheetName,
            rowCount: validRowEst,
            selected: true // By default, all sheets are selected
          });
          totalRecordsFound += validRowEst;
        }

        setAvailableSheets(sheetDetails);
        setTotalRows(totalRecordsFound);
        setIsProcessing(false);
        setCurrentStepText('');

        if (totalRecordsFound === 0) {
          alert('ملف الإكسل لا يحتوي على صفوف بيانات صالحة.');
        }
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء قراءة ملف الإكسل. يرجى التأكد من أن الملف بصيغة (.xlsx أو .xls).');
        setIsProcessing(false);
        setCurrentStepText('');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const toggleSheetSelection = (index: number) => {
    setAvailableSheets(prev => {
      const next = prev.map((s, i) => i === index ? { ...s, selected: !s.selected } : s);
      const newTotal = next.filter(s => s.selected).reduce((acc, s) => acc + s.rowCount, 0);
      setTotalRows(newTotal);
      return next;
    });
  };

  const selectAllSheets = (selected: boolean) => {
    setAvailableSheets(prev => {
      const next = prev.map(s => ({ ...s, selected }));
      const newTotal = selected ? next.reduce((acc, s) => acc + s.rowCount, 0) : 0;
      setTotalRows(newTotal);
      return next;
    });
  };

  const startSmartImport = async () => {
    if (!loadedWorkbook) return;

    const selectedSheets = availableSheets.filter(s => s.selected);
    if (selectedSheets.length === 0) {
      alert('يرجى تحديد ورقة عمل (شيت) واحدة على الأقل للاستيراد.');
      return;
    }

    setIsProcessing(true);
    setProcessedCount(0);
    setCurrentStepText('جاري استخراج السجلات وتصفيتها عبر الذكاء الاصطناعي...');

    // 1. Gather all rows from all selected sheets
    const allExtractedRows: Array<{
      sheetName: string;
      row: any;
    }> = [];

    for (const s of selectedSheets) {
      const worksheet = loadedWorkbook.Sheets[s.name];
      if (!worksheet) continue;
      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      for (const row of jsonRows) {
        allExtractedRows.push({
          sheetName: s.name,
          row
        });
      }
    }

    setTotalRows(allExtractedRows.length);

    // 2. Pre-index existing citizens by normalized name and phone
    const citizenNormMap = new Map<string, Citizen>();
    const citizenPhoneMap = new Map<string, Citizen>();

    for (const c of citizens) {
      if (c.FullName) {
        citizenNormMap.set(normalizeArabicName(c.FullName), c);
      }
      if (c.Phone1) {
        const p = cleanPhoneNumber(c.Phone1);
        if (p.length >= 8) citizenPhoneMap.set(p, c);
      }
    }

    // Temporary working maps for intra-file deduplication
    const workingNewCitizens = new Map<string, Citizen>();
    const createdRequests: OfficeRequest[] = [];
    const samplePreviews: any[] = [];

    let newCitizensCount = 0;
    let existingMatchedCount = 0;
    let deduplicatedCount = 0;
    let normalizedEntitiesCount = 0;

    const nowStamp = new Date().toISOString().split('T')[0];
    const year = new Date().getFullYear();

    // Batch process in micro-chunks of 500 rows to prevent any browser freezing
    const chunkSize = 500;
    let currentIndex = 0;

    const processChunk = () => {
      const limit = Math.min(currentIndex + chunkSize, allExtractedRows.length);

      for (; currentIndex < limit; currentIndex++) {
        const item = allExtractedRows[currentIndex];
        const row = item.row;
        const keys = Object.keys(row);

        const findVal = (patterns: RegExp[]) => {
          const matchKey = keys.find(k => patterns.some(p => p.test(k.trim())));
          return matchKey ? String(row[matchKey]).trim() : '';
        };

        const rawName = findVal([/اسم/i, /مواطن/i, /مراجع/i, /name/i, /صاحب الطلب/i, /المستفيد/i]);

        // STRICT GHOST-FILTER: Reject empty rows, header rows, or meaningless names
        if (
          !rawName || 
          rawName.length < 2 || 
          rawName.toLowerCase() === 'undefined' || 
          rawName.toLowerCase() === 'null' ||
          rawName === 'الاسم' ||
          rawName === 'اسم المواطن' ||
          rawName === 'ت' ||
          rawName === 'name' ||
          rawName === 'الملاحظات' ||
          rawName === 'مواطن بدون اسم'
        ) {
          continue;
        }

        const rawPhone = cleanPhoneNumber(findVal([/هاتف/i, /موبايل/i, /رقم/i, /phone/i, /mobile/i]));
        const rawEntity = findVal([/وزار/i, /جه/i, /دائر/i, /مؤسس/i, /ministry/i, /entity/i, /الجهة/i]);
        const rawDetails = findVal([/طلب/i, /موضوع/i, /تفاصيل/i, /معامل/i, /subject/i, /details/i, /الغرض/i]);
        const rawDistrict = findVal([/قضاء/i, /سكن/i, /منطق/i, /عنوان/i, /district/i, /address/i]) || 'الناصرية';
        const rawOutgoing = findVal([/صادر/i, /العدد/i, /رقم الصادر/i, /outgoing/i]);
        const rawOutgoingDate = findVal([/تاريخ الصادر/i, /تاريخ كتاب الصادر/i, /تاريخ/i, /date/i]);
        const rawJob = findVal([/عمل/i, /مهن/i, /وظيفة/i, /job/i]);
        const rawReferrer = findVal([/معرف/i, /تزكية/i, /منسق/i, /referrer/i]);

        const normName = normalizeArabicName(rawName);
        const standardizedEntity = normalizeEntityName(rawEntity);

        if (rawEntity && standardizedEntity !== rawEntity) {
          normalizedEntitiesCount++;
        }

        // Check if citizen already exists in database OR was already created in this file
        let targetCitizen: Citizen | undefined = 
          citizenNormMap.get(normName) ||
          (rawPhone.length >= 8 ? citizenPhoneMap.get(rawPhone) : undefined) ||
          workingNewCitizens.get(normName) ||
          (rawPhone.length >= 8 ? workingNewCitizens.get(rawPhone) : undefined);

        if (!targetCitizen) {
          // Create new unique citizen with permanent ONA identifier
          const newOnaId = `ONA-${Math.floor(10000 + Math.random() * 90000)}`;
          const parts = rawName.split(/\s+/);

          targetCitizen = {
            Citizen_ID: newOnaId,
            FirstName: parts[0] || rawName,
            FatherName: parts[1] || '',
            GrandFatherName: parts[2] || '',
            GreatGrandFatherName: parts[3] || '',
            Surname: parts.length > 4 ? parts.slice(4).join(' ') : 'عام',
            FullName: rawName,
            Phone1: rawPhone || '07800000000',
            District: rawDistrict,
            SubDistrict: 'المركز',
            Gender: 'ذكر',
            Rating: 'لائق',
            Job: rawJob || 'كاسب',
            ReferralSource: rawReferrer || `استيراد إكسل (${item.sheetName})`,
            CreatedAt: nowStamp,
            CreatedBy: currentUser?.FullName || 'موظف الإدارة',
            RegisteredVia: 'إدارة'
          };

          workingNewCitizens.set(normName, targetCitizen);
          if (rawPhone.length >= 8) workingNewCitizens.set(rawPhone, targetCitizen);
          newCitizensCount++;
        } else {
          // Citizen deduplicated! Either matched existing database or earlier row in file
          if (citizenNormMap.has(normName) || (rawPhone && citizenPhoneMap.has(rawPhone))) {
            existingMatchedCount++;
          } else {
            deduplicatedCount++;
          }
        }

        // Create linked request for this transaction/sheet item
        const requestId = `REQ-${year}-${Date.now().toString().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;
        const sheetTag = item.sheetName.includes('مقابل') ? '[مقابلة رسمية]' : (item.sheetName.includes('رعاي') ? '[شبكة الحماية]' : '');

        const newRequest: OfficeRequest = {
          Request_ID: requestId,
          Citizen_ID: targetCitizen.Citizen_ID,
          CitizenName: targetCitizen.FullName,
          CitizenPhone: targetCitizen.Phone1,
          Entity: standardizedEntity,
          RequestStatus: 'مستلم',
          ProcessingStatus: rawOutgoing ? 'منجز' : 'قيد الإجراء',
          Priority: 'عام',
          Details: `${sheetTag ? `${sheetTag} ` : ''}${rawDetails || `طلب مسجل ضمن ورقة (${item.sheetName})`}`,
          OutgoingNumber: rawOutgoing || undefined,
          OutgoingDate: rawOutgoingDate || (rawOutgoing ? nowStamp : undefined),
          RegisteredVia: 'إدارة',
          Address: rawDistrict,
          CreatedAt: nowStamp,
          CreatedBy: `استيراد إكسل (${currentUser?.FullName || 'الإدارة'})`,
          OtherNotes: `مستورد من ملف: ${fileName} - ورقة العمل: [${item.sheetName}]`
        };

        createdRequests.push(newRequest);

        if (samplePreviews.length < 6) {
          samplePreviews.push({
            ona: targetCitizen.Citizen_ID,
            name: targetCitizen.FullName,
            phone: targetCitizen.Phone1,
            sheetName: item.sheetName,
            rawEntity: rawEntity || 'غير محدد',
            normalizedEntity: standardizedEntity,
            details: newRequest.Details
          });
        }
      }

      setProcessedCount(currentIndex);

      if (currentIndex < allExtractedRows.length) {
        setTimeout(processChunk, 0);
      } else {
        // FINISHED PROCESSING: Atomically commit all records into AppContext
        setCurrentStepText('جاري حفظ البيانات المصفاة وتوليد الأكواد في المنظومة...');
        
        const finalNewCitizensList = Array.from(new Set(workingNewCitizens.values()));

        batchImportRecords(finalNewCitizensList, createdRequests)
          .then(() => {
            setIsProcessing(false);
            setCurrentStepText('');
            setPreviewRows(samplePreviews);
            setImportSummary({
              newCitizens: finalNewCitizensList.length,
              newRequests: createdRequests.length,
              existingMatched: existingMatchedCount,
              deduplicatedWithinFile: deduplicatedCount,
              normalizedEntitiesCount: normalizedEntitiesCount,
              sheetsProcessed: selectedSheets.length
            });

            addAuditLog(
              'استيراد إكسل ذكي شامل',
              'قسم الإدارة',
              `تم استيراد ${createdRequests.length} معاملة من ${selectedSheets.length} أوراق عمل وتوليد/توحيد ${finalNewCitizensList.length} مواطن برمز ONA بواسطة ${currentUser?.FullName}`
            );
          })
          .catch((err) => {
            console.error('Batch import commit error:', err);
            setIsProcessing(false);
            alert('حدث خطأ أثناء حفظ البيانات المستوردة.');
          });
      }
    };

    processChunk();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md font-['Tajawal',sans-serif]" dir="rtl">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 text-right max-h-[92vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-xs shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>استيراد وتصفية إكسل متعدد الشيتات بالذكاء الاصطناعي</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                  حتى 20,000 قيد ⚡
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                قراءة كافة أوراق العمل (المقابلات، الطلبات)، توحيد المراجعين المكررين، وتوليد كود ONA فوري
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

        {/* Feature Highlights */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-teal-50/80 via-emerald-50/50 to-blue-50/50 dark:from-teal-950/40 dark:via-emerald-950/20 dark:to-slate-900 border border-teal-200 dark:border-teal-800 text-xs space-y-1.5">
          <div className="flex items-center gap-2 text-teal-950 dark:text-teal-200 font-bold">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>خوارزمية الذكاء الاصطناعي لمعالجة ملفات الإكسل الضخمة:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-700 dark:text-slate-300 pt-1">
            <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-teal-100 dark:border-teal-900">
              <strong className="block text-teal-900 dark:text-teal-300 font-black">1. دمج وتصفية الشيتات:</strong>
              <span>يقرأ المقابلات والطلبات وسجلات الرعاية دفعة واحدة في ملف واحد.</span>
            </div>
            <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-teal-100 dark:border-teal-900">
              <strong className="block text-emerald-900 dark:text-emerald-300 font-black">2. توحيد المراجع المكرر:</strong>
              <span>إذا قدم الشخص أكثر من طلب، يُجمع كل تاريخه تحت كود ONA موحد.</span>
            </div>
            <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-teal-100 dark:border-teal-900">
              <strong className="block text-blue-900 dark:text-blue-300 font-black">3. منع القيود الوهمية:</strong>
              <span>تصفية فورية تحذف الأسطر الفارغة، العناوين، والصفوف المجهولة.</span>
            </div>
          </div>
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
            className="border-2 border-dashed border-teal-400 dark:border-teal-700 hover:border-teal-500 rounded-3xl p-5 sm:p-7 text-center cursor-pointer bg-slate-50 dark:bg-slate-850 hover:bg-teal-50/30 transition-all group"
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-100 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-700 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-2.5 group-hover:scale-110 transition-transform shadow-xs">
              <Upload className="w-6 h-6" />
            </div>

            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
              اضغط هنا لاختيار ملف Excel يحتوي على المقابلات أو الطلبات أو الشيتات المتعددة
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              يدعم ملفات (.xlsx, .xls) حتى 20,000 صف بدون توقف أو تهنيج في المتصفح
            </p>

            {fileName && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-600 text-white font-bold text-xs shadow-xs">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>الملف المحدد: {fileName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Multi-sheet Selector */}
        {availableSheets.length > 0 && !importSummary && (
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                <Layers className="w-4 h-4 text-teal-600" />
                <span>أوراق العمل الموجودة في الملف ({availableSheets.length} شيت):</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectAllSheets(true)}
                  className="px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 font-bold text-[11px]"
                >
                  تحديد الكل
                </button>
                <button
                  type="button"
                  onClick={() => selectAllSheets(false)}
                  className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px]"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {availableSheets.map((sheet, idx) => (
                <div
                  key={idx}
                  onClick={() => toggleSheetSelection(idx)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    sheet.selected
                      ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-400 dark:border-teal-700 text-teal-950 dark:text-teal-100'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-bold ${sheet.selected ? 'bg-teal-600 text-white' : 'border border-slate-400'}`}>
                      {sheet.selected ? '✓' : ''}
                    </span>
                    <span className="font-bold truncate">{sheet.name}</span>
                  </div>
                  <span className="font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                    ~{sheet.rowCount}
                  </span>
                </div>
              ))}
            </div>

            {/* Launch Action Button */}
            {!isProcessing && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={startSmartImport}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-lg shadow-teal-600/30 active:scale-95 transition-transform"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>بدء التصفية الذكية والاستيراد بالكامل ⚡</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Live Processing Progress Bar */}
        {isProcessing && (
          <div className="p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-300 dark:border-teal-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-teal-950 dark:text-teal-200">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-teal-600 animate-spin" />
                <span>{currentStepText || 'جاري معالجة وتصفية قيود الإكسل وتوليد الأكواد...'}</span>
              </span>
              <span className="font-mono text-teal-700 dark:text-teal-300 font-black">
                {processedCount.toLocaleString()} / {totalRows.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 via-emerald-500 to-blue-500 transition-all duration-150"
                style={{ width: `${totalRows > 0 ? Math.min(100, Math.round((processedCount / totalRows) * 100)) : 0}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium text-left font-mono" dir="ltr">
              {totalRows > 0 ? Math.min(100, Math.round((processedCount / totalRows) * 100)) : 0}% Completed
            </div>
          </div>
        )}

        {/* Summary Card */}
        {importSummary && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-black text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>اكتملت عملية الاستيراد والتصفية الذكية بنجاح تام!</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-slate-400 block">مراجعين جدد (ONA)</span>
                <strong className="text-emerald-700 dark:text-emerald-300 text-sm font-mono">{importSummary.newCitizens.toLocaleString()}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-slate-400 block">إجمالي المعاملات المضافة</span>
                <strong className="text-blue-700 dark:text-blue-300 text-sm font-mono">{importSummary.newRequests.toLocaleString()}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-slate-400 block">توحيد طلبات مكررة</span>
                <strong className="text-amber-700 dark:text-amber-300 text-sm font-mono">{importSummary.deduplicatedWithinFile.toLocaleString()}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-slate-400 block">شيتات تمت معالجتها</span>
                <strong className="text-purple-700 dark:text-purple-300 text-sm font-mono">{importSummary.sheetsProcessed}</strong>
              </div>
            </div>

            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">
              ✓ كافة المراجعين والمعاملات أصبحت متاحة فورياً للاستعلامات، قسم الإدارة، والبحث والأرشيف السحابي.
            </p>
          </div>
        )}

        {/* Sample Normalized Records Preview */}
        {previewRows.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
              معاينة عينة من السجلات بعد التصفية والدمج الذكي وتوليد كود ONA:
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
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold">
                      شيت: {item.sheetName}
                    </span>
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
