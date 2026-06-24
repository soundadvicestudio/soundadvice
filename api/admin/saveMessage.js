import { supabaseRequest } from '../lib/supabaseAdmin.js';
import { requireAdminAuth, optionsResponse, errorResponse, successResponse } from '../lib/adminAuth.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (!requireAdminAuth(req)) return errorResponse('Unauthorized', 401);
  if (!['POST', 'DELETE'].includes(req.method)) {
    return errorResponse('Method not allowed', 405);
  }

  let body;
  try { body = await req.json(); } catch(e) {
    return errorResponse('Invalid JSON');
  }

  const { id } = body;
  if (!id) return errorResponse('id is required');

  if (req.method === 'DELETE') {
    const { ok } = await supabaseRequest(
      'DELETE',
      `/rest/v1/studio_messages?id=eq.${id}`
    );
    if (!ok) return errorResponse('Failed to delete message', 500);
    return successResponse({ deleted: true });
  }

  // POST = status update (read / replied are handled here)
  const { status } = body;
  if (!status || !['unread', 'read', 'replied'].includes(status)) {
    return errorResponse('Valid status required: unread | read | replied');
  }

  const { ok } = await supabaseRequest(
    'PATCH',
    `/rest/v1/studio_messages?id=eq.${id}`,
    { status },
    { 'Prefer': 'return=minimal' }
  );

  if (!ok) return errorResponse('Failed to update message', 500);
  return successResponse({ updated: true, id, status });
}
