import { optionsResponse, errorResponse, successResponse } from '../lib/adminAuth.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return optionsResponse();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse('Unauthorized', 401);
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token || token.split('.').length !== 3) {
    return errorResponse('Unauthorized', 401);
  }

  if (!process.env.ADMIN_SECRET) {
    return errorResponse('Server configuration error', 500);
  }

  return successResponse({ secret: process.env.ADMIN_SECRET });
}
