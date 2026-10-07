// Netlify/Vercel Function: kelola-user
// Mengelola akun login guru/admin (Supabase Auth) dari menu "Manajemen User" di index.html.
// Semua aksi butuh service_role key (JANGAN taruh di frontend!), makanya lewat function ini.
//
// HAK AKSES (lihat tentukanPeran di ../lib/ujian-core.js):
//   - aksi "saya"     : semua yang sudah login (untuk mengetahui peran dirinya)
//   - aksi lainnya    : HANYA Super Admin (list, create, reset-password, delete, set-role)
//   Peran: guru < admin < superadmin. Super Admin otomatis juga admin.

const {
  adaKonfigurasi, wajibLogin, tentukanPeran, authAdmin, peranDari, adminLangsung, superLangsung,
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
      return resp(200, { admin: peran.admin, superadmin: peran.superadmin, dipromosikan: peran.dipromosikan, email: pemanggil.email });
    }
    if (!peran.superadmin) return resp(403, { error: 'Fitur ini hanya untuk Super Admin.' });

    const semuaUser = async () => ((await authAdmin('/users?per_page=200')).users || []);
    const jumlahSuper = (users) => users.filter((u) => superLangsung(u)).length;
    const normPeran = (r) => (r === 'superadmin' ? 'superadmin' : r === 'admin' ? 'admin' : 'guru');
    const peranUser = (u) => (superLangsung(u) ? 'superadmin' : adminLangsung(u) ? 'admin' : 'guru');

    if (action === 'list') {
      const users = (await semuaUser()).map((u) => ({
        id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
        role: peranUser(u),
        dariEnv: !['admin', 'superadmin'].includes(peranDari(u)) && adminLangsung(u),
      })).sort((a, b) => (a.email || '').localeCompare(b.email || ''));
      return resp(200, { users });
    }

    if (action === 'create') {
      const email = (body.email || '').trim();
      const password = body.password || '';
      const role = normPeran(body.role);
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
      const role = normPeran(body.role);
      if (!user_id) return resp(400, { error: 'Data tidak lengkap' });
      const users = await semuaUser();
      const target = users.find((u) => u.id === user_id);
      if (!target) return resp(404, { error: 'User tidak ditemukan' });
      if (role !== 'superadmin' && superLangsung(target) && jumlahSuper(users) <= 1) {
        return resp(400, { error: 'Tidak bisa menurunkan satu-satunya Super Admin. Jadikan akun lain Super Admin dulu.' });
      }
      if (role !== peranUser(target) && peranUser(target) !== 'guru' && target.email && !['admin', 'superadmin'].includes(peranDari(target))) {
        return resp(400, { error: 'Peran akun ini ditentukan oleh pengaturan server (ADMIN_EMAILS / SUPER_ADMIN_EMAILS). Hapus dulu emailnya dari variabel itu.' });
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
      const target = (await semuaUser()).find((u) => u.id === user_id);
      if (target && superLangsung(target) && jumlahSuper(await semuaUser()) <= 1) return resp(400, { error: 'Tidak bisa menghapus satu-satunya Super Admin.' });
      await authAdmin(`/users/${user_id}`, { method: 'DELETE' });
      return resp(200, { ok: true });
    }

    return resp(400, { error: 'Aksi tidak dikenali' });
  } catch (err) {
    return resp(500, { error: err.message });
  }
};
