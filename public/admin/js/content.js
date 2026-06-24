import {
  adminFetch,
  supabaseFetch,
  showToast,
  markUnsaved,
  markSaved,
  showConfirm
} from './adminCore.js';
import { uploadImageToStorage, openCropTool } from '../imageUploader.js';

// ── SHARED CONTENT LOADER ────────────────────────────────────────────────────

async function loadContentMap() {
  const rows = await supabaseFetch('studio_content?select=key,value');
  const map = {};
  rows.forEach(r => { map[r.key] = r.value; });
  return map;
}

async function saveKey(key, value) {
  await adminFetch('/api/admin/saveContent', { key, value });
}

// ── MARKDOWN BOLD RENDERER ───────────────────────────────────────────────────

function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?!\*)(.+?)(?<!\*)\*/g, '<em>$1</em>');
}

// ── HERO SECTION ─────────────────────────────────────────────────────────────

export async function initHeroSection() {
  const section = document.getElementById('section-hero');
  section.innerHTML = `
    <div class="admin-section-heading">Hero</div>
    <p class="admin-section-sub">
      Edit the headline and body text shown in the hero section on the home page.
    </p>
    <div class="admin-card" id="hero-card">
      <div class="admin-form" id="hero-form">

        <div class="admin-field">
          <label class="admin-label" for="hero-headline-input">Headline</label>
          <input class="admin-input" type="text" id="hero-headline-input"
            placeholder="e.g. Realize Your Vocal Potential" />
          <p class="admin-field-hint">
            Displayed in large Anton font at the top of the home page.
          </p>
        </div>

        <div class="admin-field">
          <label class="admin-label" for="hero-body-input">Body Text</label>
          <textarea class="admin-textarea" id="hero-body-input"
            style="min-height: 100px;"
            placeholder="Describe the studio in one or two sentences..."></textarea>
          <p class="admin-field-hint">
            Use **bold** for bold text. Shown in the teal card below the headline.
          </p>
        </div>

        <div class="admin-field" id="hero-preview-wrap" style="display:none;">
          <label class="admin-label">Body Text Preview</label>
          <div id="hero-preview" style="
            background: rgba(74,138,147,0.15);
            border: 1px solid rgba(74,138,147,0.3);
            padding: 14px 16px;
            font-family: 'DM Sans', sans-serif;
            font-size: 14px;
            color: var(--text-body);
            line-height: 1.6;
          "></div>
        </div>

        <div style="display:flex; justify-content:flex-end; padding-top:8px;">
          <button class="btn-admin-primary" id="hero-save-btn">Save Hero</button>
        </div>
      </div>
    </div>
  `;

  let content = {};
  try {
    content = await loadContentMap();
  } catch(e) {
    showToast('Failed to load content', 'error');
  }

  const headlineEl = document.getElementById('hero-headline-input');
  const bodyEl = document.getElementById('hero-body-input');
  const previewEl = document.getElementById('hero-preview');
  const previewWrap = document.getElementById('hero-preview-wrap');
  const saveBtn = document.getElementById('hero-save-btn');

  headlineEl.value = content['hero_headline'] || '';
  bodyEl.value = content['hero_body'] || '';

  let formDirty = false;

  function updatePreview() {
    const val = bodyEl.value.trim();
    if (val) {
      previewEl.innerHTML = renderMarkdown(val);
      previewWrap.style.display = 'block';
    } else {
      previewWrap.style.display = 'none';
    }
  }
  updatePreview();

  function setDirty() {
    if (!formDirty) {
      formDirty = true;
      markUnsaved(() => saveHero(), () => {
        headlineEl.value = content['hero_headline'] || '';
        bodyEl.value = content['hero_body'] || '';
        updatePreview();
        formDirty = false;
      });
    }
  }

  headlineEl.addEventListener('input', setDirty);
  bodyEl.addEventListener('input', () => { setDirty(); updatePreview(); });

  async function saveHero() {
    if (!formDirty) return;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      await saveKey('hero_headline', headlineEl.value.trim());
      await saveKey('hero_body', bodyEl.value.trim());
      content['hero_headline'] = headlineEl.value.trim();
      content['hero_body'] = bodyEl.value.trim();
      formDirty = false;
      markSaved();
      showToast('Hero saved', 'success');
    } catch(e) {
      showToast('Failed to save hero: ' + e.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Hero';
    }
  }

  saveBtn.addEventListener('click', saveHero);

  document.addEventListener('admin:save', () => {
    if (formDirty) saveHero();
  });
  document.addEventListener('admin:discard', () => {
    if (formDirty) {
      headlineEl.value = content['hero_headline'] || '';
      bodyEl.value = content['hero_body'] || '';
      updatePreview();
      formDirty = false;
    }
  });
}

