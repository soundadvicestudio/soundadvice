import {
  adminFetch,
  supabaseFetch,
  showToast,
  showConfirm,
  markUnsaved,
  markSaved,
  initDragReorder
} from './adminCore.js';
import {
  uploadImageToStorage,
  deleteImageFromStorage,
  openCropTool
} from '../imageUploader.js';

// ── STATE ─────────────────────────────────────────────────────────────────────
let events = [];
let editingId = null; // null = new event form, string = editing existing
let formDirty = false;

// ── INIT ──────────────────────────────────────────────────────────────────────
export async function initEventsSection() {
  const section = document.getElementById('section-events');
  section.innerHTML = `
    <div class="admin-section-heading">Events</div>
    <p class="admin-section-sub">
      Manage upcoming and past events. Drag the handle to reorder.
      Pinned events always appear first on the home page.
    </p>

    <!-- Add new event button -->
    <div style="margin-bottom: 24px;">
      <button class="btn-admin-primary" id="add-event-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Event
      </button>
    </div>

    <!-- Event form (hidden until add/edit) -->
    <div id="event-form-wrap" style="display:none; margin-bottom: 32px;">
      ${buildEventForm()}
    </div>

    <!-- Event list -->
    <div id="events-list"></div>
  `;

  document.getElementById('add-event-btn').addEventListener('click', () => openForm(null));
  wireFormEvents();
  await loadEvents();

  // Listen for unsaved banner save/discard
  document.addEventListener('admin:save', handleSave);
  document.addEventListener('admin:discard', handleDiscard);
}

