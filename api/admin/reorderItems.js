import { supabaseRequest } from '../lib/supabaseAdmin.js';
import { requireAdminAuth, optionsResponse, errorResponse, successResponse } from '../lib/adminAuth.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (!requireAdminAuth(req)) return errorResponse('Unauthorized', 401);
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  let body;
  try { body = await req.json(); } catch(e) { return errorResponse('Invalid JSON'); }

  const { table, items } = body;
  // items = [{ id, position }, ...]
  const allowedTables = ['studio_events', 'studio_testimonials', 'studio_services'];
  if (!allowedTables.includes(table)) return errorResponse('Invalid table');
  if (!Array.isArray(items) || items.length === 0) return errorResponse('items array required');

  // Update each item's position individually
  const updates = await Promise.all(
    items.map(({ id, position }) =>
      supabaseRequest(
        'PATCH',
        `/rest/v1/${table}?id=eq.${id}`,
        { position },
        { 'Prefer': 'return=minimal' }
      )
    )
  );

  const failed = updates.filter(u => !u.ok);
  if (failed.length > 0) return errorResponse(`Failed to update ${failed.length} positions`);

  return successResponse({ reordered: true, table, count: items.length });
}

export const config = { runtime: 'edge' };
