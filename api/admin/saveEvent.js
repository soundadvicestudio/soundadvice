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
    const { ok } = await supabaseRequest('DELETE', `/rest/v1/studio_events?id=eq.${id}`);
    if (!ok) return errorResponse('Failed to delete event');
    return successResponse({ deleted: true, id });
  }

  // INSERT or UPDATE
  const {
    id, title, location, date_display, date_range, schedule,
    address, description, external_url, external_url_label,
    tickets_url, image_url, active, position, pinned,
    show_date_range, show_schedule, show_address,
    is_past, year, date_sort
  } = body;

  if (!title) return errorResponse('title is required');

  const payload = {
    title,
    location: location ?? null,
    date_display: date_display ?? null,
    date_range: date_range ?? null,
    schedule: schedule ?? null,
    address: address ?? null,
    description: description ?? null,
    external_url: external_url ?? null,
    external_url_label: external_url_label ?? null,
    tickets_url: tickets_url ?? null,
    image_url: image_url ?? null,
    active: active ?? true,
    position: position ?? 0,
    pinned: pinned ?? false,
    show_date_range: show_date_range ?? true,
    show_schedule: show_schedule ?? true,
    show_address: show_address ?? true,
    is_past: is_past ?? false,
    year: year ?? null,
    date_sort: date_sort ?? null,
  };

  if (id) {
    // UPDATE
    const { ok, data } = await supabaseRequest(
      'PATCH',
      `/rest/v1/studio_events?id=eq.${id}`,
      payload,
      { 'Prefer': 'return=representation' }
    );
    if (!ok) return errorResponse('Failed to update event');
    return successResponse({ saved: true, data });
  } else {
    // INSERT
    const { ok, data } = await supabaseRequest(
      'POST',
      '/rest/v1/studio_events',
      payload,
      { 'Prefer': 'return=representation' }
    );
    if (!ok) return errorResponse('Failed to insert event');
    return successResponse({ saved: true, data });
  }
}