// ── BIO & APPROACH SECTION ───────────────────────────────────────────────────

export async function initBioSection() {
  const section = document.getElementById('section-bio');
  section.innerHTML = `
    <div class="admin-section-heading">Bio &amp; Approach</div>
    <p class="admin-section-sub">
      Edit the Meet Your Coach biography and My Approach paragraphs.
      Use **bold** for bold text and *italic* for italic text.
      Leave a paragraph blank to hide it on the page — up to 6 bio and
      6 approach paragraphs are supported.
    </p>

    <div class="admin-card" style="margin-bottom: 24px;">
      <div class="admin-card-header">
        <div class="admin-card-title">Coach Photo</div>
      </div>
      <div class="admin-form">
        <div class="admin-field">
          <label class="admin-label">
            Portrait Photo
            <span class="optional">shown on the Meet Your Coach page</span>
          </label>
          <div id="coach-photo-preview-wrap" style="margin-bottom: 12px; display: none;">
            <img id="coach-photo-preview" src="" alt="Coach portrait"
              style="width: 200px; height: auto; border-radius: 6px; display: block;
                     border: 1px solid var(--border-subtle);" />
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button type="button" class="btn-admin-secondary" id="coach-photo-upload-btn"
              style="padding: 8px 16px; font-size: 13px;">Upload Photo</button>
            <div id="coach-photo-upload-status" style="font-family: 'DM Sans', sans-serif;
              font-size: 12px; color: var(--text-muted);"></div>
          </div>
          <input type="file" id="coach-photo-file-input"
            accept="image/jpeg,image/png,image/webp" style="display: none;" />
          <p class="admin-field-hint">
            Upload replaces immediately — no separate Save button needed.
          </p>
        </div>
      </div>
    </div>

    <div class="admin-card" style="margin-bottom: 24px;">
      <div class="admin-card-header">
        <div class="admin-card-title">Meet Your Coach — Biography</div>
      </div>
      <div class="admin-form" id="bio-form">
        ${[1,2,3,4,5,6].map(n => `
          <div class="admin-field">
            <label class="admin-label" for="bio-para-${n}">
              Paragraph ${n}
              <span class="optional">leave blank to hide</span>
            </label>
            <textarea class="admin-textarea" id="bio-para-${n}"
              style="min-height: 100px;"
              placeholder="Biography paragraph ${n}..."></textarea>
            <div class="bio-preview" id="bio-preview-${n}" style="
              display:none;
              background: rgba(255,255,255,0.04);
              border-left: 2px solid var(--border-mid);
              padding: 10px 14px;
              font-family: 'DM Sans', sans-serif;
              font-size: 13px;
              color: var(--text-muted);
              line-height: 1.6;
              margin-top: 6px;
            "></div>
          </div>
        `).join('')}
        <div style="display:flex; justify-content:flex-end; padding-top:8px;">
          <button class="btn-admin-primary" id="bio-save-btn">Save Biography</button>
        </div>
      </div>
    </div>

    <div class="admin-card">
      <div class="admin-card-header">
        <div class="admin-card-title">My Approach</div>
      </div>
      <div class="admin-form" id="approach-form">
        ${[1,2,3,4,5,6].map(n => `
          <div class="admin-field">
            <label class="admin-label" for="approach-para-${n}">
              Paragraph ${n}
              <span class="optional">leave blank to hide</span>
            </label>
            <textarea class="admin-textarea" id="approach-para-${n}"
              style="min-height: 100px;"
              placeholder="Approach paragraph ${n}..."></textarea>
            <div class="bio-preview" id="approach-preview-${n}" style="
              display:none;
              background: rgba(255,255,255,0.04);
              border-left: 2px solid var(--border-mid);
              padding: 10px 14px;
              font-family: 'DM Sans', sans-serif;
              font-size: 13px;
              color: var(--text-muted);
              line-height: 1.6;
              margin-top: 6px;
            "></div>
          </div>
        `).join('')}
        <div style="display:flex; justify-content:flex-end; padding-top:8px;">
          <button class="btn-admin-primary" id="approach-save-btn">Save Approach</button>
        </div>
      </div>
    </div>
  `;

  let content = {};
  try {
    content = await loadContentMap();
  } catch(e) {
    showToast('Failed to load content', 'error');
  }

  // ── COACH PHOTO ──────────────────────────────────────────────────────────
  const photoPreviewWrap = document.getElementById('coach-photo-preview-wrap');
  const photoPreview = document.getElementById('coach-photo-preview');
  const photoUploadBtn = document.getElementById('coach-photo-upload-btn');
  const photoFileInput = document.getElementById('coach-photo-file-input');
  const photoStatus = document.getElementById('coach-photo-upload-status');

  if (content['coach_photo_url']) {
    photoPreview.src = content['coach_photo_url'];
    photoPreviewWrap.style.display = 'block';
  }

  photoUploadBtn.addEventListener('click', () => photoFileInput.click());
  photoFileInput.addEventListener('change', async () => {
    const file = photoFileInput.files[0];
    if (!file) return;
    photoStatus.textContent = 'Opening crop tool...';
    try {
      const cropped = await openCropTool(file, { aspectRatio: null });
      photoStatus.textContent = 'Uploading...';
      const url = await uploadImageToStorage(cropped, msg => { photoStatus.textContent = msg; }, 'coach-photo/portrait.jpg');
      await saveKey('coach_photo_url', url);
      content['coach_photo_url'] = url;
      photoPreview.src = url;
      photoPreviewWrap.style.display = 'block';
      photoStatus.textContent = 'Photo saved.';
      showToast('Coach photo updated', 'success');
    } catch(e) {
      if (e.message !== 'Crop cancelled') {
        photoStatus.textContent = 'Upload failed: ' + e.message;
        showToast('Photo upload failed', 'error');
      } else {
        photoStatus.textContent = '';
      }
    }
    photoFileInput.value = '';
  });

  let bioDirty = false;
  let approachDirty = false;

  // Populate bio fields and wire previews
  [1,2,3,4,5,6].forEach(n => {
    const ta = document.getElementById(`bio-para-${n}`);
    const prev = document.getElementById(`bio-preview-${n}`);
    ta.value = content[`bio_para_${n}`] || '';

    function updatePreview() {
      const val = ta.value.trim();
      if (val) {
        prev.innerHTML = renderMarkdown(val);
        prev.style.display = 'block';
      } else {
        prev.style.display = 'none';
      }
    }
    updatePreview();

    ta.addEventListener('input', () => {
      updatePreview();
      if (!bioDirty) {
        bioDirty = true;
        markUnsaved(
          () => saveBio(),
          () => {
            [1,2,3,4,5,6].forEach(i => {
              document.getElementById(`bio-para-${i}`).value =
                content[`bio_para_${i}`] || '';
              const p = document.getElementById(`bio-preview-${i}`);
              const v = content[`bio_para_${i}`] || '';
              p.innerHTML = v ? renderMarkdown(v) : '';
              p.style.display = v ? 'block' : 'none';
            });
            bioDirty = false;
          }
        );
      }
    });
  });

  // Populate approach fields and wire previews
  [1,2,3,4,5,6].forEach(n => {
    const ta = document.getElementById(`approach-para-${n}`);
    const prev = document.getElementById(`approach-preview-${n}`);
    ta.value = content[`approach_para_${n}`] || '';

    function updatePreview() {
      const val = ta.value.trim();
      if (val) {
        prev.innerHTML = renderMarkdown(val);
        prev.style.display = 'block';
      } else {
        prev.style.display = 'none';
      }
    }
    updatePreview();

    ta.addEventListener('input', () => {
      updatePreview();
      if (!approachDirty) {
        approachDirty = true;
        markUnsaved(
          () => saveApproach(),
          () => {
            [1,2,3,4,5,6].forEach(i => {
              document.getElementById(`approach-para-${i}`).value =
                content[`approach_para_${i}`] || '';
              const p = document.getElementById(`approach-preview-${i}`);
              const v = content[`approach_para_${i}`] || '';
              p.innerHTML = v ? renderMarkdown(v) : '';
              p.style.display = v ? 'block' : 'none';
            });
            approachDirty = false;
          }
        );
      }
    });
  });

  // Save bio (all 6 paragraphs in parallel)
  const bioSaveBtn = document.getElementById('bio-save-btn');
  async function saveBio() {
    if (!bioDirty) return;
    bioSaveBtn.disabled = true;
    bioSaveBtn.textContent = 'Saving...';
    try {
      await Promise.all([1,2,3,4,5,6].map(n => {
        const val = document.getElementById(`bio-para-${n}`).value.trim();
        content[`bio_para_${n}`] = val;
        return saveKey(`bio_para_${n}`, val);
      }));
      bioDirty = false;
      markSaved();
      showToast('Biography saved', 'success');
    } catch(e) {
      showToast('Failed to save biography: ' + e.message, 'error');
    } finally {
      bioSaveBtn.disabled = false;
      bioSaveBtn.textContent = 'Save Biography';
    }
  }
  bioSaveBtn.addEventListener('click', saveBio);

  // Save approach (all 6 paragraphs in parallel)
  const approachSaveBtn = document.getElementById('approach-save-btn');
  async function saveApproach() {
    if (!approachDirty) return;
    approachSaveBtn.disabled = true;
    approachSaveBtn.textContent = 'Saving...';
    try {
      await Promise.all([1,2,3,4,5,6].map(n => {
        const val = document.getElementById(`approach-para-${n}`).value.trim();
        content[`approach_para_${n}`] = val;
        return saveKey(`approach_para_${n}`, val);
      }));
      approachDirty = false;
      markSaved();
      showToast('Approach saved', 'success');
    } catch(e) {
      showToast('Failed to save approach: ' + e.message, 'error');
    } finally {
      approachSaveBtn.disabled = false;
      approachSaveBtn.textContent = 'Save Approach';
    }
  }
  approachSaveBtn.addEventListener('click', saveApproach);

  // Banner save/discard
  document.addEventListener('admin:save', () => {
    if (bioDirty) saveBio();
    if (approachDirty) saveApproach();
  });
  document.addEventListener('admin:discard', () => {
    if (bioDirty) {
      [1,2,3,4,5,6].forEach(i => {
        document.getElementById(`bio-para-${i}`).value =
          content[`bio_para_${i}`] || '';
        const p = document.getElementById(`bio-preview-${i}`);
        const v = content[`bio_para_${i}`] || '';
        p.innerHTML = v ? renderMarkdown(v) : '';
        p.style.display = v ? 'block' : 'none';
      });
      bioDirty = false;
    }
    if (approachDirty) {
      [1,2,3,4,5,6].forEach(i => {
        document.getElementById(`approach-para-${i}`).value =
          content[`approach_para_${i}`] || '';
        const p = document.getElementById(`approach-preview-${i}`);
        const v = content[`approach_para_${i}`] || '';
        p.innerHTML = v ? renderMarkdown(v) : '';
        p.style.display = v ? 'block' : 'none';
      });
      approachDirty = false;
    }
  });
}

