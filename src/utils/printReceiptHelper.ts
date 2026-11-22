// Official Isolated Receipt & Document Print Engine
// Ensures 1:1 fidelity between on-screen preview and printed page,
// exact color printing, RTL Arabic typography, and zero double-print bugs.

export interface SingleReceiptData {
  outgoingNumber: string;
  outgoingDate: string;
  citizenName: string;
  phone: string;
  entity: string;
  subject: string;
  address?: string;
  education?: string;
  job?: string;
  referrer?: string;
  deliveryStatus?: 'مستلم' | 'غير مستلم' | string;
  processingStatus?: string;
  notes?: string;
  attachedImage?: string;
  officeName?: string;
  deputyName?: string;
  emblemUrl?: string;
}

export interface CollectiveReceiptData {
  outgoingNumber: string;
  outgoingDate: string;
  entity: string;
  subject: string;
  citizens: Array<{
    name: string;
    phone: string;
    district?: string;
    notes?: string;
  }>;
  officeName?: string;
  deputyName?: string;
  emblemUrl?: string;
}

const DEFAULT_EMBLEM_SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="46" fill="#0f172a" stroke="#d97706" stroke-width="4"/>
    <circle cx="50" cy="50" r="38" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="3 2"/>
    <text x="50" y="45" text-anchor="middle" fill="#fbbf24" font-size="14" font-weight="900" font-family="Cairo, Arial, sans-serif">جمهورية</text>
    <text x="50" y="64" text-anchor="middle" fill="#ffffff" font-size="15" font-weight="900" font-family="Cairo, Arial, sans-serif">العراق</text>
  </svg>`
)}`;

function escapeHtml(value?: string | null): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Wait for all fonts and images inside an iframe document before invoking print() once.
 */
