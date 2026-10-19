const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, nowJakarta } = require('./_lib/utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });

  const supabase = supabaseAdmin();
  const q = event.queryStringParameters || {};
  const { tanggal: hariIni } = nowJakarta();
  const tanggal = q.tanggal || hariIni;

  let studentQuery = supabase.from('students').select('id, nisn, nama, jenjang, program, kelas').eq('status', 'AKTIF');
  if (q.jenjang) studentQuery = studentQuery.eq('jenjang', q.jenjang);
  if (q.program) studentQuery = studentQuery.eq('program', q.program);
  if (q.kelas) studentQuery = studentQuery.eq('kelas', q.kelas);
  if (q.search) studentQuery = studentQuery.or(`nama.ilike.%${q.search}%,nisn.ilike.%${q.search}%`);
  const { data: students } = await studentQuery.order('nama');

  const { data: attendance } = await supabase.from('attendance').select('*').eq('tanggal', tanggal);
  const attMap = new Map((attendance || []).map((a) => [a.student_id, a]));

  const rows = (students || []).map((s) => {
    const a = attMap.get(s.id);
    return {
      student_id: s.id,
      nisn: s.nisn,
      nama: s.nama,
      jenjang: s.jenjang,
      program: s.program,
      kelas: s.kelas,
      datang: a?.checkin_time || null,
      status_datang: a?.checkin_status || 'BELUM_ABSEN',
      pulang: a?.checkout_time || null,
      status_pulang: a?.checkout_time ? 'SUDAH_PULANG' : null,
      jarak_datang_m: a?.checkin_distance_m ?? null,
      akurasi_datang_m: a?.checkin_accuracy_m ?? null,
      foto_datang: a?.checkin_photo_url || null,
      keterangan: a?.keterangan || null,
    };
  });

  return json(200, { tanggal, data: rows });
};
