/**
 * PWA & Desktop App Icon Generator (192x192 & 512x512 genuine PNG data URLs)
 * Ensures Chromium/Edge Desktop App installation (Windows/macOS/Android) always
 * receives valid square PNG icons matching the Developer's uploaded custom logo.
 */

function loadImageElement(src: string, useCors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (useCors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function drawSquarePng(img: HTMLImageElement, size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  // Clean square cover-fit render with high-quality smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, size, size);

  const w = img.naturalWidth || img.width || size;
  const h = img.naturalHeight || img.height || size;
  const ratio = Math.min(size / w, size / h);
  const drawW = Math.round(w * ratio);
  const drawH = Math.round(h * ratio);
  const dx = Math.round((size - drawW) / 2);
  const dy = Math.round((size - drawH) / 2);

  // Subtle dark slate backing only if image is non-square so desktop icons never clip awkwardly
  if (Math.abs(w - h) > Math.max(w, h) * 0.08) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);
  }

  ctx.drawImage(img, dx, dy, drawW, drawH);
  return canvas.toDataURL('image/png');
}

/**
 * Generates exact 192x192 and 512x512 PNG data URLs from any logo data URL or HTTP image URL.
 */
export async function generatePwaPngIcons(
  srcUrl?: string | null
): Promise<{ icon192: string; icon512: string } | null> {
  const clean = String(srcUrl || '').trim();
  if (!clean || typeof document === 'undefined') return null;

  const candidates: Array<{ src: string; cors: boolean }> = [];
  if (clean.startsWith('data:image/')) {
    candidates.push({ src: clean, cors: false });
  } else {
    candidates.push({ src: clean, cors: true });
    // Fallback via same-origin server proxy when running on Node/Express server
    candidates.push({ src: `/api/pwa-icon/512?raw=1&t=${Date.now()}`, cors: true });
  }

  for (const cand of candidates) {
    try {
      const img = await loadImageElement(cand.src, cand.cors);
      const icon192 = drawSquarePng(img, 192);
      const icon512 = drawSquarePng(img, 512);
      if (icon192.startsWith('data:image/png;base64,') && icon512.startsWith('data:image/png;base64,')) {
        return { icon192, icon512 };
      }
    } catch {
      // Try next candidate
    }
  }

  return null;
}

/**
 * Builds a static-host safe manifest data URL embedding real 192x192 & 512x512 PNG icons
 * (used on Vercel / static hosting where /api/pwa-icon/* is unavailable).
 */
export function buildInlineManifestDataUrl(
  appName: string,
  icon192: string,
  icon512: string
): string {
  const cleanName = (appName || 'نظام مكتب النائب علا الناشي').trim();
  const shortName = cleanName.length > 24 ? cleanName.slice(0, 24) : cleanName;
  const startUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';
  const manifest = {
    name: cleanName,
    short_name: shortName,
    description:
      'النظام الإداري والمكتبي المتكامل لمكتب النائب علا الناشي لإدارة المراجعين، الطلبات، مقابلات النائب، الأرشيف، وبطاقات المعلومات الرسمية',
    start_url: startUrl,
    scope: startUrl,
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    orientation: 'any',
    dir: 'rtl',
    lang: 'ar',
    icons: [
      { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
  return `data:application/manifest+json;charset=utf-8,${encodeURIComponent(JSON.stringify(manifest))}`;
}
