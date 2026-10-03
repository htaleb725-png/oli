/**
 * Comprehensive Arabic / Iraqi Name Matching Utility
 * Handles variations in Iraqi lists:
 * - 4-part names (رباعي) matching 3-part names (ثلاثي)
 * - 3-part names matching 4-part names
 * - First name + Father + Clan/Surname (ثنائي مع اللقب)
 * - Compound names normalization (عبد الله / عبدالله, نور الهدى / نورالهدى)
 * - Diacritic removal and character standardizations (أ, إ, آ, ة, ه, ى, ي)
 * - Stripping honorary titles (السيد, الشيخ, الحاج, الدكتور, ...)
 * - Stripping / handling 'ال' in clans and surnames
 */

export type MatchType = 
  | 'exact_quad'        // مطابقة رباعية تامة
  | 'exact_triple'      // مطابقة ثلاثية تامة
  | 'triple_in_quad'    // مطابقة الاسم الثلاثي مع بداية الرباعي
  | 'triple_with_clan'  // مطابقة الاسم واسم الأب مع العشيرة/اللقب
  | 'fuzzy_tokens'      // مطابقة 3 أجزاء أو أكثر بترتيب صحيح
  | 'two_part'          // مطابقة ثنائية (الاسم والأب)
  | 'none';             // لا يوجد تطابق

export interface NameMatchResult {
  isMatch: boolean;
  matchType: MatchType;
  matchLabel: string;
  confidence: number;   // 0 - 100
  matchedTokensCount: number;
}

// Honorary and occupational prefixes commonly found in Iraqi lists
const HONORARY_PREFIXES = [
  'السيد', 'سيد',
  'الشيخ', 'شيخ',
  'الحاج', 'حاج', 'الحاجة', 'حاجة',
  'الدكتور', 'دكتور', 'د.',
  'الاستاذ', 'استاذ', 'أستاذ',
  'المحامي', 'محامي',
  'المهندس', 'مهندس',
  'العقيد', 'العميد', 'اللواء', 'الرائد', 'النقيب',
  'المواطن', 'المواطنة'
];

/**
 * Normalizes an Arabic string for matching
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';

  let normalized = text.trim();

  // 1. Remove diacritics / tashkeel
  normalized = normalized.replace(/[\u064B-\u065F\u0670]/g, '');

  // 2. Standardize Alefs
  normalized = normalized.replace(/[أإآٱ]/g, 'ا');

  // 3. Standardize Taa Marbuta & Haa
  normalized = normalized.replace(/ة/g, 'ه');

  // 4. Standardize Alef Maksura & Yaa
  normalized = normalized.replace(/ى/g, 'ي');
  normalized = normalized.replace(/ئ/g, 'ي');

  // 5. Standardize Hamzas
  normalized = normalized.replace(/ؤ/g, 'و');
  normalized = normalized.replace(/ء/g, '');

  // 6. Standardize popular compound prefixes:
  // عبد + اسم -> دمج عبد مع الاسم للمقارنة الموحدة (عبد الله -> عبدالله, عبد الرحمن -> عبدالرحمن)
  normalized = normalized.replace(/\bعبد\s+([ا-ي])/g, 'عبد$1');
  // ابو + اسم -> ابوالاسم
  normalized = normalized.replace(/\bابو\s+([ا-ي])/g, 'ابو$1');
  // الـ في المركبات الدينية
  normalized = normalized.replace(/\bنور\s+الهدي\b/g, 'نورالهدي');
  normalized = normalized.replace(/\bضياء\s+الدين\b/g, 'ضياءالدين');
  normalized = normalized.replace(/\bعلاء\s+الدين\b/g, 'علاءالدين');
  normalized = normalized.replace(/\bسيف\s+الدين\b/g, 'سيفالدين');

  // 7. Remove multiple spaces and punctuation
  normalized = normalized.replace(/[,;.\-_/()\[\]]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Extracts clean tokens from a name, stripping honorary titles
 */
