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

let services = [];
let editingId = null;
let formDirty = false;
let pendingImageUrl = null;

export async function initServicesSection() {
  const section = document.getElementById('section-services');
  section.innerHTML = `
    <div class="admin-section-heading">Services</div>
    <p class="admin-section-sub">
      Edit the six service cards shown on the Services page.
      Drag to reorder. Toggle active to show or hide a service.
    </p>
    <div id="service-form-wrap" style="display:none; margin-bottom:32px;">
      ${buildServiceForm()}
    </div>
    <div id="services-list"></div>
  `;

  wireFormEvents();
  await loadServices();

  document.addEventListener('admin:save', handleSave);
  document.addEventListener('admin:discard', handleDiscard);
}

function buildServiceForm() {
  return `
    <div class="admin-card" id="service-form-card"
      style="border-color: rgba(252,151,121,0.2);">
      <div class="admin-card-header">
        <div class="admin-card-title" id="service-form-title">Edit Service</div>
        <button class="btn-admin-secondary" id="cancel-service-btn"
          style="padding:6px 14px; font-size:12px;">Cancel</button>
      </div>
      <form class="admin-form" id="service-form" autocomplete="off">

        <!-- Image upload -->
        <div class="admin-field">
          <label class="admin-label">
            Circular Image <span class="optional">optional</span>
          </label>
          <div id="svc-image-preview-wrap" style="margin-bottom:8px; display:none;">
            <img id="svc-image-preview" src="" alt="Service image"
              style="width:120px; height:120px; object-fit:cover;
                     border-radius:50%; border:1px solid var(--border-subtle);" />
            <button type="button" class="btn-admin-danger"
              id="svc-remove-image-btn"
              style="margin-top:8px; padding:6px 12px; font-size:12px;">
              Remove Image
            </button>
          </div>
          <div id="svc-image-upload-area">
            <label for="svc-image-file-input" style="cursor:pointer;">
              <div style="border:1px dashed var(--border-mid); padding:20px;
                text-align:center; color:var(--text-dim);
                font-family:'DM Sans',sans-serif; font-size:13px;"
                id="svc-image-drop-zone">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="1.5"
                  style="display:block; margin:0 auto 8px;">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Click to upload circular image<br>
                <span style="font-size:11px; color:var(--text-dim);">
                  JPG, PNG, WebP, GIF · Will be cropped circular by CSS
                </span>
              </div>
            </label>
            <input type="file" id="svc-image-file-input"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style="display:none;" />
          </div>
          <div id="svc-image-upload-status"
            style="font-family:'DM Sans',sans-serif; font-size:12px;
              color:var(--text-muted); margin-top:6px; display:none;"></div>
        </div>

        <!-- Name -->
        <div class="admin-field">
          <label class="admin-label" for="svc-name">Service Name *</label>
          <input class="admin-input" type="text" id="svc-name"
            placeholder="e.g. Vocal Coaching" />
        </div>

        <!-- Description -->
        <div class="admin-field">
          <label class="admin-label" for="svc-description">Description *</label>
          <textarea class="admin-textarea" id="svc-description"
            style="min-height:120px;"
            placeholder="Describe this service..."></textarea>
        </div>

        <!-- Active toggle -->
        <div class="admin-card"
          style="padding:12px 16px; background:rgba(255,255,255,0.02);">
          <div class="admin-toggle-row" style="border:none; padding:6px 0;">
            <div>
              <div class="admin-toggle-label">Active / Visible</div>
              <div class="admin-toggle-hint">
                Inactive services are hidden from the Services page.
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="svc-active" checked />
              <span class="toggle-track"></span>
            </label>
          </div>
        </div>

        <div style="display:flex; gap:12px; justify-content:flex-end;
          padding-top:8px;">
          <button type="button" class="btn-admin-secondary"
            id="cancel-service-btn-2">Cancel</button>
          <button type="submit" class="btn-admin-primary" id="save-service-btn">
            Save Service
          </button>
        </div>

      </form>
    </div>
  `;
}

