import 'dotenv/config';
import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { extractCitizenInfoFromFilename } from './src/utils/filenameNameExtractor';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large base64 image payloads for OCR analysis
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Lazy initialize Gemini client
  let aiClient: GoogleGenAI | null = null;
  function getGemini(): GoogleGenAI | null {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY is not set in environment.');
      return null;
    }
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  /**
   * Resilient Gemini Vision OCR execution:
   * - Primary model: 'gemini-3.8-flash' (high throughput, low latency vision)
   * - Fallback models: 'gemini-3.1-flash-lite'
   * - Retries transient 503 (high demand) and 429 (rate limit) errors silently
   */
  async function callGeminiVisionOCRWithFallback(
    ai: GoogleGenAI,
    mimeType: string,
    base64Data: string,
    prompt: string
  ): Promise<{ text: string; modelUsed: string }> {
    const models = [
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite'
    ];

    let lastError: any = null;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data,
                },
              },
              prompt,
            ],
            config: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          });

          if (response && response.text) {
            return { text: response.text, modelUsed: model };
          }
        } catch (err: any) {
          lastError = err;
          const errMsg = err?.message || String(err);
          const isHighDemand =
            errMsg.includes('503') ||
            errMsg.includes('high demand') ||
            errMsg.includes('UNAVAILABLE') ||
            errMsg.includes('429') ||
            errMsg.includes('RESOURCE_EXHAUSTED') ||
            errMsg.includes('overloaded');

          if (isHighDemand) {
            await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));
          } else {
            // Try next model if current model fails
            break;
          }
        }
      }
    }

    throw lastError || new Error('All AI models temporarily busy');
  }

  // --- API Routes FIRST ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString()
    });
  });

  // OCR Document & Image Analysis Endpoint
  app.post('/api/ocr/analyze-image', async (req, res) => {
    const { image, filename } = req.body || {};
    try {
      if (!image || typeof image !== 'string') {
        res.status(400).json({
          success: false,
          error: 'صورة غير صالحة أو غير مرسلة (image data is required)'
        });
        return;
      }

      // Extract base64 and mime type
      let mimeType = 'image/jpeg';
      let base64Data = image;

      const dataUrlMatch = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (dataUrlMatch) {
        mimeType = dataUrlMatch[1];
        base64Data = dataUrlMatch[2];
      }

      const ai = getGemini();
      if (!ai) {
        // Safe fallback when key is not present
        const fallback = extractCitizenInfoFromFilename(filename || '');
        res.json({
          success: true,
          ocrUsed: false,
          citizenName: fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة',
          entity: fallback.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
          details: fallback.details || 'طلب رسمي مرفق بالصورة',
          phone: '',
          priority: 'عام',
          requestType: 'عام',
          fullExtractedText: '',
          confidence: fallback.confidence || 60,
          originalFilename: filename || '',
          warning: 'مفتاح الذكاء الاصطناعي غير متوفر، تم استخراج الاسم من اسم الملف'
        });
        return;
      }

      const prompt = `
أنت خبير محترف في استخراج وتدقيق الوثائق والمعاملات الإدارية والعقارية والرسمية والعرائض الشعبية في العراق (كتب رسمية، عرائض مواطنين بخط اليد أو مطبوعة، طلبات موجهة إلى النائب علا الناشي أو الدوائر والوزارات، بطاقات موحدة وهويات).

المهمة:
قم بقراءة وتحليل صورة الوثيقة المرفقة بدقة فائقة عبر تقنية OCR واستخرج البيانات الآتية بصيغة JSON حصراً:

1. citizenName: الاسم الكامل للشخص مقدم الطلب أو صاحب المعاملة (ثلاثي أو رباعي). ابحث بدقة عن: (مقدمه / مقدم الطلب / الاسم / المواطن / السيد / الحاج / اسم المراجع / التوقيع في الأسفل). إذا كانت هوية أو بطاقة وطنية استخرج الاسم الكامل المذكور فيها. إذا لم تجد اسماً واضحاً اكتب "مواطن صاحب معاملة".
2. entity: الجهة أو الوزارة أو الدائرة الرسمية الموجه إليها الطلب (مثال: "وزارة العمل والشؤون الاجتماعية (شبكة الحماية)"، "دائرة صحة ذي قار / وزارة الصحة"، "مديرية تربية ذي قار / وزارة التربية"، "مديرية بلدية الناصرية / البلديات"، "ديوان محافظة ذي قار"، "مجلس النواب العراقي / مكتب النائب علا الناشي"، أو الجهة المذكورة في الترويسة).
3. details: ملخص واضح وموجز لموضوع الطلب وحاجة المواطن (مثال: "طلب شمول براتب شبكة الحماية الاجتماعية"، "طلب نقل ملاك وظيفي"، "طلب مساعدة علاجية وعملية جراحية"، "طلب تخصيص قطعة أرض").
4. phone: رقم هاتف المواطن إذا كان مكتوباً أو مسجلاً على الورقة (مثلاً: 0780... أو 0770...) أو فارغ "" إذا لم يوجد.
5. priority: درجة الأهمية ("عاجل" إذا كان علاجاً أو حالة حرجة أو طارئة أو مكتوب عليه عاجل، وإلا "عام").
6. requestType: نوع المعاملة ("رعاية اجتماعية"، "تعيين / تشغيل"، "نقل / تنسيب"، "علاج / صحة"، "خدمات / بلدية"، "شكوى"، "عام").
7. fullExtractedText: النص الكامل المقروء من الوثيقة (كل الكلمات المكتوبة والمطبوعة على الورقة لتمكين البحث السريع بأي كلمة داخل الوثيقة).
8. confidence: نسبة الثقة التقريبية في قراءة الاسم من 1 إلى 100.

يجب أن يكون الإخراج كائن JSON فقط بالصيغة التالية دون أي نص إضافي:
{
  "citizenName": "اسم المواطن",
  "entity": "الجهة المعنية",
  "details": "تفاصيل وموضوع الطلب",
  "phone": "رقم الهاتف أو فارغ",
  "priority": "عاجل" | "عام",
  "requestType": "رعاية اجتماعية" | "عام" | ...,
  "fullExtractedText": "النص الكامل للوثيقة",
  "confidence": 95
}
`;

      let responseText = '';
      let modelUsed = '';

      try {
        const ocrExecution = await callGeminiVisionOCRWithFallback(ai, mimeType, base64Data, prompt);
        responseText = ocrExecution.text;
        modelUsed = ocrExecution.modelUsed;
      } catch (_aiErr: any) {
        const fallback = extractCitizenInfoFromFilename(filename || '');
        res.json({
          success: true,
          ocrUsed: false,
          isTemporaryOverload: true,
          citizenName: fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة',
          entity: fallback.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
          details: fallback.details || 'طلب رسمي مرفق بالصورة',
          phone: '',
          priority: 'عام',
          requestType: 'عام',
          fullExtractedText: '',
          confidence: fallback.confidence || 60,
          originalFilename: filename || '',
          warning: 'خدمة التعرف الضوئي تشهد ضغطاً مؤقتاً، تم حفظ المعاملة بنجاح ويمكن إعادة فحصها لاحقاً.'
        });
        return;
      }

      let parsedData: any = null;

      try {
        parsedData = JSON.parse(responseText.trim());
      } catch (e) {
        // Fallback extract JSON from markdown code blocks
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[1].trim());
        } else {
          throw new Error('فشل تفسير استجابة نموذج الذكاء الاصطناعي');
        }
      }

      // Clean and sanitize citizen name
      let cleanName = (parsedData.citizenName || '').trim();
      cleanName = cleanName.replace(/^(السيد|المواطن|الحاج|الشيخ|الدكتور|الأستاذ|السيدة|المواطنة|الحاجة|الشيخة)\s+/gi, '').trim();
      if (!cleanName || cleanName === 'غير متوفر' || cleanName === 'غير معروف') {
        const fallback = extractCitizenInfoFromFilename(filename || '');
        cleanName = fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة';
      }

      res.json({
        success: true,
        ocrUsed: true,
        citizenName: cleanName,
        entity: parsedData.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
        details: parsedData.details || 'طلب رسمي مستخرج من الوثيقة المرفقة',
        phone: parsedData.phone || '',
        priority: parsedData.priority === 'عاجل' ? 'عاجل' : 'عام',
        requestType: parsedData.requestType || 'عام',
        fullExtractedText: parsedData.fullExtractedText || '',
        confidence: parsedData.confidence || 90,
        originalFilename: filename || '',
        modelUsed
      });
    } catch (_error: any) {
      const fallback = extractCitizenInfoFromFilename(filename || '');
      res.json({
        success: true,
        ocrUsed: false,
        isTemporaryOverload: true,
        citizenName: fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة',
        entity: fallback.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
        details: fallback.details || 'طلب رسمي مسجل بالصورة',
        phone: '',
        priority: 'عام',
        requestType: 'عام',
        fullExtractedText: '',
        confidence: fallback.confidence || 50,
        originalFilename: filename || ''
      });
    }
  });

  // Batch OCR endpoint for analyzing a small queue
  app.post('/api/ocr/analyze-batch', async (req, res) => {
    try {
      const { items } = req.body; // array of { id, image, filename }
      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, error: 'قائمة الصور غير صحيحة' });
        return;
      }

      const results = [];
      const ai = getGemini();

      for (const item of items) {
        try {
          let mimeType = 'image/jpeg';
          let base64Data = item.image;
          const match = item.image?.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            base64Data = match[2];
          }

          if (!ai) {
            const fallback = extractCitizenInfoFromFilename(item.filename || '');
            results.push({
              id: item.id,
              success: true,
              ocrUsed: false,
              citizenName: fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة',
              entity: fallback.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
              details: fallback.details || 'طلب رسمي مستخرج',
              phone: '',
              fullExtractedText: '',
              priority: 'عام'
            });
            continue;
          }

          const prompt = `
استخرج اسم المواطن والجهة المعنية وتفاصيل الطلب ورقم الهاتف والنص الكامل من صورة المعاملة/الوثيقة العراقية المرفقة بصيغة JSON:
{
  "citizenName": "الاسم الكامل للمواطن فقط بدون لقب",
  "entity": "الجهة الرسمية الموجه إليها",
  "details": "موضوع ومطلب المعاملة",
  "phone": "رقم الهاتف إن وجد",
  "fullExtractedText": "نص الوثيقة الكامل للبحث",
  "priority": "عاجل" | "عام"
}
`;
          let responseText = '';
          try {
            const ocrExecution = await callGeminiVisionOCRWithFallback(ai, mimeType, base64Data, prompt);
            responseText = ocrExecution.text;
          } catch (batchErr) {
            const fallback = extractCitizenInfoFromFilename(item.filename || '');
            results.push({
              id: item.id,
              success: true,
              ocrUsed: false,
              citizenName: fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة',
              entity: fallback.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
              details: fallback.details || 'طلب رسمي مستخرج',
              phone: '',
              fullExtractedText: '',
              priority: 'عام'
            });
            continue;
          }

          const data = JSON.parse(responseText.trim() || '{}');
          let cleanName = (data.citizenName || '').trim();
          cleanName = cleanName.replace(/^(السيد|المواطن|الحاج|الشيخ|الدكتور|الأستاذ|السيدة|المواطنة)\s+/gi, '').trim();
          if (!cleanName) {
            const fallback = extractCitizenInfoFromFilename(item.filename || '');
            cleanName = fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة';
          }

          results.push({
            id: item.id,
            success: true,
            ocrUsed: true,
            citizenName: cleanName,
            entity: data.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
            details: data.details || 'طلب رسمي مستخرج',
            phone: data.phone || '',
            fullExtractedText: data.fullExtractedText || '',
            priority: data.priority || 'عام'
          });
        } catch (err: any) {
          const fallback = extractCitizenInfoFromFilename(item.filename || '');
          results.push({
            id: item.id,
            success: true,
            ocrUsed: false,
            citizenName: fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة',
            entity: fallback.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
            details: fallback.details || 'طلب رسمي مستخرج',
            phone: '',
            fullExtractedText: '',
            priority: 'عام'
          });
        }
      }

      res.json({ success: true, results });
    } catch (err: any) {
      res.json({ success: false, results: [] });
    }
  });

  // --- Vite & Static Handling ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
