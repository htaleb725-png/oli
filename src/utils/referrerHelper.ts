/**
 * Referrer Cleaning, Normalization & Variant Grouping Utilities
 * -------------------------------------------------------------
 * Ensures consistent extraction from Excel files (`المعرف`, `المعرّف الموحد`, `جهة التزكية`, `الوسيط`),
 * cleans noisy/placeholder labels (such as `استيراد إكسل (...)`), and groups spelling/title variants
 * of the same referrer cleanly across ReferrersStats, SmartExcelImporterModal, and Analytics.
 */

const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u0640]/g;

export function toWesternDigitsRef(str: string): string {
  return String(str || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
}

/**
 * Normalize Arabic text for forgiving search & comparison (unifies أ/إ/آ→ا, ى→ي, ة→ه, strips diacritics).
 */
export function normalizeArabicSearch(raw?: string | null): string {
  return toWesternDigitsRef(String(raw || ''))
    .replace(ARABIC_DIACRITICS_REGEX, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const PLACEHOLDER_EXACT_SET = new Set([
  '',
  '-',
  '--',
  '---',
  '—',
  '–',
  '_',
  '.',
  '..',
  '...',
  '/',
  '\\',
  '0',
  'لا',
  'لا يوجد',
  'لايوجد',
  'لا شي',
  'لاشي',
  'لا شيء',
  'بدون',
  'بدون معرف',
  'بلا',
  'بلا معرف',
  'مباشر',
  'مباشر (بدون معرف)',
  'مباشر بدون معرف',
  'غير محدد',
  'غير معروف',
  'غير مذكور',
  'نفسه',
  'بنفسه',
  'شخصي',
  'شخصيا',
  'null',
  'undefined',
  'none',
  'n/a',
  'na',
  'nil'
]);

/**
 * Returns true if the referrer string is empty, symbolic, numeric-only, or an auto-generated import placeholder.
 */
export function isPlaceholderReferrer(raw?: string | null): boolean {
  const cleaned = String(raw || '').trim();
  if (!cleaned) return true;

  const lower = cleaned.toLowerCase();
  if (lower.startsWith('استيراد إكسل') || lower.startsWith('استيراد اكسل') || lower.includes('excel import')) {
    return true;
  }

  // Strip surrounding symbols & check if anything meaningful remains
  const stripped = cleaned.replace(/^[\s\-–—_•·.,،:;/\\()[\]{}|+*=]+|[\s\-–—_•·.,،:;/\\()[\]{}|+*=]+$/g, '').trim();
  if (!stripped || stripped.length < 2) return true;

  // Purely numeric/punctuation values are not valid referrer names
  const digitsAndSymbolsOnly = stripped.replace(/[0-9٠-٩\s\-–—_.,،:;/\\()[\]{}+*=]/g, '');
  if (!digitsAndSymbolsOnly || digitsAndSymbolsOnly.length < 2) return true;

  const norm = normalizeArabicSearch(stripped);
  if (PLACEHOLDER_EXACT_SET.has(norm)) return true;

  // Reject column header names accidentally leaked into data rows
  if (
    norm === 'المعرف' ||
    norm === 'معرف' ||
    norm === 'المعرف الموحد' ||
    norm === 'معرف موحد' ||
    norm === 'جهه التزكيه' ||
    norm === 'التزكيه' ||
    norm === 'الوسيط'
  ) {
    return true;
  }

  return false;
}

/**
 * Cleans a raw referrer cell value into a crisp display label (returns '' if placeholder/junk).
 */
export function cleanReferrerLabel(raw?: string | null): string {
  if (isPlaceholderReferrer(raw)) return '';
  return String(raw || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/^[\s\-–—_•·.,،:;/\\]+|[\s\-–—_•·.,،:;/\\]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const HONORIFIC_PREFIXES = [
  'السيد',
  'سيد',
  'الشيخ',
  'شيخ',
  'الحاج',
  'حاج',
  'الحجي',
  'حجي',
  'الاستاذ',
  'استاذ',
  'الدكتور',
  'دكتور',
  'المهندس',
  'مهندس',
  'الست',
  'ست',
  'السيده',
  'سيده',
  'الحاجه',
  'حاجه',
  'الاخت',
  'اخت',
  'الاخ',
  'اخ',
  'النايب',
  'نايب',
  'النايبه',
  'نايبه',
  'مكتب',
  'الاستاذه',
  'استاذه',
  'الدكتوره',
  'دكتوره',
  'المهندسه',
  'مهندسه',
  'العلويه',
  'علويه'
];

/**
 * Canonical grouping key for merging spelling/honorific variants of the same referrer
 * (e.g. "أحمد الأسدي" === "احمد الاسدي" === "السيد أحمد الأسدي" === "احمد  الاسدي").
 */
export function normalizeReferrerGroupKey(raw?: string | null): string {
  const cleaned = cleanReferrerLabel(raw);
  if (!cleaned) return '';

  let norm = normalizeArabicSearch(cleaned);
  if (!norm) return '';

  // Strip up to 2 leading honorifics if remaining words still exist (e.g. "السيد الشيخ احمد" -> "احمد")
  const tokens = norm.split(' ').filter(Boolean);
  let strippedCount = 0;
  while (tokens.length > 1 && strippedCount < 2 && HONORIFIC_PREFIXES.includes(tokens[0])) {
    tokens.shift();
    strippedCount++;
  }

  // Strip Arabic definite article "ال" on surname/second+ word ONLY when length >= 5 so "الاسدي" and "اسدي" group together
  const normalizedTokens = tokens.map((tok, idx) => {
    if (idx > 0 && tok.startsWith('ال') && tok.length >= 5) {
      return tok.slice(2);
    }
    return tok;
  });

  norm = normalizedTokens.join(' ').trim();
  return norm || normalizeArabicSearch(cleaned);
}
