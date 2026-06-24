import { requireAdminAuth, optionsResponse, errorResponse, successResponse } from '../lib/adminAuth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req) {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (!requireAdminAuth(req)) return errorResponse('Unauthorized', 401);
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  let body;
  try { body = await req.json(); } catch(e) { return errorResponse('Invalid JSON'); }

  const { filename, contentType } = body;
  if (!filename || !contentType) return errorResponse('filename and contentType are required');

  // Validate content type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(contentType)) {
    return errorResponse('Invalid file type. Allowed: JPG, PNG, WebP, GIF');
  }

  // Generate a unique storage path
  const timestamp = Date.now();
  const ext = filename.split('.').pop().toLowerCase();
  const safeName = filename
    .replace(/\.[^.]+$/, '')           // strip extension
    .replace(/[^a-zA-Z0-9-_]/g, '-')  // sanitize
    .substring(0, 40);                  // cap length
  const storagePath = `events/${timestamp}-${safeName}.${ext}`;

  // Request signed upload URL from Supabase Storage
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/upload/sign/studio-images/${storagePath}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 300 }) // 5 minutes to complete upload
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Supabase signed URL error:', err);
    return errorResponse('Failed to generate upload URL');
  }

  const { signedURL, token } = await res.json();

  // The public URL the image will be accessible at after upload
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/studio-images/${storagePath}`;

  return successResponse({
    signedURL: `${SUPABASE_URL}${signedURL}`,
    storagePath,
    publicUrl,
    token,
  });
}

export const config = { runtime: 'edge' };
