const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });
  const supabase = supabaseAdmin();

  const id = (event.queryStringParameters || {}).id;
  if (!id) return json(400, { error: 'ID siswa wajib disertakan.' });

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
    if (error || !data) return json(404, { error: 'Siswa tidak ditemukan.' });
    const { password_hash, ...safe } = data;
    return json(200, { data: safe });
  }

  if (event.httpMethod === 'PUT') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }

    const allowed = ['nisn', 'nipd', 'nama', 'jk', 'jenjang', 'program', 'kelas', 'tempat_lahir',
      'tanggal_lahir', 'alamat', 'hp', 'status', 'foto_url', 'butuh_konfirmasi_admin', 'catatan_konfirmasi'];
    const update = {};
    for (const k of allowed) if (body[k] !== undefined) update[k] = body[k];
    update.updated_at = new Date().toISOString();

    if (body.reset_password) {
      if (body.tanggal_lahir) {
        const [y, m, d] = String(body.tanggal_lahir).split('-');
        update.password_hash = bcrypt.hashSync(`${d}${m}${y}`, 10);
        update.must_change_password = true;
      } else {
        return json(400, { error: 'Tanggal lahir diperlukan untuk reset password.' });
      }
    }
    if (body.nisn) update.butuh_konfirmasi_admin = false;

    const { data, error } = await supabase.from('students').update(update).eq('id', id).select().single();
    if (error) {
      if (String(error.code) === '23505') return json(409, { error: 'NISN sudah digunakan siswa lain.' });
      return json(500, { error: 'Gagal memperbarui siswa.' });
    }

    await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'EDIT_SISWA', detail: { id, fields: Object.keys(update) } });
    const { password_hash, ...safe } = data;
    return json(200, { data: safe });
  }

  if (event.httpMethod === 'DELETE') {
    const { data: student } = await supabase.from('students').select('nama').eq('id', id).maybeSingle();
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) return json(500, { error: 'Gagal menghapus siswa.' });
    await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'HAPUS_SISWA', detail: { id, nama: student && student.nama } });
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
};