function wireFormEvents() {
  const section = document.getElementById('section-services');

  section.addEventListener('click', (e) => {
    if (e.target.id === 'cancel-service-btn' ||
        e.target.id === 'cancel-service-btn-2') closeForm();
    if (e.target.id === 'svc-remove-image-btn') removeSvcImage();
  });

  section.addEventListener('input', (e) => {
    if (e.target.closest('#service-form')) setFormDirty();
  });

  section.addEventListener('change', (e) => {
    if (e.target.id === 'svc-image-file-input') {
      handleImageFile(e.target.files[0]);
    }
    if (e.target.closest('#service-form')) setFormDirty();
  });

  section.addEventListener('submit', (e) => {
    if (e.target.id === 'service-form') {
      e.preventDefault();
      saveService();
    }
  });
}

async function loadServices() {
  const list = document.getElementById('services-list');
  if (!list) return;
  list.innerHTML = `<div class="admin-loading"><div class="admin-spinner"></div></div>`;
  try {
    services = await supabaseFetch(
      'studio_services?select=*&order=position.asc'
    );
    renderServicesList();
  } catch(e) {
    list.innerHTML = `<p style="color:#ff6b6b; font-family:'DM Sans',sans-serif;
      font-size:14px;">Failed to load services: ${e.message}</p>`;
  }
}