// ── FORM HTML ─────────────────────────────────────────────────────────────────
function buildEventForm() {
  return `
    <div class="admin-card" id="event-form-card">
      <div class="admin-card-header">
        <div class="admin-card-title" id="event-form-title">New Event</div>
        <button class="btn-admin-secondary" id="cancel-event-btn" style="padding: 6px 14px; font-size: 12px;">Cancel</button>
      </div>

      <form class="admin-form" id="event-form" autocomplete="off">

        <!-- Image upload -->
        <div class="admin-field">
          <label class="admin-label">Show Art Image <span class="optional">optional</span></label>
          <div id="image-preview-wrap" style="margin-bottom: 8px; display: none;">
            <img id="image-preview" src="" alt="Event image"
              style="max-width: 280px; max-height: 180px; object-fit: contain;
                     border: 1px solid var(--border-subtle); display: block;" />
            <button type="button" class="btn-admin-danger" id="remove-image-btn"
              style="margin-top: 8px; padding: 6px 12px; font-size: 12px;">
              Remove Image
            </button>
          </div>
          <div id="image-upload-area">
            <label for="image-file-input" style="cursor: pointer;">
              <div style="
                border: 1px dashed var(--border-mid);
                padding: 24px;
                text-align: center;
                color: var(--text-dim);
                font-family: 'DM Sans', sans-serif;
                font-size: 13px;
                transition: border-color 0.2s;
              " id="image-drop-zone">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.5" style="margin-bottom: 8px; display: block; margin: 0 auto 8px;">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Click to upload image<br>
                <span style="font-size: 11px; color: var(--text-dim);">JPG, PNG, WebP, GIF</span>
              </div>
            </label>
            <input type="file" id="image-file-input" accept="image/jpeg,image/png,image/webp,image/gif"
              style="display: none;" />
          </div>
          <div id="image-upload-status" style="
            font-family: 'DM Sans', sans-serif; font-size: 12px;
            color: var(--text-muted); margin-top: 6px; display: none;
          "></div>
        </div>

        <!-- Title -->
        <div class="admin-field">
          <label class="admin-label" for="ev-title">Title *</label>
          <input class="admin-input" type="text" id="ev-title" placeholder="e.g. The Best Little Whorehouse in Texas" required />
        </div>

        <!-- Location -->
        <div class="admin-field">
          <label class="admin-label" for="ev-location">Theater / Location <span class="optional">optional</span></label>
          <input class="admin-input" type="text" id="ev-location" placeholder="e.g. 30 by Ninety Theatre, Mandeville" />
        </div>

        <!-- Date range + Schedule row -->
        <div class="admin-row">
          <div class="admin-field">
            <label class="admin-label" for="ev-date-range">
              Date Range <span class="optional">optional</span>
            </label>
            <input class="admin-input" type="text" id="ev-date-range" placeholder="e.g. Jun 13–29, 2026" />
            <p class="admin-field-hint">Calendar dates shown on the event card.</p>
          </div>
          <div class="admin-field">
            <label class="admin-label" for="ev-schedule">
              Schedule / Times <span class="optional">optional</span>
            </label>
            <input class="admin-input" type="text" id="ev-schedule" placeholder="e.g. Fri & Sat 8:00 PM · Sun 2:30 PM" />
            <p class="admin-field-hint">Times shown on the card below the date range.</p>
          </div>
        </div>

        <!-- Visibility toggles for date_range and schedule -->
        <div class="admin-card" style="padding: 12px 16px; background: rgba(255,255,255,0.02);">
          <p class="admin-label" style="margin-bottom: 10px;">Field Visibility</p>
          <div class="admin-toggle-row">
            <div>
              <div class="admin-toggle-label">Show Date Range</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="ev-show-date-range" checked />
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="admin-toggle-row">
            <div>
              <div class="admin-toggle-label">Show Schedule / Times</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="ev-show-schedule" checked />
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="admin-toggle-row">
            <div>
              <div class="admin-toggle-label">Show Address (in More Info panel)</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="ev-show-address" checked />
              <span class="toggle-track"></span>
            </label>
          </div>
        </div>

        <!-- Address -->
        <div class="admin-field">
          <label class="admin-label" for="ev-address">
            Full Address <span class="optional">optional — shown in More Info panel</span>
          </label>
          <input class="admin-input" type="text" id="ev-address"
            placeholder="e.g. 880 Lafayette St, Mandeville, LA 70448" />
        </div>

        <!-- Description -->
        <div class="admin-field">
          <label class="admin-label" for="ev-description">
            Description / More Info Blurb <span class="optional">optional</span>
          </label>
          <textarea class="admin-textarea" id="ev-description"
            placeholder="Short description shown when visitor clicks 'More Info' on the event card."></textarea>
          <p class="admin-field-hint">
            If left blank and no ticket link is set, a "Stay Tuned" badge will show on the card.
          </p>
        </div>

        <!-- External URL -->
        <div class="admin-row">
          <div class="admin-field">
            <label class="admin-label" for="ev-external-url">
              External Link URL <span class="optional">optional — shown inside More Info panel</span>
            </label>
            <input class="admin-input" type="url" id="ev-external-url"
              placeholder="https://..." />
          </div>
          <div class="admin-field">
            <label class="admin-label" for="ev-external-label">
              External Link Label <span class="optional">optional</span>
            </label>
            <input class="admin-input" type="text" id="ev-external-label"
              placeholder="e.g. Visit Theater Website" />
          </div>
        </div>

        <!-- Tickets URL -->
        <div class="admin-field">
          <label class="admin-label" for="ev-tickets-url">
            Tickets URL <span class="optional">optional</span>
          </label>
          <input class="admin-input" type="url" id="ev-tickets-url"
            placeholder="https://..." />
          <p class="admin-field-hint">
            If provided, a "Get Tickets" button appears on the event card.
          </p>
        </div>

        <!-- date_sort + is_past row -->
        <div class="admin-row">
          <div class="admin-field">
            <label class="admin-label" for="ev-date-sort">
              Sort Date <span class="optional">used for ordering and past detection</span>
            </label>
            <input class="admin-input" type="date" id="ev-date-sort" />
            <p class="admin-field-hint">
              Set to the opening/first date of the event. If this date is in
              the past, the event is automatically marked as Past.
            </p>
          </div>
          <div class="admin-field">
            <label class="admin-label">Status</label>
            <div class="admin-toggle-row" style="border: none; padding: 10px 0 0;">
              <div>
                <div class="admin-toggle-label">Mark as Past Event</div>
                <div class="admin-toggle-hint">
                  Auto-set when Sort Date is in the past. Override manually if needed.
                </div>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="ev-is-past" />
                <span class="toggle-track"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Pin + Active row -->
        <div class="admin-card" style="padding: 12px 16px; background: rgba(255,255,255,0.02);">
          <div class="admin-toggle-row">
            <div>
              <div class="admin-toggle-label">Pin to Top</div>
              <div class="admin-toggle-hint">Pinned events appear before all others on the home page.</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="ev-pinned" />
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="admin-toggle-row">
            <div>
              <div class="admin-toggle-label">Active / Visible</div>
              <div class="admin-toggle-hint">Inactive events are hidden from the public site.</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="ev-active" checked />
              <span class="toggle-track"></span>
            </label>
          </div>
        </div>

        <!-- Form actions -->
        <div style="display: flex; gap: 12px; justify-content: flex-end; padding-top: 8px;">
          <button type="button" class="btn-admin-secondary" id="cancel-event-btn-2">Cancel</button>
          <button type="submit" class="btn-admin-primary" id="save-event-btn">
            Save Event
          </button>
        </div>

      </form>
    </div>
  `;
}