async function waitForPrintReadiness(iframeDoc: Document, timeoutMs = 1800): Promise<void> {
  const waiters: Promise<void>[] = [];

  // 1. Wait for web fonts
  const docFonts = (iframeDoc as any).fonts;
  if (docFonts && docFonts.ready) {
    waiters.push(docFonts.ready.then(() => undefined).catch(() => undefined));
  }

  // 2. Wait for all images
  const imgs = Array.from(iframeDoc.querySelectorAll('img'));
  for (const img of imgs) {
    if (!img.complete) {
      waiters.push(
        new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        })
      );
    }
  }

  if (waiters.length === 0) return;

  await Promise.race([
    Promise.all(waiters),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

/**
 * Safely prints HTML content inside a hidden isolated iframe (works inside AI Studio & PWA without popups).
 * Invokes print() strictly ONCE after styles, fonts, and images finish loading.
 */
export const printHtmlSafely = (htmlContent: string) => {
  const existingFrame = document.getElementById('secure-print-iframe');
  if (existingFrame && existingFrame.parentNode) {
    existingFrame.parentNode.removeChild(existingFrame);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'secure-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!iframeDoc) {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    return;
  }

  // Strip any legacy inline window.print scripts to guarantee strictly ONE clean print dialog
  const cleanedHtml = htmlContent.replace(/<script[\s\S]*?window\.print\(\)[\s\S]*?<\/script>/gi, '');

  iframeDoc.open();
  iframeDoc.write(cleanedHtml);
  iframeDoc.close();

  let printed = false;
  const triggerPrint = async () => {
    if (printed) return;
    printed = true;
    try {
      await waitForPrintReadiness(iframeDoc, 1800);
      await new Promise((r) => setTimeout(r, 120));
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Isolated iframe print failed:', e);
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 2500);
    }
  };

  if (iframe.contentWindow) {
    iframe.onload = () => {
      void triggerPrint();
    };
    setTimeout(() => {
      void triggerPrint();
    }, 650);
  }
};

/**
 * Collect all active stylesheets (<link rel="stylesheet"> & <style>) from the host page
 * so isolated preview prints match the on-screen preview 1:1.
 */
function collectHostStylesHtml(): string {
  const pieces: string[] = [];
  const headNodes = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
  for (const node of headNodes) {
    if (node.tagName === 'LINK') {
      const href = (node as HTMLLinkElement).href;
      if (href) {
        pieces.push(`<link rel="stylesheet" href="${escapeHtml(href)}" />`);
      }
    } else if (node.tagName === 'STYLE') {
      const text = node.textContent || '';
      if (text.trim()) {
        pieces.push(`<style>${text}</style>`);
      }
    }
  }
  return pieces.join('\n');
}

/**
 * Prints a specific DOM element (preview card, badge, dossier, report) in complete isolation
 * while preserving 100% of Tailwind & custom styles, colors, RTL layout, and fonts.
 */
export const printElementIsolated = (
  elementOrId: HTMLElement | string,
  options?: { title?: string; landscape?: boolean; compact?: boolean }
) => {
  const targetEl =
    typeof elementOrId === 'string'
      ? document.getElementById(elementOrId)
      : elementOrId;

  if (!targetEl) {
    console.warn('printElementIsolated: target element not found');
    return;
  }

  // Clone element and remove any .no-print children
  const clone = targetEl.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.no-print').forEach((el) => el.remove());

  const title = options?.title || 'طباعة وثيقة رسمية - مكتب النائب علا الناشي';
  const orientation = options?.landscape ? 'landscape' : 'portrait';
  const hostStyles = collectHostStylesHtml();
  const baseHref = window.location.origin + window.location.pathname;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <base href="${escapeHtml(baseHref)}" />
  <title>${escapeHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
  ${hostStyles}
  <style>
    @page {
      size: A4 ${orientation};
      margin: 10mm;
    }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      box-sizing: border-box;
    }
    html, body {
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: 'Cairo', 'Tajawal', sans-serif !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      min-height: auto !important;
      direction: rtl !important;
    }
    .isolated-print-wrapper {
      width: 100%;
      max-width: ${options?.compact ? '460px' : '100%'};
      margin: 0 auto;
      background: #ffffff !important;
      color: #0f172a !important;
    }
    .no-print {
      display: none !important;
    }
    img, svg {
      max-width: 100%;
      break-inside: avoid;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    tr, td, th {
      break-inside: avoid;
    }
  </style>
</head>
<body class="bg-white text-slate-900">
  <div class="isolated-print-wrapper">${clone.outerHTML}</div>
</body>
</html>`;

  printHtmlSafely(html);
};

/**
 * Prints a single image (e.g., from Google Drive archive or document attachment) cleanly on A4
 */
export const printImageIsolated = (
  imageUrl: string,
  titleOrMeta?: string | { title?: string; subtitle?: string; citizenName?: string; date?: string },
  subtitleArg?: string
) => {
  const meta =
    typeof titleOrMeta === 'string'
      ? { title: titleOrMeta, subtitle: subtitleArg }
      : titleOrMeta;
  const title = meta?.title || 'طباعة وثيقة من أرشيف المكتب';
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Tajawal:wght@500;700;800&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Cairo', 'Tajawal', sans-serif;
      background: #ffffff;
      color: #0f172a;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .doc-header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
      font-size: 12px;
    }
    .doc-title { font-weight: 800; font-size: 14px; color: #0f172a; }
    .doc-sub { color: #475569; font-size: 11px; margin-top: 2px; }
    .img-frame {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .img-frame img {
      max-width: 100%;
      max-height: 245mm;
      object-fit: contain;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <div>
      <div class="doc-title">${escapeHtml(title)}</div>
      ${meta?.subtitle ? `<div class="doc-sub">${escapeHtml(meta.subtitle)}</div>` : ''}
    </div>
    <div style="text-align:left; font-size:11px; color:#334155;">
      ${meta?.citizenName ? `<div><strong>المراجع:</strong> ${escapeHtml(meta.citizenName)}</div>` : ''}
      <div><strong>تاريخ الطباعة:</strong> ${escapeHtml(meta?.date || new Date().toLocaleDateString('ar-IQ'))}</div>
    </div>
  </div>
  <div class="img-frame">
    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" crossorigin="anonymous" />
  </div>
</body>
</html>`;

  printHtmlSafely(html);
};

/**
 * Official Single Outgoing Receipt (وصل صادر واستلام رسمي فخم ومتطابق مع المعاينة)
 */
export const printSingleOutgoingReceipt = (data: SingleReceiptData) => {
  const officeName = data.officeName || 'مكتب النائب المهندسة علا عودة الناشي';
  const deputyName = data.deputyName || 'المهندسة علا عودة الناشي';
  const emblemSrc = data.emblemUrl || DEFAULT_EMBLEM_SVG;
  const deliveryLabel = data.deliveryStatus === 'مستلم' ? 'تم التسليم للمراجع (مستلم)' : 'بانتظار الاستلام (غير مستلم)';
  const deliveryBg = data.deliveryStatus === 'مستلم' ? '#dcfce7' : '#fef3c7';
  const deliveryColor = data.deliveryStatus === 'مستلم' ? '#166534' : '#92400e';
  const deliveryBorder = data.deliveryStatus === 'مستلم' ? '#86efac' : '#fcd34d';

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>وصل صادر رسمي - ${escapeHtml(data.outgoingNumber)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      font-family: 'Cairo', 'Tajawal', sans-serif;
      background: #ffffff;
      color: #0f172a;
      margin: 0;
      padding: 0;
      direction: rtl;
    }
    .outer-frame {
      border: 2.5px solid #0f172a;
      border-radius: 14px;
      padding: 6px;
      background: #ffffff;
      max-width: 780px;
      margin: 0 auto;
    }
    .inner-frame {
      border: 1.5px solid #b45309;
      border-radius: 10px;
      padding: 22px 26px;
      background: #ffffff;
    }
    .top-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 16px;
      border-bottom: 2px solid #0f172a;
      margin-bottom: 18px;
      gap: 12px;
    }
    .header-right {
      text-align: right;
      line-height: 1.55;
    }
    .republic {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
    }
    .parliament {
      font-size: 13px;
      font-weight: 700;
      color: #334155;
    }
    .office-title {
      font-size: 14px;
      font-weight: 800;
      color: #b45309;
      margin-top: 2px;
    }
    .header-center {
      text-align: center;
      flex-shrink: 0;
    }
    .emblem-img {
      width: 68px;
      height: 68px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }
    .header-left {
      min-width: 190px;
      background: #f8fafc;
      border: 1.5px solid #0f172a;
      border-radius: 10px;
      padding: 10px 14px;
      text-align: center;
    }
    .outgoing-label {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 2px;
    }
    .outgoing-val {
      font-size: 17px;
      font-weight: 900;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.5px;
      padding: 3px 8px;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      display: inline-block;
      margin-bottom: 5px;
    }
    .date-val {
      font-size: 12px;
      font-weight: 700;
      color: #1e293b;
      font-variant-numeric: tabular-nums;
    }
    .title-bar {
      text-align: center;
      margin-bottom: 18px;
    }
    .doc-heading {
      display: inline-block;
      background: #0f172a;
      color: #fbbf24;
      font-size: 15px;
      font-weight: 900;
      padding: 7px 32px;
      border-radius: 999px;
      letter-spacing: 0.3px;
    }
    .delivery-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: ${deliveryBg};
      border: 1.5px solid ${deliveryBorder};
      color: ${deliveryColor};
      border-radius: 10px;
      padding: 8px 14px;
      margin-bottom: 16px;
      font-size: 12px;
      font-weight: 800;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      overflow: hidden;
    }
    .details-table th {
      width: 24%;
      background: #f1f5f9;
      color: #334155;
      font-size: 12px;
      font-weight: 800;
      text-align: right;
      padding: 10px 14px;
      border-bottom: 1px solid #cbd5e1;
      border-left: 1px solid #cbd5e1;
      vertical-align: top;
    }
    .details-table td {
      background: #ffffff;
      color: #0f172a;
      font-size: 13px;
      font-weight: 700;
      text-align: right;
      padding: 10px 14px;
      border-bottom: 1px solid #cbd5e1;
      vertical-align: top;
      line-height: 1.65;
    }
    .details-table tr:last-child th,
    .details-table tr:last-child td {
      border-bottom: none;
    }
    .citizen-highlight {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
    }
    .entity-highlight {
      color: #1d4ed8;
      font-weight: 800;
    }
    .notice-box {
      background: #fffbeb;
      border: 1px dashed #d97706;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 11.5px;
      color: #78350f;
      font-weight: 700;
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      padding-top: 16px;
      border-top: 1.5px solid #cbd5e1;
      text-align: center;
    }
    .sig-col {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 10px 34px;
    }
    .sig-title {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .sig-sub {
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
    }
    .footer-meta {
      margin-top: 14px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="outer-frame">
    <div class="inner-frame">
      <div class="top-banner">
        <div class="header-right">
          <div class="republic">جمهورية العراق</div>
          <div class="parliament">مجلس النواب العراقي</div>
          <div class="office-title">${escapeHtml(officeName)}</div>
        </div>
        <div class="header-center">
          <img class="emblem-img" src="${escapeHtml(emblemSrc)}" alt="الشعار الرسمي" onerror="this.src='${DEFAULT_EMBLEM_SVG}'" />
        </div>
        <div class="header-left">
          <div class="outgoing-label">العدد الصادر الرسمي</div>
          <div class="outgoing-val">${escapeHtml(data.outgoingNumber || '—')}</div>
          <div class="date-val">التاريخ: ${escapeHtml(data.outgoingDate || new Date().toISOString().split('T')[0])}</div>
        </div>
      </div>

      <div class="title-bar">
        <span class="doc-heading">وصل تأييد وإكمال معاملة صادر رسمي</span>
      </div>

      <div class="delivery-strip">
        <span>حالة الإنجاز: ${escapeHtml(data.processingStatus || 'منجز')}</span>
        <span>حالة الاستلام: ${escapeHtml(deliveryLabel)}</span>
      </div>

      <table class="details-table">
        <tbody>
          <tr>
            <th>اسم صاحب الطلب</th>
            <td class="citizen-highlight">${escapeHtml(data.citizenName)}</td>
          </tr>
          <tr>
            <th>الوزارة / الدائرة المعنية</th>
            <td class="entity-highlight">${escapeHtml(data.entity || 'الدوائر ذات العلاقة')}</td>
          </tr>
          <tr>
            <th>موضوع المعاملة</th>
            <td>${escapeHtml(data.subject || 'طلب متابعة رسمي')}</td>
          </tr>
          <tr>
            <th>رقم الهاتف</th>
            <td dir="ltr" style="text-align:right; font-variant-numeric:tabular-nums;">${escapeHtml(data.phone || 'غير مسجل')}</td>
          </tr>
          <tr>
            <th>عنوان السكن</th>
            <td>${escapeHtml(data.address || 'محافظة ذي قار')}</td>
          </tr>
          ${
            data.referrer
              ? `<tr><th>المعرّف / جهة التزكية</th><td>${escapeHtml(data.referrer)}</td></tr>`
              : ''
          }
          ${
            data.education || data.job
              ? `<tr><th>التحصيل والعمل</th><td>${escapeHtml([data.education, data.job].filter(Boolean).join(' — '))}</td></tr>`
              : ''
          }
          ${
            data.notes
              ? `<tr><th>ملاحظات الإدارة</th><td>${escapeHtml(data.notes)}</td></tr>`
              : ''
          }
        </tbody>
      </table>

      <div class="notice-box">
        يُعتمد هذا الوصل لإثبات إصدار الكتاب الرسمي بالعدد والتاريخ المثبتين أعلاه، ويرجى إبرازه عند المراجعة لمتابعة الإجابة أو استلام أصل الكتاب.
      </div>

      <div class="signatures">
        <div class="sig-col">
          <div class="sig-title">توقيع موظف الإدارة</div>
          <div class="sig-sub">التدقيق وإصدار الصادر</div>
        </div>
        <div class="sig-col">
          <div class="sig-title">توقيع المستلم</div>
          <div class="sig-sub">الاسم وتاريخ الاستلام</div>
        </div>
        <div class="sig-col">
          <div class="sig-title">ختم مكتب النائب</div>
          <div class="sig-sub">${escapeHtml(deputyName)}</div>
        </div>
      </div>

      <div class="footer-meta">
        <span>نظام الأرشفة والمتابعة المركزي — ${escapeHtml(officeName)}</span>
        <span>تاريخ الطباعة: ${escapeHtml(new Date().toLocaleDateString('ar-IQ'))}</span>
      </div>
    </div>
  </div>
</body>
</html>`;

  printHtmlSafely(html);
};

/**
 * Official Collective Outgoing Receipt (وصل صادر موحد لمجموعة مراجعين)
 */
export const printCollectiveOutgoingReceipt = (data: CollectiveReceiptData) => {
  const officeName = data.officeName || 'مكتب النائب المهندسة علا عودة الناشي';
  const deputyName = data.deputyName || 'المهندسة علا عودة الناشي';
  const emblemSrc = data.emblemUrl || DEFAULT_EMBLEM_SVG;

  const rowsHtml = data.citizens
    .map(
      (c, idx) => `
      <tr>
        <td style="text-align:center; font-weight:800; width:44px;">${idx + 1}</td>
        <td style="font-weight:800; color:#0f172a;">${escapeHtml(c.name)}</td>
        <td dir="ltr" style="text-align:center; font-variant-numeric:tabular-nums;">${escapeHtml(c.phone || '—')}</td>
        <td>${escapeHtml(c.district || 'الناصرية')}</td>
        <td>${escapeHtml(c.notes || '—')}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>كشف كتاب صادر موحد - ${escapeHtml(data.outgoingNumber)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      font-family: 'Cairo', 'Tajawal', sans-serif;
      background: #ffffff;
      color: #0f172a;
      margin: 0;
      padding: 0;
      direction: rtl;
    }
    .outer-frame {
      border: 2.5px solid #0f172a;
      border-radius: 14px;
      padding: 6px;
      background: #ffffff;
    }
    .inner-frame {
      border: 1.5px solid #b45309;
      border-radius: 10px;
      padding: 20px 24px;
    }
    .top-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14px;
      border-bottom: 2px solid #0f172a;
      margin-bottom: 16px;
      gap: 12px;
    }
    .republic { font-size: 16px; font-weight: 900; color: #0f172a; }
    .parliament { font-size: 13px; font-weight: 700; color: #334155; }
    .office-title { font-size: 14px; font-weight: 800; color: #b45309; margin-top: 2px; }
    .emblem-img { width: 64px; height: 64px; object-fit: contain; }
    .outgoing-box {
      min-width: 190px;
      background: #f8fafc;
      border: 1.5px solid #0f172a;
      border-radius: 10px;
      padding: 10px 14px;
      text-align: center;
    }
    .outgoing-val {
      font-size: 16px;
      font-weight: 900;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      padding: 3px 10px;
      display: inline-block;
      margin: 3px 0;
    }
    .meta-strip {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 16px;
      font-size: 12.5px;
    }
    table.list-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 22px;
      font-size: 12px;
    }
    table.list-table th {
      background: #0f172a;
      color: #fbbf24;
      padding: 9px 10px;
      text-align: right;
      border: 1px solid #0f172a;
      font-weight: 800;
    }
    table.list-table td {
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      color: #1e293b;
      font-weight: 600;
    }
    table.list-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      padding-top: 16px;
      border-top: 1.5px solid #cbd5e1;
      text-align: center;
    }
    .sig-col {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 10px 32px;
      font-size: 12px;
      font-weight: 800;
    }
  </style>
</head>
<body>
  <div class="outer-frame">
    <div class="inner-frame">
      <div class="top-banner">
        <div>
          <div class="republic">جمهورية العراق</div>
          <div class="parliament">مجلس النواب العراقي</div>
          <div class="office-title">${escapeHtml(officeName)}</div>
        </div>
        <img class="emblem-img" src="${escapeHtml(emblemSrc)}" alt="الشعار الرسمي" onerror="this.src='${DEFAULT_EMBLEM_SVG}'" />
        <div class="outgoing-box">
          <div style="font-size:10px; color:#64748b; font-weight:700;">العدد الصادر الموحد</div>
          <div class="outgoing-val">${escapeHtml(data.outgoingNumber)}</div>
          <div style="font-size:12px; font-weight:700;">التاريخ: ${escapeHtml(data.outgoingDate)}</div>
        </div>
      </div>

      <div class="meta-strip">
        <div><strong>الجهة الموجه إليها:</strong> ${escapeHtml(data.entity)}</div>
        <div><strong>عدد المشمولين بالكشف:</strong> ${data.citizens.length} مراجعين</div>
        <div style="grid-column: span 2;"><strong>الموضوع:</strong> ${escapeHtml(data.subject)}</div>
      </div>

      <table class="list-table">
        <thead>
          <tr>
            <th style="text-align:center;">ت</th>
            <th>اسم المراجع الثلاثي واللقب</th>
            <th style="text-align:center;">رقم الهاتف</th>
            <th>السكن</th>
            <th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-col">توقيع موظف قسم الإدارة</div>
        <div class="sig-col">توقيع وختم مكتب النائب — ${escapeHtml(deputyName)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  printHtmlSafely(html);
};
