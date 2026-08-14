import { head } from '@vercel/blob';

// Returns { [slug]: blobUrl } for every card whose screenshot has been
// replaced via /api/upload. Empty object if nothing's been uploaded yet.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    const info = await head('manifest.json');
    const blobRes = await fetch(info.url);
    const manifest = await blobRes.json();
    res.status(200).json(manifest);
  } catch (e) {
    res.status(200).json({});
  }
}
