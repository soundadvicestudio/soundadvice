const SUPABASE_URL = 'https://trtseeytryqwwkoqtkvp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_E8g0Q5cZxzMHsMYje3SmGw_QdoOeaUT';

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

export function initNav(activePage) {
  const leftPages = [
    { label: 'Home',     href: '/index.html',          key: 'home' },
    { label: 'Services', href: '/services.html',        key: 'services' },
    { label: 'Meet Your Coach', href: '/meet-your-coach.html', key: 'meet' },
  ];
  const rightPages = [
    { label: 'New Client Registration', href: '/new-clients.html',    key: 'new-clients' },
    { label: 'Student Portal',          href: '/student-portal.html', key: 'student-portal' },
    { label: 'Contact',                 href: '/contact.html',        key: 'contact' },
  ];

  const navHTML = `
    <header class="site-header">
      <nav class="nav-bar" aria-label="Main navigation">
        ${[...leftPages, ...rightPages].map(p => `
          <a href="${p.href}"${p.key === activePage ? ' class="active" aria-current="page"' : ''}>${p.label}</a>
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
        <img src="https://static.wixstatic.com/media/23043d_4614fb47600441c198bfbbfe93e2265e~mv2.png" alt="NATS — National Association of Teachers of Singing" />
      </div>
      <div class="footer-center">
        <div class="footer-socials">
          <a href="https://www.instagram.com/soundadvicestudio" target="_blank" rel="noopener" aria-label="Instagram">
            <img src="https://static.wixstatic.com/media/11062b_55e4be1e75564866b6c28290f9a9d271~mv2.png" alt="Instagram" />
          </a>
          <a href="https://www.facebook.com/soundadvicestudio" target="_blank" rel="noopener" aria-label="Facebook">
            <img src="https://static.wixstatic.com/media/11062b_2381e8a6e7444f4f902e7b649aa3f0ac~mv2.png" alt="Facebook" />
          </a>
          <a href="https://www.tiktok.com/@soundadvicestudio" target="_blank" rel="noopener" aria-label="TikTok">
            <img src="https://static.wixstatic.com/media/11062b_8e8bb1bfaeb54186ace77d5ab14933ff~mv2.png" alt="TikTok" />
          </a>
        </div>
        <p class="footer-copy">©2026 SOUND ADVICE VOCAL STUDIO LLC · All rights reserved</p>
      </div>
      <div class="footer-badge">
        <img src="https://static.wixstatic.com/media/23043d_7b4e3ff7e2864e3ab188e7209775df5d~mv2.png" alt="Vocal Health Education Member" />
      </div>
    </footer>
  `;

  const headerEl = document.getElementById('site-header');
  if (headerEl) headerEl.outerHTML = navHTML;
  const footerEl = document.getElementById('site-footer');
  if (footerEl) footerEl.outerHTML = footerHTML;
}
