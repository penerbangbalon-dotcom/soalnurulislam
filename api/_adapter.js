// Inti adapter Vercel — dipakai oleh api/[...path].js dan api/gateway.js.
// Menerjemahkan /api/<nama> ke handler Netlify Functions di netlify/functions/<nama>.js.
// Kalau menambah function baru di netlify/functions/, tambahkan satu baris di HANDLERS.

const HANDLERS = {
  'admin-absen-manual': () => require('../netlify/functions/admin-absen-manual.js'),
  'admin-absen-manual-bulk': () => require('../netlify/functions/admin-absen-manual-bulk.js'),
  'admin-attendance-live': () => require('../netlify/functions/admin-attendance-live.js'),
  'admin-attendance-set-status': () => require('../netlify/functions/admin-attendance-set-status.js'),
  'admin-audit-log': () => require('../netlify/functions/admin-audit-log.js'),
  'admin-dashboard-stats': () => require('../netlify/functions/admin-dashboard-stats.js'),
  'admin-kelas-list': () => require('../netlify/functions/admin-kelas-list.js'),
  'admin-jadwal-pelajaran': () => require('../netlify/functions/admin-jadwal-pelajaran.js'),
  'admin-jadwal-export': () => require('../netlify/functions/admin-jadwal-export.js'),
  'admin-muatan-mapel': () => require('../netlify/functions/admin-muatan-mapel.js'),
  'admin-jam-belajar': () => require('../netlify/functions/admin-jam-belajar.js'),
  'admin-mapel': () => require('../netlify/functions/admin-mapel.js'),
  'admin-hari-libur': () => require('../netlify/functions/admin-hari-libur.js'),
  'admin-persentase': () => require('../netlify/functions/admin-persentase.js'),
  'admin-persentase-export': () => require('../netlify/functions/admin-persentase-export.js'),
  'admin-rapor-identitas': () => require('../netlify/functions/admin-rapor-identitas.js'),
  'admin-rapor-semester': () => require('../netlify/functions/admin-rapor-semester.js'),
  'admin-rapor-semester-export': () => require('../netlify/functions/admin-rapor-semester-export.js'),
  'admin-reports': () => require('../netlify/functions/admin-reports.js'),
  'admin-rekap-word': () => require('../netlify/functions/admin-rekap-word.js'),
  'admin-reports-export': () => require('../netlify/functions/admin-reports-export.js'),
  'admin-settings': () => require('../netlify/functions/admin-settings.js'),
  'admin-students': () => require('../netlify/functions/admin-students.js'),
  'admin-students-detail': () => require('../netlify/functions/admin-students-detail.js'),
  'admin-token-current': () => require('../netlify/functions/admin-token-current.js'),
  'admin-token-rotate': () => require('../netlify/functions/admin-token-rotate.js'),
  'admin-token-stop': () => require('../netlify/functions/admin-token-stop.js'),
  'admin-users': () => require('../netlify/functions/admin-users.js'),
  'admin-wali-kelas': () => require('../netlify/functions/admin-wali-kelas.js'),
  'auth-login-admin': () => require('../netlify/functions/auth-login-admin.js'),
  'auth-login-siswa': () => require('../netlify/functions/auth-login-siswa.js'),
  'scheduled-rotate-token': () => require('../netlify/functions/scheduled-rotate-token.js'),
  'siswa-checkin': () => require('../netlify/functions/siswa-checkin.js'),
  'siswa-checkout': () => require('../netlify/functions/siswa-checkout.js'),
  'siswa-ganti-password': () => require('../netlify/functions/siswa-ganti-password.js'),
  'siswa-laporan': () => require('../netlify/functions/siswa-laporan.js'),
  'siswa-me': () => require('../netlify/functions/siswa-me.js'),
  'siswa-riwayat': () => require('../netlify/functions/siswa-riwayat.js'),
};

// Ambil nama endpoint dari berbagai sumber, supaya tetap jalan walau salah satunya kosong.
function ambilNama(req) {
  const q = req.query || {};
  let seg = q.path !== undefined ? q.path : q.name;
  if (Array.isArray(seg)) seg = seg.join('/');
  if (seg) return String(seg);
  // cadangan: baca langsung dari URL, mis. "/api/auth-login-siswa?x=1"
  const url = String(req.url || '').split('?')[0];
  const m = url.match(/\/api\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : '';
}

module.exports = async function jalankan(req, res) {
  try {
    const name = ambilNama(req);

    const loader = HANDLERS[name];
    if (!loader) {
      res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
      return;
    }

    const fn = loader();
    const handler = fn && fn.handler;
    if (typeof handler !== 'function') {
      res.status(500).json({ error: 'Endpoint tidak valid.' });
      return;
    }

    const { path: _p, name: _n, ...queryStringParameters } = req.query || {};

    const event = {
      httpMethod: req.method,
      headers: req.headers || {},
      body: req.body == null
        ? ''
        : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)),
      queryStringParameters,
      path: req.url || '',
    };

    const result = await handler(event, {});
    const status = (result && result.statusCode) || 200;
    res.status(status);

    const headers = (result && result.headers) || {};
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }

    if (result && result.isBase64Encoded) {
      res.end(Buffer.from(result.body || '', 'base64'));
      return;
    }

    const body = result && result.body;
    if (body == null) { res.end(); return; }
    if (typeof body === 'object') { res.json(body); return; }
    res.send(body);
  } catch (error) {
    console.error('[Vercel API adapter]', error);
    res.status(500).json({ error: (error && error.message) || 'Terjadi kesalahan pada server.' });
  }
};
