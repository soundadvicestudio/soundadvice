import { requireAdminAuth } from '../lib/adminAuth.js';

export default {
  async fetch(req) {
  if (!requireAdminAuth(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const results = {};

  // Check 1: env vars present
  results.SUPABASE_URL = process.env.SUPABASE_URL
    ? process.env.SUPABASE_URL.slice(0, 40)
    : 'MISSING';
  results.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? 'PRESENT (length ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')'
    : 'MISSING';
  results.ADMIN_SECRET = process.env.ADMIN_SECRET
    ? 'PRESENT'
    : 'MISSING';

  // Check 2: can we import supabaseAdmin
  try {
    const { supabaseRequest } = await import('../lib/supabaseAdmin.js');
    results.supabaseAdminImport = 'OK';

    // Check 3: can we make a read request to Supabase
    try {
      const { ok, status, data } = await supabaseRequest(
        'GET',
        '/rest/v1/studio_content?select=key&limit=1'
      );
      results.supabaseRead = { ok, status, rowCount: Array.isArray(data) ? data.length : 0 };
    } catch(e) {
      results.supabaseRead = 'ERROR: ' + e.message;
    }

    // Check 4: can we upsert to studio_content
    try {
      const { ok, status, data } = await supabaseRequest(
        'POST',
        '/rest/v1/studio_content?on_conflict=key',
        { key: 'diagnostic_test', value: 'ok', updated_at: new Date().toISOString() },
        { 'Prefer': 'resolution=merge-duplicates,return=representation' }
      );
      results.supabaseUpsert = { ok, status, data };
    } catch(e) {
      results.supabaseUpsert = 'ERROR: ' + e.message;
    }

  } catch(e) {
    results.supabaseAdminImport = 'FAILED: ' + e.message;
  }

  // Check 5: requireAdminAuth
  try {
    const { requireAdminAuth } = await import('../lib/adminAuth.js');
    const fakeReq = { headers: new Headers({ 'x-admin-secret': process.env.ADMIN_SECRET || '' }) };
    results.requireAdminAuth = requireAdminAuth(fakeReq) ? 'PASS' : 'FAIL';
  } catch(e) {
    results.requireAdminAuth = 'ERROR: ' + e.message;
  }

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
  }
};
