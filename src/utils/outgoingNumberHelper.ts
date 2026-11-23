import { OfficeRequest, OfficialLetter, SystemSettings } from '../types';

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
 * Compute a robust maximum outgoing sequence from a list of candidate numbers.
 * Rejects impossible values (> MAX_VALID_OUTGOING_SEQ) and isolated huge outlier spikes
 * (e.g. a single typo row like 45920 inside an archive whose real numbers are 1..1343).
 */
export function findRobustMaxSequence(sequences: number[]): number {
  const valid = sequences.filter(
    (n) => Number.isFinite(n) && Number.isInteger(n) && n > 0 && n <= MAX_VALID_OUTGOING_SEQ
  );
  if (valid.length === 0) return 0;

  const uniqueSorted = Array.from(new Set(valid)).sort((a, b) => a - b);
  if (uniqueSorted.length < 5) {
    return uniqueSorted[uniqueSorted.length - 1];
  }

  // Walk downward from the top to discard isolated corrupted tail spikes
  // (e.g., 1..1343 followed by 1-4 stray Excel serial dates or typo numbers like 45890)
  let topIdx = uniqueSorted.length - 1;
  while (topIdx >= 1) {
    const candidate = uniqueSorted[topIdx];
    const prev = uniqueSorted[topIdx - 1];
    const tailSize = uniqueSorted.length - topIdx;
    const isHugeJump = candidate - prev > 2000 && candidate > prev * 3;
    if (isHugeJump && tailSize <= 4) {
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
 * - "ن / 12 / 450"              -> { seq: 450, branch: 'nasiriyah' }
 * - "س / 14 / 320"              -> { seq: 320, branch: 'suq_al_shuyoukh' }
 * - "ن / ٢٦ / ٤٥٠"              -> { seq: 450, branch: 'nasiriyah' }
 * - "ن/12/450 في 2026/03/12"    -> { seq: 450, branch: 'nasiriyah' }
 * - "450 في 12/03/2026"         -> { seq: 450, branch: 'general' }
 * - "450 / 2026"                -> { seq: 450, branch: 'general' }
 * - "2026/450"                  -> { seq: 450, branch: 'general' }
 * - "1343"                      -> { seq: 1343, branch: 'general' }
 */
export function extractOutgoingSequence(rawOutgoing?: string | null): ParsedOutgoingInfo {
  const rawNormalized = toWesternDigits(rawOutgoing || '').trim();
  if (!rawNormalized) {
    return { seq: 0, branch: 'general', normalized: '' };
  }

  // CRITICAL: Strip embedded dates BEFORE tokenizing numbers so dates like 12/3/2026 NEVER corrupt the sequence!
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
    // Reject obvious standalone 4-digit year (2020..2040)
    if (only >= 2020 && only <= 2040) {
      return { seq: 0, branch, normalized };
    }
    // Reject bare 5-digit Excel serial date numbers (40000..55000 => years 2009..2050) when no branch prefix is present
    if (branch === 'general' && only >= 40000 && only <= 55000) {
      return { seq: 0, branch, normalized };
    }
    return { seq: only, branch, normalized };
  }

  // Filter out 4-digit years (2020..2040)
  const nonYearTokens = numericTokens.filter((n) => !(n >= 2020 && n <= 2040));
  if (nonYearTokens.length === 0) {
    return { seq: 0, branch, normalized };
  }

  if (nonYearTokens.length === 1) {
    const only = nonYearTokens[0];
    if (branch === 'general' && only >= 40000 && only <= 55000) {
      return { seq: 0, branch, normalized };
    }
    return { seq: only, branch, normalized };
  }

  // Multiple non-year numbers exist:
  // e.g., ["12", "450"] from "ن / 12 / 450", ["14", "320"] from "س / 14 / 320", or reversed ["450", "12"] from "450 / 12 / ن"
  const currentYearShort = parseInt(String(new Date().getFullYear()).slice(-2), 10);
  const first = nonYearTokens[0];
  const last = nonYearTokens[nonYearTokens.length - 1];

  // Standard prefix code first: "ن / 12 / 450" or "ن / 26 / 450"
  if (
    first === 12 ||
    first === 14 ||
    first === currentYearShort ||
    (first >= 20 && first <= 35 && nonYearTokens.length >= 2)
  ) {
    return { seq: last, branch, normalized };
  }

  // Reversed Iraqi format: "450 / 12 / ن" or "450 / 14 / س"
  if (last === 12 || last === 14 || last === currentYearShort) {
    return { seq: first, branch, normalized };
  }

  // Otherwise pick the largest non-branch-code token
  const nonCodeTokens = nonYearTokens.filter((n) => n !== 12 && n !== 14);
  return {
    seq: nonCodeTokens.length > 0 ? Math.max(...nonCodeTokens) : last,
    branch,
    normalized
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
 * Compute the next authoritative outgoing number across ALL requests (active + archived Excel imports),
 * official letters, and systemSettings baselines so archiving ANY Excel file immediately advances the outgoing counter.
 * Automatically self-heals poisoned/corrupted baselines (e.g. > 50,000 or impossible spikes).
 */
export function computeNextOutgoingNumber(
  requests: OfficeRequest[],
  systemSettings?: Partial<SystemSettings> | null,
  officialLetters?: OfficialLetter[]
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
    request?: OfficeRequest;
  };

  const candidates: CandidateRecord[] = [];

  for (const r of requests || []) {
    if (!r?.OutgoingNumber || !String(r.OutgoingNumber).trim()) continue;
    const parsed = extractOutgoingSequence(r.OutgoingNumber);
    if (parsed.seq <= 0 || parsed.seq > MAX_VALID_OUTGOING_SEQ) continue;

    // Count matching branch records + general/numeric records
    const appliesToBranch = parsed.branch === 'general' || parsed.branch === targetBranch;
    if (appliesToBranch) {
      candidates.push({
        outgoingNumber: r.OutgoingNumber,
        outgoingDate: r.OutgoingDate || (r.CreatedAt ? String(r.CreatedAt).split('T')[0] : ''),
        citizenName: r.CitizenName || 'غير محدد',
        seq: parsed.seq,
        request: r
      });
    }
  }

  for (const l of officialLetters || []) {
    if (!l?.LetterNumber || !String(l.LetterNumber).trim()) continue;
    const parsed = extractOutgoingSequence(l.LetterNumber);
    if (parsed.seq <= 0 || parsed.seq > MAX_VALID_OUTGOING_SEQ) continue;
    const appliesToBranch = parsed.branch === 'general' || parsed.branch === targetBranch;
    if (appliesToBranch) {
      candidates.push({
        outgoingNumber: l.LetterNumber,
        outgoingDate: l.LetterDate || '',
        citizenName: l.CitizenName || l.Recipient || 'كتاب رسمي',
        seq: parsed.seq
      });
    }
  }

  const robustMaxFromRecords = findRobustMaxSequence(candidates.map((c) => c.seq));

  // Self-heal poisoned baselines (e.g. 23182436 stored in Firestore from an older buggy import)
  let effectiveBaseline =
    Number.isFinite(rawBaseline) && rawBaseline > 0 && rawBaseline <= MAX_VALID_OUTGOING_SEQ
      ? Math.floor(rawBaseline)
      : 0;

  if (
    effectiveBaseline > 0 &&
    robustMaxFromRecords > 0 &&
    effectiveBaseline - robustMaxFromRecords > 2000 &&
    effectiveBaseline > robustMaxFromRecords * 3
  ) {
    effectiveBaseline = 0;
  }

  const maxFound = Math.max(effectiveBaseline, robustMaxFromRecords);

  // Pick the best record matching the true robust max (not an outlier!)
  let bestRecord: CandidateRecord | undefined;
  if (robustMaxFromRecords > 0) {
    for (const c of candidates) {
      if (c.seq === robustMaxFromRecords) {
        bestRecord = c;
      }
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
