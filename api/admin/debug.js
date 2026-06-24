export default async function handler(req) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const adminSecret = process.env.ADMIN_SECRET;

  const authHeader = req.headers['authorization'] || 'MISSING';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '')
    : 'NO_TOKEN';

  // Test the Supabase auth endpoint
  let supabaseStatus = null;
  let supabaseBody = null;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`
      }
    });
    supabaseStatus = res.status;
    supabaseBody = await res.text();
  } catch(e) {
    supabaseBody = 'FETCH_ERROR: ' + e.message;
  }

  return new Response(JSON.stringify({
    env: {
      SUPABASE_URL: supabaseUrl || 'MISSING',
      SUPABASE_ANON_KEY_prefix: supabaseKey
        ? supabaseKey.slice(0, 20) + '...'
        : 'MISSING',
      ADMIN_SECRET_present: !!adminSecret
    },
    auth_header_present: authHeader !== 'MISSING',
    token_prefix: token !== 'NO_TOKEN'
      ? token.slice(0, 20) + '...'
      : 'NO_TOKEN',
    supabase_status: supabaseStatus,
    supabase_response: supabaseBody.slice(0, 300)
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
