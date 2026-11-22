/**
 * Bulletproof receipt printing helper
 * Creates an isolated printable iframe/window to prevent any modal backdrop,
 * overflow, or dark-mode CSS clipping.
 */

interface SingleReceiptData {
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
  officeName?: string;
  deputyName?: string;
  emblemUrl?: string;
  notes?: string;
  status?: string;
  attachedImage?: string;
}

interface CollectiveReceiptData {
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

/**
 * Bulletproof hidden iframe print helper that works everywhere,
 * avoiding popup blockers and iframe sandbox restrictions.
 */
export const printHtmlSafely = (html: string) => {
  try {
    let iframe = document.getElementById('receipt-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'receipt-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }

    const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print failed, falling back:', e);
          window.print();
        }
      }, 350);
      return;
    }
  } catch (err) {
    console.warn('Iframe print error, falling back:', err);
  }

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    window.print();
  }
};

/**
 * Universal print helper for any element on the page (report, modal content, badge, letter, document image).
 * Extracts the inner HTML or element, wraps it in full standalone HTML with fonts and print CSS,
 * and prints via isolated hidden iframe. NEVER prints surrounding UI or modals!
 */
export const printElementIsolated = (elementOrId: HTMLElement | string, options?: { title?: string; landscape?: boolean }) => {
  let targetEl: HTMLElement | null = null;
  if (typeof elementOrId === 'string') {
    targetEl = document.getElementById(elementOrId);
  } else {
    targetEl = elementOrId;
  }

  if (!targetEl) {
    window.print();
    return;
  }

  const contentHtml = targetEl.innerHTML;
  const pageTitle = options?.title || 'طباعة مستند رسمي - مكتب مجلس النواب';
  const orientation = options?.landscape ? '@page { size: landscape; margin: 8mm; }' : '@page { size: A4 portrait; margin: 10mm; }';

  const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${pageTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">
  <style>
    ${orientation}
    * { box-sizing: border-box; }
    body {
      font-family: 'Cairo', 'Tajawal', sans-serif;
      direction: rtl;
      text-align: right;
      color: #000000;
      background: #ffffff;
      margin: 0;
      padding: 12px;
      font-size: 13px;
    }
    .no-print, button, input[type="button"], input[type="submit"] {
      display: none !important;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; }
    th { background-color: #f1f5f9; font-weight: bold; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${contentHtml}
</body>
</html>`;

  printHtmlSafely(fullHtml);
};

export const printImageIsolated = (imageUrl: string, title?: string, citizenInfo?: string) => {
  const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${title || 'طباعة صورة المعاملة - أرشيف Google Drive'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body {
      font-family: 'Cairo', sans-serif;
      direction: rtl;
      text-align: center;
      margin: 0;
      padding: 10px;
      background: #ffffff;
      color: #000000;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .title { font-size: 15px; font-weight: 900; }
    .subtitle { font-size: 11px; color: #475569; }
    .image-container {
      margin: 10px auto;
      max-height: 80vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    img {
      max-width: 100%;
      max-height: 78vh;
      object-fit: contain;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    .footer {
      margin-top: 10px;
      font-size: 11px;
      color: #64748b;
      border-top: 1px dashed #cbd5e1;
      padding-top: 6px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="text-align: right;">
      <div class="title">جمهورية العراق - مجلس النواب العراقي</div>
      <div class="subtitle">مكتب النائب المهندسة علا عودة الناشي - قسم الأرشيف والتوثيق</div>
    </div>
    <div style="text-align: left; font-size: 11px; font-family: monospace;">
      <div>التاريخ: ${new Date().toLocaleDateString('ar-IQ')}</div>
      ${citizenInfo ? `<div>المواطن: ${citizenInfo}</div>` : ''}
    </div>
  </div>
  <div class="image-container">
    <img src="${imageUrl}" alt="صورة المعاملة الأرشيفية" />
  </div>
  <div class="footer">
    وثيقة رسمية صادرة من الأرشيف الإلكتروني المركزي المربوط بـ Google Drive
  </div>
</body>
</html>`;

  printHtmlSafely(fullHtml);
};

export const printSingleOutgoingReceipt = (data: SingleReceiptData) => {
  const officeTitle = data.officeName || 'مكتب مجلس النواب العراقي';
  const deputyTitle = data.deputyName || 'عضو مجلس النواب';
  const emblem = data.emblemUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Coat_of_arms_of_Iraq_%282008%E2%80%93present%29.svg/200px-Coat_of_arms_of_Iraq_%282008%E2%80%93present%29.svg.png';

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>وصل صادر رسمي - ${data.outgoingNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Cairo', system-ui, sans-serif;
      background: #ffffff;
      color: #0f172a;
      padding: 15mm;
      direction: rtl;
    }
    .receipt-card {
      border: 3px double #0f172a;
      border-radius: 16px;
      padding: 24px;
      max-width: 650px;
      margin: 0 auto;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .header-text h1 {
      font-size: 18px;
      font-weight: 900;
      color: #0f172a;
    }
    .header-text h2 {
      font-size: 14px;
      font-weight: 700;
      color: #b45309;
      margin-top: 2px;
    }
    .header-logo img {
      max-height: 70px;
      object-fit: contain;
    }
    .outgoing-badge {
      background: #fef3c7;
      border: 2px solid #f59e0b;
      border-radius: 12px;
      padding: 12px 20px;
      text-align: center;
      margin-bottom: 20px;
    }
    .outgoing-title {
      font-size: 12px;
      font-weight: 700;
      color: #78350f;
    }
    .outgoing-number {
      font-size: 26px;
      font-weight: 900;
      color: #451a03;
      font-family: monospace;
      margin-top: 4px;
      letter-spacing: 1px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .info-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
    }
    .info-table td.label {
      font-weight: 700;
      color: #475569;
      width: 32%;
      background: #f8fafc;
    }
    .info-table td.value {
      font-weight: 800;
      color: #0f172a;
    }
    .footer {
      border-top: 2px dashed #94a3b8;
      padding-top: 14px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      margin-top: 10px;
    }
    .stamp-box {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
      padding: 0 10px;
    }
    .signature-slot {
      text-align: center;
      font-size: 12px;
      font-weight: 700;
    }
    @media print {
      body {
        padding: 0;
      }
      .receipt-card {
        border-color: #000;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-card">
    <div class="header">
      <div class="header-text">
        <h1>جمهورية العراق - مجلس النواب</h1>
        <h2>${officeTitle}</h2>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">قسم الإدارة والمعاملات الرسمية</div>
      </div>
      <div class="header-logo">
        <img src="${emblem}" alt="شعار جمهورية العراق" />
      </div>
    </div>

    <div class="outgoing-badge">
      <div class="outgoing-title">العدد الصادر الرسمي المعتمد</div>
      <div class="outgoing-number">${data.outgoingNumber}</div>
      <div style="font-size: 12px; font-weight: 700; color: #92400e; margin-top: 4px;">
        تاريخ الصادر: ${data.outgoingDate}
      </div>
    </div>

    <table class="info-table">
      <tr>
        <td class="label">اسم صاحب الطلب:</td>
        <td class="value">${data.citizenName}</td>
      </tr>
      <tr>
        <td class="label">الجهة / الوزارة المعنية:</td>
        <td class="value" style="color: #1d4ed8;">${data.entity}</td>
      </tr>
      <tr>
        <td class="label">موضوع وتفاصيل الطلب:</td>
        <td class="value">${data.subject}</td>
      </tr>
      <tr>
        <td class="label">رقم الهاتف:</td>
        <td class="value" dir="ltr" style="text-align: right; font-family: monospace;">${data.phone || 'غير مسجل'}</td>
      </tr>
      ${data.address ? `
      <tr>
        <td class="label">عنوان السكن:</td>
        <td class="value">${data.address}</td>
      </tr>` : ''}
      ${data.referrer ? `
      <tr>
        <td class="label">جهة التزكية / المعرف:</td>
        <td class="value">${data.referrer}</td>
      </tr>` : ''}
    </table>

    <div class="stamp-box">
      <div class="signature-slot">
        <div>موظف الصادر والإدارة</div>
        <div style="margin-top: 30px; border-bottom: 1px dotted #94a3b8; width: 120px; margin-left: auto; margin-right: auto;"></div>
      </div>
      <div class="signature-slot">
        <div>ختم وتوقيع إدارة المكتب</div>
        <div style="margin-top: 30px; border-bottom: 1px dotted #94a3b8; width: 120px; margin-left: auto; margin-right: auto;"></div>
      </div>
    </div>

    <div class="footer">
      يُعتبر هذا الوصل إشعاراً رسمياً بتسجيل وإصدار الكتاب الصادر. يرجى الاحتفاظ بالرقم الصادر للمتابعة.
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>
`;

  printHtmlSafely(html);
};

export const printCollectiveOutgoingReceipt = (data: CollectiveReceiptData) => {
  const officeTitle = data.officeName || 'مكتب مجلس النواب العراقي';
  const emblem = data.emblemUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Coat_of_arms_of_Iraq_%282008%E2%80%93present%29.svg/200px-Coat_of_arms_of_Iraq_%282008%E2%80%93present%29.svg.png';

  const rowsHtml = data.citizens.map((c, i) => `
    <tr>
      <td style="text-align: center; font-weight: bold;">${i + 1}</td>
      <td style="font-weight: 800;">${c.name}</td>
      <td dir="ltr" style="text-align: center; font-family: monospace; font-weight: 700;">${c.phone || '-'}</td>
      <td>${c.district || '-'}</td>
      <td>${c.notes || '-'}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>كتاب صادر موحد - ${data.outgoingNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Cairo', system-ui, sans-serif;
      background: #ffffff;
      color: #0f172a;
      padding: 12mm;
      direction: rtl;
    }
    .letter-card {
      border: 3px double #0f172a;
      border-radius: 16px;
      padding: 24px;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .header-text h1 {
      font-size: 18px;
      font-weight: 900;
    }
    .header-text h2 {
      font-size: 14px;
      font-weight: 700;
      color: #b45309;
      margin-top: 2px;
    }
    .header-logo img {
      max-height: 65px;
      object-fit: contain;
    }
    .outgoing-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fef3c7;
      border: 2px solid #f59e0b;
      border-radius: 12px;
      padding: 12px 20px;
      margin-bottom: 18px;
    }
    .outgoing-number {
      font-size: 22px;
      font-weight: 900;
      color: #451a03;
      font-family: monospace;
    }
    .subject-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 18px;
      font-size: 13px;
    }
    .citizens-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .citizens-table th {
      background: #1e293b;
      color: #ffffff;
      padding: 8px 10px;
      font-weight: 800;
      border: 1px solid #0f172a;
    }
    .citizens-table td {
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
    }
    .citizens-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .stamp-box {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
      padding: 0 20px;
    }
    .signature-slot {
      text-align: center;
      font-size: 12px;
      font-weight: 700;
    }
    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="letter-card">
    <div class="header">
      <div class="header-text">
        <h1>جمهورية العراق - مجلس النواب</h1>
        <h2>${officeTitle}</h2>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">كتاب صادر موحد لمجموعة مراجعين</div>
      </div>
      <div class="header-logo">
        <img src="${emblem}" alt="شعار جمهورية العراق" />
      </div>
    </div>

    <div class="outgoing-banner">
      <div>
        <div style="font-size: 11px; color: #78350f; font-weight: 700;">العدد الصادر الموحد الرسمي:</div>
        <div class="outgoing-number">${data.outgoingNumber}</div>
      </div>
      <div style="text-align: left;">
        <div style="font-size: 11px; color: #78350f; font-weight: 700;">التاريخ:</div>
        <div style="font-size: 14px; font-weight: 800; color: #451a03;">${data.outgoingDate}</div>
      </div>
    </div>

    <div class="subject-box">
      <div style="margin-bottom: 4px;"><strong>إلى:</strong> <span style="color: #1d4ed8; font-weight: bold;">${data.entity}</span></div>
      <div><strong>الموضوع:</strong> <span style="font-weight: bold;">${data.subject}</span></div>
      <div style="font-size: 11px; color: #64748b; margin-top: 6px;">
        يرجى التفضل بالاطلاع والموافقة على متابعة وإنجاز طلبات المواطنين المدرجة أسماؤهم وتفاصيلهم في الجدول أدناه:
      </div>
    </div>

    <table class="citizens-table">
      <thead>
        <tr>
          <th style="width: 40px;">ت</th>
          <th>اسم المواطن الرباعي</th>
          <th style="width: 140px;">رقم الهاتف</th>
          <th style="width: 150px;">السكن / القضاء</th>
          <th>ملاحظات</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="stamp-box">
      <div class="signature-slot">
        <div>تنظيم وتدقيق قسم الإدارة</div>
        <div style="margin-top: 35px; border-bottom: 1px dotted #94a3b8; width: 140px; margin-left: auto; margin-right: auto;"></div>
      </div>
      <div class="signature-slot">
        <div>ختم وتوقيع إدارة المكتب</div>
        <div style="margin-top: 35px; border-bottom: 1px dotted #94a3b8; width: 140px; margin-left: auto; margin-right: auto;"></div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>
`;

  printHtmlSafely(html);
};
