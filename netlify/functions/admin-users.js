const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const supabase = supabaseAdmin();

  if (event.httpMethod === 'GET') {
    const auth = requireAdmin(event, { superAdminOnly: true });
    if (!auth) return json(403, { error: 'Hanya Super Admin yang dapat melihat daftar admin.' });
    const { data, error } = await supabase.from('admins').select('id, email, nama, role, aktif, created_at').order('created_at');
    if (error) return json(500, { error: 'Gagal mengambil daftar admin.' });
    return json(200, { data });
  }

  if (event.httpMethod === 'POST') {
    const auth = requireAdmin(event, { superAdminOnly: true });
    if (!auth) return json(403, { error: 'Hanya Super Admin yang dapat menambah admin.' });

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }
    const { email, nama, password, role } = body;
    if (!email || !nama || !password) return json(400, { error: 'Email, nama, dan password wajib diisi.' });
    if (password.length < 8) return json(400, { error: 'Password admin minimal 8 karakter.' });

    const { data, error } = await supabase.from('admins').insert({
      email: String(email).toLowerCase().trim(),
      nama,
      role: role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
      password_hash: bcrypt.hashSync(password, 10),
    }).select('id, email, nama, role, aktif').single();

    if (error) {
      if (String(error.code) === '23505') return json(409, { error: 'Email sudah terdaftar.' });
      return json(500, { error: 'Gagal menambah admin.' });
    }

    await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'TAMBAH_ADMIN', detail: { email: data.email, role: data.role } });
    return json(201, { data });
  }

  if (event.httpMethod === 'PUT') {
    const auth = requireAdmin(event, { superAdminOnly: true });
    if (!auth) return json(403, { error: 'Hanya Super Admin yang dapat mengubah admin.' });

    const id = (event.queryStringParameters || {}).id;
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }

    const update = {};
    if (body.nama) update.nama = body.nama;
    if (body.role) update.role = body.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';
    if (body.aktif !== undefined) update.aktif = Boolean(body.aktif);
    if (body.password) update.password_hash = bcrypt.hashSync(body.password, 10);

    const { data, error } = await supabase.from('admins').update(update).eq('id', id).select('id, email, nama, role, aktif').single();
    if (error) return json(500, { error: 'Gagal memperbarui admin.' });

    await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'EDIT_ADMIN', detail: { id, fields: Object.keys(update) } });
    return json(200, { data });
  }

  if (event.httpMethod === 'DELETE') {
    const auth = requireAdmin(event, { superAdminOnly: true });
    if (!auth) return json(403, { error: 'Hanya Super Admin yang dapat menghapus admin.' });
    const id = (event.queryStringParameters || {}).id;
    if (id === auth.sub) return json(400, { error: 'Tidak dapat menghapus akun sendiri.' });
    const { error } = await supabase.from('admins').delete().eq('id', id);
    if (error) return json(500, { error: 'Gagal menghapus admin.' });
    await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'HAPUS_ADMIN', detail: { id } });
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
};
