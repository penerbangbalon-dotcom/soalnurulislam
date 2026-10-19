const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight } = require('./_lib/utils');

/**
 * Ambil rekap persentase kehadiran per siswa dalam rentang tanggal, dengan
 * memanggil fungsi database `rekap_kehadiran` (dibuat di Supabase).
 * Fungsi itu menghitung, untuk tiap siswa AKTIF:
 *   - total_hari : jumlah hari sekolah efektif dalam rentang (mengikuti
 *                  school_settings.hari_aktif, tidak menghitung hari yg belum lewat)
 *   - hadir      : HADIR + TERLAMBAT
 *   - izin, sakit, alpa (dihitung terpisah)
 *   - persentase : hadir / (hadir+izin+sakit+alpa) * 100
 *
 * Filter jenjang & pencarian nama/nisn dilakukan di sini karena fungsi database
 * belum punya parameter untuk itu.
 */
async function fetchPersentase(supabase, q) {
  const { data, error } = await supabase.rpc('rekap_kehadiran', {
    p_start: q.tanggal_mulai,
    p_end: q.tanggal_akhir,
    p_student_id: q.student_id || null,
    p_kelas: q.kelas || null,
    p_program: q.program || null,
  });

  if (error) throw error;

  let rows = data || [];

  if (q.jenjang) {
    rows = rows.filter((r) => r.jenjang === q.jenjang);
  }
  if (q.nama) {
    const needle = q.nama.toLowerCase();
    rows = rows.filter(
      (r) => r.nama.toLowerCase().includes(needle) || (r.nisn || '').includes(q.nama)
    );
  }

  return rows;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });

  const q = event.queryStringParameters || {};
  if (!q.tanggal_mulai || !q.tanggal_akhir) {
    return json(400, { error: 'Parameter tanggal_mulai dan tanggal_akhir wajib diisi.' });
  }

  const supabase = supabaseAdmin();
  try {
    const data = await fetchPersentase(supabase, q);
    return json(200, {
      tanggal_mulai: q.tanggal_mulai,
      tanggal_akhir: q.tanggal_akhir,
      total: data.length,
      data,
    });
  } catch (e) {
    console.error('admin-persentase error:', e);
    return json(500, { error: 'Gagal mengambil rekap persentase kehadiran.' });
  }
};

module.exports.fetchPersentase = fetchPersentase;
