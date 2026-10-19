const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireSiswa } = require('./_lib/auth');
const { json, preflight, nowJakarta } = require('./_lib/utils');

/** Tentukan [tanggal_mulai, tanggal_akhir, label] dari parameter query. */
function tentukanRentang(q, hariIniISO) {
  if (q.mode === 'semester') {
    const tahun = Number(q.tahun) || Number(hariIniISO.slice(0, 4));
    if (q.semester === 'genap') {
      return [`${tahun + 1}-01-01`, `${tahun + 1}-06-30`, `Semester Genap ${tahun}/${tahun + 1}`];
    }
    return [`${tahun}-07-01`, `${tahun}-12-31`, `Semester Ganjil ${tahun}/${tahun + 1}`];
  }
  if (q.mode === 'custom' && q.tanggal_mulai && q.tanggal_akhir) {
    return [q.tanggal_mulai, q.tanggal_akhir, `${q.tanggal_mulai} s/d ${q.tanggal_akhir}`];
  }
  // default: mode bulanan (kompatibel dengan versi sebelumnya)
  const bulanIni = hariIniISO.slice(0, 7);
  const bulan = q.bulan || bulanIni;
  const akhirBulan = new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0).toISOString().slice(0, 10);
  return [`${bulan}-01`, akhirBulan, bulan];
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireSiswa(event);
  if (!auth) return json(401, { error: 'Sesi tidak valid. Silakan login kembali.' });

  const supabase = supabaseAdmin();
  const q = event.queryStringParameters || {};
  const { tanggal: hariIni } = nowJakarta();
  const [tanggalMulai, tanggalAkhir, label] = tentukanRentang(q, hariIni);

  const { data, error } = await supabase
    .from('attendance')
    .select('tanggal, checkin_time, checkin_status, checkout_time, keterangan')
    .eq('student_id', auth.sub) // identitas dari token, siswa hanya bisa lihat data sendiri
    .gte('tanggal', tanggalMulai)
    .lte('tanggal', tanggalAkhir)
    .order('tanggal', { ascending: true });

  if (error) return json(500, { error: 'Gagal mengambil riwayat absensi.' });

  const terlambatTercatat = data.filter((d) => d.checkin_status === 'TERLAMBAT').length;
  const izinTercatat = data.filter((d) => d.checkin_status === 'IZIN').length;
  const sakitTercatat = data.filter((d) => d.checkin_status === 'SAKIT').length;

  // Persentase resmi dihitung lewat rekap_kehadiran() supaya konsisten dengan rekap
  // admin: hari tanpa record (siswa tidak absen sama sekali) tetap dihitung sebagai
  // Alpa, bukan diabaikan begitu saja.
  const { data: rekap, error: errRekap } = await supabase.rpc('rekap_kehadiran', {
    p_start: tanggalMulai,
    p_end: tanggalAkhir,
    p_student_id: auth.sub,
    p_kelas: null,
    p_program: null,
  });
  if (errRekap) return json(500, { error: 'Gagal menghitung persentase kehadiran.' });

  const r = (rekap && rekap[0]) || { total_hari: 0, hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, persentase: 0 };

  return json(200, {
    mode: q.mode || 'bulan',
    periode: label,
    tanggal_mulai: tanggalMulai,
    tanggal_akhir: tanggalAkhir,
    bulan: q.mode === 'bulan' || !q.mode ? (q.bulan || hariIni.slice(0, 7)) : undefined,
    riwayat: data,
    statistik: {
      hadir: r.hadir - r.terlambat, // pisahkan Hadir tepat waktu vs Terlambat untuk tampilan
      terlambat: Math.max(r.terlambat, terlambatTercatat),
      izin: Math.max(r.izin, izinTercatat),
      sakit: Math.max(r.sakit, sakitTercatat),
      alpa: r.alpa,
      total_hari_efektif: r.total_hari,
      persentase_kehadiran: r.persentase,
    },
  });
};

module.exports.tentukanRentang = tentukanRentang;
