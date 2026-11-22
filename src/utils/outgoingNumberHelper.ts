import { OfficeRequest, SystemSettings } from '../types';

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

  // YYYY-MM-DD or YYYY/MM/DD
  const ymd = normalized.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const y = ymd[1];
    const m = ymd[2].padStart(2, '0');
    const d = ymd[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = normalized.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
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

export type OutgoingBranch = 'nasiriyah' | 'suq_al_shuyoukh' | 'general';

export interface ParsedOutgoingInfo {
  seq: number;
  branch: OutgoingBranch;
  normalized: string;
}

/**
 * Intelligently extract the outgoing sequence number and office branch from ANY Iraqi outgoing format:
 * Examples:
 * - "ن / 12 / 450" -> { seq: 450, branch: 'nasiriyah' }
 * - "س / 14 / 320" -> { seq: 320, branch: 'suq_al_shuyoukh' }
 * - "ن / ٢٦ / ٤٥٠" -> { seq: 450, branch: 'nasiriyah' }
 * - "450 / 2026"   -> { seq: 450, branch: 'general' }
 * - "2026/450"     -> { seq: 450, branch: 'general' }
 * - "450"          -> { seq: 450, branch: 'general' }
 */
export function extractOutgoingSequence(rawOutgoing?: string | null): ParsedOutgoingInfo {
  const normalized = toWesternDigits(rawOutgoing || '').trim();
  if (!normalized) {
    return { seq: 0, branch: 'general', normalized: '' };
  }

  // Detect branch prefix
  let branch: OutgoingBranch = 'general';
  if (/^س(\s|\/|-|$)|سوق\s*الشيوخ/i.test(normalized) || /(^|\s)س\s*\//.test(normalized)) {
    branch = 'suq_al_shuyoukh';
  } else if (/^ن(\s|\/|-|$)|الناصرية|ناصرية/i.test(normalized) || /(^|\s)ن\s*\//.test(normalized)) {
    branch = 'nasiriyah';
  }

  // Extract numeric segments in order
  const rawTokens = normalized.split(/[\/\\\-|،,\s]+/).filter(Boolean);
  const numericTokens: number[] = [];
  for (const tok of rawTokens) {
    const m = tok.match(/\d+/g);
    if (m) {
      for (const digits of m) {
        const val = parseInt(digits, 10);
        if (!isNaN(val) && val > 0) {
          numericTokens.push(val);
        }
      }
    }
  }

  if (numericTokens.length === 0) {
    return { seq: 0, branch, normalized };
  }

  if (numericTokens.length === 1) {
    const only = numericTokens[0];
    // Reject obvious standalone 4-digit year unless nothing else exists
    if (only >= 2020 && only <= 2040) {
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
    return { seq: nonYearTokens[0], branch, normalized };
  }

  // Multiple non-year numbers exist, e.g., ["12", "450"] from "ن / 12 / 450" or ["14", "320"] from "س / 14 / 320" or ["26", "15"] from "ن / 26 / 15"
  const currentYearShort = parseInt(String(new Date().getFullYear()).slice(-2), 10);
  const first = nonYearTokens[0];
  const last = nonYearTokens[nonYearTokens.length - 1];

  // If the first token is a known branch code (12 for Nasiriyah, 14 for Suq) or 2-digit year (23..30), the sequence is the last token!
  if (
    first === 12 ||
    first === 14 ||
    first === currentYearShort ||
    (first >= 20 && first <= 35 && nonYearTokens.length >= 2)
  ) {
    return { seq: last, branch, normalized };
  }

  // Otherwise pick the last token (standard Iraqi format: Code / Seq), or max if last is smaller than a 2-digit code
  return { seq: Math.max(last, ...nonYearTokens.filter((n) => n !== 12 && n !== 14)), branch, normalized };
}

/**
 * Compute the next authoritative outgoing number across ALL requests (active + archived Excel imports)
 * and systemSettings baselines so archiving ANY Excel file immediately advances the outgoing counter.
 */
export function computeNextOutgoingNumber(
  requests: OfficeRequest[],
  systemSettings?: Partial<SystemSettings> | null
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
    request: OfficeRequest;
  };
} {
  const isSuq = systemSettings?.officeBranch === 'suq_al_shuyoukh';
  const targetBranch: OutgoingBranch = isSuq ? 'suq_al_shuyoukh' : 'nasiriyah';
  const branchPrefix = isSuq ? 'س' : 'ن';
  const branchCode = isSuq ? '14' : '12';

  const baseline = isSuq
    ? Number(systemSettings?.lastOutgoingNumberSuq) || 0
    : Number(systemSettings?.lastOutgoingNumberNasiriyah) || 0;

  let maxFound = baseline;
  let bestRecord:
    | {
        outgoingNumber: string;
        outgoingDate: string;
        citizenName: string;
        seq: number;
        request: OfficeRequest;
      }
    | undefined;

  for (const r of requests || []) {
    if (!r?.OutgoingNumber || !String(r.OutgoingNumber).trim()) continue;
    const parsed = extractOutgoingSequence(r.OutgoingNumber);
    if (parsed.seq <= 0) continue;

    // Count matching branch records + general/numeric records (do not mix Suq into Nasiriyah if explicitly prefixed)
    const appliesToBranch = parsed.branch === 'general' || parsed.branch === targetBranch;
    if (appliesToBranch) {
      if (parsed.seq > maxFound) {
        maxFound = parsed.seq;
      }
      if (!bestRecord || parsed.seq >= bestRecord.seq) {
        bestRecord = {
          outgoingNumber: r.OutgoingNumber,
          outgoingDate: r.OutgoingDate || (r.CreatedAt ? String(r.CreatedAt).split('T')[0] : ''),
          citizenName: r.CitizenName || 'غير محدد',
          seq: parsed.seq,
          request: r
        };
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
