import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { Citizen, OfficeRequest } from '../types';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  X,
  Sparkles,
  Layers,
  RefreshCw,
  FolderKanban,
  Table2,
  Check,
  Filter,
  Download,
  Search,
  RotateCcw
} from 'lucide-react';
import {
  MAX_VALID_OUTGOING_SEQ,
  scanMaxOutgoingSequences,
  findLastOutgoingInRawValues,
  isValidImportedCitizenName,
  parseExcelDateValue,
  parseDeliveryStatus,
  splitCombinedOutgoingAndDate,
  toWesternDigits
} from '../utils/outgoingNumberHelper';
import { cleanReferrerLabel } from '../utils/referrerHelper';
import { fsSyncReferrer } from '../services/firebaseFirestoreService';
import { SOCIAL_CARE_LEGACY_CUSTOM_ID } from '../utils/permissions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type CanonicalFieldKey =
  | 'seq'
  | 'name'
  | 'entity'
  | 'subject'
  | 'outgoingNumber'
  | 'outgoingDate'
  | 'phone'
  | 'referrer'
  | 'address'
  | 'margin'
  | 'status'
  | 'deliveryStatus'
  | 'education'
  | 'job'
  | 'notes';

interface FieldSpec {
  key: CanonicalFieldKey;
  label: string;
  exactPatterns: RegExp[];
  strongPatterns: RegExp[];
  fallbackPatterns: RegExp[];
}

const CANONICAL_FIELDS: FieldSpec[] = [
  {
    key: 'seq',
    label: 'ت (التسلسل)',
    exactPatterns: [/^ت$/i, /^ت\.?$/i, /^التسلسل$/i, /^تسلسل$/i, /^م$/i, /^#$/],
    strongPatterns: [/^رقم التسلسل$/i, /^seq$/i, /^no\.?$/i, /^serial$/i],
    fallbackPatterns: []
  },
  {
    key: 'name',
    label: 'اسم صاحب الطلب',
    exactPatterns: [/^اسم صاحب الطلب$/i, /^الاسم الكامل$/i, /^الاسم الثلاثي$/i, /^الاسم$/i, /^اسم المواطن$/i, /^اسم المراجع$/i, /^اسم المستفيد$/i],
    strongPatterns: [/صاحب الطلب/i, /اسم المواطن/i, /اسم المراجع/i, /اسم المستفيد/i, /الاسم الرباعي/i, /^full\s*name$/i, /^name$/i],
    fallbackPatterns: [/^الاسم/i]
  },
  {
    key: 'entity',
    label: 'اسم الدائرة / الوزارة',
    exactPatterns: [/^اسم الدائرة\s*\/?\s*او الوزارة$/i, /^اسم الدائرة أو الوزارة$/i, /^اسم الدائرة$/i, /^الدائرة أو الوزارة$/i, /^الوزارة$/i, /^الجهة المعنية$/i, /^الجهة$/i],
    strongPatterns: [/اسم الدائر/i, /الدائرة.*الوزارة/i, /الوزارة.*الدائرة/i, /الجهة المعنية/i, /الجهة المستفيدة/i, /^ministry$/i, /^entity$/i],
    fallbackPatterns: [/وزار/i, /دائر/i, /مؤسس/i]
  },
  {
    key: 'outgoingNumber',
    label: 'رقم الكتاب / العدد',
    exactPatterns: [
      /^رقم الكتاب\s*\/?\s*العدد$/i,
      /^العدد\s*\/?\s*رقم الكتاب$/i,
      /^العدد\s*\/?\s*التاريخ$/i,
      /^العدد والتاريخ$/i,
      /^العدد و التاريخ$/i,
      /^رقم وتاريخ الكتاب$/i,
      /^رقم وتاريخ الصادر$/i,
      /^رقم الكتاب وتاريخه$/i,
      /^رقم الكتاب$/i,
      /^العدد$/i,
      /^عدد الكتاب$/i,
      /^رقم الصادر$/i,
      /^الصادر$/i,
      /^العدد الصادر$/i,
      /^الرقم الصادر$/i,
      /^العدد\s*\/?\s*الصادر$/i
    ],
    strongPatterns: [
      /رقم الكتاب/i,
      /رقم الصادر/i,
      /العدد الصادر/i,
      /عدد الكتاب/i,
      /العدد.*تاريخ/i,
      /عدد.*صادر/i,
      /صادر.*عدد/i,
      /^outgoing\s*number$/i,
      /^outgoing$/i,
      /^book\s*no/i
    ],
    fallbackPatterns: [/صادر/i, /^عدد$/i, /العدد/i]
  },
  {
    key: 'outgoingDate',
    label: 'تاريخ الكتاب',
    exactPatterns: [/^تاريخ الكتاب$/i, /^تاريخ الصادر$/i, /^التاريخ$/i, /^تاريخ الطلب$/i, /^تاريخ الانجاز$/i, /^تاريخ الإنجاز$/i],
    strongPatterns: [/تاريخ الكتاب/i, /تاريخ الصادر/i, /تاريخ التسجيل/i, /^outgoing\s*date$/i, /^date$/i],
    fallbackPatterns: [/تاريخ/i]
  },
  {
    key: 'deliveryStatus',
    label: 'حالة الاستلام (مستلم / غير مستلم)',
    exactPatterns: [/^حالة الاستلام$/i, /^الاستلام$/i, /^مستلم\s*\/?\s*غير مستلم$/i, /^هل تم الاستلام$/i, /^التسليم$/i],
    strongPatterns: [/حالة الاستلام/i, /استلام الطلب/i, /تم الاستلام/i, /مستلم.*غير/i, /^delivery/i],
    fallbackPatterns: [/استلام/i, /تسليم/i]
  },
  {
    key: 'status',
    label: 'حالة الطلب',
    exactPatterns: [/^حالة الطلب$/i, /^حالة المعاملة$/i, /^الحالة$/i, /^الإنجاز$/i, /^الاجراء$/i],
    strongPatterns: [/حالة الطلب/i, /حالة المعامل/i, /حالة الإنجاز/i, /^status$/i, /^processing/i],
    fallbackPatterns: [/حالة/i]
  },
  {
    key: 'subject',
    label: 'الموضوع',
    exactPatterns: [/^الموضوع$/i, /^موضوع الطلب$/i, /^موضوع المعاملة$/i, /^التفاصيل$/i, /^تفاصيل الطلب$/i, /^نوع الطلب$/i],
    strongPatterns: [/الموضوع/i, /موضوع/i, /تفاصيل/i, /الغرض/i, /^subject$/i, /^details$/i],
    fallbackPatterns: []
  },
  {
    key: 'phone',
    label: 'رقم الهاتف',
    exactPatterns: [/^رقم الهاتف$/i, /^الهاتف$/i, /^الموبايل$/i, /^رقم الموبايل$/i, /^رقم الجوال$/i, /^التلفون$/i],
    strongPatterns: [/رقم الهاتف/i, /هاتف/i, /موبايل/i, /جوال/i, /تلفون/i, /^phone$/i, /^mobile$/i],
    fallbackPatterns: []
  },
  {
    key: 'referrer',
    label: 'المعرف / المعرّف الموحد',
    exactPatterns: [
      /^المعر[فّ]\s*الموحد$/i,
      /^المعرف الموحد$/i,
      /^المعرف$/i,
      /^المعرّف$/i,
      /^معرف$/i,
      /^جهة التزكية$/i,
      /^التزكية$/i,
      /^الوسيط$/i
    ],
    strongPatterns: [/معر[فّ]\s*موحد/i, /المعر[فّ]/i, /المعرف/i, /معرف/i, /تزكي/i, /منسق/i, /^referrer$/i],
    fallbackPatterns: []
  },
  {
    key: 'address',
    label: 'عنوان السكن',
    exactPatterns: [/^عنوان السكن$/i, /^العنوان$/i, /^السكن$/i, /^محل السكن$/i, /^القضاء$/i, /^المنطقة$/i],
    strongPatterns: [/عنوان السكن/i, /عنوان/i, /سكن/i, /قضاء/i, /منطق/i, /حي/i, /^address$/i, /^district$/i],
    fallbackPatterns: []
  },
  {
    key: 'margin',
    label: 'الهامش',
    exactPatterns: [/^الهامش$/i, /^هامش$/i, /^هامش النائب$/i, /^التوجيه$/i, /^توجيه النائب$/i],
    strongPatterns: [/الهامش/i, /هامش/i, /توجيه/i, /^margin$/i, /^directive$/i],
    fallbackPatterns: []
  },
  {
    key: 'education',
    label: 'التحصيل الدراسي',
    exactPatterns: [/^التحصيل الدراسي$/i, /^التحصيل$/i, /^الشهادة$/i, /^المؤهل العلمي$/i],
    strongPatterns: [/التحصيل/i, /تحصيل/i, /شهادة/i, /مؤهل/i, /^education$/i],
    fallbackPatterns: []
  },
  {
    key: 'job',
    label: 'نوع العمل',
    exactPatterns: [/^نوع العمل$/i, /^العمل$/i, /^المهنة$/i, /^نوع المهنة$/i, /^الوظيفة$/i],
    strongPatterns: [/نوع العمل/i, /نوع المهن/i, /المهنة/i, /مهن/i, /وظيف/i, /^job$/i],
    fallbackPatterns: []
  },
  {
    key: 'notes',
    label: 'ملاحظات أخرى',
    exactPatterns: [/^ملاحظات اخرى$/i, /^ملاحظات أخرى$/i, /^الملاحظات$/i, /^ملاحظات$/i, /^ملاحظة$/i],
    strongPatterns: [/ملاحظات/i, /ملاحظة/i, /^notes?$/i, /^remarks?$/i],
    fallbackPatterns: []
  }
];

/**
 * Exclusive priority column mapper: guarantees every Excel column header maps to AT MOST ONE field
 * (eliminates collisions like "تاريخ الكتاب" matching "رقم الكتاب" or "اسم صاحب الطلب" matching "الموضوع").
 */
function detectExclusiveColumnMapping(headers: string[]): Record<CanonicalFieldKey, string> {
  const result = {} as Record<CanonicalFieldKey, string>;
  const claimedHeaders = new Set<string>();
  const cleanHeaders = headers.map((h) => ({
    raw: h,
    norm: String(h || '')
      .trim()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/\s+/g, ' ')
  }));

  const runPass = (tier: 'exactPatterns' | 'strongPatterns' | 'fallbackPatterns') => {
    for (const spec of CANONICAL_FIELDS) {
      if (result[spec.key]) continue;
      const patterns = spec[tier];
      if (!patterns.length) continue;
      const matched = cleanHeaders.find(
        (h) => !claimedHeaders.has(h.raw) && patterns.some((p) => p.test(h.norm) || p.test(h.raw.trim()))
      );
      if (matched) {
        result[spec.key] = matched.raw;
        claimedHeaders.add(matched.raw);
      }
    }
  };

  runPass('exactPatterns');
  runPass('strongPatterns');
  runPass('fallbackPatterns');

  return result;
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
  const digits = toWesternDigits(raw).replace(/\D/g, '');
  if (digits.startsWith('9647')) return '0' + digits.slice(3);
  if (digits.startsWith('7') && digits.length === 10) return '0' + digits;
  return digits;
}

