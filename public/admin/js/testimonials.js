import {
  adminFetch,
  supabaseFetch,
  showToast,
  showConfirm,
  markUnsaved,
  markSaved,
  initDragReorder
} from './adminCore.js';

let testimonials = [];
let editingId = null;
let formDirty = false;

export async function initTestimonialsSection() {
  const section = document.getElementById('section-testimonials');
  section.innerHTML = `
    <div class="admin-section-heading">Testimonials</div>
    <p class="admin-section-sub">
      Manage student testimonials shown in the carousel on the home page.
      Drag to reorder. Only active testimonials appear on the site.
    </p>

    <div style="margin-bottom: 24px;">
      <button class="btn-admin-primary" id="add-testimonial-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Testimonial
      </button>
    </div>

    <div id="testimonial-form-wrap" style="display:none; margin-bottom: 32px;">
      ${buildTestimonialForm()}
    </div>

    <div id="testimonials-list"></div>
  `;

  document.getElementById('add-testimonial-btn')
    .addEventListener('click', () => openForm(null));
  wireFormEvents();
  await loadTestimonials();

  document.addEventListener('admin:save', handleSave);
  document.addEventListener('admin:discard', handleDiscard);
}

function buildTestimonialForm() {
  return `
    <div class="admin-card" id="testimonial-form-card"
      style="border-color: rgba(74,138,147,0.2);">
      <div class="admin-card-header">
        <div class="admin-card-title" id="testimonial-form-title">New Testimonial</div>
        <button class="btn-admin-secondary" id="cancel-testimonial-btn"
          style="padding: 6px 14px; font-size: 12px;">Cancel</button>
      </div>
      <form class="admin-form" id="testimonial-form" autocomplete="off">

        <div class="admin-field">
          <label class="admin-label" for="tm-quote">Quote *</label>
          <textarea class="admin-textarea" id="tm-quote" rows="4"
            placeholder="Enter the full testimonial quote..." style="min-height:110px;"></textarea>
          <p class="admin-field-hint">
            Do not include surrounding quote marks — they are added automatically on the site.
          </p>
        </div>

        <div class="admin-row">
          <div class="admin-field">
            <label class="admin-label" for="tm-name">Name *</label>
            <input class="admin-input" type="text" id="tm-name"
              placeholder="e.g. Zondra White Jones" />
          </div>
          <div class="admin-field">
            <label class="admin-label" for="tm-title">
              Title / Role <span class="optional">optional</span>
            </label>
            <input class="admin-input" type="text" id="tm-title"
              placeholder="e.g. Stage Actress, Lead Singer of Soul Revival" />
          </div>
        </div>

        <div class="admin-card" style="padding: 12px 16px;
          background: rgba(255,255,255,0.02);">
          <div class="admin-toggle-row" style="border:none; padding: 6px 0;">
            <div>
              <div class="admin-toggle-label">Active / Visible</div>
              <div class="admin-toggle-hint">
                Inactive testimonials are hidden from the carousel.
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="tm-active" checked />
              <span class="toggle-track"></span>
            </label>
          </div>
        </div>

        <div style="display:flex; gap:12px; justify-content:flex-end; padding-top:8px;">
          <button type="button" class="btn-admin-secondary"
            id="cancel-testimonial-btn-2">Cancel</button>
          <button type="submit" class="btn-admin-primary" id="save-testimonial-btn">
            Save Testimonial
          </button>
        </div>

      </form>
    </div>
  `;
}

function wireFormEvents() {
  const section = document.getElementById('section-testimonials');

  section.addEventListener('click', (e) => {
    if (e.target.id === 'cancel-testimonial-btn' ||
        e.target.id === 'cancel-testimonial-btn-2') {
      closeForm();
    }
  });

  section.addEventListener('input', (e) => {
    if (e.target.closest('#testimonial-form')) setFormDirty();
  });

  section.addEventListener('change', (e) => {
    if (e.target.closest('#testimonial-form')) setFormDirty();
  });

  section.addEventListener('submit', (e) => {
    if (e.target.id === 'testimonial-form') {
      e.preventDefault();
      saveTestimonial();
    }
  });
}

async function loadTestimonials() {
  const list = document.getElementById('testimonials-list');
  if (!list) return;
  list.innerHTML = `<div class="admin-loading"><div class="admin-spinner"></div></div>`;
  try {
    testimonials = await supabaseFetch(
      'studio_testimonials?select=*&order=position.asc'
    );
    renderTestimonialsList();
  } catch(e) {
    list.innerHTML = `<p style="color:#ff6b6b; font-family:'DM Sans',sans-serif;
      font-size:14px;">Failed to load testimonials: ${e.message}</p>`;
  }
}

