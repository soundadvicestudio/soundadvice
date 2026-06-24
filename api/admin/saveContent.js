import { supabaseRequest } from '../lib/supabaseAdmin.js';
import { requireAdminAuth, optionsResponse, errorResponse, successResponse } from '../lib/adminAuth.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (!requireAdminAuth(req)) return errorResponse('Unauthorized', 401);
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  let body;
  try { body = await req.json(); } catch(e) { return errorResponse('Invalid JSON'); }

  const { key, value } = body;
  if (!key || value === undefined) return errorResponse('key and value are required');

  const { ok, data } = await supabaseRequest(
    'POST',
    '/rest/v1/studio_content?on_conflict=key',
    { key, value, updated_at: new Date().toISOString() },
    { 'Prefer': 'resolution=merge-duplicates,return=representation' }
  );

  if (!ok) return errorResponse('Failed to save content');
  return successResponse({ saved: true, key, data });
}

export const config = { runtime: 'edge' };
