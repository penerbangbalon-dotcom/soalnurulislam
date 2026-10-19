const JSZip = require('jszip');
const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit, nowJakarta } = require('./_lib/utils');
const { grupKelas, bandingGrup, hariIsoDariTanggal } = require('./_lib/kelasGrup');
const { buatDokumenRekap, susunKolomMapel } = require('./_lib/rekapWord');

/**
 * Rekap harian Daftar Hadir & Tanda Tangan Siswa (Word), satu berkas per grup kelas.
 *   GET ?tanggal=YYYY-MM-DD&kelas=7        -> 1 berkas .docx
 *   GET ?tanggal=YYYY-MM-DD&kelas=SEMUA    -> .zip berisi 1 .docx per kelas
 *   GET ?tanggal=YYYY-MM-DD&format=info    -> JSON ringkasan per kelas (untuk tampilan tombol)
 * Siswa yang tampil = siswa yang sudah scan masuk pada tanggal tsb (sama seperti contoh).
 * Kolom mapel diambil dari Jadwal Pelajaran hari itu; Jumat memakai jam belajar Jumat.
 */
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function jamWib(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}
const amanNamaFile = (s) => String(s).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');

async function kumpulkan(supabase, tanggal) {
  const weekday = hariIsoDariTanggal(tanggal);
  const tipeHari = weekday === 5 ? 'JUMAT' : 'REGULER';

  const { data: hadir, error } = await supabase
    .from('attendance')
    .select('checkin_time, students!inner(nama, kelas, program)')
    .eq('tanggal', tanggal)
    .not('checkin_time', 'is', null);
  if (error) throw new Error('Gagal mengambil data absensi.');

  const peta = new Map();
  for (const r of hadir || []) {
    const s = r.students;
    if (!s || (s.program !== 'PAKET_B' && s.program !== 'PAKET_C')) continue;
    const grup = grupKelas(s.kelas, s.program);
    if (!grup) continue;
    if (!peta.has(grup)) peta.set(grup, { grup, program: s.program, siswa: [] });
    peta.get(grup).siswa.push({ nama: String(s.nama || '').trim(), jam: jamWib(r.checkin_time) });
  }
  const kelas = [...peta.values()].sort((a, b) => bandingGrup(a.grup, b.grup));
  for (const k of kelas) k.siswa.sort((a, b) => a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' }));

  // Jadwal & jam belajar (boleh kosong: kolom mapel jadi kosong seperti format contoh)
  let slots = []; let jadwal = [];
  if (kelas.length && weekday >= 1 && weekday <= 5) {
    const r1 = await supabase.from('absensi_jam_belajar').select('*').eq('tipe_hari', tipeHari).order('urut');
    slots = r1.data || [];
    const r2 = await supabase.from('absensi_jadwal_mapel').select('kelas_grup, jam_ke, mapel').eq('hari', weekday).in('kelas_grup', kelas.map((k) => k.grup));
    jadwal = r2.data || [];
  }
  for (const k of kelas) {
    const slotProgram = slots.filter((s) => s.program === k.program);
    k.kolom = susunKolomMapel(slotProgram, jadwal.filter((j) => j.kelas_grup === k.grup));
  }
  return { kelas, weekday };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });

  const q = event.queryStringParameters || {};
  const tanggal = q.tanggal || nowJakarta().tanggal;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || Number.isNaN(Date.parse(`${tanggal}T00:00:00Z`))) {
    return json(400, { error: 'Format tanggal tidak valid.' });
  }

  const supabase = supabaseAdmin();
  let data;
  try { data = await kumpulkan(supabase, tanggal); } catch (e) { return json(500, { error: e.message || 'Gagal menyusun rekap.' }); }

  if (q.format === 'info') {
    return json(200, {
      tanggal, hari_iso: data.weekday,
      kelas: data.kelas.map((k) => ({ grup: k.grup, program: k.program, jumlah_hadir: k.siswa.length, jumlah_mapel: k.kolom.length })),
    });
  }

  const pilih = String(q.kelas || 'SEMUA').trim();
  const terpilih = pilih.toUpperCase() === 'SEMUA' ? data.kelas : data.kelas.filter((k) => k.grup === pilih);
  if (!terpilih.length) {
    return json(404, {
      error: pilih.toUpperCase() === 'SEMUA'
        ? 'Belum ada siswa Paket B/C yang scan masuk pada tanggal ini.'
        : `Belum ada siswa kelas ${pilih} yang scan masuk pada tanggal ini.`,
    });
  }

  const { data: sekolah } = await supabase.from('school_settings').select('*').eq('id', 1).single();

  const berkas = [];
  for (const k of terpilih) {
    const buf = await buatDokumenRekap({ sekolah: sekolah || {}, grup: k.grup, program: k.program, tanggal, siswa: k.siswa, kolom: k.kolom });
    berkas.push({ nama: `Rekap-Absensi_Kelas-${amanNamaFile(k.grup)}_${tanggal}.docx`, buf });
  }

  await writeAudit(supabase, {
    actorType: 'ADMIN', actorId: auth.sub, action: 'EXPORT_REKAP_WORD',
    detail: { tanggal, kelas: terpilih.map((k) => k.grup), jumlah_berkas: berkas.length },
  });

  if (berkas.length === 1) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': MIME_DOCX, 'Content-Disposition': `attachment; filename="${berkas[0].nama}"` },
      body: berkas[0].buf.toString('base64'),
      isBase64Encoded: true,
    };
  }

  const zip = new JSZip();
  for (const b of berkas) zip.file(b.nama, b.buf);
  const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="Rekap-Absensi_Semua-Kelas_${tanggal}.zip"` },
    body: zipBuf.toString('base64'),
    isBase64Encoded: true,
  };
};
