// Merender sidebar + topbar admin secara konsisten di semua halaman.
// Menu dikelompokkan supaya sidebar ringkas: grup yang berisi halaman aktif otomatis terbuka,
// grup lain bisa dibuka/ditutup (pilihan diingat di browser).
const ADMIN_MENU = [
  { href: '/admin/dashboard.html', icon: '📊', label: 'Dashboard' },
  { id: 'absensi', icon: '🕘', label: 'Absensi', items: [
    { href: '/admin/token.html', label: 'Sesi & Token Absensi' },
    { href: '/admin/absen-manual.html', label: 'Absen Manual', superAdminOnly: true },
    { href: '/admin/rekap.html', label: 'Rekap Absensi' },
  ] },
  { id: 'akademik', icon: '📚', label: 'Akademik', items: [
    { href: '/admin/siswa.html', label: 'Data Siswa' },
    { href: '/admin/jadwal.html', label: 'Jadwal Pelajaran' },
    { href: '/admin/persentase.html', label: 'Persentase Kehadiran' },
    { href: '/admin/rapor.html', label: 'Rekap Semester (Rapor)' },
  ] },
  { id: 'sistem', icon: '⚙️', label: 'Pengaturan', items: [
    { href: '/admin/pengaturan.html', label: 'Pengaturan Sekolah' },
    { href: '/admin/users.html', label: 'User Admin' },
    { href: '/admin/audit.html', label: 'Audit Log' },
  ] },
];

function bacaNavTerbuka() {
  try { return JSON.parse(localStorage.getItem('admin_nav_open') || '{}'); } catch { return {}; }
}
function renderMenuAdmin(activeHref, isSuperAdmin) {
  const terbuka = bacaNavTerbuka();
  return ADMIN_MENU.map((m) => {
    if (!m.items) return `<a href="${m.href}" class="${m.href === activeHref ? 'active' : ''}">${m.icon} ${m.label}</a>`;
    const items = m.items.filter((x) => !x.superAdminOnly || isSuperAdmin);
    if (!items.length) return '';
    const aktif = items.some((x) => x.href === activeHref);
    const buka = aktif || terbuka[m.id] === true;
    return `<details class="nav-group ${aktif ? 'has-active' : ''}" data-grup="${m.id}" ${buka ? 'open' : ''}>
      <summary>${m.icon} ${m.label}<span class="caret">▾</span></summary>
      <div class="nav-sub">${items.map((x) => `<a href="${x.href}" class="${x.href === activeHref ? 'active' : ''}">${x.label}</a>`).join('')}</div>
    </details>`;
  }).join('');
}

function renderAdminShell(activeHref, pageTitle) {
  requireAdminAuth();
  const info = JSON.parse(localStorage.getItem('admin_info') || '{}');
  const isSuperAdmin = info.role === 'SUPER_ADMIN';
  document.body.insertAdjacentHTML('afterbegin', `
    <div class="admin-shell">
      <aside class="admin-sidebar" id="admin-sidebar">
        <div class="brand" style="display:flex; align-items:center; gap:10px;">
          <img src="/assets/img/logo-pkbm.png" alt="Logo PKBM Nurul Islam" style="width:36px; height:36px; object-fit:contain; flex:0 0 auto;">
          <span>PKBM Nurul Islam<small>Absensi Digital</small></span>
        </div>
        <nav>
          ${renderMenuAdmin(activeHref, isSuperAdmin)}
          <a href="#" id="btn-logout-admin" style="margin-top:14px; color:#ffb4ac;">🚪 Keluar</a>
        </nav>
      </aside>
      <div class="admin-main">
        <div class="admin-topbar">
          <div style="display:flex; align-items:center; gap:12px;">
            <button class="btn btn-ghost menu-toggle" id="menu-toggle">☰</button>
            <h2 style="font-size:1.1rem;">${pageTitle}</h2>
          </div>
          <div style="font-size:0.85rem; color:var(--ink-muted);">${info.nama || ''} · <span style="text-transform:capitalize;">${(info.role || '').replace('_',' ').toLowerCase()}</span></div>
        </div>
        <div class="admin-content" id="admin-content-slot"></div>
      </div>
    </div>
  `);
  document.querySelectorAll('#admin-sidebar details.nav-group').forEach((d) => {
    d.addEventListener('toggle', () => {
      const st = bacaNavTerbuka(); st[d.dataset.grup] = d.open;
      try { localStorage.setItem('admin_nav_open', JSON.stringify(st)); } catch { /* abaikan */ }
    });
  });
  document.getElementById('menu-toggle').onclick = () => document.getElementById('admin-sidebar').classList.toggle('open');
  document.getElementById('btn-logout-admin').onclick = (e) => { e.preventDefault(); logoutAdmin(); };
  return document.getElementById('admin-content-slot');
}
