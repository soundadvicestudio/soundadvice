import { optionsResponse, errorResponse, successResponse } from '../lib/adminAuth.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return optionsResponse();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse('Unauthorized', 401);
  }
  const token = authHeader.replace('Bearer ', '');

  const verifyRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': process.env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
    }
  });

  if (!verifyRes.ok) return errorResponse('Unauthorized', 401);

  const user = await verifyRes.json();
  if (!user?.id) return errorResponse('Unauthorized', 401);

  return successResponse({ secret: process.env.ADMIN_SECRET });
}