function renderTestimonialsList() {
  const old = document.getElementById('testimonials-list');
  if (!old) return;

  // Replace element to clear accumulated drag/click listeners from prior renders
  const list = document.createElement('div');
  list.id = 'testimonials-list';
  old.replaceWith(list);

  if (!testimonials.length) {
    list.innerHTML = `<p style="color:var(--text-muted); font-family:'DM Sans',sans-serif;
      font-size:14px;">No testimonials yet. Click "Add Testimonial" to create your first one.</p>`;
    return;
  }

  list.innerHTML = testimonials.map(tm => `
    <div class="draggable-item" data-id="${tm.id}" draggable="true">
      <div class="drag-handle" title="Drag to reorder">⠿</div>

      <div style="flex:1; min-width:0;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span style="font-family:'DM Sans',sans-serif; font-size:14px;
            font-weight:600; color:var(--white);">${tm.name}</span>
          ${tm.title ? `<span style="font-family:'DM Sans',sans-serif;
            font-size:12px; color:var(--text-muted);">${tm.title}</span>` : ''}
          ${!tm.active ? `<span style="font-family:'DM Sans',sans-serif;
            font-size:10px; font-weight:600; color:#ff6b6b;
            border:1px solid rgba(255,107,107,0.3); padding:1px 7px;
            letter-spacing:0.06em; text-transform:uppercase;">HIDDEN</span>` : ''}
        </div>
        <div style="font-family:'DM Sans',sans-serif; font-size:12px;
          color:var(--text-muted); margin-top:4px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          max-width:500px;">
          "${tm.quote?.substring(0, 100)}${tm.quote?.length > 100 ? '...' : ''}"
        </div>
      </div>

      <div style="display:flex; gap:8px; flex-shrink:0;">
        <button class="btn-admin-secondary" data-action="toggle"
          data-id="${tm.id}" data-active="${tm.active}"
          style="padding:6px 12px; font-size:11px;">
          ${tm.active ? 'Hide' : 'Show'}
        </button>
        <button class="btn-admin-secondary" data-action="edit"
          data-id="${tm.id}" style="padding:6px 12px; font-size:11px;">
          Edit
        </button>
        <button class="btn-admin-danger" data-action="delete"
          data-id="${tm.id}" style="padding:6px 12px; font-size:11px;">
          Delete
        </button>
      </div>
    </div>
  `).join('');

  list.addEventListener('click', handleListAction);

  initDragReorder(list, async (orderedIds) => {
    try {
      await adminFetch('/api/admin/reorderItems', {
        table: 'studio_testimonials',
        items: orderedIds.map((id, i) => ({ id, position: i }))
      });
      orderedIds.forEach((id, i) => {
        const tm = testimonials.find(t => t.id === id);
        if (tm) tm.position = i;
      });
      showToast('Order saved', 'success');
    } catch(e) {
      showToast('Failed to save order', 'error');
    }
  });
}

async function handleListAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;

  if (action === 'edit') {
    openForm(id);
  }

  if (action === 'toggle') {
    const tm = testimonials.find(t => t.id === id);
    if (!tm) return;
    try {
      // Must include quote+name because saveTestimonial.js validates them on every PATCH
      await adminFetch('/api/admin/saveTestimonial', {
        id,
        quote: tm.quote,
        name: tm.name,
        title: tm.title ?? null,
        active: !tm.active,
      });
      tm.active = !tm.active;
      renderTestimonialsList();
      showToast(tm.active ? 'Testimonial shown' : 'Testimonial hidden', 'success');
    } catch(err) {
      showToast('Failed to update', 'error');
    }
  }

  if (action === 'delete') {
    const tm = testimonials.find(t => t.id === id);
    if (!tm) return;
    const confirmed = await showConfirm(
      'Delete Testimonial',
      `Delete the testimonial from "${tm.name}"? This cannot be undone.`,
      'Delete',
      true
    );
    if (!confirmed) return;
    try {
      await adminFetch('/api/admin/saveTestimonial', { id }, 'DELETE');
      testimonials = testimonials.filter(t => t.id !== id);
      renderTestimonialsList();
      showToast('Testimonial deleted', 'success');
    } catch(err) {
      showToast('Failed to delete', 'error');
    }
  }
}

function openForm(id) {
  editingId = id;
  formDirty = false;
  const wrap = document.getElementById('testimonial-form-wrap');
  wrap.style.display = 'block';
  document.getElementById('testimonial-form-title').textContent =
    id ? 'Edit Testimonial' : 'New Testimonial';
  if (id) {
    const tm = testimonials.find(t => t.id === id);
    if (tm) {
      document.getElementById('tm-quote').value = tm.quote || '';
      document.getElementById('tm-name').value = tm.name || '';
      document.getElementById('tm-title').value = tm.title || '';
      document.getElementById('tm-active').checked = tm.active !== false;
    }
  } else {
    document.getElementById('tm-quote').value = '';
    document.getElementById('tm-name').value = '';
    document.getElementById('tm-title').value = '';
    document.getElementById('tm-active').checked = true;
  }
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeForm() {
  editingId = null;
  formDirty = false;
  markSaved();
  document.getElementById('testimonial-form-wrap').style.display = 'none';
}

function setFormDirty() {
  if (!formDirty) {
    formDirty = true;
    markUnsaved(
      () => saveTestimonial(),
      () => { formDirty = false; closeForm(); }
    );
  }
}

async function saveTestimonial() {
  const quote = document.getElementById('tm-quote')?.value?.trim();
  const name = document.getElementById('tm-name')?.value?.trim();
  if (!quote || !name) {
    showToast('Quote and name are required', 'error');
    return;
  }

  const saveBtn = document.getElementById('save-testimonial-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

  try {
    const payload = {
      quote,
      name,
      title: document.getElementById('tm-title').value.trim() || null,
      active: document.getElementById('tm-active').checked,
    };
    if (editingId) payload.id = editingId;

    await adminFetch('/api/admin/saveTestimonial', payload);
    formDirty = false;
    markSaved();
    closeForm();
    await loadTestimonials();
    showToast(editingId ? 'Testimonial updated' : 'Testimonial created', 'success');
  } catch(err) {
    showToast('Failed to save: ' + err.message, 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Testimonial'; }
  }
}

function handleSave() {
  const wrap = document.getElementById('testimonial-form-wrap');
  if (wrap?.style.display !== 'none' && formDirty) saveTestimonial();
}

function handleDiscard() {
  formDirty = false;
  closeForm();
}