// ── WIRE FORM EVENTS ─────────────────────────────────────────────────────────
function wireFormEvents() {
  document.getElementById('section-events').addEventListener('click', (e) => {
    if (e.target.id === 'cancel-event-btn' || e.target.id === 'cancel-event-btn-2') {
      closeForm();
    }
    if (e.target.id === 'remove-image-btn') {
      removeImage();
    }
  });

  document.getElementById('section-events').addEventListener('change', (e) => {
    if (e.target.id === 'ev-date-sort') {
      autoDetectIsPast();
    }
    if (e.target.closest('#event-form')) {
      setFormDirty();
    }
  });

  document.getElementById('section-events').addEventListener('input', (e) => {
    if (e.target.closest('#event-form')) {
      setFormDirty();
    }
  });

  document.getElementById('section-events').addEventListener('submit', (e) => {
    if (e.target.id === 'event-form') {
      e.preventDefault();
      saveEvent();
    }
  });

  // Image file input
  document.getElementById('section-events').addEventListener('change', (e) => {
    if (e.target.id === 'image-file-input') {
      handleImageFile(e.target.files[0]);
    }
  });
}

// ── LOAD EVENTS ───────────────────────────────────────────────────────────────
async function loadEvents() {
  const list = document.getElementById('events-list');
  if (!list) return;
  list.innerHTML = `<div class="admin-loading"><div class="admin-spinner"></div></div>`;

  try {
    events = await supabaseFetch(
      'studio_events?select=*&order=pinned.desc,position.asc'
    );
    renderEventsList();
  } catch(e) {
    list.innerHTML = `<p style="color:#ff6b6b; font-family:'DM Sans',sans-serif; font-size:14px;">
      Failed to load events: ${e.message}
    </p>`;
  }
}

