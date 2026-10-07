// Netlify/Vercel Function: kelola-user
// Mengelola akun login guru/admin (Supabase Auth) dari menu "Manajemen User" di index.html.
// Semua aksi butuh service_role key (JANGAN taruh di frontend!), makanya lewat function ini.
//
// HAK AKSES (lihat tentukanPeran di ../lib/ujian-core.js):
//   - aksi "saya"     : semua yang sudah login (untuk mengetahui apakah dirinya admin)
//   - aksi lainnya    : HANYA admin (list, create, reset-password, delete, set-role)

const {
  adaKonfigurasi, wajibLogin, tentukanPeran, authAdmin, peranDari, adminLangsung,
} = require('../lib/ujian-core');

const resp = (statusCode, obj) => ({ statusCode, body: JSON.stringify(obj) });

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!adaKonfigurasi()) return resp(500, { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel Environment Variables.' });

  const guard = await wajibLogin(event);
  if (guard.error) return guard.error;
  const pemanggil = guard.pemanggil;

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return resp(400, { error: 'Body tidak valid' }); }
  const { action } = body;

  try {
    const peran = await tentukanPeran(pemanggil);

    if (action === 'saya') {
      return resp(200, { admin: peran.admin, dipromosikan: peran.dipromosikan, email: pemanggil.email });
    }
    if (!peran.admin) return resp(403, { error: 'Fitur ini hanya untuk admin.' });

    const semuaUser = async () => ((await authAdmin('/users?per_page=200')).users || []);
    const jumlahAdmin = (users) => users.filter((u) => adminLangsung(u)).length;

    if (action === 'list') {
      const users = (await semuaUser()).map((u) => ({
        id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
        role: adminLangsung(u) ? 'admin' : 'guru',
        dariEnv: peranDari(u) !== 'admin' && adminLangsung(u),
      })).sort((a, b) => (a.email || '').localeCompare(b.email || ''));
      return resp(200, { users });
    }

    if (action === 'create') {
      const email = (body.email || '').trim();
      const password = body.password || '';
      const role = body.role === 'admin' ? 'admin' : 'guru';
      if (!email || !password) return resp(400, { error: 'Email dan kata sandi wajib diisi' });
      if (password.length < 6) return resp(400, { error: 'Kata sandi minimal 6 karakter' });
      const user = await authAdmin('/users', {
        method: 'POST',
        body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { role } }),
      });
      return resp(200, { ok: true, user });
    }

    if (action === 'set-role') {
      const { user_id } = body;
      const role = body.role === 'admin' ? 'admin' : 'guru';
      if (!user_id) return resp(400, { error: 'Data tidak lengkap' });
      const users = await semuaUser();
      const target = users.find((u) => u.id === user_id);
      if (!target) return resp(404, { error: 'User tidak ditemukan' });
      if (role === 'guru' && adminLangsung(target) && jumlahAdmin(users) <= 1) {
        return resp(400, { error: 'Tidak bisa menurunkan satu-satunya admin. Jadikan akun lain admin dulu.' });
      }
      if (role === 'guru' && target.email && adminLangsung(target) && peranDari(target) !== 'admin') {
        return resp(400, { error: 'Akun ini admin karena terdaftar di ADMIN_EMAILS (pengaturan server). Hapus dulu dari variabel itu.' });
      }
      await authAdmin(`/users/${user_id}`, { method: 'PUT', body: JSON.stringify({ app_metadata: { ...(target.app_metadata || {}), role } }) });
      return resp(200, { ok: true });
    }

    if (action === 'reset-password') {
      const { user_id, password } = body;
      if (!user_id || !password) return resp(400, { error: 'Data tidak lengkap' });
      if (password.length < 6) return resp(400, { error: 'Kata sandi minimal 6 karakter' });
      await authAdmin(`/users/${user_id}`, { method: 'PUT', body: JSON.stringify({ password }) });
      return resp(200, { ok: true });
    }

    if (action === 'delete') {
      const { user_id } = body;
      if (!user_id) return resp(400, { error: 'Data tidak lengkap' });
      if (user_id === pemanggil.id) return resp(400, { error: 'Tidak bisa menghapus akun yang sedang login.' });
      await authAdmin(`/users/${user_id}`, { method: 'DELETE' });
      return resp(200, { ok: true });
    }

    return resp(400, { error: 'Aksi tidak dikenali' });
  } catch (err) {
    return resp(500, { error: err.message });
  }
};
