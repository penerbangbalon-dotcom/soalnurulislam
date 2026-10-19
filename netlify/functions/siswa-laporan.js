const ExcelJS = require('exceljs');
const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireSiswa } = require('./_lib/auth');
const { json, preflight, nowJakarta } = require('./_lib/utils');
const { buatDeskripsiKehadiran, predikatKehadiran } = require('./_lib/deskripsiKehadiran');
const { tentukanRentang } = require('./siswa-riwayat');

const STATUS = { HADIR: 'Hadir', TERLAMBAT: 'Terlambat', IZIN: 'Izin', SAKIT: 'Sakit', TIDAK_HADIR: 'Tidak Hadir', SUDAH_PULANG: 'Hadir (sudah pulang)', PERLU_VERIFIKASI: 'Perlu Verifikasi' };
const jam = (iso) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) : '-');
const csvEsc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/**
 * Laporan absensi PRIBADI siswa (JSON untuk tampilan/cetak PDF, atau unduhan xlsx/csv).
 * Identitas siswa selalu dari token login, bukan dari parameter -> hanya bisa unduh data sendiri.
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireSiswa(event);
  if (!auth) return json(401, { error: 'Sesi tidak valid. Silakan login kembali.' });

  const q = event.queryStringParameters || {};
  const format = (q.format || 'json').toLowerCase();
  const supabase = supabaseAdmin();
  const [mulai, akhir, periode] = tentukanRentang(q, nowJakarta().tanggal);

  const [st, cfg, att, rk] = await Promise.all([
    supabase.from('students').select('nama, nisn, kelas, program, jenjang').eq('id', auth.sub).maybeSingle(),
    supabase.from('school_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('attendance').select('tanggal, checkin_time, checkin_status, checkout_time, keterangan')
      .eq('student_id', auth.sub).gte('tanggal', mulai).lte('tanggal', akhir).order('tanggal', { ascending: true }),
    supabase.rpc('rekap_kehadiran', { p_start: mulai, p_end: akhir, p_student_id: auth.sub, p_kelas: null, p_program: null }),
  ]);
  const student = st.data;
  if (!student) return json(404, { error: 'Data siswa tidak ditemukan.' });
  if (att.error || rk.error) return json(500, { error: 'Gagal menyusun laporan absensi.' });

  const settings = cfg.data || {};
  const r = (rk.data && rk.data[0]) || { total_hari: 0, hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, persentase: 0 };
  const laporan = {
    siswa: student,
    sekolah: {
      nama_sekolah: settings.nama_sekolah, alamat: settings.alamat, yayasan_nama: settings.yayasan_nama,
      npsn: settings.npsn, kota_ttd: settings.kota_ttd, kepala_pkbm_nama: settings.kepala_pkbm_nama,
    },
    periode, tanggal_mulai: mulai, tanggal_akhir: akhir,
    statistik: {
      total_hari_efektif: r.total_hari, hadir: r.hadir - r.terlambat, terlambat: r.terlambat,
      izin: r.izin, sakit: r.sakit, alpa: r.alpa, persentase: r.persentase, predikat: predikatKehadiran(r.persentase),
    },
    deskripsi: buatDeskripsiKehadiran({ ...r, nama: student.nama }, periode, settings),
    riwayat: att.data || [],
  };

  if (format === 'json') return json(200, laporan);

  const nama = `Laporan_Absensi_${(student.nisn || student.nama).toString().replace(/[^\w-]+/g, '_')}_${mulai}_${akhir}`;
  const head = ['Tanggal', 'Jam Datang', 'Status', 'Jam Pulang', 'Keterangan'];
  const baris = laporan.riwayat.map((x) => [x.tanggal, jam(x.checkin_time), STATUS[x.checkin_status] || x.checkin_status || '-', jam(x.checkout_time), x.keterangan || '']);
  const s = laporan.statistik;
  const info = [
    ['Laporan Absensi Siswa'], ['Sekolah', settings.nama_sekolah || ''], ['Nama', student.nama], ['NISN', student.nisn || '-'],
    ['Kelas', student.kelas || '-'], ['Program', (student.program || '').replace('_', ' ')], ['Periode', periode],
    ['Hari Efektif', s.total_hari_efektif], ['Hadir', s.hadir], ['Terlambat', s.terlambat], ['Izin', s.izin], ['Sakit', s.sakit],
    ['Alpa', s.alpa], ['Persentase Kehadiran (%)', `${s.persentase} (${s.predikat})`], ['Deskripsi', laporan.deskripsi],
  ];

  if (format === 'csv') {
    const lines = [...info, [], head, ...baris].map((row) => row.map(csvEsc).join(','));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${nama}.csv"` },
      body: '\uFEFF' + lines.join('\n'),
    };
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Laporan Absensi');
  info.forEach((row) => ws.addRow(row));
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([]);
  ws.addRow(head).font = { bold: true };
  baris.forEach((row) => ws.addRow(row));
  ws.columns.forEach((c, i) => { c.width = i === 4 ? 40 : 22; });
  const buffer = await wb.xlsx.writeBuffer();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${nama}.xlsx"` },
    body: Buffer.from(buffer).toString('base64'),
    isBase64Encoded: true,
  };
};
