import {
  adminFetch,
  supabaseFetch,
  showToast
} from './adminCore.js';

const NAV_KEYS = [
  { key: 'nav_show_home',            label: 'Home' },
  { key: 'nav_show_services',        label: 'Services' },
  { key: 'nav_show_meet',            label: 'Meet Your Coach' },
  { key: 'nav_show_new_clients',     label: 'New Client Registration' },
  { key: 'nav_show_student_portal',  label: 'Student Portal' },
  { key: 'nav_show_contact',         label: 'Contact' },
  { key: 'nav_show_performers_lab',  label: "The Performer's Lab" },
];

const FOOTER_KEYS = [
  { key: 'footer_show_instagram', label: 'Instagram' },
  { key: 'footer_show_facebook',  label: 'Facebook' },
  { key: 'footer_show_tiktok',    label: 'TikTok' },
];

function buildToggleRow(key, label, checked) {
  return `
    <div class="admin-toggle-row" data-key="${key}">
      <div>
        <div class="admin-toggle-label">${label}</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" class="settings-toggle"
          data-key="${key}" ${checked ? 'checked' : ''} />
        <span class="toggle-track"></span>
      </label>
    </div>
  `;
}

export async function initSettingsSection() {
  const section = document.getElementById('section-settings');
  section.innerHTML = `
    <div class="admin-section-heading">Site Settings</div>
    <p class="admin-section-sub">
      Control which navigation links and social icons are visible on the site.
      Changes take effect immediately on the public site after the next page load.
    </p>

    <div class="admin-card" style="margin-bottom: 24px;">
      <div class="admin-card-header">
        <div class="admin-card-title">Navigation Links</div>
      </div>
      <div id="nav-toggles-wrap">
        <div class="admin-loading"><div class="admin-spinner"></div></div>
      </div>
    </div>

    <div class="admin-card">
      <div class="admin-card-header">
        <div class="admin-card-title">Footer Social Links</div>
      </div>
      <div id="footer-toggles-wrap">
        <div class="admin-loading"><div class="admin-spinner"></div></div>
      </div>
    </div>
  `;

  // Load current values
  let contentMap = {};
  try {
    const rows = await supabaseFetch('studio_content?select=key,value');
    rows.forEach(r => { contentMap[r.key] = r.value; });
  } catch(e) {
    showToast('Failed to load settings', 'error');
    return;
  }

  // Render nav toggles
  const navWrap = document.getElementById('nav-toggles-wrap');
  navWrap.innerHTML = NAV_KEYS.map(({ key, label }) => {
    const val = contentMap[key];
    const checked = val !== 'false'; // missing or 'true' = ON
    return buildToggleRow(key, label, checked);
  }).join('');

  // Render footer toggles
  const footerWrap = document.getElementById('footer-toggles-wrap');
  footerWrap.innerHTML = FOOTER_KEYS.map(({ key, label }) => {
    const val = contentMap[key];
    const checked = val !== 'false';
    return buildToggleRow(key, label, checked);
  }).join('');

  // Wire all toggles — save immediately on change
  document.getElementById('section-settings').addEventListener('change', async (e) => {
    const toggle = e.target.closest('.settings-toggle');
    if (!toggle) return;

    const key = toggle.dataset.key;
    const value = toggle.checked ? 'true' : 'false';

    // Optimistically update local map
    contentMap[key] = value;

    try {
      await adminFetch('/api/admin/saveContent', { key, value });
      const isNav = NAV_KEYS.some(k => k.key === key);
      showToast(isNav ? 'Nav updated' : 'Footer updated', 'success');
    } catch(e) {
      // Revert toggle on failure
      toggle.checked = !toggle.checked;
      contentMap[key] = toggle.checked ? 'true' : 'false';
      showToast('Failed to save setting', 'error');
    }
  });
}
