// ── SESSION / AUTH ──────────────────────────────────────────────────────────

const SESSION_KEY = 'sb-soundadvice-auth';

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session.expires_at && session.expires_at > Date.now() / 1000) return session;
    localStorage.removeItem(SESSION_KEY);
    return null;
  } catch(e) { return null; }
}

export function requireSession() {
  const session = getSession();
  if (!session) {
    window.location.replace('/admin/login.html');
    return null;
  }
  return session;
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
  window.location.replace('/admin/login.html');
}

// ── ADMIN SECRET ─────────────────────────────────────────────────────────────

let _adminSecret = null;

export async function loadAdminSecret(accessToken) {
  if (_adminSecret) return _adminSecret;
  const res = await fetch('/api/admin/env', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Failed to load admin config');
  const data = await res.json();
  _adminSecret = data.secret;
  window.__ADMIN_SECRET__ = _adminSecret; // for imageUploader.js
  return _adminSecret;
}

export function getAdminSecret() { return _adminSecret; }

// ── API HELPER ──────────────────────────────────────────────────────────────

export async function adminFetch(path, body, method = 'POST') {
  const secret = getAdminSecret();
  if (!secret) throw new Error('Admin secret not loaded');
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': secret,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function supabaseFetch(path) {
  const SUPABASE_URL = 'https://trtseeytryqwwkoqtkvp.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_E8g0Q5cZxzMHsMYje3SmGw_QdoOeaUT';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  return res.json();
}

// ── TOAST SYSTEM ─────────────────────────────────────────────────────────────

let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, type = 'success', duration = 3500) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── CONFIRM DIALOG ───────────────────────────────────────────────────────────

export function showConfirm(title, message, confirmLabel = 'Confirm', danger = false) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-title">${title}</div>
        <div class="confirm-message">${message}</div>
        <div class="confirm-buttons">
          <button class="btn-admin-secondary" id="confirm-cancel">Cancel</button>
          <button class="${danger ? 'btn-admin-danger' : 'btn-admin-primary'}" id="confirm-ok">
            ${confirmLabel}
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirm-cancel').addEventListener('click', () => {
      overlay.remove(); resolve(false);
    });
    overlay.querySelector('#confirm-ok').addEventListener('click', () => {
      overlay.remove(); resolve(true);
    });
  });
}

// ── UNSAVED CHANGES ──────────────────────────────────────────────────────────

let _hasUnsavedChanges = false;
let _onSave = null;
let _onDiscard = null;

export function markUnsaved(onSave, onDiscard) {
  _hasUnsavedChanges = true;
  _onSave = onSave;
  _onDiscard = onDiscard;
  document.getElementById('unsaved-banner')?.classList.add('visible');
}

export function markSaved() {
  _hasUnsavedChanges = false;
  _onSave = null;
  _onDiscard = null;
  document.getElementById('unsaved-banner')?.classList.remove('visible');
}

export function hasUnsavedChanges() { return _hasUnsavedChanges; }

export async function guardNavigation() {
  if (!_hasUnsavedChanges) return true;
  const leave = await showConfirm(
    'Unsaved Changes',
    'You have unsaved changes. If you leave this section they will be lost.',
    'Leave Without Saving',
    true
  );
  if (leave) {
    if (_onDiscard) _onDiscard();
    markSaved();
  }
  return leave;
}

// ── DRAG TO REORDER ──────────────────────────────────────────────────────────

export function initDragReorder(container, onReorder) {
  let dragItem = null;
  let dragOverItem = null;

  container.addEventListener('dragstart', (e) => {
    dragItem = e.target.closest('.draggable-item');
    if (!dragItem) return;
    dragItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragItem.dataset.id);
  });

  container.addEventListener('dragend', () => {
    if (dragItem) dragItem.classList.remove('dragging');
    if (dragOverItem) dragOverItem.classList.remove('drag-over');
    dragItem = null;
    dragOverItem = null;
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('.draggable-item');
    if (!target || target === dragItem) return;
    if (dragOverItem && dragOverItem !== target) {
      dragOverItem.classList.remove('drag-over');
    }
    dragOverItem = target;
    target.classList.add('drag-over');

    const items = [...container.querySelectorAll('.draggable-item')];
    const dragIdx = items.indexOf(dragItem);
    const overIdx = items.indexOf(target);
    if (dragIdx < overIdx) {
      container.insertBefore(dragItem, target.nextSibling);
    } else {
      container.insertBefore(dragItem, target);
    }
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const items = [...container.querySelectorAll('.draggable-item')];
    const orderedIds = items.map(item => item.dataset.id);
    if (onReorder) onReorder(orderedIds);
  });
}

// ── SESSION TOKEN REFRESH ────────────────────────────────────────────────────

const SUPABASE_URL = 'https://trtseeytryqwwkoqtkvp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_E8g0Q5cZxzMHsMYje3SmGw_QdoOeaUT';

/**
 * Attempts to refresh the Supabase session using the stored refresh_token.
 * Updates localStorage with the new session if successful.
 * Returns the new access_token, or null if refresh failed.
 */
export async function refreshSession() {
  const session = getSession();
  if (!session?.refresh_token) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (!res.ok) {
      // Refresh token expired or invalid — sign out
      signOut();
      return null;
    }

    const data = await res.json();
    const newSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: data.user || session.user,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    return data.access_token;

  } catch(e) {
    console.error('Session refresh failed:', e);
    return null;
  }
}

/**
 * Starts a background refresh interval.
 * Refreshes the token 5 minutes before it expires.
 * Call this once after the admin dashboard confirms a valid session.
 */
export function startSessionRefresh() {
  const session = getSession();
  if (!session) return;

  const msUntilExpiry = session.expires_at - Date.now();
  const refreshAt = Math.max(msUntilExpiry - (5 * 60 * 1000), 10000); // 5 min before expiry, min 10s

  setTimeout(async () => {
    const newToken = await refreshSession();
    if (newToken) {
      // Schedule next refresh
      startSessionRefresh();
    }
    // If null, signOut() was already called inside refreshSession()
  }, refreshAt);
}
