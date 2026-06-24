import { requireAdminAuth, optionsResponse, errorResponse, successResponse } from '../lib/adminAuth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req) {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (!requireAdminAuth(req)) return errorResponse('Unauthorized', 401);
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  let body;
  try { body = await req.json(); } catch(e) { return errorResponse('Invalid JSON'); }

  const { storagePath } = body;
  if (!storagePath) return errorResponse('storagePath is required');

  // Prevent deleting outside the expected paths
  if (!storagePath.startsWith('events/') && !storagePath.startsWith('services/')) {
    return errorResponse('Invalid storage path');
  }

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/studio-images/${storagePath}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      }
    }
  );

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    console.error('Supabase delete error:', err);
    return errorResponse('Failed to delete image');
  }

  return successResponse({ deleted: true, storagePath });
}

export const config = { runtime: 'edge' };
