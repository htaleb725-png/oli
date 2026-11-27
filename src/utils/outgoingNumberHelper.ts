import { OfficeRequest, OfficialLetter, SystemSettings } from '../types';
import { getLocalTodayIsoDate } from './archiveHelper';

const INVALID_IMPORTED_NAME_EXACT = new Set([
  'الاسم',
  'الاسم الكامل',
  'اسم صاحب الطلب',
  'صاحب الطلب',
  'اسم المواطن',
  'اسم المراجع',
  'الاسم الرباعي',
  'الاسم الثلاثي',
  'اسم الدائرة',
  'الدائرة',
  'الوزارة',
  'الجهة',
  'رقم الكتاب',
  'العدد',
  'الصادر',
  'التسلسل',
  'ت',
  'المعرف',
  'المعرّف',
  'المعرف الموحد',
  'الملاحظات',
  'ملاحظات',
  'ملاحظة',
  'المجموع',
  'المجموع الكلي',
  'الإجمالي',
  'الاجمالي',
  'اجمالي',
  'مجموع',
  'العدد الكلي',
  'عدد الطلبات',
  'مواطن بدون اسم',
  'غير محدد',
  'لا يوجد',
  'بدون اسم',
  'name',
  'full name',
  'fullname',
  'citizen',
  'total',
  'grand total',
  'summary',
  'notes',
  'undefined',
  'null',
  'nan',
  'n/a',
  'none'
]);

/**
 * Strictly validates whether a cell value from an Excel import represents a real citizen name,
 * excluding empty cells, repeated headers, summary/total rows, pure numbers/dates, and random symbols.
 */
export function isValidImportedCitizenName(rawName?: string | null): boolean {
  const cleaned = String(rawName || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length < 2) return false;

  const lower = cleaned.toLowerCase();
  if (INVALID_IMPORTED_NAME_EXACT.has(lower)) return false;

  if (
    /^(المجموع|الإجمالي|الاجمالي|اجمالي|مجموع|ملاحظة|ملاحظات|كشف|جدول|تقرير|الصفحة|صفحة|total|subtotal|summary)\b/i.test(
      cleaned
    )
  ) {
    return false;
  }

  const lettersOnly = cleaned.replace(/[^a-zA-Z\u0621-\u064A\u0671-\u06D3]/g, '');
  if (lettersOnly.length < 2) return false;

  const digitsOnly = cleaned.replace(/[^0-9٠-٩]/g, '');
  if (digitsOnly.length >= 4 && digitsOnly.length >= lettersOnly.length) return false;

  if (/^(.)\1+$/.test(lettersOnly)) return false;

  return true;
}

/**
 * Convert Arabic-Indic (٠-٩) and Persian (۰-۹) digits to Western ASCII digits (0-9)
 */
export function toWesternDigits(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

/**
 * Parse Excel dates (serial numbers like 46085, DD/MM/YYYY, YYYY/MM/DD, ISO strings) into YYYY-MM-DD
 */
export function parseExcelDateValue(raw: any): string {
  if (raw === null || raw === undefined || raw === '') return '';

  // Handle Date instance
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().split('T')[0];
  }

  const normalized = toWesternDigits(raw).trim();
  if (!normalized) return '';

  // Excel serial date number (e.g. 44000..55000 => ~2020..2050)
  if (/^\d{5}(\.\d+)?$/.test(normalized)) {
    const serial = parseFloat(normalized);
    if (serial >= 35000 && serial <= 65000) {
      // Excel epoch is 1899-12-30
      const utcMs = Math.round((serial - 25569) * 86400 * 1000);
      const dt = new Date(utcMs);
      if (!isNaN(dt.getTime())) {
        return dt.toISOString().split('T')[0];
      }
    }
  }

  // YYYY-MM-DD or YYYY/MM/DD (anywhere inside string)
  const ymd = normalized.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const y = ymd[1];
    const m = ymd[2].padStart(2, '0');
    const d = ymd[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY (anywhere inside string)
  const dmy = normalized.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }

  // DD/MM/YY
  const dmyShort = normalized.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmyShort) {
    const d = dmyShort[1].padStart(2, '0');
    const m = dmyShort[2].padStart(2, '0');
    const y = `20${dmyShort[3]}`;
    return `${y}-${m}-${d}`;
  }

  return normalized;
}

