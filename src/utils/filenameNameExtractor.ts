/**
 * Smart Arabic Filename Name Extractor
 * Extracts citizen names and titles from uploaded image filenames
 * Handles titles like: السيد, المواطن, المواطنة, العميد, العقيد, اللواء, الشيخ, etc.
 */

export interface ExtractedImageInfo {
  rawFilename: string;
  cleanName: string;
  title?: string;
  entity?: string;
  details?: string;
  confidence: number;
}

// Common honorary & occupational titles to detect and strip from citizen names
const TITLES_REGEX = [
  // Military & Police titles
  'الفريق اول ركن', 'الفريق ركن', 'الفريق', 'اللواء ركن', 'اللواء', 'العميد ركن', 'العميد', 'عميد',
  'العقيد ركن', 'العقيد', 'عقيد', 'المقدم ركن', 'المقدم', 'مقدم', 'الرائد', 'رائد',
  'النقيب', 'نقيب', 'الملازم اول', 'الملازم', 'ملازم اول', 'ملازم',
  // Civilian and honorary
  'السيد', 'سيد', 'السيدة', 'سيدة',
  'المواطن', 'مواطن', 'المواطنة', 'مواطنة',
  'الشيخ', 'شيخ', 'الشيخة', 'شيخة',
  'الحاج', 'حاج', 'الحاجة', 'حاجة',
  'الدكتور', 'دكتور', 'الدكتورة', 'دكتورة', 'د\\.',
  'الاستاذ', 'استاذ', 'الأستاذ', 'أستاذ', 'الأستاذة', 'الاستاذة', 'استاذة',
  'المحامي', 'محامي', 'المحامية', 'محامية',
  'المهندس', 'مهندس', 'المهندسة', 'مهندسة',
  'الاخ', 'الأخ', 'الاخت', 'الأخت'
];

// Document / request type keywords to strip
const DOCUMENT_KEYWORDS = [
  'طلب مقدم من', 'طلب المواطن', 'طلب المواطنة', 'طلب السيد', 'طلب السيدة', 'طلب رسمي',
  'طلب شمول', 'طلب نقل', 'طلب تعيين', 'طلب مساعدة', 'طلب مقابلة', 'طلب إعانة',
  'طلب', 'معاملة', 'كتاب رسمي', 'كتاب صادر', 'كتاب وارد', 'كتاب',
  'عريضة استرحام', 'عريضة', 'استرحام', 'مذكرة', 'مرفق', 'صورة كتاب', 'صورة طلب',
  'صورة', 'مسح ضوئي', 'سكنر', 'تأييد', 'شهادة', 'وصل', 'هوية', 'بطاقة وطنية'
];

// Common Iraqi entities that might be present in filenames
const KNOWN_ENTITIES: Record<string, string> = {
  'حماية': 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
  'شبكة الحماية': 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
  'الرعاية': 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
  'العمل': 'وزارة العمل والشؤون الاجتماعية',
  'الصحة': 'دائرة صحة ذي قار / وزارة الصحة',
  'صحة': 'دائرة صحة ذي قار / وزارة الصحة',
  'مستشفى': 'دائرة صحة ذي قار / وزارة الصحة',
  'التربية': 'مديرية تربية ذي قار / وزارة التربية',
  'تربية': 'مديرية تربية ذي قار / وزارة التربية',
  'البلدية': 'مديرية بلدية الناصرية / البلديات',
  'بلدية': 'مديرية بلدية الناصرية / البلديات',
  'الكهرباء': 'مديرية توزيع كهرباء ذي قار',
  'كهرباء': 'مديرية توزيع كهرباء ذي قار',
  'الماء': 'مديرية مجاري وماء ذي قار',
  'ماء': 'مديرية مجاري وماء ذي قار',
  'مجاري': 'مديرية مجاري وماء ذي قار',
  'الداخلية': 'وزارة الداخلية / قيادة شرطة ذي قار',
  'شرطة': 'وزارة الداخلية / قيادة شرطة ذي قار',
  'الدفاع': 'وزارة الدفاع / قيادة العمليات',
  'دفاع': 'وزارة الدفاع / قيادة العمليات',
  'النفط': 'شركة نفط ذي قار / وزارة النفط',
  'نفط': 'شركة نفط ذي قار / وزارة النفط',
  'المرور': 'مديرية مرور ذي قار',
  'مرور': 'مديرية مرور ذي قار',
  'الجوازات': 'مديرية الأحوال المدنية والجوازات والإقامة',
  'جوازات': 'مديرية الأحوال المدنية والجوازات والإقامة',
  'التقاعد': 'صندوق تقاعد موظفي الدولة / هيئة التقاعد الوطنية',
  'تقاعد': 'صندوق تقاعد موظفي الدولة / هيئة التقاعد الوطنية',
  'الشهداء': 'مؤسسة الشهداء والجرحى',
  'شهداء': 'مؤسسة الشهداء والجرحى',
  'السجناء': 'مؤسسة السجناء السياسيين',
  'سجناء': 'مؤسسة السجناء السياسيين',
  'الإسكان': 'وزارة الإعمار والإسكان والبلديات العامة',
  'إسكان': 'وزارة الإعمار والإسكان والبلديات العامة',
  'المحافظة': 'ديوان محافظة ذي قار',
  'مجلس المحافظة': 'مجلس محافظة ذي قار',
  'البرلمان': 'مجلس النواب العراقي'
};

