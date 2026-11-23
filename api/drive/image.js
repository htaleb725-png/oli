// Native Vercel Serverless Function: Public Google Drive Image Thumbnail & Print Proxy
// Serves crisp Google Drive image thumbnails cleanly on Vercel for preview, direct download, and isolated printing.

const DRIVE_ID_REGEX = /^[a-zA-Z0-9_-]{10,80}$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const fileId = String(req.query?.id || req.query?.fileId || '').trim();
    if (!DRIVE_ID_REGEX.test(fileId)) {
      res.status(400).send('Invalid file ID');
      return;
    }

    const sizeParam = String(req.query?.sz || 'w1200');
    const safeSize = /^w\d{3,4}$/.test(sizeParam) ? sizeParam : 'w1200';

    const candidateUrls = [
      `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=${safeSize}`,
      `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=${safeSize}`,
      `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`
    ];

    for (const targetUrl of candidateUrls) {
      try {
        const upstream = await fetch(targetUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
          },
          redirect: 'follow'
        });

        const contentType = upstream.headers.get('content-type') || '';
        if (upstream.ok && contentType.startsWith('image/')) {
          const arrayBuffer = await upstream.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          if (buffer.length > 0) {
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
            res.status(200).send(buffer);
            return;
          }
        }
      } catch {
        // Try next image host
      }
    }

    res.status(404).send('Image preview unavailable');
  } catch {
    res.status(500).send('Image proxy error');
  }
}
