const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight } = require('./_lib/utils');

async function fetchRekap(supabase, q) {
  let query = supabase
    .from('attendance')
    .select('*, students!inner(nisn, nama, jenjang, program, kelas)')
    .order('tanggal', { ascending: false });

  if (q.tanggal_mulai) query = query.gte('tanggal', q.tanggal_mulai);
  if (q.tanggal_akhir) query = query.lte('tanggal', q.tanggal_akhir);
  if (q.jenjang) query = query.eq('students.jenjang', q.jenjang);
  if (q.program) query = query.eq('students.program', q.program);
  if (q.kelas) query = query.eq('students.kelas', q.kelas);
  if (q.nisn) query = query.eq('students.nisn', q.nisn);
  if (q.status) query = query.eq('checkin_status', q.status);
  if (q.nama) query = query.ilike('students.nama', `%${q.nama}%`);

  const { data, error } = await query.limit(5000);
  if (error) throw error;

  return (data || []).map((r) => ({
    nisn: r.students.nisn,
    nama: r.students.nama,
    jenjang: r.students.jenjang,
    program: r.students.program,
    kelas: r.students.kelas,
    tanggal: r.tanggal,
    jam_datang: r.checkin_time,
    status_datang: r.checkin_status,
    jam_pulang: r.checkout_time,
    status_pulang: r.checkout_time ? 'SUDAH_PULANG' : null,
    keterangan: r.keterangan,
  }));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });

  const supabase = supabaseAdmin();
  const q = event.queryStringParameters || {};
  try {
    const data = await fetchRekap(supabase, q);
    return json(200, { data, total: data.length });
  } catch (e) {
    return json(500, { error: 'Gagal mengambil rekap absensi.' });
  }
};

module.exports.fetchRekap = fetchRekap;