export function extractNameTokens(rawName: string): string[] {
  const normalized = normalizeArabicText(rawName);
  const words = normalized.split(' ').filter(w => w.length > 1);

  // Filter out honorary prefixes if at start
  const cleaned: string[] = [];
  for (const w of words) {
    if (cleaned.length === 0 && HONORARY_PREFIXES.includes(w)) {
      continue;
    }
    cleaned.push(w);
  }

  return cleaned.length > 0 ? cleaned : words;
}

/**
 * Strips leading 'ال' from a word (useful for clan comparison like الناشي / ناشي)
 */
export function stripAlDefinite(word: string): string {
  if (!word) return '';
  if (word.startsWith('ال') && word.length > 3) {
    return word.substring(2);
  }
  return word;
}

/**
 * Checks if two individual tokens match (with or without 'ال')
 */
export function areTokensEqual(t1: string, t2: string): boolean {
  if (!t1 || !t2) return false;
  if (t1 === t2) return true;
  return stripAlDefinite(t1) === stripAlDefinite(t2);
}

/**
 * Smart Iraqi / Arabic Name Matching Engine
 * Matches input against target name with granular hierarchy:
 * 1. Exact quad match (رباعي مطابق تماماً)
 * 2. Exact triple match (ثلاثي مطابق تماماً)
 * 3. Triple in Quad (الاسم الثلاثي مطابق لبداية الاسم الرباعي)
 * 4. Triple with clan (الاسم + الأب + العشيرة أو اللقب)
 * 5. Ordered token subset (3 أجزاء متطابقة بالترتيب)
 * 6. Two-part match (ثنائي: الاسم والأب فقط)
 */