// ── CONTACT INFO SECTION ─────────────────────────────────────────────────────

export async function initContactSection() {
  const section = document.getElementById('section-contact');
  section.innerHTML = `
    <div class="admin-section-heading">Contact Info</div>
    <p class="admin-section-sub">
      Edit the contact details shown on the Contact page.
    </p>

    <div class="admin-card">
      <div class="admin-form" id="contact-form">

        <div class="admin-field">
          <label class="admin-label" for="contact-email-input">Email Address</label>
          <input class="admin-input" type="email" id="contact-email-input"
            placeholder="alittlesoundadvice@gmail.com" />
        </div>

        <div class="admin-row">
          <div class="admin-field">
            <label class="admin-label" for="contact-addr1-input">Address Line 1</label>
            <input class="admin-input" type="text" id="contact-addr1-input"
              placeholder="e.g. 880 Lafayette St." />
          </div>
          <div class="admin-field">
            <label class="admin-label" for="contact-addr2-input">Address Line 2</label>
            <input class="admin-input" type="text" id="contact-addr2-input"
              placeholder="e.g. Mandeville, LA 70448" />
          </div>
        </div>

        <div class="admin-field">
          <label class="admin-label" for="contact-studio-note-input">
            Studio Location Note
            <span class="optional">shown below the address</span>
          </label>
          <textarea class="admin-textarea" id="contact-studio-note-input"
            style="min-height: 70px;"
            placeholder="e.g. All coaching sessions take place at 30 by Ninety Theatre..."></textarea>
        </div>

        <div class="admin-field">
          <label class="admin-label" for="contact-virtual-note-input">
            Virtual Note
            <span class="optional">shown below the studio note</span>
          </label>
          <textarea class="admin-textarea" id="contact-virtual-note-input"
            style="min-height: 70px;"
            placeholder="e.g. Virtual coaching options also available..."></textarea>
        </div>

        <div class="admin-field">
          <label class="admin-label" for="contact-signature-input">
            Email Reply Signature
            <span class="optional">appended to every reply sent from the inbox</span>
          </label>
          <textarea class="admin-textarea" id="contact-signature-input"
            style="min-height: 90px;"
            placeholder="e.g. Jonathan Sturcken&#10;Sound Advice Vocal Studio&#10;alittlesoundadvice.com">
          </textarea>
          <p class="admin-field-hint">
            Plain text only. Line breaks are preserved. Shown below every reply email.
          </p>
        </div>

        <div style="display:flex; justify-content:flex-end; padding-top:8px;">
          <button class="btn-admin-primary" id="contact-save-btn">
            Save Contact Info
          </button>
        </div>

      </div>
    </div>
  `;

  let content = {};
  try {
    content = await loadContentMap();
  } catch(e) {
    showToast('Failed to load content', 'error');
  }

  const fields = {
    'contact_email':         document.getElementById('contact-email-input'),
    'contact_address_line1': document.getElementById('contact-addr1-input'),
    'contact_address_line2': document.getElementById('contact-addr2-input'),
    'contact_studio_note':   document.getElementById('contact-studio-note-input'),
    'contact_virtual_note':  document.getElementById('contact-virtual-note-input'),
    'reply_signature':       document.getElementById('contact-signature-input'),
  };

  // Populate
  Object.entries(fields).forEach(([key, el]) => {
    el.value = content[key] || '';
  });

  let formDirty = false;
  const saveBtn = document.getElementById('contact-save-btn');

  function setDirty() {
    if (!formDirty) {
      formDirty = true;
      markUnsaved(
        () => saveContact(),
        () => {
          Object.entries(fields).forEach(([key, el]) => {
            el.value = content[key] || '';
          });
          formDirty = false;
        }
      );
    }
  }

  Object.values(fields).forEach(el => {
    el.addEventListener('input', setDirty);
  });

  async function saveContact() {
    if (!formDirty) return;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      await Promise.all(
        Object.entries(fields).map(([key, el]) => {
          const val = el.value.trim();
          content[key] = val;
          return saveKey(key, val);
        })
      );
      formDirty = false;
      markSaved();
      showToast('Contact info saved', 'success');
    } catch(e) {
      showToast('Failed to save contact info: ' + e.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Contact Info';
    }
  }

  saveBtn.addEventListener('click', saveContact);

  document.addEventListener('admin:save', () => {
    if (formDirty) saveContact();
  });
  document.addEventListener('admin:discard', () => {
    if (formDirty) {
      Object.entries(fields).forEach(([key, el]) => {
        el.value = content[key] || '';
      });
      formDirty = false;
    }
  });
}
