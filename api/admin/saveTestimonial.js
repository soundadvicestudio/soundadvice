import { supabaseRequest } from '../lib/supabaseAdmin.js';
import { requireAdminAuth, optionsResponse, errorResponse, successResponse } from '../lib/adminAuth.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (!requireAdminAuth(req)) return errorResponse('Unauthorized', 401);
  if (!['POST', 'DELETE'].includes(req.method)) return errorResponse('Method not allowed', 405);

  let body;
  try { body = await req.json(); } catch(e) { return errorResponse('Invalid JSON'); }

  // DELETE
  if (req.method === 'DELETE') {
    const { id } = body;
    if (!id) return errorResponse('id is required');
    const { ok } = await supabaseRequest('DELETE', `/rest/v1/studio_testimonials?id=eq.${id}`);
    if (!ok) return errorResponse('Failed to delete testimonial');
    return successResponse({ deleted: true, id });
  }

  // INSERT or UPDATE
  const { id, quote, name, title, active, position } = body;
  if (!quote || !name) return errorResponse('quote and name are required');

  const payload = {
    quote,
    name,
    title: title ?? null,
    active: active ?? true,
    position: position ?? 0,
  };

  if (id) {
    const { ok, data } = await supabaseRequest(
      'PATCH',
      `/rest/v1/studio_testimonials?id=eq.${id}`,
      payload,
      { 'Prefer': 'return=representation' }
    );
    if (!ok) return errorResponse('Failed to update testimonial');
    return successResponse({ saved: true, data });
  } else {
    const { ok, data } = await supabaseRequest(
      'POST',
      '/rest/v1/studio_testimonials',
      payload,
      { 'Prefer': 'return=representation' }
    );
    if (!ok) return errorResponse('Failed to insert testimonial');
    return successResponse({ saved: true, data });
  }
}

export const config = { runtime: 'edge' };
