import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const _supabase = createClient(
  'https://trtseeytryqwwkoqtkvp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRydHNlZXl0cnlxd3drb3F0a3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNzk2MTUsImV4cCI6MjA5Nzc1NTYxNX0.NjkB2bkn6V-Vz1vfc_Pu0p8c5hXa7i0UpFE7dqKhYeA',
  {
    auth: {
      storageKey: 'sb-soundadvice-auth',
      storage: window.localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  }
);

// _supabase is intentionally NOT exported.

// ── SESSION / AUTH ──────────────────────────────────────────────────────────

export async function getSession() {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) return null;
  const { data: { session } } = await _supabase.auth.getSession();
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    window.location.replace('/admin/login.html');
    return null;
  }
  return session;
}

export async function signOut() {
  await _supabase.auth.signOut();
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
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRydHNlZXl0cnlxd3drb3F0a3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNzk2MTUsImV4cCI6MjA5Nzc1NTYxNX0.NjkB2bkn6V-Vz1vfc_Pu0p8c5hXa7i0UpFE7dqKhYeA';
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

