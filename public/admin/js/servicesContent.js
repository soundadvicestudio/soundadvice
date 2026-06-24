import {
  adminFetch,
  supabaseFetch,
  showToast,
  markUnsaved,
  markSaved
} from './adminCore.js';

async function loadContentMap() {
  const rows = await supabaseFetch('studio_content?select=key,value');
  const map = {};
  rows.forEach(r => { map[r.key] = r.value; });
  return map;
}

async function saveKey(key, value) {
  await adminFetch('/api/admin/saveContent', { key, value });
}

// Appends the Services page intro fields to the bottom of #hero-card.
// Must run after initHeroSection() so that #hero-card exists in the DOM.
export async function initServicesContentSection() {
  const heroCard = document.getElementById('hero-card');
  if (!heroCard) return;

  const divider = document.createElement('div');
  divider.style.cssText = `
    border-top: 1px solid var(--border-subtle);
    margin: 24px 0 20px;
  `;

  const subheading = document.createElement('div');
  subheading.className = 'admin-card-title';
  subheading.style.marginBottom = '20px';
  subheading.textContent = 'Services Page — Intro Text';

  const fields = document.createElement('div');
  fields.className = 'admin-form';
  fields.innerHTML = `
    <div class="admin-field">
      <label class="admin-label" for="svc-intro-heading-input">
        Intro Heading
      </label>
      <input class="admin-input" type="text" id="svc-intro-heading-input"
        placeholder="e.g. Your Voice, Your Growth, Our Expertise" />
    </div>
    <div class="admin-field">
      <label class="admin-label" for="svc-intro-body-input">
        Intro Paragraph
      </label>
      <textarea class="admin-textarea" id="svc-intro-body-input"
        style="min-height: 100px;"
        placeholder="Introductory text shown at the top of the Services page..."></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; padding-top:8px;">
      <button class="btn-admin-primary" id="svc-intro-save-btn">
        Save Services Intro
      </button>
    </div>
  `;

  heroCard.appendChild(divider);
  heroCard.appendChild(subheading);
  heroCard.appendChild(fields);

  let content = {};
  try {
    content = await loadContentMap();
  } catch(e) {
    showToast('Failed to load services intro', 'error');
  }

  const headingEl = document.getElementById('svc-intro-heading-input');
  const bodyEl = document.getElementById('svc-intro-body-input');
  const saveBtn = document.getElementById('svc-intro-save-btn');

  headingEl.value = content['services_intro_heading'] || '';
  bodyEl.value = content['services_intro_body'] || '';

  let formDirty = false;

  function setDirty() {
    if (!formDirty) {
      formDirty = true;
      markUnsaved(
        () => saveServicesIntro(),
        () => {
          headingEl.value = content['services_intro_heading'] || '';
          bodyEl.value = content['services_intro_body'] || '';
          formDirty = false;
        }
      );
    }
  }

  headingEl.addEventListener('input', setDirty);
  bodyEl.addEventListener('input', setDirty);

  async function saveServicesIntro() {
    if (!formDirty) return;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      await saveKey('services_intro_heading', headingEl.value.trim());
      await saveKey('services_intro_body', bodyEl.value.trim());
      content['services_intro_heading'] = headingEl.value.trim();
      content['services_intro_body'] = bodyEl.value.trim();
      formDirty = false;
      markSaved();
      showToast('Services intro saved', 'success');
    } catch(e) {
      showToast('Failed to save services intro: ' + e.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Services Intro';
    }
  }

  saveBtn.addEventListener('click', saveServicesIntro);

  document.addEventListener('admin:save', () => {
    if (formDirty) saveServicesIntro();
  });
  document.addEventListener('admin:discard', () => {
    if (formDirty) {
      headingEl.value = content['services_intro_heading'] || '';
      bodyEl.value = content['services_intro_body'] || '';
      formDirty = false;
    }
  });
}