// ── RENDER EVENTS LIST ────────────────────────────────────────────────────────
function renderEventsList() {
  const old = document.getElementById('events-list');
  if (!old) return;

  // Replace the element to clear any accumulated drag/click listeners from prior renders
  const list = document.createElement('div');
  list.id = 'events-list';
  old.replaceWith(list);

  if (!events.length) {
    list.innerHTML = `<p style="color:var(--text-muted); font-family:'DM Sans',sans-serif; font-size:14px;">
      No events yet. Click "Add Event" to create your first one.
    </p>`;
    return;
  }

  list.innerHTML = events.map(ev => `
    <div class="draggable-item" data-id="${ev.id}" draggable="true">
      <div class="drag-handle" title="Drag to reorder">⠿</div>

      ${ev.image_url ? `
        <img src="${ev.image_url}" alt="${ev.title}"
          style="width: 60px; height: 44px; object-fit: cover;
                 flex-shrink: 0; border: 1px solid var(--border-subtle);" />
      ` : `
        <div style="width:60px; height:44px; flex-shrink:0;
                    background: var(--bg-card); border: 1px solid var(--border-subtle);
                    display:flex; align-items:center; justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-dim)" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
      `}

      <div style="flex: 1; min-width: 0;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span style="font-family:'DM Sans',sans-serif; font-size:14px;
                       font-weight:600; color:var(--white);">${ev.title}</span>
          ${ev.pinned ? `<span style="
            font-family:'DM Sans',sans-serif; font-size:10px; font-weight:600;
            color: rgb(252,151,121); border: 1px solid rgba(252,151,121,0.4);
            padding: 1px 7px; letter-spacing: 0.06em; text-transform: uppercase;
          ">PINNED</span>` : ''}
          ${ev.is_past ? `<span style="
            font-family:'DM Sans',sans-serif; font-size:10px; font-weight:600;
            color: var(--text-dim); border: 1px solid var(--border-subtle);
            padding: 1px 7px; letter-spacing: 0.06em; text-transform: uppercase;
          ">PAST</span>` : ''}
          ${!ev.active ? `<span style="
            font-family:'DM Sans',sans-serif; font-size:10px; font-weight:600;
            color: #ff6b6b; border: 1px solid rgba(255,107,107,0.3);
            padding: 1px 7px; letter-spacing: 0.06em; text-transform: uppercase;
          ">HIDDEN</span>` : ''}
          ${!ev.tickets_url && !ev.description ? `<span style="
            font-family:'DM Sans',sans-serif; font-size:10px; font-weight:600;
            color: rgb(74,138,147); border: 1px solid rgba(74,138,147,0.5);
            padding: 1px 7px; letter-spacing: 0.06em; text-transform: uppercase;
          ">STAY TUNED</span>` : ''}
        </div>
        <div style="font-family:'DM Sans',sans-serif; font-size:12px;
                    color:var(--text-muted); margin-top:3px;">
          ${[ev.date_range, ev.location].filter(Boolean).join(' · ') || 'No date or location set'}
        </div>
      </div>

      <div style="display:flex; gap:8px; flex-shrink:0;">
        <button class="btn-admin-secondary" data-action="pin" data-id="${ev.id}"
          style="padding:6px 12px; font-size:11px;"
          title="${ev.pinned ? 'Unpin' : 'Pin to top'}">
          ${ev.pinned ? '📌 Pinned' : '📌 Pin'}
        </button>
        <button class="btn-admin-secondary" data-action="edit" data-id="${ev.id}"
          style="padding:6px 12px; font-size:11px;">
          Edit
        </button>
        <button class="btn-admin-danger" data-action="delete" data-id="${ev.id}"
          style="padding:6px 12px; font-size:11px;">
          Delete
        </button>
      </div>
    </div>
  `).join('');

  // Wire action buttons
  list.addEventListener('click', handleListAction);

  // Init drag to reorder
  initDragReorder(list, async (orderedIds) => {
    try {
      await adminFetch('/api/admin/reorderItems', {
        table: 'studio_events',
        items: orderedIds.map((id, i) => ({ id, position: i }))
      });
      orderedIds.forEach((id, i) => {
        const ev = events.find(e => e.id === id);
        if (ev) ev.position = i;
      });
      showToast('Order saved', 'success');
    } catch(e) {
      showToast('Failed to save order', 'error');
    }
  });
}

// ── LIST ACTION HANDLER ───────────────────────────────────────────────────────
async function handleListAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;

  if (action === 'edit') {
    openForm(id);
  }

  if (action === 'pin') {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    try {
      await adminFetch('/api/admin/saveEvent', { id, pinned: !ev.pinned });
      ev.pinned = !ev.pinned;
      renderEventsList();
      showToast(ev.pinned ? 'Event pinned' : 'Event unpinned', 'success');
    } catch(err) {
      showToast('Failed to update pin', 'error');
    }
  }

  if (action === 'delete') {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    const confirmed = await showConfirm(
      'Delete Event',
      `Are you sure you want to delete "${ev.title}"? This cannot be undone.`,
      'Delete',
      true
    );
    if (!confirmed) return;
    try {
      await adminFetch('/api/admin/saveEvent', { id }, 'DELETE');
      if (ev.image_url?.includes('studio-images')) {
        await deleteImageFromStorage(ev.image_url).catch(() => {});
      }
      events = events.filter(e => e.id !== id);
      renderEventsList();
      showToast('Event deleted', 'success');
    } catch(err) {
      showToast('Failed to delete event', 'error');
    }
  }
}

// ── OPEN / CLOSE FORM ─────────────────────────────────────────────────────────
function openForm(id) {
  editingId = id;
  formDirty = false;
  const wrap = document.getElementById('event-form-wrap');
  wrap.style.display = 'block';
  document.getElementById('event-form-title').textContent =
    id ? 'Edit Event' : 'New Event';

  if (id) {
    const ev = events.find(e => e.id === id);
    if (ev) populateForm(ev);
  } else {
    resetForm();
  }

  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeForm() {
  editingId = null;
  formDirty = false;
  markSaved();
  document.getElementById('event-form-wrap').style.display = 'none';
  resetForm();
}

function setFormDirty() {
  if (!formDirty) {
    formDirty = true;
    markUnsaved(
      () => saveEvent(),
      () => { formDirty = false; closeForm(); }
    );
  }
}

// ── POPULATE / RESET FORM ─────────────────────────────────────────────────────
function populateForm(ev) {
  setField('ev-title', ev.title);
  setField('ev-location', ev.location);
  setField('ev-date-range', ev.date_range);
  setField('ev-schedule', ev.schedule);
  setField('ev-address', ev.address);
  setField('ev-description', ev.description);
  setField('ev-external-url', ev.external_url);
  setField('ev-external-label', ev.external_url_label);
  setField('ev-tickets-url', ev.tickets_url);
  setField('ev-date-sort', ev.date_sort);
  setCheck('ev-show-date-range', ev.show_date_range !== false);
  setCheck('ev-show-schedule', ev.show_schedule !== false);
  setCheck('ev-show-address', ev.show_address !== false);
  setCheck('ev-pinned', ev.pinned);
  setCheck('ev-active', ev.active !== false);
  setCheck('ev-is-past', ev.is_past);

  if (ev.image_url) {
    showImagePreview(ev.image_url);
  } else {
    hideImagePreview();
  }

  document.getElementById('event-form').dataset.currentImageUrl = ev.image_url || '';
}

function resetForm() {
  ['ev-title','ev-location','ev-date-range','ev-schedule','ev-address',
   'ev-description','ev-external-url','ev-external-label','ev-tickets-url',
   'ev-date-sort'].forEach(id => setField(id, ''));
  setCheck('ev-show-date-range', true);
  setCheck('ev-show-schedule', true);
  setCheck('ev-show-address', true);
  setCheck('ev-pinned', false);
  setCheck('ev-active', true);
  setCheck('ev-is-past', false);
  hideImagePreview();
  document.getElementById('event-form').dataset.currentImageUrl = '';
  document.getElementById('image-file-input').value = '';
}

function setField(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}

function setCheck(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}

// ── AUTO-DETECT IS_PAST ───────────────────────────────────────────────────────
function autoDetectIsPast() {
  const dateSort = document.getElementById('ev-date-sort')?.value;
  if (!dateSort) return;
  const isPast = new Date(dateSort) < new Date();
  setCheck('ev-is-past', isPast);
}

// ── IMAGE HANDLING ────────────────────────────────────────────────────────────
let pendingImageUrl = null;

async function handleImageFile(file) {
  if (!file) return;
  const status = document.getElementById('image-upload-status');
  status.style.display = 'block';
  status.textContent = 'Opening crop tool...';

  try {
    const cropped = await openCropTool(file, { aspectRatio: null });
    status.textContent = 'Uploading...';
    const url = await uploadImageToStorage(cropped, (msg) => {
      status.textContent = msg;
    });
    pendingImageUrl = url;
    showImagePreview(url);
    status.textContent = 'Image ready.';
    setFormDirty();
    showToast('Image uploaded', 'success');
  } catch(e) {
    if (e.message !== 'Crop cancelled') {
      status.textContent = 'Upload failed: ' + e.message;
      showToast('Image upload failed', 'error');
    } else {
      status.textContent = '';
    }
  }
}

function showImagePreview(url) {
  document.getElementById('image-preview').src = url;
  document.getElementById('image-preview-wrap').style.display = 'block';
  document.getElementById('image-upload-area').style.display = 'none';
}

function hideImagePreview() {
  document.getElementById('image-preview').src = '';
  document.getElementById('image-preview-wrap').style.display = 'none';
  document.getElementById('image-upload-area').style.display = 'block';
  pendingImageUrl = null;
}

async function removeImage() {
  const confirmed = await showConfirm(
    'Remove Image',
    'Remove the image from this event? The file will be deleted from storage if it was uploaded here.',
    'Remove',
    true
  );
  if (!confirmed) return;

  const currentUrl = document.getElementById('event-form').dataset.currentImageUrl;
  if (currentUrl?.includes('studio-images')) {
    await deleteImageFromStorage(currentUrl).catch(() => {});
  }
  pendingImageUrl = 'REMOVE';
  hideImagePreview();
  setFormDirty();
}

// ── SAVE EVENT ────────────────────────────────────────────────────────────────
async function saveEvent() {
  const titleEl = document.getElementById('ev-title');
  if (!titleEl?.value?.trim()) {
    showToast('Title is required', 'error');
    titleEl?.focus();
    return;
  }

  const saveBtn = document.getElementById('save-event-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

  try {
    let imageUrl;
    const currentUrl = document.getElementById('event-form').dataset.currentImageUrl;
    if (pendingImageUrl === 'REMOVE') {
      imageUrl = null;
    } else if (pendingImageUrl) {
      imageUrl = pendingImageUrl;
    } else {
      imageUrl = currentUrl || null;
    }

    const dateSort = document.getElementById('ev-date-sort').value || null;

    const payload = {
      title: document.getElementById('ev-title').value.trim(),
      location: document.getElementById('ev-location').value.trim() || null,
      date_range: document.getElementById('ev-date-range').value.trim() || null,
      date_display: document.getElementById('ev-date-range').value.trim() || null,
      schedule: document.getElementById('ev-schedule').value.trim() || null,
      address: document.getElementById('ev-address').value.trim() || null,
      description: document.getElementById('ev-description').value.trim() || null,
      external_url: document.getElementById('ev-external-url').value.trim() || null,
      external_url_label: document.getElementById('ev-external-label').value.trim() || null,
      tickets_url: document.getElementById('ev-tickets-url').value.trim() || null,
      image_url: imageUrl,
      date_sort: dateSort,
      year: dateSort ? new Date(dateSort).getFullYear() : null,
      is_past: document.getElementById('ev-is-past').checked,
      show_date_range: document.getElementById('ev-show-date-range').checked,
      show_schedule: document.getElementById('ev-show-schedule').checked,
      show_address: document.getElementById('ev-show-address').checked,
      pinned: document.getElementById('ev-pinned').checked,
      active: document.getElementById('ev-active').checked,
    };

    if (editingId) payload.id = editingId;

    await adminFetch('/api/admin/saveEvent', payload);

    pendingImageUrl = null;
    formDirty = false;
    markSaved();
    closeForm();
    await loadEvents();
    showToast(editingId ? 'Event updated' : 'Event created', 'success');

  } catch(err) {
    showToast('Failed to save event: ' + err.message, 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Event'; }
  }
}

// ── UNSAVED BANNER HANDLERS ───────────────────────────────────────────────────
async function handleSave() {
  const wrap = document.getElementById('event-form-wrap');
  if (wrap?.style.display !== 'none' && formDirty) {
    await saveEvent();
  }
}

function handleDiscard() {
  formDirty = false;
  closeForm();
}