export function extractCitizenInfoFromFilename(filename: string): ExtractedImageInfo {
  if (!filename) {
    return { rawFilename: '', cleanName: 'مواطن غير معروف', confidence: 0 };
  }

  // 1. Remove file extension
  let base = filename.replace(/\.[a-zA-Z0-9]+$/i, '').trim();

  // 2. Decode URL encoding if present (e.g. %20 -> space)
  try {
    base = decodeURIComponent(base);
  } catch {
    // Ignore decoding errors
  }

  // 3. Normalize spaces and separators (underscores, dashes, dots to spaces)
  let working = base.replace(/[_]+/g, ' ');
  working = working.replace(/[ـ]+/g, ''); // Remove Tatweel

  // 4. Extract details or entity in brackets or after dashes
  // e.g. "السيد حسن طالب - شبكة الحماية" or "المواطن علي جاسم (نقل وظيفة)"
  let entityFound: string | undefined;
  let detailsFound: string | undefined;

  // Check brackets () or []
  const bracketMatch = working.match(/[\(\[\{](.+?)[\)\]\}]/);
  if (bracketMatch) {
    const insideBracket = bracketMatch[1].trim();
    // Check if bracket contains known entity
    for (const [key, ent] of Object.entries(KNOWN_ENTITIES)) {
      if (insideBracket.includes(key)) {
        entityFound = ent;
        break;
      }
    }
    if (!detailsFound) detailsFound = insideBracket;
    working = working.replace(bracketMatch[0], ' ');
  }

  // Check dashes or colons
  if (working.includes(' - ') || working.includes(' : ') || working.includes(' | ')) {
    const parts = working.split(/\s*[-:|]\s*/);
    if (parts.length >= 2) {
      // Find which part is likely the name and which is the note/entity
      for (let i = 1; i < parts.length; i++) {
        const seg = parts[i].trim();
        for (const [key, ent] of Object.entries(KNOWN_ENTITIES)) {
          if (seg.includes(key)) {
            entityFound = ent;
            break;
          }
        }
        if (!detailsFound && seg.length > 2) {
          detailsFound = seg;
        }
      }
      working = parts[0];
    }
  }

  // 5. Remove camera / scanner default prefixes (e.g. IMG_2026, SCAN_001, DOC_123, numbers)
  working = working.replace(/^(IMG|SCAN|DOC|PHOTO|PIC|DSC|FILE)[\s\d_-]*/i, ' ');
  working = working.replace(/^\d+[\s\.\-_]+/g, ' '); // e.g. "01 - " or "1. "
  working = working.replace(/[\s\.\-_]+\d+$/g, ' '); // e.g. "- 01" at end

  // 6. Detect and extract honorary title
  let detectedTitle: string | undefined;
  for (const title of TITLES_REGEX) {
    const regex = new RegExp(`^\\s*${title}[\\s/:]+`, 'i');
    if (regex.test(working)) {
      detectedTitle = title.replace('\\.', '.').trim();
      working = working.replace(regex, ' ');
      break;
    }
  }

  // 7. Strip document keywords (طلب, عريضة, كتاب...)
  for (const kw of DOCUMENT_KEYWORDS) {
    const regex = new RegExp(`^\\s*${kw}[\\s/:]+`, 'i');
    if (regex.test(working)) {
      if (!detailsFound) detailsFound = kw;
      working = working.replace(regex, ' ');
    }
    // Also check if kw is at start
    working = working.replace(new RegExp(`\\b${kw}\\b`, 'gi'), ' ');
  }

  // Re-check title in case it was after document keyword (e.g. "طلب السيد حسن طالب")
  if (!detectedTitle) {
    for (const title of TITLES_REGEX) {
      const regex = new RegExp(`^\\s*${title}[\\s/:]+`, 'i');
      if (regex.test(working)) {
        detectedTitle = title.replace('\\.', '.').trim();
        working = working.replace(regex, ' ');
        break;
      }
    }
  }

  // Check remaining text for known entities if not found yet
  if (!entityFound) {
    for (const [key, ent] of Object.entries(KNOWN_ENTITIES)) {
      if (working.includes(key) || base.includes(key)) {
        entityFound = ent;
        working = working.replace(new RegExp(`\\b${key}\\b`, 'gi'), ' ');
        break;
      }
    }
  }

  // 8. Clean up extra punctuation, symbols, numbers
  working = working.replace(/[0-9٠-٩]+/g, ' ');
  working = working.replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, ' ');
  working = working.replace(/\s+/g, ' ').trim();

  // If after all stripping the string is empty, fallback to sanitized original filename
  let cleanName = working;
  if (!cleanName || cleanName.length < 2) {
    cleanName = base.replace(/[_-]+/g, ' ').trim() || 'مواطن صاحب معاملة';
  }

  // Calculate a reasonable confidence score
  let confidence = 70;
  if (detectedTitle) confidence += 15;
  if (cleanName.split(' ').length >= 2) confidence += 10;
  if (cleanName.split(' ').length >= 3) confidence += 5;

  return {
    rawFilename: filename,
    cleanName,
    title: detectedTitle,
    entity: entityFound || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
    details: detailsFound ? `طلب بخصوص ${detailsFound}` : 'طلب رسمي مسجل ومرفق بالصورة',
    confidence: Math.min(confidence, 100)
  };
}
