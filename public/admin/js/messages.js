import {
  adminFetch,
  supabaseFetch,
  showToast,
  showConfirm,
  getSession
} from './adminCore.js';

let messages = [];
let activeMessageId = null;

export async function initMessagesSection() {
  const section = document.getElementById('section-messages');
  section.innerHTML = `
    <div class="admin-section-heading">Inbox</div>
    <p class="admin-section-sub">
      Contact form submissions. Click a message to read it and reply.
    </p>
    <div id="messages-layout" style="display: flex; gap: 24px; align-items: flex-start;">
      <div id="messages-list" style="flex: 0 0 340px; display: flex; flex-direction: column; gap: 8px;">
        <div class="admin-loading"><div class="admin-spinner"></div></div>
      </div>
      <div id="message-detail" style="flex: 1; display: none;">
      </div>
    </div>
  `;

  await loadMessages();
}

async function loadMessages() {
  const list = document.getElementById('messages-list');
  if (!list) return;

  try {
    const SUPABASE_URL = 'https://trtseeytryqwwkoqtkvp.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_E8g0Q5cZxzMHsMYje3SmGw_QdoOeaUT';
    const session = getSession();
    const accessToken = session?.access_token || SUPABASE_ANON_KEY;

    const messagesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/studio_messages?select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    );
    if (!messagesRes.ok) throw new Error(`Failed to load messages: ${messagesRes.status}`);
    messages = await messagesRes.json();
    renderMessagesList();
    updateInboxBadge();
  } catch(e) {
    list.innerHTML = `<p style="color:#ff6b6b; font-family:'DM Sans',sans-serif;
      font-size:14px;">Failed to load messages: ${e.message}</p>`;
  }
}

function renderMessagesList() {
  const oldList = document.getElementById('messages-list');
  if (!oldList) return;

  const list = document.createElement('div');
  list.id = 'messages-list';
  list.style.cssText = 'flex: 0 0 340px; display: flex; flex-direction: column; gap: 8px;';

  if (!messages.length) {
    list.innerHTML = `<p style="color:var(--text-muted); font-family:'DM Sans',sans-serif;
      font-size:14px;">No messages yet.</p>`;
    oldList.replaceWith(list);
    return;
  }

  list.innerHTML = messages.map(msg => {
    const isActive = msg.id === activeMessageId;
    const isUnread = msg.status === 'unread';
    const date = new Date(msg.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });

    return `
      <div class="message-list-item ${isActive ? 'active' : ''}"
        data-id="${msg.id}"
        style="
          padding: 14px 16px;
          background: ${isActive ? 'rgba(74,138,147,0.12)' : 'rgba(0,0,0,0.4)'};
          border: 1px solid ${isActive ? 'rgba(74,138,147,0.4)' : 'var(--border-subtle)'};
          cursor: pointer;
          transition: background 0.15s;
        ">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          ${isUnread ? `<span style="
            width:8px; height:8px; border-radius:50%;
            background: rgb(252,151,121); flex-shrink:0;
          "></span>` : '<span style="width:8px; flex-shrink:0;"></span>'}
          <span style="
            font-family:'DM Sans',sans-serif; font-size:14px;
            font-weight: ${isUnread ? '600' : '400'};
            color: var(--white); flex:1; min-width:0;
            white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          ">${msg.first_name} ${msg.last_name}</span>
          <span style="
            font-family:'DM Sans',sans-serif; font-size:11px;
            color:var(--text-dim); flex-shrink:0;
          ">${date}</span>
        </div>
        <div style="
          font-family:'DM Sans',sans-serif; font-size:12px;
          color:var(--text-muted);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          padding-left:16px;
        ">${msg.message.substring(0, 60)}${msg.message.length > 60 ? '...' : ''}</div>
        <div style="padding-left:16px; margin-top:4px;">
          ${statusBadge(msg.status)}
        </div>
      </div>
    `;
  }).join('');

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.message-list-item');
    if (!item) return;
    openMessage(item.dataset.id);
  });

  oldList.replaceWith(list);
}

function statusBadge(status) {
  const styles = {
    unread:  'color: rgb(252,151,121); border-color: rgba(252,151,121,0.4);',
    read:    'color: var(--text-muted); border-color: var(--border-subtle);',
    replied: 'color: rgb(74,138,147); border-color: rgba(74,138,147,0.4);',
  };
  const labels = { unread: 'UNREAD', read: 'READ', replied: 'REPLIED' };
  return `<span style="
    font-family:'DM Sans',sans-serif; font-size:10px; font-weight:600;
    border:1px solid; padding:1px 7px; letter-spacing:0.06em;
    text-transform:uppercase; ${styles[status] || styles.read}
  ">${labels[status] || status.toUpperCase()}</span>`;
}

async function openMessage(id) {
  activeMessageId = id;
  const msg = messages.find(m => m.id === id);
  if (!msg) return;

  // Mark as read if unread
  if (msg.status === 'unread') {
    try {
      await adminFetch('/api/admin/saveMessage', { id, status: 'read' });
      msg.status = 'read';
      updateInboxBadge();
    } catch(e) {
      // Non-fatal — continue showing message
    }
  }

  renderMessagesList(); // re-render list to update active state + unread dot

  const detail = document.getElementById('message-detail');
  if (!detail) return;
  detail.style.display = 'block';

  const date = new Date(msg.created_at).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });

  detail.innerHTML = `
    <div class="admin-card">

      <!-- Header -->
      <div style="margin-bottom:20px; padding-bottom:20px; border-bottom:1px solid var(--border-subtle);">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
          <div>
            <div style="font-family:'DM Sans',sans-serif; font-size:18px; font-weight:600;
              color:var(--white); margin-bottom:4px;">
              ${msg.first_name} ${msg.last_name}
            </div>
            <a href="mailto:${msg.email}" style="font-family:'DM Sans',sans-serif;
              font-size:13px; color:rgb(74,138,147); text-decoration:none;">
              ${msg.email}
            </a>
            ${msg.phone ? `<span style="font-family:'DM Sans',sans-serif;
              font-size:13px; color:var(--text-muted); margin-left:16px;">
              ${msg.phone}
            </span>` : ''}
          </div>
          <div style="text-align:right; flex-shrink:0;">
            ${statusBadge(msg.status)}
            <div style="font-family:'DM Sans',sans-serif; font-size:11px;
              color:var(--text-dim); margin-top:6px;">${date}</div>
            ${msg.newsletter ? `<div style="font-family:'DM Sans',sans-serif;
              font-size:11px; color:var(--text-dim); margin-top:3px;">
              ✓ Newsletter opt-in
            </div>` : ''}
          </div>
        </div>
      </div>

      <!-- Message body -->
      <div style="margin-bottom:24px;">
        <p style="font-family:'DM Sans',sans-serif; font-size:11px; font-weight:600;
          color:var(--text-dim); text-transform:uppercase; letter-spacing:0.08em;
          margin-bottom:10px;">Message</p>
        <p style="font-family:'DM Sans',sans-serif; font-size:15px; color:var(--text-body);
          line-height:1.7; white-space:pre-wrap;">${msg.message}</p>
      </div>

      <!-- Previous reply (if exists) -->
      ${msg.reply_body ? `
        <div style="background: rgba(74,138,147,0.06); border-left:3px solid rgba(74,138,147,0.4);
          padding:16px 20px; margin-bottom:24px;">
          <p style="font-family:'DM Sans',sans-serif; font-size:11px; font-weight:600;
            color:var(--text-dim); text-transform:uppercase; letter-spacing:0.08em;
            margin-bottom:8px;">
            Your reply · ${new Date(msg.replied_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            })}
          </p>
          <p style="font-family:'DM Sans',sans-serif; font-size:14px; color:var(--text-muted);
            line-height:1.6; white-space:pre-wrap;">${msg.reply_body}</p>
        </div>
      ` : ''}

      <!-- Reply form -->
      <div id="reply-form-wrap">
        <p style="font-family:'DM Sans',sans-serif; font-size:11px; font-weight:600;
          color:var(--text-dim); text-transform:uppercase; letter-spacing:0.08em;
          margin-bottom:10px;">
          ${msg.reply_body ? 'Send Another Reply' : 'Reply'}
        </p>
        <textarea id="reply-textarea" class="admin-textarea"
          style="min-height:140px; margin-bottom:12px;"
          placeholder="Write your reply to ${msg.first_name}..."></textarea>
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button class="btn-admin-secondary" id="delete-msg-btn"
            style="padding:10px 16px; font-size:12px;">
            Delete Message
          </button>
          <button class="btn-admin-primary" id="send-reply-btn">
            Send Reply to ${msg.first_name}
          </button>
        </div>
      </div>

    </div>
  `;

  // Wire reply button
  document.getElementById('send-reply-btn').addEventListener('click', () => {
    sendReply(msg);
  });

  // Wire delete button
  document.getElementById('delete-msg-btn').addEventListener('click', () => {
    deleteMessage(msg);
  });
}