/**
 * Splits a combined Iraqi Excel cell like "ن / 12 / 450 في 2026/03/12" or "450 - 12/03/2026"
 * cleanly into separate outgoingNumber and outgoingDate values.
 */
export function splitCombinedOutgoingAndDate(
  rawOutgoing: any,
  rawDate?: any
): { outgoingNumber: string; outgoingDate: string } {
  const outStr = toWesternDigits(rawOutgoing || '').trim();
  let dateStr = parseExcelDateValue(rawDate);

  if (!outStr) {
    return { outgoingNumber: '', outgoingDate: dateStr };
  }

  // Detect embedded full date inside outgoing cell (YYYY/MM/DD or DD/MM/YYYY)
  const datePatterns = [
    /(?:في|بتاريخ|تاريخ)?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/,
    /(?:في|بتاريخ|تاريخ)?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/
  ];

  let cleanedOutgoing = outStr;
  for (const pat of datePatterns) {
    const match = cleanedOutgoing.match(pat);
    if (match) {
      if (!dateStr && match[1]) {
        dateStr = parseExcelDateValue(match[1]);
      }
      cleanedOutgoing = cleanedOutgoing
        .replace(match[0], ' ')
        .replace(/[-–—|،,]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  // Strip trailing keywords left behind like "في" or "بتاريخ"
  cleanedOutgoing = cleanedOutgoing
    .replace(/(?:في|بتاريخ|العدد|رقم\s*الكتاب|رقم\s*الصادر)\s*:?\s*$/i, '')
    .replace(/^(?:العدد|رقم\s*الكتاب|رقم\s*الصادر)\s*:?\s*/i, '')
    .trim();

  return {
    outgoingNumber: cleanedOutgoing || outStr,
    outgoingDate: dateStr
  };
}

export type OutgoingBranch = 'nasiriyah' | 'suq_al_shuyoukh' | 'general';

export interface ParsedOutgoingInfo {
  seq: number;
  branch: OutgoingBranch;
  normalized: string;
}

/**
 * Maximum realistic parliamentary office outgoing book sequence number.
 * Rejects accidental 6-8+ digit phone numbers, national IDs, timestamps, or YYYYMMDD dates
 * (e.g., 23182436 / 23182437) from ever poisoning the office outgoing counter.
 */
export const MAX_VALID_OUTGOING_SEQ = 50000;

/**
 * Compute the highest valid outgoing sequence from a list of candidate numbers.
 * Rejects impossible values (> MAX_VALID_OUTGOING_SEQ) and bare Excel serial dates (40000..55000),
 * while ALWAYS preserving real office outgoing numbers (e.g. 4256 even when earlier records were 1..100).
 */
export function findRobustMaxSequence(sequences: number[]): number {
  const valid = sequences.filter(
    (n) => Number.isFinite(n) && Number.isInteger(n) && n > 0 && n <= MAX_VALID_OUTGOING_SEQ
  );
  if (valid.length === 0) return 0;

  const uniqueSorted = Array.from(new Set(valid)).sort((a, b) => a - b);
  if (uniqueSorted.length < 6) {
    return uniqueSorted[uniqueSorted.length - 1];
  }

  // Only discard extreme corrupted tail values above 35,000 (e.g., stray Excel serial dates 44xxx-46xxx)
  // that sit far above the normal book sequence range; never discard genuine 1..35000 book numbers like 4256!
  let topIdx = uniqueSorted.length - 1;
  while (topIdx >= 1) {
    const candidate = uniqueSorted[topIdx];
    const prev = uniqueSorted[topIdx - 1];
    const tailSize = uniqueSorted.length - topIdx;
    const isLikelyExcelSerialOutlier =
      candidate >= 35000 && candidate - prev > 10000 && candidate > prev * 4 && tailSize <= 3;
    if (isLikelyExcelSerialOutlier) {
      topIdx -= 1;
      continue;
    }
    break;
  }

  return uniqueSorted[topIdx];
}

/**
 * Intelligently extract the outgoing sequence number and office branch from ANY Iraqi outgoing format:
 * Examples:
 * - "4256/1125"                 -> { seq: 4256, branch: 'general' }
 * - "1125/4256"                 -> { seq: 4256, branch: 'general' }
 * - "ن / 12 / 4256"             -> { seq: 4256, branch: 'nasiriyah' }
 * - "س / 14 / 320"              -> { seq: 320, branch: 'suq_al_shuyoukh' }
 * - "ن / ٢٦ / ٤٢٥٦"             -> { seq: 4256, branch: 'nasiriyah' }
 * - "ن/12/450 في 2026/03/12"    -> { seq: 450, branch: 'nasiriyah' }
 * - "4256 / 2026"               -> { seq: 4256, branch: 'general' }
 * - "2026/4256"                 -> { seq: 4256, branch: 'general' }
 * - "4256"                      -> { seq: 4256, branch: 'general' }
 */
export function extractOutgoingSequence(rawOutgoing?: string | null): ParsedOutgoingInfo {
  const rawNormalized = toWesternDigits(rawOutgoing || '').trim();
  if (!rawNormalized) {
    return { seq: 0, branch: 'general', normalized: '' };
  }

  // CRITICAL: Strip embedded full dates (3-part dates like 12/03/2026 or 2026/03/12) BEFORE tokenizing numbers
  const normalized = rawNormalized
    .replace(/(?:في|بتاريخ|تاريخ)\s*\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/gi, ' ')
    .replace(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, ' ')
    .replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return { seq: 0, branch: 'general', normalized: rawNormalized };
  }

  // Detect branch prefix
  let branch: OutgoingBranch = 'general';
  if (/^س(\s|\/|-|$)|سوق\s*الشيوخ/i.test(normalized) || /(^|\s)س\s*\//.test(normalized) || /\/\s*س(\s|$)/.test(normalized)) {
    branch = 'suq_al_shuyoukh';
  } else if (/^ن(\s|\/|-|$)|الناصرية|ناصرية/i.test(normalized) || /(^|\s)ن\s*\//.test(normalized) || /\/\s*ن(\s|$)/.test(normalized)) {
    branch = 'nasiriyah';
  }

  // Extract numeric segments in order
  const rawTokens = normalized.split(/[\/\\\-|،,\s]+/).filter(Boolean);
  const numericTokens: number[] = [];
  let hadRejectedOversizedToken = false;
  for (const tok of rawTokens) {
    const m = tok.match(/\d+/g);
    if (m) {
      for (const digits of m) {
        // Immediately reject 6+ digit numbers (phone fragments, national IDs, YYYYMMDD dates, 23182437, etc.)
        if (digits.length > 5) {
          hadRejectedOversizedToken = true;
          continue;
        }
        const val = parseInt(digits, 10);
        if (!isNaN(val) && val > 0 && val <= MAX_VALID_OUTGOING_SEQ) {
          numericTokens.push(val);
        } else if (!isNaN(val) && val > MAX_VALID_OUTGOING_SEQ) {
          hadRejectedOversizedToken = true;
        }
      }
    }
  }

  if (numericTokens.length === 0) {
    return { seq: 0, branch, normalized };
  }

  if (numericTokens.length === 1) {
    const only = numericTokens[0];
    // If an oversized corrupted sequence was dropped (e.g. "ن / 12 / 23182437") leaving only branch code 12/14, reject!
    if (hadRejectedOversizedToken && (only === 12 || only === 14)) {
      return { seq: 0, branch, normalized };
    }
    // Reject bare 5-digit Excel serial date numbers (40000..55000 => years 2009..2050) when no branch prefix is present
    if (branch === 'general' && only >= 40000 && only <= 55000) {
      return { seq: 0, branch, normalized };
    }
    return { seq: only, branch, normalized };
  }

  // Filter out 4-digit calendar years (2020..2040) when paired with another numeric token (e.g. "4256 / 2026" or "2026/4256")
  // If ALL tokens happen to be in 2020..2040 (e.g. book #2025 in year 2026 -> "2025/2026"), keep the first token!
  const nonYearTokens = numericTokens.filter((n) => !(n >= 2020 && n <= 2040));
  if (nonYearTokens.length === 0) {
    return { seq: numericTokens[0], branch, normalized };
  }

  if (nonYearTokens.length === 1) {
    const only = nonYearTokens[0];
    if (branch === 'general' && only >= 40000 && only <= 55000) {
      return { seq: 0, branch, normalized };
    }
    return { seq: only, branch, normalized };
  }

  // Multiple non-year numbers exist:
  // e.g., ["12", "4256"] from "ن / 12 / 4256", ["4256", "1125"] from "4256/1125", or ["4256", "12"] from "4256 / 12 / ن"
  const currentYearShort = parseInt(String(new Date().getFullYear()).slice(-2), 10);
  const first = nonYearTokens[0];
  const last = nonYearTokens[nonYearTokens.length - 1];

  // Standard prefix code first: "ن / 12 / 4256" or "ن / 26 / 4256"
  if (
    first === 12 ||
    first === 14 ||
    first === currentYearShort ||
    (first >= 20 && first <= 35 && nonYearTokens.length >= 2 && last > 35)
  ) {
    return { seq: last, branch, normalized };
  }

  // Reversed Iraqi format: "4256 / 12 / ن" or "4256 / 14 / س" or "4256 / 26"
  if (last === 12 || last === 14 || last === currentYearShort || (last >= 20 && last <= 35 && first > 35)) {
    return { seq: first, branch, normalized };
  }

  // Formats like "4256/1125" (sequence/month-year or sequence/subcode):
  // Prefer the largest non-branch-code token (e.g. 4256 over 1125)
  const nonCodeTokens = nonYearTokens.filter((n) => n !== 12 && n !== 14);
  return {
    seq: nonCodeTokens.length > 0 ? Math.max(...nonCodeTokens) : last,
    branch,
    normalized
  };
}

export interface OutgoingRawEntry {
  outgoing: string | number | null | undefined;
  citizenName?: string;
}

/**
 * Scan raw cell values from an uploaded Excel file's "العدد / الصادر" column in exact file order
 * and extract the authoritative LAST recorded outgoing number (handling ascending files, descending/newest-first
 * files, trailing unnumbered rows, Arabic digits, and sequential numbers crossing 2020..2040).
 * Guarantees that the counter resumes cleanly right after the last recorded outgoing entry without duplication or reset.
 */
export function findLastOutgoingInRawValues(
  rawValues: Array<string | number | null | undefined | OutgoingRawEntry>
): {
  lastSeq: number;
  lastInFileOrder: number;
  maxValid: number;
  recommendedBaseline: number;
  lastBranch: OutgoingBranch;
  lastRaw: string;
  lastCitizenName: string;
  lastNasiriyah: number;
  lastSuq: number;
  validCount: number;
  totalValidFound: number;
  orderDirection: 'asc' | 'desc' | 'single';
} {
  interface ParsedRowItem {
    seq: number;
    branch: OutgoingBranch;
    raw: string;
    citizenName: string;
    isStandaloneYearRange: boolean;
  }

  const parsedItems: ParsedRowItem[] = [];

  for (const entry of rawValues || []) {
    const raw =
      entry !== null && typeof entry === 'object' && 'outgoing' in entry
        ? entry.outgoing
        : (entry as string | number | null | undefined);
    const citizenName =
      entry !== null && typeof entry === 'object' && 'citizenName' in entry
        ? String(entry.citizenName || '').trim()
        : '';

    if (raw === null || raw === undefined) continue;
    const str = toWesternDigits(raw).trim();
    if (!str) continue;
    const split = splitCombinedOutgoingAndDate(str);
    const candidateStr = split.outgoingNumber || str;
    const parsed = extractOutgoingSequence(candidateStr);
    if (parsed.seq <= 0 || parsed.seq > MAX_VALID_OUTGOING_SEQ) continue;

    // Detect if cell was literally a standalone year like "2026" with no branch prefix
    const isStandaloneYearRange =
      parsed.branch === 'general' &&
      /^\d{4}$/.test(candidateStr.trim()) &&
      parsed.seq >= 2020 &&
      parsed.seq <= 2040;

    parsedItems.push({
      seq: parsed.seq,
      branch: parsed.branch,
      raw: candidateStr,
      citizenName,
      isStandaloneYearRange
    });
  }

  // Filter out isolated accidental year cells (e.g. "2025" inside a column whose numbers are 1..400),
  // while KEEPING genuine sequence numbers 2020..2040 when nearby rows are within ±100!
  const filteredItems = parsedItems.filter((item, idx) => {
    if (!item.isStandaloneYearRange) return true;
    const prev = idx > 0 ? parsedItems[idx - 1].seq : null;
    const next = idx < parsedItems.length - 1 ? parsedItems[idx + 1].seq : null;
    const nearPrev = prev !== null && Math.abs(item.seq - prev) <= 100 && prev !== item.seq;
    const nearNext = next !== null && Math.abs(item.seq - next) <= 100 && next !== item.seq;
    return nearPrev || nearNext;
  });

  let lastSeq = 0;
  let lastBranch: OutgoingBranch = 'general';
  let lastRaw = '';
  let lastCitizenName = '';
  let lastNasiriyah = 0;
  let lastSuq = 0;
  const allValidSeqs: number[] = [];

  for (const item of filteredItems) {
    lastSeq = item.seq;
    allValidSeqs.push(item.seq);
    lastBranch = item.branch;
    lastRaw = item.raw;
    if (item.citizenName) lastCitizenName = item.citizenName;

    if (item.branch === 'suq_al_shuyoukh') {
      lastSuq = Math.max(lastSuq, item.seq);
    } else if (item.branch === 'nasiriyah') {
      lastNasiriyah = Math.max(lastNasiriyah, item.seq);
    } else {
      lastNasiriyah = Math.max(lastNasiriyah, item.seq);
      lastSuq = Math.max(lastSuq, item.seq);
    }
  }

  const maxValid = findRobustMaxSequence(allValidSeqs);
  const validCount = filteredItems.length;

  // Determine whether the file is ordered ascending (1..N) or descending (N..1)
  let orderDirection: 'asc' | 'desc' | 'single' = 'single';
  if (filteredItems.length >= 2) {
    const firstSeq = filteredItems[0].seq;
    orderDirection = firstSeq > lastSeq ? 'desc' : 'asc';
  }

  // Authoritative baseline selection:
  // - If the file is descending (newest-first, e.g. 1343 -> 1), pick maxValid (top latest record) so we NEVER reset to 1!
  // - If the file is ascending (normal chronological order), pick the higher of lastSeq (when robust) and maxValid,
  //   ensuring the counter ALWAYS continues cleanly after the last recorded outgoing number without duplicating earlier ones.
  let recommendedBaseline = maxValid;
  let authoritativeItem: ParsedRowItem | undefined;

  if (orderDirection === 'desc') {
    recommendedBaseline = maxValid > 0 ? maxValid : lastSeq;
    authoritativeItem = filteredItems.find((i) => i.seq === recommendedBaseline) || filteredItems[0];
  } else {
    // Ascending or single-entry: if lastSeq is within the valid robust range, prefer max(lastSeq, maxValid)
    const lastIsOutlier = maxValid > 0 && lastSeq > maxValid;
    recommendedBaseline = lastIsOutlier ? maxValid : Math.max(lastSeq, maxValid);
    // Find the last item in file order matching recommendedBaseline
    for (let i = filteredItems.length - 1; i >= 0; i--) {
      if (filteredItems[i].seq === recommendedBaseline) {
        authoritativeItem = filteredItems[i];
        break;
      }
    }
  }

  if (authoritativeItem) {
    lastRaw = authoritativeItem.raw;
    lastBranch = authoritativeItem.branch;
    if (authoritativeItem.citizenName) {
      lastCitizenName = authoritativeItem.citizenName;
    }
  }

  return {
    lastSeq,
    lastInFileOrder: lastSeq,
    maxValid,
    recommendedBaseline,
    lastBranch,
    lastRaw,
    lastCitizenName,
    lastNasiriyah,
    lastSuq,
    validCount,
    totalValidFound: validCount,
    orderDirection
  };
}

/**
 * Scan any list of OfficeRequests (and optional OfficialLetters) to find the robust highest outgoing sequence
 * per office branch so importing Excel archives ALWAYS advances the outgoing counter accurately
 * without being poisoned by stray dates/phone numbers/typos.
 */
export function scanMaxOutgoingSequences(
  requests: OfficeRequest[],
  officialLetters?: OfficialLetter[]
): { maxNasiriyah: number; maxSuq: number; maxAny: number } {
  const nasiriyahSeqs: number[] = [];
  const suqSeqs: number[] = [];
  const anySeqs: number[] = [];

  const inspectRaw = (raw?: string | null) => {
    if (!raw || !String(raw).trim()) return;
    const parsed = extractOutgoingSequence(raw);
    if (parsed.seq <= 0 || parsed.seq > MAX_VALID_OUTGOING_SEQ) return;
    anySeqs.push(parsed.seq);
    if (parsed.branch === 'suq_al_shuyoukh') {
      suqSeqs.push(parsed.seq);
    } else if (parsed.branch === 'nasiriyah') {
      nasiriyahSeqs.push(parsed.seq);
    } else {
      nasiriyahSeqs.push(parsed.seq);
      suqSeqs.push(parsed.seq);
    }
  };

  for (const r of requests || []) {
    inspectRaw(r?.OutgoingNumber);
  }
  for (const l of officialLetters || []) {
    inspectRaw(l?.LetterNumber);
  }

  return {
    maxNasiriyah: findRobustMaxSequence(nasiriyahSeqs),
    maxSuq: findRobustMaxSequence(suqSeqs),
    maxAny: findRobustMaxSequence(anySeqs)
  };
}

/**
 * Extract an outgoing number string from a dynamic record object (CustomFields or CustomSectionRecord.data).
 */
function pickOutgoingFromDynamicBag(bag?: Record<string, any> | null): string {
  if (!bag || typeof bag !== 'object') return '';
  const exactKeys = [
    'OutgoingNumber',
    'outgoingNumber',
    'العدد / الصادر',
    'رقم الصادر',
    'العدد الصادر',
    'رقم الكتاب',
    'الصادر',
    'العدد'
  ];
  for (const key of exactKeys) {
    const val = bag[key];
    if (val !== undefined && val !== null && String(val).trim()) {
      return String(val).trim();
    }
  }
  return '';
}

/**
 * Compute the next authoritative outgoing number across ALL recorded outgoing entries:
 * - ALL requests (active + archived + imported, including any OutgoingNumber in CustomFields)
 * - ALL officialLetters
 * - Optional customRecords (e.g. Social Care / custom departments with outgoing columns)
 * - Plus systemSettings baseline when higher than recorded numbers
 *
 * Always identifies the TRUE largest recorded outgoing sequence (whether standalone like "4256"
 * or formatted like "4256/1125", "ن / 12 / 4256", "4256/2026") as "آخر عدد صادر مسجل",
 * and sets "العدد القادم المقترح" to `maxFound + 1` (e.g. 4256 -> 4257).
 */
export function computeNextOutgoingNumber(
  requests: OfficeRequest[],
  systemSettings?: Partial<SystemSettings> | null,
  officialLetters?: OfficialLetter[],
  customRecords?: Array<{ data?: Record<string, any>; createdAt?: string; [key: string]: any }>
): {
  nextNumber: string;
  nextSeq: number;
  maxFound: number;
  branchPrefix: string;
  branchCode: string;
  lastOutgoingRecord?: {
    outgoingNumber: string;
    outgoingDate: string;
    citizenName: string;
    seq: number;
    request?: OfficeRequest;
  };
} {
  const isSuq = systemSettings?.officeBranch === 'suq_al_shuyoukh';
  const targetBranch: OutgoingBranch = isSuq ? 'suq_al_shuyoukh' : 'nasiriyah';
  const branchPrefix = isSuq ? 'س' : 'ن';
  const branchCode = isSuq ? '14' : '12';

  const rawBaseline = isSuq
    ? Number(systemSettings?.lastOutgoingNumberSuq) || 0
    : Number(systemSettings?.lastOutgoingNumberNasiriyah) || 0;

  type CandidateRecord = {
    outgoingNumber: string;
    outgoingDate: string;
    citizenName: string;
    seq: number;
    branch: OutgoingBranch;
    request?: OfficeRequest;
    orderIdx: number;
  };

  const allCandidates: CandidateRecord[] = [];
  let orderCounter = 0;

  for (const r of requests || []) {
    const rawOut =
      (r?.OutgoingNumber && String(r.OutgoingNumber).trim()) ||
      pickOutgoingFromDynamicBag((r as any)?.CustomFields);
    if (!rawOut) continue;
    const parsed = extractOutgoingSequence(rawOut);
    if (parsed.seq <= 0 || parsed.seq > MAX_VALID_OUTGOING_SEQ) continue;

    allCandidates.push({
      outgoingNumber: rawOut,
      outgoingDate: r.OutgoingDate || (r.CreatedAt ? String(r.CreatedAt).split('T')[0] : ''),
      citizenName: r.CitizenName || 'غير محدد',
      seq: parsed.seq,
      branch: parsed.branch,
      request: r,
      orderIdx: orderCounter++
    });
  }

  for (const l of officialLetters || []) {
    if (!l?.LetterNumber || !String(l.LetterNumber).trim()) continue;
    const rawOut = String(l.LetterNumber).trim();
    const parsed = extractOutgoingSequence(rawOut);
    if (parsed.seq <= 0 || parsed.seq > MAX_VALID_OUTGOING_SEQ) continue;

    allCandidates.push({
      outgoingNumber: rawOut,
      outgoingDate: l.LetterDate || '',
      citizenName: l.CitizenName || l.Recipient || 'كتاب رسمي',
      seq: parsed.seq,
      branch: parsed.branch,
      orderIdx: orderCounter++
    });
  }

  for (const rec of customRecords || []) {
    const rawOut = pickOutgoingFromDynamicBag(rec?.data || rec);
    if (!rawOut) continue;
    const parsed = extractOutgoingSequence(rawOut);
    if (parsed.seq <= 0 || parsed.seq > MAX_VALID_OUTGOING_SEQ) continue;
    const bag = rec?.data || rec || {};
    allCandidates.push({
      outgoingNumber: rawOut,
      outgoingDate: String(bag.OutgoingDate || bag['تاريخ الصادر'] || rec?.createdAt || '').split('T')[0],
      citizenName: String(bag.FullName || bag.CitizenName || bag['الاسم الكامل'] || bag['الاسم'] || 'سجل قسم'),
      seq: parsed.seq,
      branch: parsed.branch,
      orderIdx: orderCounter++
    });
  }

  // Prefer matching branch + general/unprefixed numbers (e.g. "4256/1125", "4256");
  // if another branch has records and matching branch has none, fall back to allCandidates so real outgoing numbers are never invisible.
  const branchCandidates = allCandidates.filter(
    (c) => c.branch === 'general' || c.branch === targetBranch
  );
  const effectiveCandidates = branchCandidates.length > 0 ? branchCandidates : allCandidates;

  const robustMaxFromRecords = findRobustMaxSequence(effectiveCandidates.map((c) => c.seq));

  // Keep valid manual/imported baseline, self-healing corrupted (> MAX_VALID_OUTGOING_SEQ) values
  const effectiveBaseline =
    Number.isFinite(rawBaseline) && rawBaseline > 0 && rawBaseline <= MAX_VALID_OUTGOING_SEQ
      ? Math.floor(rawBaseline)
      : 0;

  const isManualBaseline =
    effectiveBaseline > 0 &&
    (systemSettings?.outgoingBaselineMode === 'manual' ||
      String(systemSettings?.outgoingBaselineLabel || '').includes('تعديل يدوي'));

  const anchorMs = systemSettings?.outgoingBaselineSetAt
    ? Date.parse(systemSettings.outgoingBaselineSetAt) || 0
    : 0;

  const parseCandidateTs = (c: CandidateRecord): number => {
    const raw =
      (c.request as any)?.UpdatedAt ||
      (c.request as any)?.updatedAt ||
      c.request?.CreatedAt ||
      c.outgoingDate ||
      '';
    if (!raw) return 0;
    const t = Date.parse(String(raw));
    return Number.isFinite(t) ? t : 0;
  };

  let maxFound: number;
  let candidatePoolForBest = effectiveCandidates;

  if (isManualBaseline) {
    // Authoritative manual baseline (e.g. 3344): old historical records created BEFORE anchorMs
    // MUST NOT override the manual starting point. Only records created/updated strictly AFTER
    // the manual baseline was saved can advance it beyond effectiveBaseline.
    const postAnchorCandidates =
      anchorMs > 0
        ? effectiveCandidates.filter((c) => {
            const ts = parseCandidateTs(c);
            return ts > anchorMs + 1000 && c.seq >= effectiveBaseline;
          })
        : [];
    const postAnchorMax =
      postAnchorCandidates.length > 0
        ? Math.max(...postAnchorCandidates.map((c) => c.seq))
        : 0;
    maxFound = Math.max(effectiveBaseline, postAnchorMax);
    candidatePoolForBest = postAnchorCandidates;
  } else {
    maxFound = Math.max(effectiveBaseline, robustMaxFromRecords);
  }

  // Pick the best real record matching maxFound:
  // Prefer valid real citizen name + latest OutgoingDate / CreatedAt / orderIdx so lastName and lastOutgoing always match
  let bestRecord: CandidateRecord | undefined;
  const pickBetterCandidate = (current: CandidateRecord | undefined, next: CandidateRecord): CandidateRecord => {
    if (!current) return next;
    const curValid = isValidImportedCitizenName(current.citizenName);
    const nextValid = isValidImportedCitizenName(next.citizenName);
    if (nextValid && !curValid) return next;
    if (curValid && !nextValid) return current;
    const curDate = current.outgoingDate || '';
    const nextDate = next.outgoingDate || '';
    if (nextDate && curDate && nextDate !== curDate) {
      return nextDate > curDate ? next : current;
    }
    if (nextDate && !curDate) return next;
    if (curDate && !nextDate) return current;
    return next.orderIdx >= current.orderIdx ? next : current;
  };

  if (maxFound > 0) {
    for (const c of candidatePoolForBest) {
      if (c.seq === maxFound) {
        bestRecord = pickBetterCandidate(bestRecord, c);
      }
    }
    if (!bestRecord && !isManualBaseline) {
      for (const c of allCandidates) {
        if (c.seq === maxFound) {
          bestRecord = pickBetterCandidate(bestRecord, c);
        }
      }
    }
    if (!bestRecord && effectiveBaseline > 0 && maxFound === effectiveBaseline) {
      bestRecord = {
        outgoingNumber:
          (systemSettings?.lastOutgoingRaw && String(systemSettings.lastOutgoingRaw).trim()) ||
          `${branchPrefix} / ${branchCode} / ${effectiveBaseline}`,
        outgoingDate:
          (systemSettings?.defaultOutgoingDate && String(systemSettings.defaultOutgoingDate).trim()) ||
          (systemSettings?.outgoingBaselineSetAt
            ? systemSettings.outgoingBaselineSetAt.split('T')[0]
            : getLocalTodayIsoDate()),
        citizenName:
          (systemSettings?.lastRegisteredName && String(systemSettings.lastRegisteredName).trim()) ||
          systemSettings?.outgoingBaselineLabel ||
          'عداد الصادر اليدوي / المرفوع',
        seq: effectiveBaseline,
        branch: targetBranch,
        orderIdx: -1
      };
    }
  }

  const nextSeq = maxFound <= 0 ? 1 : maxFound + 1;
  const nextNumber = `${branchPrefix} / ${branchCode} / ${nextSeq}`;

  return {
    nextNumber,
    nextSeq,
    maxFound,
    branchPrefix,
    branchCode,
    lastOutgoingRecord: bestRecord
  };
}

/**
 * Parse delivery status (مستلم / غير مستلم) from Excel columns or text values
 */
export function parseDeliveryStatus(
  rawDelivery?: string | null,
  rawStatusFallback?: string | null
): 'مستلم' | 'غير مستلم' {
  const check = (val?: string | null): 'مستلم' | 'غير مستلم' | null => {
    if (!val) return null;
    const clean = String(val)
      .trim()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/\s+/g, ' ')
      .toLowerCase();
    if (!clean) return null;

    if (
      clean.includes('غير مستلم') ||
      clean.includes('غير مستلمة') ||
      clean.includes('لم يستلم') ||
      clean.includes('لم يتم الاستلام') ||
      clean.includes('بانتظار الاستلام') ||
      clean.includes('قيد الاستلام') ||
      clean === 'لا' ||
      clean === 'no' ||
      clean === 'false' ||
      clean === '0'
    ) {
      return 'غير مستلم';
    }

    if (
      clean.includes('مستلم') ||
      clean.includes('تم الاستلام') ||
      clean.includes('استلم') ||
      clean === 'نعم' ||
      clean === 'yes' ||
      clean === 'true' ||
      clean === '1'
    ) {
      return 'مستلم';
    }
    return null;
  };

  return check(rawDelivery) ?? check(rawStatusFallback) ?? 'غير مستلم';
}
