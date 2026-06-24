import { supabaseRequest } from '../lib/supabaseAdmin.js';
import { requireAdminAuth, optionsResponse, errorResponse, successResponse } from '../lib/adminAuth.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (!requireAdminAuth(req)) return errorResponse('Unauthorized', 401);
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  let body;
  try { body = await req.json(); } catch(e) { return errorResponse('Invalid JSON'); }

  const { id, name, description, image_url, position, active } = body;
  if (!id) return errorResponse('id is required');

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (image_url !== undefined) updates.image_url = image_url;
  if (position !== undefined) updates.position = position;
  if (active !== undefined) updates.active = active;

  const { ok, data } = await supabaseRequest(
    'PATCH',
    `/rest/v1/studio_services?id=eq.${id}`,
    updates,
    { 'Prefer': 'return=representation' }
  );

  if (!ok) return errorResponse('Failed to save service');
  return successResponse({ saved: true, data });
}
