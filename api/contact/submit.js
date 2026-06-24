import { supabaseRequest } from '../lib/supabaseAdmin.js';
import { corsHeaders, optionsResponse, errorResponse, successResponse } from '../lib/adminAuth.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = 'alittlesoundadvice@gmail.com';
const FROM_EMAIL = 'Sound Advice Vocal Studio <notifications@alittlesoundadvice.com>';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  let body;
  try { body = await req.json(); } catch(e) {
    return errorResponse('Invalid JSON');
  }

  const { first_name, last_name, email, phone, message, newsletter } = body;

  // Validate required fields
  if (!first_name?.trim() || !last_name?.trim() || !email?.trim() || !message?.trim()) {
    return errorResponse('first_name, last_name, email, and message are required');
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse('Invalid email address');
  }

  // Save to database
  const { ok, data } = await supabaseRequest(
    'POST',
    '/rest/v1/studio_messages',
    {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      message: message.trim(),
      newsletter: newsletter === true || newsletter === 'yes',
      status: 'unread',
    },
    { 'Prefer': 'return=representation' }
  );

  if (!ok) {
    console.error('Failed to save message:', data);
    return errorResponse('Failed to save message', 500);
  }

  const saved = Array.isArray(data) ? data[0] : data;

  // Send admin notification email via Resend
  if (RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [ADMIN_EMAIL],
          reply_to: email.trim(),
          subject: `New message from ${first_name.trim()} ${last_name.trim()} — Sound Advice`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff; padding: 32px;">
              <h2 style="color: rgb(252,151,121); font-size: 20px; margin-bottom: 24px;">
                New Contact Form Submission
              </h2>
              <table style="width:100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 8px 0; color: rgba(255,255,255,0.6); width: 140px; vertical-align: top;">Name</td>
                  <td style="padding: 8px 0; color: #fff;">${first_name.trim()} ${last_name.trim()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: rgba(255,255,255,0.6); vertical-align: top;">Email</td>
                  <td style="padding: 8px 0; color: #fff;">${email.trim()}</td>
                </tr>
                ${phone?.trim() ? `
                <tr>
                  <td style="padding: 8px 0; color: rgba(255,255,255,0.6); vertical-align: top;">Phone</td>
                  <td style="padding: 8px 0; color: #fff;">${phone.trim()}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 8px 0; color: rgba(255,255,255,0.6); vertical-align: top;">Newsletter</td>
                  <td style="padding: 8px 0; color: #fff;">${newsletter === true || newsletter === 'yes' ? 'Yes' : 'No'}</td>
                </tr>
              </table>
              <div style="background: #0d0d0d; border: 1px solid rgba(255,255,255,0.1); padding: 20px; margin-bottom: 24px;">
                <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.08em;">Message</p>
                <p style="color: #fff; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message.trim()}</p>
              </div>
              <a href="https://soundadvice.vercel.app/admin/"
                style="display: inline-block; background: rgb(74,138,147); color: #fff;
                padding: 12px 24px; text-decoration: none; font-size: 14px;">
                View in Admin Inbox →
              </a>
              <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin-top: 32px;">
                Sound Advice Vocal Studio · alittlesoundadvice.com
              </p>
            </div>
          `,
        }),
      });
    } catch(e) {
      // Email failure is non-fatal — message is already saved to DB
      console.error('Failed to send notification email:', e);
    }
  }

  return successResponse({ received: true, id: saved?.id });
}