export function matchArabicNames(
  inputRaw: string,
  candidateRaw: string,
  options: { allowTwoPart?: boolean } = { allowTwoPart: false }
): NameMatchResult {
  const inTokens = extractNameTokens(inputRaw);
  const candTokens = extractNameTokens(candidateRaw);

  const noMatch: NameMatchResult = {
    isMatch: false,
    matchType: 'none',
    matchLabel: 'غير مطابق',
    confidence: 0,
    matchedTokensCount: 0
  };

  if (inTokens.length === 0 || candTokens.length === 0) {
    return noMatch;
  }

  // 1. Exact string match after normalization
  const inJoined = inTokens.join(' ');
  const candJoined = candTokens.join(' ');

  if (inJoined === candJoined) {
    if (inTokens.length >= 4) {
      return {
        isMatch: true,
        matchType: 'exact_quad',
        matchLabel: 'مطابقة رباعية تامة',
        confidence: 100,
        matchedTokensCount: inTokens.length
      };
    } else {
      return {
        isMatch: true,
        matchType: 'exact_triple',
        matchLabel: 'مطابقة ثلاثية تامة',
        confidence: 98,
        matchedTokensCount: inTokens.length
      };
    }
  }

  // 2. Triple in Quad Match (الثلاثي يطابق بداية الرباعي)
  // Example 1: Input has 3 names [أحمد, جاسم, محمد], Candidate has 4 [أحمد, جاسم, محمد, علي]
  // Example 2: Input has 4 names [أحمد, جاسم, محمد, علي], Candidate has 3 [أحمد, جاسم, محمد]
  if (inTokens.length >= 3 && candTokens.length >= 3) {
    const firstThreeIn = inTokens.slice(0, 3);
    const firstThreeCand = candTokens.slice(0, 3);

    const matchesAllThree = 
      areTokensEqual(firstThreeIn[0], firstThreeCand[0]) &&
      areTokensEqual(firstThreeIn[1], firstThreeCand[1]) &&
      areTokensEqual(firstThreeIn[2], firstThreeCand[2]);

    if (matchesAllThree) {
      // If 4th name also matches
      if (inTokens.length >= 4 && candTokens.length >= 4 && areTokensEqual(inTokens[3], candTokens[3])) {
        return {
          isMatch: true,
          matchType: 'exact_quad',
          matchLabel: 'مطابقة رباعية تامة',
          confidence: 100,
          matchedTokensCount: 4
        };
      }

      return {
        isMatch: true,
        matchType: 'triple_in_quad',
        matchLabel: 'مطابقة الاسم الثلاثي (متطابق مع الرباعي)',
        confidence: 95,
        matchedTokensCount: 3
      };
    }
  }

  // 3. Name + Father + Clan / Surname Match (الاسم + الأب + اللقب أو العشيرة)
  // Example: Input is [حيدر, كريم, الناشي] and Candidate is [حيدر, كريم, عبد, الناشي]
  if (inTokens.length >= 2 && candTokens.length >= 3) {
    const firstNameMatch = areTokensEqual(inTokens[0], candTokens[0]);
    const fatherNameMatch = areTokensEqual(inTokens[1], candTokens[1]);

    const inputLastToken = inTokens[inTokens.length - 1];
    const candLastToken = candTokens[candTokens.length - 1];
    const clanMatch = areTokensEqual(inputLastToken, candLastToken);

    if (firstNameMatch && fatherNameMatch && clanMatch && inTokens.length >= 3) {
      return {
        isMatch: true,
        matchType: 'triple_with_clan',
        matchLabel: 'مطابقة (الاسم + الأب + العشيرة/اللقب)',
        confidence: 92,
        matchedTokensCount: 3
      };
    }
  }

  // 4. Ordered Token Subset Match (at least 3 tokens match in proper order)
  // Example: [أحمد, كاظم, علي] inside [أحمد, سعدون, كاظم, علي]
  let candIndex = 0;
  let matchedCount = 0;
  for (let i = 0; i < inTokens.length; i++) {
    while (candIndex < candTokens.length) {
      if (areTokensEqual(inTokens[i], candTokens[candIndex])) {
        matchedCount++;
        candIndex++;
        break;
      }
      candIndex++;
    }
  }

  if (matchedCount >= 3) {
    return {
      isMatch: true,
      matchType: 'fuzzy_tokens',
      matchLabel: 'مطابقة 3 أجزاء بالترتيب',
      confidence: 88,
      matchedTokensCount: matchedCount
    };
  }

  // 5. Two-part match (Only if explicitly allowed, or if input only has 2 names and strictly matches first 2)
  if (options.allowTwoPart && inTokens.length >= 2 && candTokens.length >= 2) {
    if (areTokensEqual(inTokens[0], candTokens[0]) && areTokensEqual(inTokens[1], candTokens[1])) {
      return {
        isMatch: true,
        matchType: 'two_part',
        matchLabel: 'مطابقة ثنائية (الاسم والأب فقط)',
        confidence: 70,
        matchedTokensCount: 2
      };
    }
  }

  // 6. Substring fallback for compound words
  if (inJoined.length > 7 && (candJoined.includes(inJoined) || inJoined.includes(candJoined))) {
    return {
      isMatch: true,
      matchType: 'fuzzy_tokens',
      matchLabel: 'مطابقة جزئية للاسم',
      confidence: 80,
      matchedTokensCount: Math.min(inTokens.length, candTokens.length)
    };
  }

  return noMatch;
}

/**
 * Searches a list of candidates to find the best matching candidate
 */
export function findBestArabicMatch<T>(
  inputName: string,
  candidates: T[],
  getName: (item: T) => string,
  options: { allowTwoPart?: boolean } = { allowTwoPart: false }
): { match: T | null; result: NameMatchResult } {
  let bestItem: T | null = null;
  let bestResult: NameMatchResult = {
    isMatch: false,
    matchType: 'none',
    matchLabel: 'غير مطابق',
    confidence: 0,
    matchedTokensCount: 0
  };

  for (const candidate of candidates) {
    const candidateName = getName(candidate);
    const result = matchArabicNames(inputName, candidateName, options);

    if (result.isMatch && result.confidence > bestResult.confidence) {
      bestResult = result;
      bestItem = candidate;

      // If we found a 100% exact quad match, we can stop early
      if (result.confidence === 100) {
        break;
      }
    }
  }

  return { match: bestItem, result: bestResult };
}