async function sendReply(msg) {
  const textarea = document.getElementById('reply-textarea');
  const reply = textarea?.value?.trim();
  if (!reply) {
    showToast('Reply cannot be empty', 'error');
    return;
  }

  const btn = document.getElementById('send-reply-btn');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    // Load signature from studio_content
    let signature = '';
    try {
      const rows = await supabaseFetch(
        'studio_content?select=value&key=eq.reply_signature'
      );
      signature = rows?.[0]?.value || '';
    } catch(e) {
      // Non-fatal — send without signature
    }

    await adminFetch('/api/contact/reply', {
      id: msg.id,
      reply_body: reply,
      signature,
    });

    // Update local state
    msg.status = 'replied';
    msg.reply_body = reply;
    msg.replied_at = new Date().toISOString();

    await loadMessages(); // reload to sync
    openMessage(msg.id); // re-open to show sent reply
    showToast(`Reply sent to ${msg.first_name}`, 'success');
  } catch(e) {
    showToast('Failed to send reply: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = `Send Reply to ${msg.first_name}`;
  }
}

async function deleteMessage(msg) {
  const confirmed = await showConfirm(
    'Delete Message',
    `Delete the message from ${msg.first_name} ${msg.last_name}? This cannot be undone.`,
    'Delete',
    true
  );
  if (!confirmed) return;

  try {
    await adminFetch('/api/admin/saveMessage', { id: msg.id }, 'DELETE');
    messages = messages.filter(m => m.id !== msg.id);
    activeMessageId = null;
    document.getElementById('message-detail').style.display = 'none';
    renderMessagesList();
    updateInboxBadge();
    showToast('Message deleted', 'success');
  } catch(e) {
    showToast('Failed to delete: ' + e.message, 'error');
  }
}

// Updates the unread count badge in the sidebar nav item
export function updateInboxBadge() {
  const unreadCount = messages.filter(m => m.status === 'unread').length;
  const navItem = document.querySelector('.admin-nav-item[data-section="messages"]');
  if (!navItem) return;

  // Remove existing badge if present
  navItem.querySelector('.inbox-badge')?.remove();

  if (unreadCount > 0) {
    const badge = document.createElement('span');
    badge.className = 'inbox-badge';
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.style.cssText = `
      margin-left: auto;
      background: rgb(252,151,121);
      color: #000;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 10px;
      min-width: 18px;
      text-align: center;
      line-height: 16px;
    `;
    navItem.appendChild(badge);
  }
}