function renderServicesList() {
  const old = document.getElementById('services-list');
  if (!old) return;

  // Replace element to clear accumulated drag/click listeners from prior renders
  const list = document.createElement('div');
  list.id = 'services-list';
  old.replaceWith(list);

  if (!services.length) {
    list.innerHTML = `<p style="color:var(--text-muted); font-family:'DM Sans',sans-serif;
      font-size:14px;">No services found.</p>`;
    return;
  }

  list.innerHTML = services.map(svc => `
    <div class="draggable-item" data-id="${svc.id}" draggable="true">
      <div class="drag-handle" title="Drag to reorder">⠿</div>

      ${svc.image_url ? `
        <img src="${svc.image_url}" alt="${svc.name}"
          style="width:48px; height:48px; object-fit:cover; border-radius:50%;
                 flex-shrink:0; border:1px solid var(--border-subtle);" />
      ` : `
        <div style="width:48px; height:48px; border-radius:50%; flex-shrink:0;
          background:var(--bg-card); border:1px solid var(--border-subtle);
          display:flex; align-items:center; justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-dim)" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
      `}

      <div style="flex:1; min-width:0;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-family:'DM Sans',sans-serif; font-size:14px;
            font-weight:600; color:var(--white);">${svc.name}</span>
          ${!svc.active ? `<span style="font-family:'DM Sans',sans-serif;
            font-size:10px; font-weight:600; color:#ff6b6b;
            border:1px solid rgba(255,107,107,0.3); padding:1px 7px;
            letter-spacing:0.06em; text-transform:uppercase;">HIDDEN</span>` : ''}
        </div>
        <div style="font-family:'DM Sans',sans-serif; font-size:12px;
          color:var(--text-muted); margin-top:3px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          max-width:500px;">
          ${svc.description?.substring(0, 90)}${svc.description?.length > 90 ? '...' : ''}
        </div>
      </div>

      <div style="display:flex; gap:8px; flex-shrink:0;">
        <button class="btn-admin-secondary" data-action="toggle"
          data-id="${svc.id}" data-active="${svc.active}"
          style="padding:6px 12px; font-size:11px;">
          ${svc.active ? 'Hide' : 'Show'}
        </button>
        <button class="btn-admin-secondary" data-action="edit"
          data-id="${svc.id}" style="padding:6px 12px; font-size:11px;">
          Edit
        </button>
      </div>
    </div>
  `).join('');

  list.addEventListener('click', handleListAction);

  initDragReorder(list, async (orderedIds) => {
    try {
      await adminFetch('/api/admin/reorderItems', {
        table: 'studio_services',
        items: orderedIds.map((id, i) => ({ id, position: i }))
      });
      orderedIds.forEach((id, i) => {
        const svc = services.find(s => s.id === id);
        if (svc) svc.position = i;
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

  if (action === 'edit') openForm(id);

  if (action === 'toggle') {
    const svc = services.find(s => s.id === id);
    if (!svc) return;
    try {
      await adminFetch('/api/admin/saveService', { id, active: !svc.active });
      svc.active = !svc.active;
      renderServicesList();
      showToast(svc.active ? 'Service shown' : 'Service hidden', 'success');
    } catch(err) {
      showToast('Failed to update', 'error');
    }
  }
}

function openForm(id) {
  editingId = id;
  formDirty = false;
  pendingImageUrl = null;
  const wrap = document.getElementById('service-form-wrap');
  wrap.style.display = 'block';
  const svc = services.find(s => s.id === id);
  if (svc) {
    document.getElementById('svc-name').value = svc.name || '';
    document.getElementById('svc-description').value = svc.description || '';
    document.getElementById('svc-active').checked = svc.active !== false;
    document.getElementById('service-form-title').textContent =
      `Edit: ${svc.name}`;
    document.getElementById('service-form').dataset.currentImageUrl =
      svc.image_url || '';
    if (svc.image_url) {
      showImagePreview(svc.image_url);
    } else {
      hideImagePreview();
    }
  }
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeForm() {
  editingId = null;
  formDirty = false;
  pendingImageUrl = null;
  markSaved();
  document.getElementById('service-form-wrap').style.display = 'none';
}

function setFormDirty() {
  if (!formDirty) {
    formDirty = true;
    markUnsaved(
      () => saveService(),
      () => { formDirty = false; closeForm(); }
    );
  }
}

async function handleImageFile(file) {
  if (!file) return;
  const status = document.getElementById('svc-image-upload-status');
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
  document.getElementById('svc-image-preview').src = url;
  document.getElementById('svc-image-preview-wrap').style.display = 'block';
  document.getElementById('svc-image-upload-area').style.display = 'none';
}

function hideImagePreview() {
  document.getElementById('svc-image-preview').src = '';
  document.getElementById('svc-image-preview-wrap').style.display = 'none';
  document.getElementById('svc-image-upload-area').style.display = 'block';
}

async function removeSvcImage() {
  const confirmed = await showConfirm(
    'Remove Image',
    'Remove this service image?',
    'Remove',
    true
  );
  if (!confirmed) return;
  const currentUrl = document.getElementById('service-form').dataset.currentImageUrl;
  if (currentUrl?.includes('studio-images')) {
    await deleteImageFromStorage(currentUrl).catch(() => {});
  }
  pendingImageUrl = 'REMOVE';
  hideImagePreview();
  setFormDirty();
}

async function saveService() {
  const name = document.getElementById('svc-name')?.value?.trim();
  const description = document.getElementById('svc-description')?.value?.trim();
  if (!name || !description) {
    showToast('Name and description are required', 'error');
    return;
  }

  const saveBtn = document.getElementById('save-service-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

  try {
    const currentUrl = document.getElementById('service-form').dataset.currentImageUrl;
    let imageUrl;
    if (pendingImageUrl === 'REMOVE') imageUrl = null;
    else if (pendingImageUrl) imageUrl = pendingImageUrl;
    else imageUrl = currentUrl || null;

    await adminFetch('/api/admin/saveService', {
      id: editingId,
      name,
      description,
      image_url: imageUrl,
      active: document.getElementById('svc-active').checked,
    });

    pendingImageUrl = null;
    formDirty = false;
    markSaved();
    closeForm();
    await loadServices();
    showToast('Service updated', 'success');
  } catch(err) {
    showToast('Failed to save: ' + err.message, 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Service'; }
  }
}

function handleSave() {
  const wrap = document.getElementById('service-form-wrap');
  if (wrap?.style.display !== 'none' && formDirty) saveService();
}

function handleDiscard() {
  formDirty = false;
  closeForm();
}
