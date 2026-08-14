import { put, head } from '@vercel/blob';

// Client-side already crops/resizes to 960px wide 16:10 JPEG before sending, so
// this ceiling is just abuse protection, not the expected normal size.
const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_FOR_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.ADMIN_KEY || req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { slug, dataUrl } = req.body || {};
  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    res.status(400).json({ error: 'Invalid slug' });
    return;
  }

  const match = typeof dataUrl === 'string' && dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: 'Invalid image data' });
    return;
  }
  const [, contentType, base64] = match;
  if (!ALLOWED_TYPES.has(contentType)) {
    res.status(400).json({ error: 'Only JPEG, PNG or WebP images are allowed' });
    return;
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_BYTES) {
    res.status(400).json({ error: 'Image too large (max 6MB)' });
    return;
  }

  const blob = await put(`screenshots/${slug}-${Date.now()}.${EXT_FOR_TYPE[contentType]}`, buffer, {
    access: 'public',
    contentType,
  });

  // Merge into the shared manifest so every visitor's next load picks up the new
  // screenshot — not just the browser that uploaded it.
  let manifest = {};
  try {
    const info = await head('manifest.json');
    const manifestRes = await fetch(info.url);
    manifest = await manifestRes.json();
  } catch (e) {
    // No manifest yet — first upload ever.
  }
  manifest[slug] = blob.url;

  await put('manifest.json', JSON.stringify(manifest), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });

  res.status(200).json({ ok: true, url: blob.url });
}