const DUMMY_PHONES = new Set([
  '07800000000',
  '07700000000',
  '07900000000',
  '07000000000',
  '07500000000',
  '00000000000',
  '0000000000',
  '1234567890',
  '0123456789'
]);

export function isValidRealPhone(phone: string): boolean {
  if (!phone) return false;
  const p = cleanPhoneNumber(phone);
  if (p.length < 9 || p.length > 15) return false;
  if (DUMMY_PHONES.has(p)) return false;
  if (/^(\d)\1+$/.test(p)) return false;
  if (/0{7,}$/.test(p)) return false;
  return true;
}

export function normalizeArabicName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/^(السيد|السيدة|المواطن|المواطنة|الحاج|الحاجة|المهندس|المهندسة|الدكتور|الدكتورة|الشيخ)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function guessDepartmentFromText(text: string): string {
  const clean = (text || '').toLowerCase();
  if (/رعاي|حماي|اجتماع|شؤون/.test(clean)) return 'social_care';
  if (/مقابل/.test(clean)) return 'interviews';
  if (/تنظيم|انتخاب/.test(clean)) return 'organization';
  if (/استعلام|مراجع/.test(clean)) return 'reception';
  return 'admin';
}

export const SmartExcelImporterModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    citizens,
    requests,
    customSections,
    currentUser,
    batchImportRecords,
    addCustomRecord,
    addInterview,
    upsertOrgRecord,
    addAuditLog,
    systemSettings,
    updateSystemSettings
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [currentStepText, setCurrentStepText] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Target department selector (routes imported data directly into its designated department!)
  const [targetDepartment, setTargetDepartment] = useState<string>('admin');

  // Multi-sheet State & detected column headers/mapping
  const [availableSheets, setAvailableSheets] = useState<
    Array<{ name: string; rowCount: number; selected: boolean; headers: string[] }>
  >([]);
  const [loadedWorkbook, setLoadedWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<CanonicalFieldKey, string>>(
    {} as Record<CanonicalFieldKey, string>
  );
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [customOutgoingBaseline, setCustomOutgoingBaseline] = useState<string>('');

  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState<{
    newCitizens: number;
    newRequests: number;
    gapFilledRecords?: number;
    departmentRecordsAdded: number;
    targetDepartmentLabel: string;
    existingMatched: number;
    deduplicatedWithinFile: number;
    skippedDuplicateRequests?: number;
    normalizedEntitiesCount: number;
    sheetsProcessed: number;
    deliveredCount: number;
    undeliveredCount: number;
    detectedMaxOutgoing?: number;
    lastRegisteredName?: string;
    lastOutgoingRaw?: string;
    referrersSyncedCount?: number;
    nextOutgoingPreview?: string;
    firestoreSaved?: boolean;
    sheetsDispatched?: boolean;
  } | null>(null);

  // Interactive Pre-Import & Direct-Export Filter States
  const [filterSearch, setFilterSearch] = useState('');
  const [filterSheet, setFilterSheet] = useState<string>('ALL');
  const [filterEntity, setFilterEntity] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDelivery, setFilterDelivery] = useState<string>('ALL');
  const [filterColumnKey, setFilterColumnKey] = useState<string>('ALL');
  const [filterColumnValue, setFilterColumnValue] = useState<string>('');
  const [showFilteredPreview, setShowFilteredPreview] = useState<boolean>(true);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const departmentOptions = useMemo(() => {
    const base = [
      { id: 'admin', label: 'قسم الإدارة — أرشيف المعاملات والصادر' },
      { id: 'social_care', label: 'قسم الرعاية الاجتماعية (شبكة الحماية)' },
      { id: 'reception', label: 'قسم الاستعلامات (سجل المواطنين)' },
      { id: 'interviews', label: 'قسم المقابلات' },
      { id: 'organization', label: 'قسم التنظيم' }
    ];
    const extras = (customSections || [])
      .filter((s) => s.id !== SOCIAL_CARE_LEGACY_CUSTOM_ID)
      .map((s) => ({ id: `custom:${s.id}`, label: `قسم مخصص: ${s.title}` }));
    return [...base, ...extras];
  }, [customSections]);

  const allDetectedHeaders = useMemo(() => {
    const set = new Set<string>();
    for (const s of availableSheets) {
      if (s.selected) {
        s.headers.forEach((h) => set.add(h));
      }
    }
    return Array.from(set);
  }, [availableSheets]);

  // Helper to check empty/placeholder values during smart gap-filling
  const isMissingFieldVal = (val: any): boolean => {
    const s = String(val ?? '').trim();
    if (!s) return true;
    const lower = s.toLowerCase();
    return (
      s === '-' ||
      s === '—' ||
      s === '–' ||
      s === 'غير محدد' ||
      s === 'غير مسجل' ||
      s === 'غير معروف' ||
      s === 'لا يوجد' ||
      s === 'جهة حكومية غير محددة' ||
      s === '07800000000' ||
      s === '07700000000' ||
      s === 'كاسب' ||
      s === 'إعدادية فما دون' ||
      s === 'عام' ||
      lower === 'null' ||
      lower === 'undefined'
    );
  };

  // Extract & normalize all valid rows reactively from selected sheets for live filtering, preview, export, and import
  const parsedFileRows = useMemo(() => {
    if (!loadedWorkbook || availableSheets.length === 0) return [];
    const targetDeptObj = departmentOptions.find((d) => d.id === targetDepartment);
    const targetDeptLabel = targetDeptObj?.label || 'قسم الإدارة';

    const rowsOut: Array<{
      sheetName: string;
      rawRow: Record<string, any>;
      seq: string;
      name: string;
      rawEntity: string;
      entity: string;
      subject: string;
      outgoingNumber: string;
      outgoingDate: string;
      phone: string;
      referrer: string;
      address: string;
      margin: string;
      rawStatus: string;
      status: string;
      deliveryStatus: 'مستلم' | 'غير مستلم';
      education: string;
      job: string;
      notes: string;
      departmentLabel: string;
    }> = [];

    for (const s of availableSheets) {
      if (!s.selected) continue;
      const ws = loadedWorkbook.Sheets[s.name];
      if (!ws) continue;
      const matrix = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 }) as any[][];
      let headerRowIdx = 0;
      for (let r = 0; r < Math.min(matrix.length, 6); r++) {
        const nonEmpty = (matrix[r] || []).filter((c) => String(c || '').trim() !== '');
        if (nonEmpty.length >= 2) {
          headerRowIdx = r;
          break;
        }
      }
      const jsonRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', range: headerRowIdx });
      if (jsonRows.length === 0) continue;

      const sheetHeaders = Object.keys(jsonRows[0] || {});
      const autoSheetMap = detectExclusiveColumnMapping(sheetHeaders);
      const effectiveMap: Record<CanonicalFieldKey, string> = { ...autoSheetMap };
      for (const spec of CANONICAL_FIELDS) {
        const userChoice = columnMapping[spec.key];
        if (userChoice === '__NONE__') {
          effectiveMap[spec.key] = '';
        } else if (userChoice && sheetHeaders.includes(userChoice)) {
          effectiveMap[spec.key] = userChoice;
        }
      }

      for (const row of jsonRows) {
        const getField = (key: CanonicalFieldKey): string => {
          const header = effectiveMap[key];
          if (!header) return '';
          const v = row[header];
          return v === null || v === undefined ? '' : String(v).trim();
        };

        const rawName = getField('name');
        if (!isValidImportedCitizenName(rawName)) {
          continue;
        }

        const rawSeq = toWesternDigits(getField('seq'));
        const rawEntity = getField('entity');
        const standardizedEntity = rawEntity
          ? normalizeEntityName(rawEntity)
          : targetDepartment === 'social_care'
            ? 'وزارة العمل والشؤون الاجتماعية'
            : 'جهة حكومية غير محددة';
        const rawSubject = getField('subject');
        const rawOutgoingDateRaw = effectiveMap.outgoingDate ? row[effectiveMap.outgoingDate] : '';
        const splitOut = splitCombinedOutgoingAndDate(getField('outgoingNumber'), rawOutgoingDateRaw);
        const rawOutgoing = splitOut.outgoingNumber;
        const rawOutgoingDate = splitOut.outgoingDate || parseExcelDateValue(rawOutgoingDateRaw);
        const rawPhone = cleanPhoneNumber(getField('phone'));
        const rawReferrer = cleanReferrerLabel(getField('referrer'));
        const rawAddress = getField('address');
        const rawMargin = getField('margin');
        const rawStatus = getField('status');
        const rawDelivery = getField('deliveryStatus');
        const rawEducation = getField('education');
        const rawJob = getField('job');
        const rawNotes = getField('notes');

        const normalizedStatus = rawStatus.includes('رفض')
          ? 'مرفوض'
          : rawStatus.includes('تدقيق') || rawStatus.includes('انتظار') || rawStatus.includes('معلق') || rawStatus.includes('متابع')
            ? 'قيد التدقيق'
            : rawStatus || 'منجز';
        const deliveryStatus = parseDeliveryStatus(rawDelivery, rawStatus);

        rowsOut.push({
          sheetName: s.name,
          rawRow: row,
          seq: rawSeq,
          name: rawName,
          rawEntity,
          entity: standardizedEntity,
          subject: rawSubject || `طلب مسجل ضمن (${s.name})`,
          outgoingNumber: rawOutgoing,
          outgoingDate: rawOutgoingDate,
          phone: isValidRealPhone(rawPhone) ? rawPhone : '',
          referrer: rawReferrer,
          address: rawAddress,
          margin: rawMargin,
          rawStatus,
          status: normalizedStatus,
          deliveryStatus,
          education: rawEducation,
          job: rawJob,
          notes: rawNotes,
          departmentLabel: targetDeptLabel
        });
      }
    }
    return rowsOut;
  }, [loadedWorkbook, availableSheets, columnMapping, targetDepartment, departmentOptions]);

  // Distinct dropdown options for Entity, Status, and Selected Specific Column
  const uniqueEntitiesInFile = useMemo(() => {
    const set = new Set<string>();
    for (const r of parsedFileRows) {
      if (r.entity) set.add(r.entity);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [parsedFileRows]);

  const uniqueStatusesInFile = useMemo(() => {
    const set = new Set<string>(['منجز', 'قيد التدقيق', 'مرفوض']);
    for (const r of parsedFileRows) {
      if (r.status) set.add(r.status);
    }
    return Array.from(set);
  }, [parsedFileRows]);

  const getRowColumnFilterValue = (row: (typeof parsedFileRows)[number], colKey: string): string => {
    if (colKey.startsWith('raw:')) {
      const hdr = colKey.slice(4);
      const val = row.rawRow?.[hdr];
      return val === null || val === undefined ? '' : String(val).trim();
    }
    switch (colKey as CanonicalFieldKey) {
      case 'seq': return row.seq;
      case 'name': return row.name;
      case 'entity': return row.entity;
      case 'subject': return row.subject;
      case 'outgoingNumber': return row.outgoingNumber;
      case 'outgoingDate': return row.outgoingDate;
      case 'phone': return row.phone;
      case 'referrer': return row.referrer;
      case 'address': return row.address;
      case 'margin': return row.margin;
      case 'status': return row.status;
      case 'deliveryStatus': return row.deliveryStatus;
      case 'education': return row.education;
      case 'job': return row.job;
      case 'notes': return row.notes;
      default: return '';
    }
  };

  const uniqueValuesForSelectedColumn = useMemo(() => {
    if (filterColumnKey === 'ALL') return [];
    const set = new Set<string>();
    for (const r of parsedFileRows) {
      const v = getRowColumnFilterValue(r, filterColumnKey);
      if (v) set.add(v);
      if (set.size >= 250) break;
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [parsedFileRows, filterColumnKey]);

  // Apply all interactive filters reactively
  const filteredParsedRows = useMemo(() => {
    const q = normalizeArabicName(toWesternDigits(filterSearch));
    const colQ = normalizeArabicName(toWesternDigits(filterColumnValue));

    return parsedFileRows.filter((r) => {
      if (filterSheet !== 'ALL' && r.sheetName !== filterSheet) return false;
      if (filterEntity !== 'ALL' && r.entity !== filterEntity) return false;
      if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
      if (filterDelivery !== 'ALL' && r.deliveryStatus !== filterDelivery) return false;

      if (filterColumnKey !== 'ALL' && colQ) {
        const cellVal = normalizeArabicName(toWesternDigits(getRowColumnFilterValue(r, filterColumnKey)));
        if (!cellVal.includes(colQ)) return false;
      }

      if (q) {
        const haystack = normalizeArabicName(
          toWesternDigits(
            [
              r.seq,
              r.name,
              r.entity,
              r.subject,
              r.outgoingNumber,
              r.outgoingDate,
              r.phone,
              r.referrer,
              r.address,
              r.margin,
              r.status,
              r.deliveryStatus,
              r.education,
              r.job,
              r.notes,
              r.sheetName
            ].join(' ')
          )
        );
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [
    parsedFileRows,
    filterSearch,
    filterSheet,
    filterEntity,
    filterStatus,
    filterDelivery,
    filterColumnKey,
    filterColumnValue
  ]);

  const hasActiveFilters = Boolean(
    filterSearch.trim() ||
      filterSheet !== 'ALL' ||
      filterEntity !== 'ALL' ||
      filterStatus !== 'ALL' ||
      filterDelivery !== 'ALL' ||
      (filterColumnKey !== 'ALL' && filterColumnValue.trim())
  );

  const resetAllFilters = () => {
    setFilterSearch('');
    setFilterSheet('ALL');
    setFilterEntity('ALL');
    setFilterStatus('ALL');
    setFilterDelivery('ALL');
    setFilterColumnKey('ALL');
    setFilterColumnValue('');
    setDownloadNotice(null);
  };

  // Direct download of currently filtered & column-ordered rows as a clean RTL Excel (.xlsx) file
  const handleDownloadFilteredExcel = () => {
    if (filteredParsedRows.length === 0) {
      setErrorBanner('لا توجد صفوف مطابقة للفلترة الحالية لتنزيلها.');
      return;
    }
    setErrorBanner(null);

    const targetDeptObj = departmentOptions.find((d) => d.id === targetDepartment);
    const deptLabel = targetDeptObj?.label || 'قسم الإدارة';

    const exportData = filteredParsedRows.map((r, index) => ({
      'ت': r.seq || String(index + 1),
      'اسم صاحب الطلب': r.name,
      'الوزارة / الجهة / الدائرة': r.entity,
      'موضوع الطلب': r.subject,
      'العدد / رقم الكتاب': r.outgoingNumber || '',
      'تاريخ الكتاب': r.outgoingDate || '',
      'رقم الهاتف': r.phone || '',
      'المعرف / الواسطة': r.referrer || '',
      'السكن / القضاء / المنطقة': r.address || '',
      'الهامش / التوجيه': r.margin || '',
      'حالة الطلب': r.status,
      'حالة الاستلام': r.deliveryStatus,
      'التحصيل الدراسي': r.education || '',
      'العمل / الوظيفة': r.job || '',
      'الملاحظات': r.notes || '',
      'القسم المستهدف': deptLabel,
      'ورقة العمل الأصلية': r.sheetName
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!views'] = [{ RTL: true }];
    ws['!cols'] = [
      { wch: 7 },
      { wch: 28 },
      { wch: 26 },
      { wch: 32 },
      { wch: 16 },
      { wch: 14 },
      { wch: 15 },
      { wch: 20 },
      { wch: 22 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 28 },
      { wch: 24 },
      { wch: 18 }
    ];

    const wb = XLSX.utils.book_new();
    const safeSheetTab = (deptLabel.split('—')[0] || 'البيانات_المفلترة').trim().slice(0, 30);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetTab || 'البيانات_المفلترة');

    const dateStamp = new Date().toISOString().split('T')[0];
    const cleanBaseName = (fileName || 'بيانات_المكتب').replace(/\.(xlsx|xls|csv)$/i, '').slice(0, 35);
    const outName = `مفلتر_${cleanBaseName}_${dateStamp}.xlsx`;
    XLSX.writeFile(wb, outName);

    setDownloadNotice(`تم تنزيل ملف Excel مفلتر بنجاح (${filteredParsedRows.length.toLocaleString()} صف) باسم: ${outName}`);
    addAuditLog(
      'تنزيل بيانات إكسل مفلترة',
      deptLabel,
      `تم تصدير وتنزيل ${filteredParsedRows.length} صف مفلتر من الملف (${fileName}) مباشرة بصيغة Excel`
    );
  };

  // Live scan of the uploaded Excel file's (رقم الكتاب / العدد) column strictly from cleaned valid rows
  // Guarantees 1-to-1 pairing between every valid citizen name and its exact outgoing number, excluding blank/junk rows
  const detectedFileOutgoing = useMemo(() => {
    if (!loadedWorkbook || availableSheets.length === 0 || parsedFileRows.length === 0) {
      return {
        lastSeq: 0,
        lastInFileOrder: 0,
        maxValid: 0,
        recommendedBaseline: 0,
        totalValidFound: 0,
        lastCitizenName: '',
        lastRaw: '',
        columnHeader: ''
      };
    }

    const rawEntries: Array<{ outgoing: any; citizenName?: string }> = [];
    let lastValidRowName = '';
    for (const row of parsedFileRows) {
      if (isValidImportedCitizenName(row.name)) {
        lastValidRowName = row.name;
      }
      if (row.outgoingNumber) {
        rawEntries.push({
          outgoing: row.outgoingNumber,
          citizenName: row.name
        });
      }
    }

    const stats = findLastOutgoingInRawValues(rawEntries);
    const resolvedLastCitizenName =
      (stats.lastCitizenName && isValidImportedCitizenName(stats.lastCitizenName) ? stats.lastCitizenName : '') ||
      lastValidRowName;

    return {
      ...stats,
      lastCitizenName: resolvedLastCitizenName,
      columnHeader: columnMapping.outgoingNumber && columnMapping.outgoingNumber !== '__NONE__' ? columnMapping.outgoingNumber : ''
    };
  }, [loadedWorkbook, availableSheets, parsedFileRows, columnMapping.outgoingNumber]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportSummary(null);
    setPreviewRows([]);
    setIsProcessing(true);
    setCurrentStepText('جاري قراءة أوراق العمل واكتشاف الأعمدة بدقة...');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        setLoadedWorkbook(workbook);

        const sheetDetails: Array<{ name: string; rowCount: number; selected: boolean; headers: string[] }> = [];
        let totalRecordsFound = 0;
        const firstHeaders: string[] = [];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;
          const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 }) as any[][];
          // Find the real header row (first non-empty row with >= 2 cells)
          let headerRowIdx = 0;
          for (let r = 0; r < Math.min(raw.length, 6); r++) {
            const nonEmpty = (raw[r] || []).filter((c) => String(c || '').trim() !== '');
            if (nonEmpty.length >= 2) {
              headerRowIdx = r;
              break;
            }
          }
          const headers = (raw[headerRowIdx] || [])
            .map((h) => String(h || '').trim())
            .filter(Boolean);
          if (firstHeaders.length === 0 && headers.length > 0) {
            firstHeaders.push(...headers);
          }
          const validRowEst = Math.max(0, raw.length - headerRowIdx - 1);
          sheetDetails.push({
            name: sheetName,
            rowCount: validRowEst,
            selected: true,
            headers
          });
          totalRecordsFound += validRowEst;
        }

        // Auto-detect department from file name or first sheet name
        const autoDept = guessDepartmentFromText(`${file.name} ${workbook.SheetNames.join(' ')}`);
        setTargetDepartment(autoDept);

        // Compute exclusive column mapping across all headers
        const mergedHeaders = Array.from(new Set(sheetDetails.flatMap((s) => s.headers)));
        const detected = detectExclusiveColumnMapping(mergedHeaders);
        setColumnMapping(detected);
        setShowColumnMapper(false);
        setCustomOutgoingBaseline('');
        setFilterSearch('');
        setFilterSheet('ALL');
        setFilterEntity('ALL');
        setFilterStatus('ALL');
        setFilterDelivery('ALL');
        setFilterColumnKey('ALL');
        setFilterColumnValue('');
        setDownloadNotice(null);

        setAvailableSheets(sheetDetails);
        setTotalRows(totalRecordsFound);
        setIsProcessing(false);
        setCurrentStepText('');
        setErrorBanner(null);

        if (totalRecordsFound === 0) {
          setErrorBanner('ملف الإكسل لا يحتوي على صفوف بيانات صالحة.');
        }
      } catch (err) {
        console.error(err);
        setErrorBanner('حدث خطأ أثناء قراءة ملف الإكسل. يرجى التأكد من أن الملف بصيغة (.xlsx أو .xls).');
        setIsProcessing(false);
        setCurrentStepText('');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const toggleSheetSelection = (index: number) => {
    setAvailableSheets((prev) => {
      const next = prev.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s));
      const newTotal = next.filter((s) => s.selected).reduce((acc, s) => acc + s.rowCount, 0);
      setTotalRows(newTotal);
      return next;
    });
  };

  const selectAllSheets = (selected: boolean) => {
    setAvailableSheets((prev) => {
      const next = prev.map((s) => ({ ...s, selected }));
      const newTotal = selected ? next.reduce((acc, s) => acc + s.rowCount, 0) : 0;
      setTotalRows(newTotal);
      return next;
    });
  };

  const startSmartImport = async () => {
    if (!loadedWorkbook) return;
    setErrorBanner(null);

    const selectedSheets = availableSheets.filter((s) => s.selected);
    if (selectedSheets.length === 0) {
      setErrorBanner('يرجى تحديد ورقة عمل واحدة على الأقل للاستيراد.');
      return;
    }

    if (filteredParsedRows.length === 0) {
      setErrorBanner('لا توجد صفوف مطابقة لمعايير الفلترة الحالية للاستيراد. قم بتعديل الفلاتر أو إعادة ضبطها.');
      return;
    }

    setIsProcessing(true);
    setProcessedCount(0);
    setCurrentStepText('جاري استيراد الصفوف المفلترة وترتيب الأعمدة وإكمال النواقص دون تكرار...');

    const rowsToImport = filteredParsedRows;
    setTotalRows(rowsToImport.length);

    // 1. Pre-index existing citizens
    const citizenNormMap = new Map<string, Citizen>();
    const citizenPhoneMap = new Map<string, Citizen>();
    const existingCitizenIds = new Set<string>();
    let maxOnaNumeric = 10000;

    for (const c of citizens) {
      if (!c) continue;
      if (c.Citizen_ID) {
        existingCitizenIds.add(c.Citizen_ID);
        const m = String(c.Citizen_ID).match(/ONA-(\d+)/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > maxOnaNumeric) maxOnaNumeric = n;
        }
      }
      if (c.FullName) {
        citizenNormMap.set(normalizeArabicName(c.FullName), c);
      }
      if (c.Phone1 && isValidRealPhone(c.Phone1)) {
        citizenPhoneMap.set(cleanPhoneNumber(c.Phone1), c);
      }
    }

    // 2. Pre-index existing requests by fingerprint AND by citizen+outgoing for smart gap-filling without duplication
    const existingRequestIds = new Set<string>();
    const existingRequestByFp = new Map<string, OfficeRequest>();
    const existingRequestByOutFp = new Map<string, OfficeRequest>();
    const makeReqFingerprint = (citizenId: string, entity: string, subject: string, outgoing: string) =>
      `${citizenId}|${normalizeArabicName(entity)}|${normalizeArabicName(subject)}|${normalizeArabicName(toWesternDigits(outgoing))}`;
    const makeReqOutFingerprint = (citizenId: string, outgoing: string) =>
      `${citizenId}|OUT:${normalizeArabicName(toWesternDigits(outgoing))}`;

    for (const r of requests) {
      if (!r) continue;
      if (r.Request_ID) existingRequestIds.add(r.Request_ID);
      if (r.Citizen_ID) {
        const fp = makeReqFingerprint(r.Citizen_ID, r.Entity || '', r.Details || '', r.OutgoingNumber || '');
        if (!existingRequestByFp.has(fp)) existingRequestByFp.set(fp, r);
        if (r.OutgoingNumber && !isMissingFieldVal(r.OutgoingNumber)) {
          const outFp = makeReqOutFingerprint(r.Citizen_ID, r.OutgoingNumber);
          if (!existingRequestByOutFp.has(outFp)) existingRequestByOutFp.set(outFp, r);
        }
      }
    }

    const workingNewCitizensByName = new Map<string, Citizen>();
    const workingNewCitizensByPhone = new Map<string, Citizen>();
    const gapFilledExistingCitizens = new Map<string, Citizen>();
    const gapFilledExistingRequests = new Map<string, OfficeRequest>();
    const createdRequests: OfficeRequest[] = [];
    const seenNewReqFingerprints = new Set<string>();
    const departmentMirrorTasks: Array<{ citizen: Citizen; request: OfficeRequest }> = [];
    const samplePreviews: any[] = [];

    let existingMatchedCount = 0;
    let deduplicatedCount = 0;
    let skippedDuplicateRequestsCount = 0;
    let gapFilledCount = 0;
    let normalizedEntitiesCount = 0;
    let deliveredCount = 0;
    let undeliveredCount = 0;
    let maxAnyOutgoing = 0;
    const allRawOutgoingInFile: Array<{ outgoing: string; citizenName?: string }> = [];
    let reqSeqCounter = 1;

    const nowStamp = new Date().toISOString().split('T')[0];
    const year = new Date().getFullYear();
    const batchStamp = Date.now().toString(36).toUpperCase().slice(-5);

    const targetDeptObj = departmentOptions.find((d) => d.id === targetDepartment);
    const targetDeptLabel = targetDeptObj?.label || 'قسم الإدارة';
    const isReceptionTarget = targetDepartment === 'reception';

    const chunkSize = 400;
    let currentIndex = 0;

    const processChunk = () => {
      const limit = Math.min(currentIndex + chunkSize, rowsToImport.length);

      for (; currentIndex < limit; currentIndex++) {
        const item = rowsToImport[currentIndex];
        const rawSeq = item.seq;
        const rawName = item.name;
        const rawEntity = item.rawEntity;
        const standardizedEntity = item.entity;
        const rawSubject = item.subject;
        const rawOutgoing = item.outgoingNumber;
        const rawOutgoingDate = item.outgoingDate;
        const validPhone = item.phone;
        const rawReferrer = item.referrer;
        const rawAddress = item.address;
        const rawMargin = item.margin;
        const rawStatus = item.rawStatus;
        const finalStatus = item.status;
        const deliveryStatus = item.deliveryStatus;
        const rawEducation = item.education;
        const rawJob = item.job;
        const rawNotes = item.notes;

        if (rawOutgoing) {
          allRawOutgoingInFile.push({ outgoing: rawOutgoing, citizenName: rawName });
        }

        if (rawEntity && standardizedEntity !== rawEntity) {
          normalizedEntitiesCount++;
        }

        const normName = normalizeArabicName(rawName);
        const incomingFirstWord = normName.split(' ')[0] || '';

        let targetCitizen: Citizen | undefined =
          citizenNormMap.get(normName) || workingNewCitizensByName.get(normName);

        if (!targetCitizen && validPhone) {
          const phoneCandidate = citizenPhoneMap.get(validPhone) || workingNewCitizensByPhone.get(validPhone);
          if (phoneCandidate) {
            const candFirstWord = normalizeArabicName(phoneCandidate.FullName || '').split(' ')[0] || '';
            if (candFirstWord && candFirstWord === incomingFirstWord) {
              targetCitizen = phoneCandidate;
            }
          }
        }

        if (!targetCitizen) {
          maxOnaNumeric += 1;
          let newOnaId = `ONA-${maxOnaNumeric}`;
          while (existingCitizenIds.has(newOnaId)) {
            maxOnaNumeric += 1;
            newOnaId = `ONA-${maxOnaNumeric}`;
          }
          existingCitizenIds.add(newOnaId);

          const parts = rawName.split(/\s+/);

          targetCitizen = {
            Citizen_ID: newOnaId,
            FirstName: parts[0] || rawName,
            FatherName: parts[1] || '',
            GrandFatherName: parts[2] || '',
            GreatGrandFatherName: parts[3] || '',
            Surname: parts.length > 4 ? parts.slice(4).join(' ') : 'عام',
            FullName: rawName,
            Phone1: validPhone,
            District: rawAddress || 'قضاء الناصرية (المركز)',
            ResidentialArea: rawAddress || undefined,
            SubDistrict: 'المركز',
            Gender: 'ذكر',
            Rating: 'لائق',
            Job: rawJob || 'كاسب',
            Education: rawEducation || 'إعدادية فما دون',
            ReferralSource: rawReferrer || '',
            CreatedAt: rawOutgoingDate || nowStamp,
            CreatedBy: currentUser?.FullName || 'موظف الإدارة',
            RegisteredVia: isReceptionTarget ? 'استعلامات' : 'إدارة',
            // Always tag restored/imported records as historical archive so they NEVER flood "الأعمال اليومية"
            IsHistoricalImported: true,
            IsArchived: true
          };

          workingNewCitizensByName.set(normName, targetCitizen);
          if (validPhone) workingNewCitizensByPhone.set(validPhone, targetCitizen);
        } else {
          // Smart gap-filling for matched citizen: fill ONLY missing/placeholder fields without touching valid data
          const isPreExisting = citizenNormMap.has(normName) || Boolean(validPhone && citizenPhoneMap.has(validPhone));
          const baseCit = gapFilledExistingCitizens.get(targetCitizen.Citizen_ID) || targetCitizen;
          const patchedCit: Citizen = { ...baseCit };
          let citizenChanged = false;

          if (isMissingFieldVal(patchedCit.Phone1) && validPhone) {
            patchedCit.Phone1 = validPhone;
            citizenChanged = true;
          }
          if (isMissingFieldVal(patchedCit.District) && !isMissingFieldVal(rawAddress)) {
            patchedCit.District = rawAddress;
            citizenChanged = true;
          }
          if (isMissingFieldVal(patchedCit.ResidentialArea) && !isMissingFieldVal(rawAddress)) {
            patchedCit.ResidentialArea = rawAddress;
            citizenChanged = true;
          }
          if (isMissingFieldVal(patchedCit.Job) && !isMissingFieldVal(rawJob)) {
            patchedCit.Job = rawJob;
            citizenChanged = true;
          }
          if (isMissingFieldVal(patchedCit.Education) && !isMissingFieldVal(rawEducation)) {
            patchedCit.Education = rawEducation;
            citizenChanged = true;
          }
          if (isMissingFieldVal(patchedCit.ReferralSource) && !isMissingFieldVal(rawReferrer)) {
            patchedCit.ReferralSource = rawReferrer;
            citizenChanged = true;
          }

          if (citizenChanged) {
            targetCitizen = patchedCit;
            if (isPreExisting) {
              gapFilledExistingCitizens.set(patchedCit.Citizen_ID, patchedCit);
              gapFilledCount++;
            } else {
              workingNewCitizensByName.set(normName, patchedCit);
            }
          }

          if (isPreExisting) {
            existingMatchedCount++;
          } else {
            deduplicatedCount++;
          }
        }

        const resolvedDetails = rawSubject || `طلب مسجل ضمن (${item.sheetName})`;
        const reqFp = makeReqFingerprint(targetCitizen.Citizen_ID, standardizedEntity, resolvedDetails, rawOutgoing || '');
        const outFp = rawOutgoing ? makeReqOutFingerprint(targetCitizen.Citizen_ID, rawOutgoing) : '';

        const matchedExistingReq =
          existingRequestByFp.get(reqFp) || (outFp ? existingRequestByOutFp.get(outFp) : undefined);

        if (matchedExistingReq) {
          // Existing request matched: if complete keep untouched; if missing fields, fill ONLY missing fields!
          const baseReq = gapFilledExistingRequests.get(matchedExistingReq.Request_ID) || matchedExistingReq;
          const patchedReq: OfficeRequest = { ...baseReq };
          let reqChanged = false;

          if (isMissingFieldVal(patchedReq.CitizenPhone) && (validPhone || targetCitizen.Phone1)) {
            patchedReq.CitizenPhone = validPhone || targetCitizen.Phone1 || '';
            reqChanged = true;
          }
          if (isMissingFieldVal(patchedReq.OutgoingNumber) && rawOutgoing) {
            patchedReq.OutgoingNumber = rawOutgoing;
            reqChanged = true;
          }
          if (isMissingFieldVal(patchedReq.OutgoingDate) && rawOutgoingDate) {
            patchedReq.OutgoingDate = rawOutgoingDate;
            reqChanged = true;
          }
          if (isMissingFieldVal(patchedReq.Address) && !isMissingFieldVal(rawAddress)) {
            patchedReq.Address = rawAddress;
            reqChanged = true;
          }
          if (isMissingFieldVal(patchedReq.ResidentialArea) && !isMissingFieldVal(rawAddress)) {
            patchedReq.ResidentialArea = rawAddress;
            reqChanged = true;
          }
          if (isMissingFieldVal(patchedReq.Margin) && !isMissingFieldVal(rawMargin)) {
            patchedReq.Margin = rawMargin;
            reqChanged = true;
          }
          if (isMissingFieldVal(patchedReq.Education) && !isMissingFieldVal(rawEducation)) {
            patchedReq.Education = rawEducation;
            reqChanged = true;
          }
          if (isMissingFieldVal(patchedReq.Job) && !isMissingFieldVal(rawJob)) {
            patchedReq.Job = rawJob;
            reqChanged = true;
          }
          if (isMissingFieldVal(patchedReq.ReferralSource) && !isMissingFieldVal(rawReferrer)) {
            patchedReq.ReferralSource = rawReferrer;
            reqChanged = true;
          }
          if (isMissingFieldVal(patchedReq.OtherNotes) && !isMissingFieldVal(rawNotes)) {
            patchedReq.OtherNotes = rawNotes;
            reqChanged = true;
          }

          if (reqChanged) {
            gapFilledExistingRequests.set(patchedReq.Request_ID, patchedReq);
            gapFilledCount++;
          } else {
            skippedDuplicateRequestsCount++;
          }
          continue;
        }

        if (seenNewReqFingerprints.has(reqFp) || (outFp && seenNewReqFingerprints.has(outFp))) {
          skippedDuplicateRequestsCount++;
          continue;
        }
        seenNewReqFingerprints.add(reqFp);
        if (outFp) seenNewReqFingerprints.add(outFp);

        let requestId = `REQ-${year}-IMP-${batchStamp}-${String(reqSeqCounter++).padStart(4, '0')}`;
        while (existingRequestIds.has(requestId)) {
          requestId = `REQ-${year}-IMP-${batchStamp}-${String(reqSeqCounter++).padStart(4, '0')}`;
        }
        existingRequestIds.add(requestId);

        if (deliveryStatus === 'مستلم') deliveredCount++;
        else undeliveredCount++;

        const newRequest: OfficeRequest = {
          Request_ID: requestId,
          Citizen_ID: targetCitizen.Citizen_ID,
          CitizenName: targetCitizen.FullName,
          CitizenPhone: validPhone || targetCitizen.Phone1 || '',
          Entity: standardizedEntity,
          RequestStatus: deliveryStatus,
          ProcessingStatus: rawStatus?.includes('رفض') ? 'مرفوض' : finalStatus === 'قيد التدقيق' ? 'قيد التدقيق' : 'منجز',
          DeliveryStatus: deliveryStatus,
          DeliveredAt: deliveryStatus === 'مستلم' ? (rawOutgoingDate || nowStamp) : undefined,
          Priority: 'عام',
          Details: resolvedDetails,
          OutgoingNumber: rawOutgoing || undefined,
          OutgoingDate: rawOutgoingDate || (rawOutgoing ? nowStamp : undefined),
          RegisteredVia: targetDeptLabel,
          TargetDepartment: targetDepartment,
          SerialNumber: rawSeq || undefined,
          CurrentStage: 'مكتمل',
          DirectorDecision: 'مؤرشف',
          Address: rawAddress || targetCitizen.District || 'الناصرية',
          ResidentialArea: rawAddress || targetCitizen.ResidentialArea,
          Margin: rawMargin || undefined,
          Education: rawEducation || targetCitizen.Education,
          Job: rawJob || targetCitizen.Job,
          ReferralSource: rawReferrer || cleanReferrerLabel(targetCitizen.ReferralSource) || '',
          CreatedAt: rawOutgoingDate || nowStamp,
          CreatedBy: `استيراد وتصفية (${currentUser?.FullName || 'الإدارة'})`,
          OtherNotes: rawNotes || `ملف: ${fileName} [${item.sheetName}]`,
          IsHistoricalImported: true,
          IsArchived: true
        };

        createdRequests.push(newRequest);

        if (targetDepartment !== 'admin' && targetDepartment !== 'reception') {
          departmentMirrorTasks.push({ citizen: targetCitizen, request: newRequest });
        }

        if (samplePreviews.length < 6) {
          samplePreviews.push({
            ona: targetCitizen.Citizen_ID,
            name: targetCitizen.FullName,
            phone: targetCitizen.Phone1 || 'غير مسجل',
            outgoingNumber: rawOutgoing || '—',
            outgoingDate: rawOutgoingDate || '—',
            deliveryStatus,
            normalizedEntity: standardizedEntity,
            details: resolvedDetails
          });
        }
      }

      setProcessedCount(currentIndex);

      if (currentIndex < rowsToImport.length) {
        setTimeout(processChunk, 0);
      } else {
        setCurrentStepText('جاري تثبيت البيانات المفلترة في قاعدة البيانات والأرشيف الاحتياطي وتحديث عداد الصادر...');

        const finalNewCitizensList = Array.from(workingNewCitizensByName.values());
        const allCitizensToCommit = [
          ...finalNewCitizensList,
          ...Array.from(gapFilledExistingCitizens.values())
        ];
        const allRequestsToCommit = [
          ...createdRequests,
          ...Array.from(gapFilledExistingRequests.values())
        ];

        // 1. Determine the exact last outgoing number & linked last registered citizen name from cleaned rows
        const fileOutgoingStats =
          detectedFileOutgoing.recommendedBaseline > 0
            ? detectedFileOutgoing
            : findLastOutgoingInRawValues(allRawOutgoingInFile);
        const manualBaselineNum = parseInt(toWesternDigits(customOutgoingBaseline).replace(/\D/g, ''), 10);
        const targetOutgoingBaseline =
          !isNaN(manualBaselineNum) && manualBaselineNum > 0 && manualBaselineNum <= MAX_VALID_OUTGOING_SEQ
            ? manualBaselineNum
            : fileOutgoingStats.recommendedBaseline > 0
            ? fileOutgoingStats.recommendedBaseline
            : scanMaxOutgoingSequences(allRequestsToCommit).maxAny;

        maxAnyOutgoing = targetOutgoingBaseline;
        const anchorTimestamp = new Date().toISOString();
        const lastRegisteredName =
          (fileOutgoingStats.lastCitizenName && isValidImportedCitizenName(fileOutgoingStats.lastCitizenName)
            ? fileOutgoingStats.lastCitizenName
            : '') ||
          (rowsToImport.length > 0 ? rowsToImport[rowsToImport.length - 1].name : '');
        const lastOutgoingRaw =
          (fileOutgoingStats.lastRaw && String(fileOutgoingStats.lastRaw).trim()) ||
          (targetOutgoingBaseline > 0 ? String(targetOutgoingBaseline) : '');
        const anchorLabel = lastRegisteredName
          ? `${lastRegisteredName} (${fileName} — آخر عدد: ${lastOutgoingRaw || targetOutgoingBaseline})`
          : `${fileName} (${lastOutgoingRaw || targetOutgoingBaseline})`;

        if (targetOutgoingBaseline > 0 || lastRegisteredName) {
          updateSystemSettings({
            ...(targetOutgoingBaseline > 0
              ? {
                  lastOutgoingNumberNasiriyah: targetOutgoingBaseline,
                  lastOutgoingNumberSuq: targetOutgoingBaseline
                }
              : {}),
            outgoingBaselineSetAt: anchorTimestamp,
            outgoingBaselineLabel: anchorLabel,
            ...(lastRegisteredName ? { lastRegisteredName } : {}),
            ...(lastOutgoingRaw ? { lastOutgoingRaw } : {})
          });
        }

        // 1b. Extract and sync all real unique referrers from imported rows to Firestore `referrers` collection
        const uniqueExtractedReferrers = Array.from(
          new Set(
            rowsToImport
              .map(r => cleanReferrerLabel(r.referrer))
              .filter(Boolean)
          )
        );
        if (uniqueExtractedReferrers.length > 0) {
          void Promise.allSettled(
            uniqueExtractedReferrers.slice(0, 250).map(refLabel => fsSyncReferrer(refLabel))
          );
        }

        const isSuqBranch = systemSettings.officeBranch === 'suq_al_shuyoukh';
        const effectiveMaxForBranch =
          targetOutgoingBaseline > 0
            ? targetOutgoingBaseline
            : isSuqBranch
            ? Number(systemSettings.lastOutgoingNumberSuq) || 0
            : Number(systemSettings.lastOutgoingNumberNasiriyah) || 0;
        const nextOutgoingPreview =
          effectiveMaxForBranch > 0
            ? `${isSuqBranch ? 'س / 14 / ' : 'ن / 12 / '}${effectiveMaxForBranch + 1}`
            : undefined;

        // 2. Mirror records into designated target department
        let deptMirroredCount = 0;
        if (departmentMirrorTasks.length > 0) {
          const cap = Math.min(departmentMirrorTasks.length, 500);
          for (let i = 0; i < cap; i++) {
            const { citizen, request } = departmentMirrorTasks[i];
            if (targetDepartment === 'social_care' || targetDepartment.startsWith('custom:')) {
              const secId =
                targetDepartment === 'social_care'
                  ? SOCIAL_CARE_LEGACY_CUSTOM_ID
                  : targetDepartment.replace('custom:', '');
              addCustomRecord({
                sectionId: secId,
                createdBy: currentUser?.FullName || 'استيراد وتصفية Excel',
                data: {
                  citizenName: citizen.FullName,
                  fullName: citizen.FullName,
                  phone: citizen.Phone1 || request.CitizenPhone || '',
                  entity: request.Entity,
                  subject: request.Details,
                  outgoingNumber: request.OutgoingNumber || '',
                  outgoingDate: request.OutgoingDate || '',
                  address: request.Address || citizen.District || '',
                  referrer: request.ReferralSource || '',
                  margin: request.Margin || '',
                  status: request.ProcessingStatus || 'منجز',
                  deliveryStatus: request.DeliveryStatus || 'غير مستلم',
                  education: request.Education || '',
                  job: request.Job || '',
                  notes: request.OtherNotes || ''
                }
              });
              deptMirroredCount++;
            } else if (targetDepartment === 'interviews') {
              addInterview({
                Citizen_ID: citizen.Citizen_ID,
                FullName: citizen.FullName,
                Phone1: citizen.Phone1 || request.CitizenPhone || '',
                Address: request.Address || citizen.District || 'الناصرية',
                Referrer: request.ReferralSource || '',
                Subject: request.Details,
                InterviewDate: request.OutgoingDate || nowStamp,
                Priority: 'عادي',
                Status: 'تمت المقابلة',
                DeputyNotes: request.Margin || request.OtherNotes || ''
              });
              deptMirroredCount++;
            } else if (targetDepartment === 'organization') {
              upsertOrgRecord({
                Citizen_ID: citizen.Citizen_ID,
                FullName: citizen.FullName,
                Phone1: citizen.Phone1 || request.CitizenPhone || '',
                District: request.Address || citizen.District || 'الناصرية',
                OrgRating: 'فعال',
                Notes: [request.Details, request.OtherNotes].filter(Boolean).join(' - ')
              });
              deptMirroredCount++;
            }
          }
        }

        // 3. Commit new & gap-filled citizens/requests atomically to Server + Firebase + Google Sheets
        // Pass the anchored outgoing baseline directly so batchImportRecords NEVER overrides it with stale closure state
        batchImportRecords(allCitizensToCommit, allRequestsToCommit, {
          anchoredOutgoingBaseline: targetOutgoingBaseline > 0 ? targetOutgoingBaseline : undefined,
          anchorTimestamp: targetOutgoingBaseline > 0 || lastRegisteredName ? anchorTimestamp : undefined,
          anchorLabel: targetOutgoingBaseline > 0 || lastRegisteredName ? anchorLabel : undefined,
          lastRegisteredName: lastRegisteredName || undefined,
          lastOutgoingRaw: lastOutgoingRaw || undefined
        })
          .then((syncRes) => {
            setIsProcessing(false);
            setCurrentStepText('');
            setPreviewRows(samplePreviews);
            setImportSummary({
              newCitizens: finalNewCitizensList.length,
              newRequests: createdRequests.length,
              gapFilledRecords: gapFilledCount,
              departmentRecordsAdded: deptMirroredCount || createdRequests.length,
              targetDepartmentLabel: targetDeptLabel,
              existingMatched: existingMatchedCount,
              deduplicatedWithinFile: deduplicatedCount,
              skippedDuplicateRequests: skippedDuplicateRequestsCount,
              normalizedEntitiesCount,
              sheetsProcessed: selectedSheets.length,
              deliveredCount,
              undeliveredCount,
              detectedMaxOutgoing: maxAnyOutgoing > 0 ? maxAnyOutgoing : undefined,
              lastRegisteredName: lastRegisteredName || undefined,
              lastOutgoingRaw: lastOutgoingRaw || undefined,
              referrersSyncedCount: uniqueExtractedReferrers.length,
              nextOutgoingPreview,
              firestoreSaved: syncRes?.firestoreSaved,
              sheetsDispatched: syncRes?.sheetsDispatched
            });

            addAuditLog(
              'استيراد وتصفية ملف إكسل',
              targetDeptLabel,
              `تم استيراد ${createdRequests.length} معاملة جديدة وإكمال نواقص ${gapFilledCount} سجل موجود (مستلم: ${deliveredCount} | غير مستلم: ${undeliveredCount}) إلى ${targetDeptLabel}${lastRegisteredName ? ` | آخر اسم: ${lastRegisteredName}` : ''}${maxAnyOutgoing > 0 ? ` | آخر عدد صادر: ${lastOutgoingRaw || maxAnyOutgoing}` : ''}`
            );
          })
          .catch((err) => {
            console.error('Batch import commit error:', err);
            setIsProcessing(false);
            setErrorBanner('حدث خطأ أثناء حفظ البيانات المستوردة. يرجى المحاولة مرة أخرى.');
          });
      }
    };

    processChunk();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md font-['Tajawal',sans-serif]" dir="rtl">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 text-right max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                استيراد وتصفية ملفات البيانات وترتيب الأعمدة حسب القسم
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                فرز دقيق لكل عمود في مكانه المخصص • دعم خاصية (مستلم / غير مستلم) • تحديث تلقائي لعداد الصادر بعد الأرشفة
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inline Error Banner */}
        {errorBanner && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center justify-between gap-2">
            <span>{errorBanner}</span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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
            className="border-2 border-dashed border-teal-400 dark:border-teal-700 hover:border-teal-500 rounded-2xl p-5 text-center cursor-pointer bg-slate-50 dark:bg-slate-800/40 hover:bg-teal-50/40 transition-all group"
          >
            <div className="w-11 h-11 mx-auto rounded-xl bg-teal-100 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-700 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-2">
              <Upload className="w-5 h-5" />
            </div>

            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
              اضغط لاختيار ملف Excel (.xlsx / .xls) لتصفيته وإنزاله في قسمه المخصص
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              يقرأ كافة الأعمدة (ت، اسم صاحب الطلب، الدائرة/الوزارة، الموضوع، العدد، التاريخ، الهاتف، المعرف، السكن، الهامش، الحالة، مستلم/غير مستلم، التحصيل، العمل، الملاحظات)
            </p>

            {fileName && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-600 text-white font-bold text-xs">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>الملف المحدد: {fileName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Target Department + Sheets + Column Mapping Panel */}
        {availableSheets.length > 0 && !importSummary && (
          <div className="space-y-3">
            {/* Step 1: Target Department Selector */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-amber-950 dark:text-amber-200">
                <FolderKanban className="w-4 h-4 text-amber-600" />
                <span>1. اختر القسم الذي ستنزل فيه بيانات هذا الملف:</span>
              </div>
              <select
                value={targetDepartment}
                onChange={(e) => setTargetDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
              >
                {departmentOptions.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Sheet Selection */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                  <Layers className="w-4 h-4 text-teal-600" />
                  <span>2. أوراق العمل في الملف ({availableSheets.length} ورقة عمل — إجمالي ~{totalRows.toLocaleString()} صف):</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectAllSheets(true)}
                    className="px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 font-bold text-[11px] cursor-pointer"
                  >
                    تحديد الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => selectAllSheets(false)}
                    className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] cursor-pointer"
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
                    className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                      sheet.selected
                        ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-400 dark:border-teal-700 text-teal-950 dark:text-teal-100'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          sheet.selected ? 'bg-teal-600 text-white' : 'border border-slate-400'
                        }`}
                      >
                        {sheet.selected ? <Check className="w-3 h-3" /> : ''}
                      </span>
                      <span className="font-bold truncate">{sheet.name}</span>
                    </div>
                    <span className="font-mono tabular-nums text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      {sheet.rowCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3: Strict Column Mapping Verification & Override */}
            {allDetectedHeaders.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                    <Table2 className="w-4 h-4 text-blue-600" />
                    <span>3. مطابقة وترتيب الأعمدة (كل حقل في عموده المخصص):</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowColumnMapper((v) => !v)}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    {showColumnMapper ? 'إخفاء التفاصيل' : 'تعديل مطابقة الأعمدة'}
                  </button>
                </div>

                {showColumnMapper && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                    {CANONICAL_FIELDS.map((spec) => (
                      <div
                        key={spec.key}
                        className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col gap-1"
                      >
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>{spec.label}</span>
                          {columnMapping[spec.key] && columnMapping[spec.key] !== '__NONE__' ? (
                            <span className="text-[10px] text-emerald-600 font-bold">مربوط</span>
                          ) : (
                            <span className="text-[10px] text-slate-400">غير موجود</span>
                          )}
                        </label>
                        <select
                          value={columnMapping[spec.key] || '__NONE__'}
                          onChange={(e) =>
                            setColumnMapping((prev) => ({ ...prev, [spec.key]: e.target.value }))
                          }
                          className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-900 dark:text-slate-100 outline-none"
                        >
                          <option value="__NONE__">— غير مربوط —</option>
                          {allDetectedHeaders.map((hdr) => (
                            <option key={hdr} value={hdr}>
                              {hdr}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Interactive Filtering by Columns/Fields/Status/Department + Direct Filtered Excel Download */}
            {parsedFileRows.length > 0 && (
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-black text-blue-950 dark:text-blue-200">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <span>4. فلترة وتصفية البيانات (حسب الأعمدة / الحقول / الحالة / القسم):</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-blue-700 text-white font-mono font-bold text-[11px] tabular-nums">
                      المطابق: {filteredParsedRows.length.toLocaleString()} / {parsedFileRows.length.toLocaleString()} صف
                    </span>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-100 font-bold text-[11px] cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>إعادة ضبط</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Controls Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {/* Global Search */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      placeholder="بحث شامل (الاسم، الهاتف، العدد، الموضوع...)"
                      className="w-full pr-8 pl-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 text-slate-900 dark:text-white text-[11px] font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Filter by Entity / Ministry */}
                  <select
                    value={filterEntity}
                    onChange={(e) => setFilterEntity(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 text-slate-900 dark:text-white text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">الوزارة / الجهة: الكل ({uniqueEntitiesInFile.length})</option>
                    {uniqueEntitiesInFile.map((ent) => (
                      <option key={ent} value={ent}>
                        {ent}
                      </option>
                    ))}
                  </select>

                  {/* Filter by Sheet / Tab */}
                  <select
                    value={filterSheet}
                    onChange={(e) => setFilterSheet(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 text-slate-900 dark:text-white text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">ورقة العمل: الكل</option>
                    {availableSheets
                      .filter((s) => s.selected)
                      .map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                  </select>

                  {/* Filter by Processing Status */}
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 text-slate-900 dark:text-white text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">حالة الطلب: الكل</option>
                    {uniqueStatusesInFile.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>

                  {/* Filter by Delivery Status */}
                  <select
                    value={filterDelivery}
                    onChange={(e) => setFilterDelivery(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 text-slate-900 dark:text-white text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">حالة الاستلام: الكل</option>
                    <option value="مستلم">مستلم فقط</option>
                    <option value="غير مستلم">غير مستلم فقط</option>
                  </select>

                  {/* Filter by Specific Column/Field */}
                  <select
                    value={filterColumnKey}
                    onChange={(e) => {
                      setFilterColumnKey(e.target.value);
                      setFilterColumnValue('');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 text-slate-900 dark:text-white text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">تصفية حسب عمود/حقل محدد...</option>
                    <optgroup label="الحقول المنظمة للنظام">
                      {CANONICAL_FIELDS.map((spec) => (
                        <option key={spec.key} value={spec.key}>
                          {spec.label}
                        </option>
                      ))}
                    </optgroup>
                    {allDetectedHeaders.length > 0 && (
                      <optgroup label="أعمدة الملف الأصلية">
                        {allDetectedHeaders.map((hdr) => (
                          <option key={`raw:${hdr}`} value={`raw:${hdr}`}>
                            عمود الملف: {hdr}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Specific Column Value Input / Selector */}
                {filterColumnKey !== 'ALL' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                    <input
                      type="text"
                      list="smart_excel_col_values"
                      value={filterColumnValue}
                      onChange={(e) => setFilterColumnValue(e.target.value)}
                      placeholder="اكتب أو اختر القيمة المطلوبة داخل العمود المحدد..."
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-400 dark:border-blue-600 text-slate-900 dark:text-white text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <datalist id="smart_excel_col_values">
                      {uniqueValuesForSelectedColumn.map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                    {uniqueValuesForSelectedColumn.length > 0 && (
                      <select
                        value={uniqueValuesForSelectedColumn.includes(filterColumnValue) ? filterColumnValue : ''}
                        onChange={(e) => setFilterColumnValue(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-300 dark:border-slate-700 text-slate-900 dark:text-white text-[11px] font-bold outline-none"
                      >
                        <option value="">— اختيار سريع من قيم العمود ({uniqueValuesForSelectedColumn.length}) —</option>
                        {uniqueValuesForSelectedColumn.slice(0, 150).map((val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {downloadNotice && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-[11px] font-bold flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{downloadNotice}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setDownloadNotice(null)}
                      className="p-0.5 hover:bg-emerald-200/50 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Live Filtered Data Preview Table */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      معاينة البيانات بعد الفلترة وترتيب الأعمدة ({Math.min(filteredParsedRows.length, 50)} من {filteredParsedRows.length.toLocaleString()} صف):
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFilteredPreview((v) => !v)}
                      className="text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:underline cursor-pointer"
                    >
                      {showFilteredPreview ? 'إخفاء المعاينة' : 'إظهار المعاينة'}
                    </button>
                  </div>

                  {showFilteredPreview && (
                    <div className="max-h-56 overflow-auto border border-blue-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900">
                      {filteredParsedRows.length === 0 ? (
                        <div className="p-5 text-center text-slate-500 text-xs font-bold">
                          لا توجد صفوف مطابقة للفلاتر المحددة حالياً.
                        </div>
                      ) : (
                        <table className="w-full text-right text-[11px] whitespace-nowrap">
                          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black sticky top-0 z-10">
                            <tr>
                              <th className="p-2">ت</th>
                              <th className="p-2">صاحب الطلب</th>
                              <th className="p-2">الوزارة / الجهة</th>
                              <th className="p-2">الموضوع</th>
                              <th className="p-2">العدد الصادر</th>
                              <th className="p-2">التاريخ</th>
                              <th className="p-2">الهاتف</th>
                              <th className="p-2">الحالة</th>
                              <th className="p-2">الاستلام</th>
                              <th className="p-2">الورقة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {filteredParsedRows.slice(0, 50).map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50">
                                <td className="p-2 font-mono text-slate-500">{row.seq || rIdx + 1}</td>
                                <td className="p-2 font-bold text-slate-900 dark:text-white">{row.name}</td>
                                <td className="p-2 text-teal-700 dark:text-teal-300">{row.entity}</td>
                                <td className="p-2 max-w-[200px] truncate" title={row.subject}>{row.subject}</td>
                                <td className="p-2 font-mono">{row.outgoingNumber || '—'}</td>
                                <td className="p-2 font-mono">{row.outgoingDate || '—'}</td>
                                <td className="p-2 font-mono">{row.phone || '—'}</td>
                                <td className="p-2 font-bold">{row.status}</td>
                                <td className="p-2 font-bold">
                                  <span className={row.deliveryStatus === 'مستلم' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                                    {row.deliveryStatus}
                                  </span>
                                </td>
                                <td className="p-2 text-slate-500">{row.sheetName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Detected Last Outgoing Number from Uploaded Excel File (عمود العدد / الصادر) */}
            <div className="p-3.5 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-black text-teal-950 dark:text-teal-200 flex items-center gap-2">
                  <span>5. ضبط عداد الصادر تلقائياً من عمود الصادر في الملف:</span>
                </div>
                {detectedFileOutgoing.recommendedBaseline > 0 && (
                  <span className="px-2.5 py-0.5 rounded-md bg-teal-700 text-white font-mono font-black text-[11px] tabular-nums">
                    آخر رقم صادر مرصود: {detectedFileOutgoing.recommendedBaseline}
                  </span>
                )}
              </div>

              {/* Direct Outgoing Column Selector so user can pick the exact outgoing column anytime */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center pt-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    عمود الصادر / العدد بالملف:
                  </label>
                  <select
                    value={columnMapping.outgoingNumber || '__NONE__'}
                    onChange={(e) => {
                      setColumnMapping((prev) => ({ ...prev, outgoingNumber: e.target.value }));
                      setCustomOutgoingBaseline('');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-teal-400 dark:border-teal-700 text-slate-900 dark:text-white font-bold text-[11px] outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="__NONE__">— بدون عمود صادر —</option>
                    {allDetectedHeaders.map((hdr) => (
                      <option key={hdr} value={hdr}>
                        {hdr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    آخر رقم صادر مسجل (يستكمل الترقيم بعده):
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      customOutgoingBaseline !== ''
                        ? customOutgoingBaseline
                        : detectedFileOutgoing.recommendedBaseline > 0
                        ? String(detectedFileOutgoing.recommendedBaseline)
                        : ''
                    }
                    onChange={(e) => setCustomOutgoingBaseline(e.target.value)}
                    placeholder="مثال: 1343"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-teal-400 dark:border-teal-700 text-slate-900 dark:text-white font-mono font-black text-xs text-center outline-none focus:ring-2 focus:ring-teal-500 tabular-nums"
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 dark:bg-slate-950 border border-slate-700 text-amber-300 font-bold text-[11px] flex flex-col justify-center gap-0.5">
                  <span className="text-[10px] text-slate-400">سيبدأ الترقيم القادم تلقائياً من:</span>
                  <span className="font-mono font-black text-sm text-emerald-300 tabular-nums" dir="rtl">
                    {(() => {
                      const base =
                        parseInt(toWesternDigits(customOutgoingBaseline).replace(/\D/g, ''), 10) ||
                        detectedFileOutgoing.recommendedBaseline ||
                        0;
                      const prefix = systemSettings.officeBranch === 'suq_al_shuyoukh' ? 'س / 14 / ' : 'ن / 12 / ';
                      return base > 0 ? `${prefix}${base + 1}` : 'يُحتسب تلقائياً';
                    })()}
                  </span>
                </div>
              </div>

              {detectedFileOutgoing.lastCitizenName && detectedFileOutgoing.recommendedBaseline > 0 && (
                <div className="text-[11px] text-teal-900 dark:text-teal-200 bg-white/70 dark:bg-slate-900/60 border border-teal-200 dark:border-teal-800/80 rounded-lg px-3 py-1.5 flex items-center justify-between flex-wrap gap-2">
                  <span>
                    آخر قيد صادر مرصود بالملف: <strong className="font-black">{detectedFileOutgoing.lastCitizenName}</strong>
                  </span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300">
                    القيمة بالملف: ({detectedFileOutgoing.lastRaw || detectedFileOutgoing.recommendedBaseline}) — إجمالي الأعداد المرصودة: {detectedFileOutgoing.totalValidFound}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons: Direct Filtered Excel Download + Smart Import & Sync */}
            {!isProcessing && (
              <div className="pt-1 flex flex-wrap items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadFilteredExcel}
                  disabled={filteredParsedRows.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-md active:scale-95 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل البيانات المفلترة مباشرة (Excel — {filteredParsedRows.length.toLocaleString()} صف)</span>
                </button>

                <button
                  type="button"
                  onClick={startSmartImport}
                  disabled={filteredParsedRows.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-md active:scale-95 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>
                    {hasActiveFilters
                      ? `استيراد وتثبيت (${filteredParsedRows.length.toLocaleString()}) سجل مفلتر في القسم`
                      : `تصفية وإنزال البيانات (${filteredParsedRows.length.toLocaleString()} صف) وتثبيت الصادر`}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Live Processing Progress Bar */}
        {isProcessing && (
          <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-300 dark:border-teal-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-teal-950 dark:text-teal-200">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-teal-600 animate-spin" />
                <span>{currentStepText || 'جاري معالجة الملف...'}</span>
              </span>
              <span className="font-mono tabular-nums text-teal-700 dark:text-teal-300 font-black">
                {processedCount.toLocaleString()} / {totalRows.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-teal-600 transition-all duration-150"
                style={{ width: `${totalRows > 0 ? Math.min(100, Math.round((processedCount / totalRows) * 100)) : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Summary Card */}
        {importSummary && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-black text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>اكتملت عملية التصفية والإنزال بنجاح في: {importSummary.targetDepartmentLabel}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-slate-500 block">مراجعين جدد</span>
                <strong className="text-emerald-700 dark:text-emerald-300 text-sm font-mono tabular-nums">
                  {importSummary.newCitizens.toLocaleString()}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-slate-500 block">المعاملات المضافة</span>
                <strong className="text-blue-700 dark:text-blue-300 text-sm font-mono tabular-nums">
                  {importSummary.newRequests.toLocaleString()}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-slate-500 block">إكمال حقول ناقصة</span>
                <strong className="text-teal-700 dark:text-teal-300 text-sm font-mono tabular-nums">
                  {(importSummary.gapFilledRecords || 0).toLocaleString()}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-slate-500 block">مستلم من المراجع</span>
                <strong className="text-emerald-700 dark:text-emerald-300 text-sm font-mono tabular-nums">
                  {importSummary.deliveredCount.toLocaleString()}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-slate-500 block">غير مستلم بعد</span>
                <strong className="text-amber-700 dark:text-amber-300 text-sm font-mono tabular-nums">
                  {importSummary.undeliveredCount.toLocaleString()}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-slate-500 block">سجلات مكتملة محفوظة دون تكرار</span>
                <strong className="text-slate-700 dark:text-slate-300 text-sm font-mono tabular-nums">
                  {(importSummary.deduplicatedWithinFile + (importSummary.skippedDuplicateRequests || 0)).toLocaleString()}
                </strong>
              </div>
            </div>

            {(importSummary.detectedMaxOutgoing || importSummary.lastRegisteredName) && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-xs font-bold flex items-center justify-between flex-wrap gap-2">
                <div className="space-y-0.5">
                  <span>تم رصد آخر سجل مكتمل وأعلى عدد صادر في الملف وتحديث تسلسل المكتب تلقائياً:</span>
                  {importSummary.lastRegisteredName && (
                    <div className="text-[11px] text-amber-900 dark:text-amber-100">
                      آخر اسم مسجل: <strong className="font-black">{importSummary.lastRegisteredName}</strong>
                      {importSummary.referrersSyncedCount ? ` • تم استخراج ومزامنة (${importSummary.referrersSyncedCount}) معرّف إلى قسم التزكيات` : ''}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 font-mono tabular-nums">
                  {importSummary.detectedMaxOutgoing && (
                    <span className="px-2 py-0.5 rounded bg-amber-200/80 text-slate-950 font-black">
                      آخر عدد/صادر: {importSummary.lastOutgoingRaw || importSummary.detectedMaxOutgoing}
                    </span>
                  )}
                  {importSummary.nextOutgoingPreview && (
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-black">
                      الصادر القادم: {importSummary.nextOutgoingPreview}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
              <p>
                {importSummary.firestoreSaved
                  ? 'تم الحفظ في قاعدة البيانات بنجاح.'
                  : 'تم إرسال السجلات وتجري المزامنة مع قاعدة البيانات في الخلفية.'}
                {' · '}
                {importSummary.sheetsDispatched
                  ? 'تمت مزامنة البيانات بنجاح مع الأرشيف الاحتياطي (إضافة الجديد وإكمال النواقص فقط دون تكرار).'
                  : 'يمكنك ترحيلها إلى الأرشيف الاحتياطي في أي وقت من لوحة المزامنة.'}
              </p>
              {filteredParsedRows.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadFilteredExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-black cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل نسخة Excel للبيانات المفلترة</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sample Normalized Records Preview */}
        {previewRows.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
              معاينة عينة من السجلات المرتبة في أعمدتها:
            </h4>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
              <table className="w-full text-right text-[11px]">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-2">ONA</th>
                    <th className="p-2">صاحب الطلب</th>
                    <th className="p-2">الدائرة / الوزارة</th>
                    <th className="p-2">العدد الصادر</th>
                    <th className="p-2">التاريخ</th>
                    <th className="p-2">الاستلام</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {previewRows.map((item, idx) => (
                    <tr key={idx} className="bg-white dark:bg-slate-900">
                      <td className="p-2 font-mono text-blue-600 dark:text-blue-400 font-bold">{item.ona}</td>
                      <td className="p-2 font-bold text-slate-900 dark:text-white">{item.name}</td>
                      <td className="p-2 text-teal-700 dark:text-teal-300">{item.normalizedEntity}</td>
                      <td className="p-2 font-mono tabular-nums">{item.outgoingNumber}</td>
                      <td className="p-2 font-mono tabular-nums">{item.outgoingDate}</td>
                      <td className="p-2 font-bold">
                        <span className={item.deliveryStatus === 'مستلم' ? 'text-emerald-700' : 'text-amber-700'}>
                          {item.deliveryStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
