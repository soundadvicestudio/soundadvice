import { supabaseRequest } from '../lib/supabaseAdmin.js';
import { requireAdminAuth, optionsResponse, errorResponse, successResponse } from '../lib/adminAuth.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'Jonathan Sturcken <alittlesoundadvice@alittlesoundadvice.com>';
const REPLY_TO_EMAIL = 'alittlesoundadvice@gmail.com';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (!requireAdminAuth(req)) return errorResponse('Unauthorized', 401);
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  let body;
  try { body = await req.json(); } catch(e) {
    return errorResponse('Invalid JSON');
  }

  const { id, reply_body, signature } = body;
  if (!id || !reply_body?.trim()) {
    return errorResponse('id and reply_body are required');
  }

  // Fetch the original message to get recipient info
  const { ok: fetchOk, data: messages } = await supabaseRequest(
    'GET',
    `/rest/v1/studio_messages?id=eq.${id}&select=*`
  );

  if (!fetchOk || !messages?.length) {
    return errorResponse('Message not found', 404);
  }

  const msg = messages[0];

  // Send reply email via Resend
  if (!RESEND_API_KEY) {
    return errorResponse('Email service not configured', 500);
  }

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [msg.email],
      reply_to: REPLY_TO_EMAIL,
      subject: `Re: Your message to Sound Advice Vocal Studio`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff; padding: 32px;">
          <div style="margin-bottom: 8px;">
            <img src="https://static.wixstatic.com/media/23043d_9cbf6867b112498ea07b1bfb7e3ca04b~mv2.jpg"
              alt="Sound Advice Vocal Studio" style="height: 60px; width: auto;" />
          </div>
          <p style="color: rgba(255,255,255,0.6); font-size: 13px; margin-bottom: 24px;">
            Sound Advice Vocal Studio
          </p>
          <div style="color: #fff; font-size: 16px; line-height: 1.7; margin-bottom: 32px;
            white-space: pre-wrap;">${reply_body.trim()}${signature ? `\n\n—\n${signature.trim()}` : ''}</div>
          <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 32px 0;" />
          <div style="background: #0d0d0d; border-left: 3px solid rgba(255,255,255,0.2);
            padding: 16px 20px; margin-bottom: 24px;">
            <p style="color: rgba(255,255,255,0.4); font-size: 11px; text-transform: uppercase;
              letter-spacing: 0.08em; margin: 0 0 8px;">Original message from ${msg.first_name} ${msg.last_name}</p>
            <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.6; margin: 0;
              white-space: pre-wrap;">${msg.message}</p>
          </div>
          <p style="color: rgba(255,255,255,0.4); font-size: 11px;">
            Jonathan Sturcken · Sound Advice Vocal Studio · alittlesoundadvice.com
          </p>
        </div>
      `,
    }),
  });

  if (!emailRes.ok) {
    const err = await emailRes.text();
    console.error('Resend error:', err);
    return errorResponse('Failed to send reply email', 500);
  }

  // Update message status to 'replied' and store reply body
  await supabaseRequest(
    'PATCH',
    `/rest/v1/studio_messages?id=eq.${id}`,
    {
      status: 'replied',
      reply_body: reply_body.trim(),
      replied_at: new Date().toISOString(),
    }
  );

  return successResponse({ replied: true });
}
