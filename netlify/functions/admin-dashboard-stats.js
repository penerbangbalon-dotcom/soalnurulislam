const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, nowJakarta } = require('./_lib/utils');

function emptyBucket() {
  return { total: 0, hadir: 0, terlambat: 0, belum_absen: 0, sudah_pulang: 0, izin: 0, sakit: 0, tidak_hadir: 0, perlu_verifikasi: 0 };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });

  const supabase = supabaseAdmin();
  const { tanggal } = nowJakarta();

  const { data: students } = await supabase.from('students').select('id, jenjang, program, status').eq('status', 'AKTIF');
  const { data: attendanceToday } = await supabase.from('attendance').select('*').eq('tanggal', tanggal);

  const attByStudent = new Map((attendanceToday || []).map((a) => [a.student_id, a]));

  const buckets = { SD: emptyBucket(), PAKET_B: emptyBucket(), PAKET_C: emptyBucket(), TOTAL: emptyBucket() };

  for (const s of students || []) {
    const key = s.jenjang === 'SD' ? 'SD' : s.program;
    if (!buckets[key]) buckets[key] = emptyBucket();
    buckets[key].total++;
    buckets.TOTAL.total++;

    const a = attByStudent.get(s.id);
    let label = 'belum_absen';
    if (a) {
      if (a.checkin_status === 'PERLU_VERIFIKASI') label = 'perlu_verifikasi';
      else if (a.checkout_time) label = 'sudah_pulang';
      else if (a.checkin_status === 'TERLAMBAT') label = 'terlambat';
      else if (a.checkin_status === 'HADIR') label = 'hadir';
      else if (a.checkin_status === 'IZIN') label = 'izin';
      else if (a.checkin_status === 'SAKIT') label = 'sakit';
      else if (a.checkin_status === 'TIDAK_HADIR') label = 'tidak_hadir';
    }
    buckets[key][label]++;
    buckets.TOTAL[label]++;
  }

  // Ringkasan persentase kehadiran bulan berjalan (rata-rata) + daftar siswa
  // dengan kehadiran terendah, dipakai widget "Persentase Kehadiran" di dashboard.
  const awalBulan = `${tanggal.slice(0, 7)}-01`;
  let persentaseBulanIni = { rata_rata: 0, terendah: [] };
  try {
    const { data: rekap, error: rekapErr } = await supabase.rpc('rekap_kehadiran', {
      p_start: awalBulan, p_end: tanggal, p_student_id: null, p_kelas: null, p_program: null,
    });
    if (!rekapErr && rekap && rekap.length) {
      const dihitung = rekap.filter((r) => r.total_hari > 0);
      const rataRata = dihitung.length
        ? Math.round((dihitung.reduce((sum, r) => sum + Number(r.persentase), 0) / dihitung.length) * 10) / 10
        : 0;
      const terendah = [...dihitung].sort((a, b) => a.persentase - b.persentase).slice(0, 5)
        .map((r) => ({ nama: r.nama, nisn: r.nisn, kelas: r.kelas, program: r.program, persentase: r.persentase }));
      persentaseBulanIni = { rata_rata: rataRata, terendah };
    }
  } catch (e) {
    console.error('gagal menghitung persentase dashboard:', e);
  }

  return json(200, { tanggal, buckets, persentase_bulan_ini: persentaseBulanIni });
};
