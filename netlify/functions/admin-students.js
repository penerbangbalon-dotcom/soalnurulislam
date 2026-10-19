const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });
  const supabase = supabaseAdmin();

  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    const page = Math.max(1, parseInt(q.page || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(q.per_page || '25', 10)));
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase.from('students').select('*', { count: 'exact' }).order('nama', { ascending: true });
    if (q.search) query = query.or(`nama.ilike.%${q.search}%,nisn.ilike.%${q.search}%`);
    if (q.jenjang) query = query.eq('jenjang', q.jenjang);
    if (q.program) query = query.eq('program', q.program);
    if (q.kelas) query = query.eq('kelas', q.kelas);
    if (q.status) query = query.eq('status', q.status);
    if (q.butuh_konfirmasi === 'true') query = query.eq('butuh_konfirmasi_admin', true);
    if (q.tanpa_hp === 'true') query = query.or('hp.is.null,hp.eq.');
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) return json(500, { error: 'Gagal mengambil data siswa.' });

    const safe = (data || []).map(({ password_hash, ...s }) => s);
    return json(200, { data: safe, total: count, page, per_page: perPage });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }

    if (!body.nama || !body.jenjang || !body.kelas) {
      return json(400, { error: 'Nama, jenjang, dan kelas wajib diisi.' });
    }

    let passwordHash = null;
    if (body.tanggal_lahir) {
      const [y, m, d] = String(body.tanggal_lahir).split('-');
      if (y && m && d) passwordHash = bcrypt.hashSync(`${d}${m}${y}`, 10);
    }

    const payload = {
      nisn: body.nisn || null,
      nipd: body.nipd || null,
      nama: body.nama,
      jk: body.jk || null,
      jenjang: body.jenjang,
      program: body.program || 'UMUM',
      kelas: body.kelas,
      tempat_lahir: body.tempat_lahir || null,
      tanggal_lahir: body.tanggal_lahir || null,
      alamat: body.alamat || null,
      hp: body.hp || null,
      status: body.status || 'AKTIF',
      password_hash: passwordHash,
      must_change_password: true,
      butuh_konfirmasi_admin: !body.nisn,
      catatan_konfirmasi: !body.nisn ? 'NISN belum diisi oleh admin' : null,
    };

    const { data, error } = await supabase.from('students').insert(payload).select().single();
    if (error) {
      if (String(error.code) === '23505') return json(409, { error: 'NISN sudah digunakan siswa lain.' });
      return json(500, { error: 'Gagal menambah siswa.' });
    }

    await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'TAMBAH_SISWA', detail: { nama: data.nama, nisn: data.nisn } });
    const { password_hash, ...safe } = data;
    return json(201, { data: safe });
  }

  return json(405, { error: 'Method not allowed' });
};
