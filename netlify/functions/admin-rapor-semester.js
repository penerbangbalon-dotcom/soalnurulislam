const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight } = require('./_lib/utils');
const { fetchPersentase } = require('./admin-persentase');
const { buatDeskripsiKehadiran } = require('./_lib/deskripsiKehadiran');

/**
 * Rekap kehadiran per rentang tanggal (biasanya satu semester) LENGKAP dengan
 * deskripsi kehadiran otomatis per siswa, siap dipakai sebagai lampiran rapor.
 * Dipakai oleh halaman admin/rapor.html untuk pratinjau layar & cetak (PDF).
 */
async function buildRapor(supabase, q) {
  const { data: settings } = await supabase.from('school_settings').select('*').eq('id', 1).single();
  const { data: waliKelasList } = await supabase.from('wali_kelas').select('*');
  const waliMap = Object.fromEntries((waliKelasList || []).map((w) => [w.kelas, w]));
  const periodeLabel = q.periode || `periode ${q.tanggal_mulai} s/d ${q.tanggal_akhir}`;

  const rows = await fetchPersentase(supabase, q);
  const data = rows.map((r) => ({
    ...r,
    deskripsi: buatDeskripsiKehadiran(r, periodeLabel, settings),
    wali_kelas: waliMap[r.kelas] || null,
  }));

  return {
    sekolah: {
      nama_sekolah: settings.nama_sekolah,
      alamat: settings.alamat,
      yayasan_nama: settings.yayasan_nama,
      npsn: settings.npsn,
      sk_kemenhukum: settings.sk_kemenhukum,
      ijin_operasional: settings.ijin_operasional,
      kota_ttd: settings.kota_ttd,
      kepala_pkbm_nama: settings.kepala_pkbm_nama,
      kepala_pkbm_ttd: settings.kepala_pkbm_ttd,
      kepala_pkbm_ttd_lebar: settings.kepala_pkbm_ttd_lebar,
      kop_logo: settings.kop_logo,
      kop_logo_lebar: settings.kop_logo_lebar,
    },
    periode: periodeLabel,
    tanggal_mulai: q.tanggal_mulai,
    tanggal_akhir: q.tanggal_akhir,
    total: data.length,
    data,
  };
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
    const result = await buildRapor(supabase, q);
    return json(200, result);
  } catch (e) {
    console.error('admin-rapor-semester error:', e);
    return json(500, { error: 'Gagal membuat rekap semester.' });
  }
};

module.exports.buildRapor = buildRapor;
