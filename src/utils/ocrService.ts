import { extractCitizenInfoFromFilename } from './filenameNameExtractor';

export interface OCRResult {
  success: boolean;
  ocrUsed: boolean;
  isTemporaryOverload?: boolean;
  citizenName: string;
  title?: string;
  entity: string;
  details: string;
  phone?: string;
  priority: 'عاجل' | 'عام' | 'خاص جداً';
  requestType?: string;
  fullExtractedText: string;
  confidence: number;
  originalFilename?: string;
  warning?: string;
  error?: string;
}

/**
 * Resize/compress image client-side if it exceeds max dimension (e.g. 1800px)
 * to speed up OCR transmission while preserving readable text
 */
export async function optimizeImageForOCR(dataUrl: string, maxDimension = 1800): Promise<string> {
  return new Promise((resolve) => {
    // If not a data URL or small, return as-is
    if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length < 500000) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxDimension && height <= maxDimension) {
        resolve(dataUrl);
        return;
      }

      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const optimized = canvas.toDataURL('image/jpeg', 0.88);
      resolve(optimized);
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
}

/**
 * Analyze an image using Server-Side Gemini AI OCR
 */
export async function analyzeImageWithOCR(
  imageDataUrl: string, 
  filename = ''
): Promise<OCRResult> {
  const fallbackInfo = extractCitizenInfoFromFilename(filename);

  try {
    const optimizedImage = await optimizeImageForOCR(imageDataUrl);

    const response = await fetch('/api/ocr/analyze-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: optimizedImage,
        filename: filename,
      }),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      console.warn(`Server OCR returned ${response.status}:`, errorJson.error || 'Server error');
      return {
        success: true,
        ocrUsed: false,
        isTemporaryOverload: true,
        citizenName: fallbackInfo.cleanName || 'مواطن صاحب معاملة',
        entity: fallbackInfo.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
        details: fallbackInfo.details || 'طلب رسمي مسجل مع الصورة',
        phone: '',
        priority: 'عام',
        requestType: 'عام',
        fullExtractedText: '',
        confidence: fallbackInfo.confidence || 50,
        originalFilename: filename,
        warning: 'خدمة التعرف الضوئي تشهد ضغطاً مؤقتاً، تم حفظ الطلب بنجاح ويمكن إعادة فحصه لاحقاً.',
      };
    }

    const result = await response.json();
    if (result.isTemporaryOverload) {
      return {
        success: true,
        ocrUsed: false,
        isTemporaryOverload: true,
        citizenName: result.citizenName || fallbackInfo.cleanName || 'مواطن صاحب معاملة',
        entity: result.entity || fallbackInfo.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
        details: result.details || fallbackInfo.details || 'طلب رسمي مسجل مع الصورة',
        phone: '',
        priority: 'عام',
        requestType: 'عام',
        fullExtractedText: '',
        confidence: fallbackInfo.confidence || 50,
        originalFilename: filename,
        warning: result.warning || 'خدمة الذكاء الاصطناعي تحت ضغط مؤقت، تم حفظ الطلب بنجاح.',
      };
    }

    if (result.success && result.citizenName && result.citizenName !== 'مواطن صاحب معاملة') {
      return {
        success: true,
        ocrUsed: true,
        citizenName: result.citizenName,
        entity: result.entity || fallbackInfo.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
        details: result.details || fallbackInfo.details || 'طلب رسمي مستخرج من الوثيقة',
        phone: result.phone || '',
        priority: result.priority || 'عام',
        requestType: result.requestType || 'عام',
        fullExtractedText: result.fullExtractedText || '',
        confidence: result.confidence || 90,
        originalFilename: filename,
      };
    }

    // If OCR succeeded but didn't find a distinct name, check if filename has a better candidate
    if (fallbackInfo.cleanName && fallbackInfo.cleanName !== 'مواطن غير معروف' && fallbackInfo.confidence > 60) {
      return {
        success: true,
        ocrUsed: true,
        citizenName: fallbackInfo.cleanName,
        entity: result.entity || fallbackInfo.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
        details: result.details || fallbackInfo.details || 'طلب رسمي مستخرج',
        phone: result.phone || '',
        priority: result.priority || 'عام',
        requestType: result.requestType || 'عام',
        fullExtractedText: result.fullExtractedText || '',
        confidence: 80,
        originalFilename: filename,
      };
    }

    return {
      success: true,
      ocrUsed: true,
      citizenName: result.citizenName || 'مواطن صاحب معاملة',
      entity: result.entity || fallbackInfo.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
      details: result.details || fallbackInfo.details || 'طلب رسمي مستخرج من الوثيقة',
      phone: result.phone || '',
      priority: result.priority || 'عام',
      requestType: result.requestType || 'عام',
      fullExtractedText: result.fullExtractedText || '',
      confidence: result.confidence || 75,
      originalFilename: filename,
    };
  } catch (err: any) {
    console.warn('AI OCR failed, using smart filename fallback:', err);
    return {
      success: false,
      ocrUsed: false,
      citizenName: fallbackInfo.cleanName || 'مواطن صاحب معاملة',
      entity: fallbackInfo.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
      details: fallbackInfo.details || 'طلب رسمي مسجل مع الصورة',
      phone: '',
      priority: 'عام',
      requestType: 'عام',
      fullExtractedText: '',
      confidence: fallbackInfo.confidence || 50,
      originalFilename: filename,
      error: err.message,
    };
  }
}
