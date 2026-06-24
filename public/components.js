const SUPABASE_URL = 'https://trtseeytryqwwkoqtkvp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRydHNlZXl0cnlxd3drb3F0a3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNzk2MTUsImV4cCI6MjA5Nzc1NTYxNX0.NjkB2bkn6V-Vz1vfc_Pu0p8c5hXa7i0UpFE7dqKhYeA';

export async function supabaseFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  return res.json();
}

export async function initNav(activePage) {
  const leftPages = [
    { label: 'Home',            href: '/index.html',           key: 'home',            navKey: 'nav_show_home' },
    { label: 'Services',        href: '/services.html',         key: 'services',        navKey: 'nav_show_services' },
    { label: 'Meet Your Coach', href: '/meet-your-coach.html',  key: 'meet',            navKey: 'nav_show_meet' },
  ];
  const rightPages = [
    { label: 'New Client Registration', href: '/new-clients.html',    key: 'new-clients',     navKey: 'nav_show_new_clients' },
    { label: 'Student Portal',          href: '/student-portal.html', key: 'student-portal',  navKey: 'nav_show_student_portal' },
    { label: 'Contact',                 href: '/contact.html',            key: 'contact',              navKey: 'nav_show_contact' },
    { label: 'Past Productions',        href: '/past-productions.html',    key: 'past-productions',     navKey: 'nav_show_past_productions' },
    { label: "The Performer's Lab",     href: 'https://performers-lab.com', key: 'performers-lab',      navKey: 'nav_show_performers_lab', external: true },
  ];

  const allPages = [...leftPages, ...rightPages];

  const navHTML = `
    <header class="site-header">
      <nav class="nav-bar" aria-label="Main navigation">
        ${allPages.map(p => `
          <a href="${p.href}"
            data-nav-key="${p.navKey}"
            ${p.key === activePage ? ' class="active" aria-current="page"' : ''}
            ${p.external ? ' target="_blank" rel="noopener"' : ''}
          >${p.label}</a>
        `).join('')}
      </nav>
      <div class="logo-bar">
        <a href="/index.html" aria-label="Sound Advice Vocal Studio — Home">
          <img src="https://static.wixstatic.com/media/23043d_9cbf6867b112498ea07b1bfb7e3ca04b~mv2.jpg" alt="Sound Advice Vocal Studio" />
        </a>
      </div>
    </header>
  `;

  const footerHTML = `
    <footer class="site-footer">
      <div class="footer-badge">
        <img src="https://static.wixstatic.com/media/23043d_7b4e3ff7e2864e3ab188e7209775df5d~mv2.png" alt="Vocal Health Education Member" />
      </div>
      <div class="footer-center">
        <div class="footer-socials">
          <a href="https://www.instagram.com/soundadvicestudio" target="_blank" rel="noopener" aria-label="Instagram" data-social="instagram">
            <img src="https://static.wixstatic.com/media/11062b_55e4be1e75564866b6c28290f9a9d271~mv2.png" alt="Instagram" />
          </a>
          <a href="https://www.facebook.com/soundadvicestudio" target="_blank" rel="noopener" aria-label="Facebook" data-social="facebook">
            <img src="https://static.wixstatic.com/media/11062b_2381e8a6e7444f4f902e7b649aa3f0ac~mv2.png" alt="Facebook" />
          </a>
          <a href="https://www.tiktok.com/@soundadvicestudio" target="_blank" rel="noopener" aria-label="TikTok" data-social="tiktok">
            <img src="https://static.wixstatic.com/media/11062b_8e8bb1bfaeb54186ace77d5ab14933ff~mv2.png" alt="TikTok" />
          </a>
        </div>
        <p class="footer-copy">©2026 SOUND ADVICE VOCAL STUDIO LLC - All rights reserved.</p>
      </div>
      <div class="footer-badge">
        <img src="https://static.wixstatic.com/media/23043d_4614fb47600441c198bfbbfe93e2265e~mv2.png" alt="NATS — National Association of Teachers of Singing" />
      </div>
    </footer>
  `;

  // Render nav and footer synchronously — visible immediately
  const headerEl = document.getElementById('site-header');
  if (headerEl) headerEl.outerHTML = navHTML;
  const footerEl = document.getElementById('site-footer');
  if (footerEl) footerEl.outerHTML = footerHTML;

  // Fetch studio_content to apply visibility toggles and dynamic hrefs.
  // Fail-open: any error leaves content = {} so all checks below are no-ops
  // and all links/icons remain fully visible.
  let content = {};
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/studio_content?select=key,value`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    if (res.ok) {
      const rows = await res.json();
      content = Object.fromEntries(rows.map(r => [r.key, r.value]));
    }
  } catch(e) {
    console.warn('Nav settings fetch failed — all links defaulting to visible:', e);
  }

  // Nav link visibility — hide if value is exactly the string 'false'
  allPages.forEach(p => {
    if (content[p.navKey] === 'false') {
      const link = document.querySelector(`[data-nav-key="${p.navKey}"]`);
      if (link) link.style.display = 'none';
    }
  });

  // Performer's Lab href — set from studio_content, fall back to default
  const labLink = document.querySelector('[data-nav-key="nav_show_performers_lab"]');
  if (labLink && content.performers_lab_cta_url) {
    labLink.href = content.performers_lab_cta_url;
  }

  // Footer social icon visibility
  const socialKeys = {
    instagram: 'footer_show_instagram',
    facebook:  'footer_show_facebook',
    tiktok:    'footer_show_tiktok',
  };
  Object.entries(socialKeys).forEach(([social, key]) => {
    if (content[key] === 'false') {
      const link = document.querySelector(`[data-social="${social}"]`);
      if (link) link.style.display = 'none';
    }
  });
}
