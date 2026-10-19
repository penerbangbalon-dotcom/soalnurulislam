const ExcelJS = require('exceljs');
const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');
const { PROGRAM_LABEL, bandingGrup } = require('./_lib/kelasGrup');
const { susunTabelJadwal } = require('./_lib/jadwalTabel');
const { daftarKelas } = require('./admin-jadwal-pelajaran');

/**
 * Cetak Jadwal Pelajaran ke Excel (.xlsx) — satu sheet per kelas.
 *   GET ?kelas=10        -> jadwal kelas 10
 *   GET ?kelas=SEMUA     -> semua kelas (satu sheet per kelas)
 * Versi PDF dibuat di browser (tombol Cetak PDF) agar tata letaknya sama dengan layar.
 */
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const HIJAU = 'FF1F6F5C';
const garis = { style: 'thin', color: { argb: 'FF999999' } };
const kotak = { top: garis, left: garis, bottom: garis, right: garis };

function tulisSheet(wb, { sekolah, info, tabel }) {
  const ws = wb.addWorksheet(`Kelas ${info.grup}`.slice(0, 31), {
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });
  ws.columns = [{ width: 6 }, { width: 17 }, { width: 24 }, { width: 24 }, { width: 24 }, { width: 24 }, { width: 17 }, { width: 24 }];

  const judul = (r, teks, size, bold) => {
    ws.mergeCells(r, 1, r, 8);
    const c = ws.getCell(r, 1);
    c.value = teks; c.font = { bold, size }; c.alignment = { horizontal: 'center', vertical: 'middle' };
  };
  judul(1, 'JADWAL PELAJARAN', 15, true);
  judul(2, sekolah || 'PKBM Nurul Islam', 12, true);
  judul(3, `Kelas ${info.grup} — ${PROGRAM_LABEL[info.program] || info.program}`, 11, false);

  const hr = 5;
  tabel.header.forEach((h, i) => {
    const c = ws.getCell(hr, i + 1);
    c.value = h; c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HIJAU } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = kotak;
  });
  ws.getRow(hr).height = 22;

  tabel.baris.forEach((b, idx) => {
    const r = hr + 1 + idx;
    b.sel.forEach((v, i) => {
      const c = ws.getCell(r, i + 1);
      c.value = v; c.border = kotak;
      c.alignment = { horizontal: i < 2 || i === 6 ? 'center' : 'left', vertical: 'middle', wrapText: true };
      const istirahat = i <= 5 ? b.istirahatReg : b.istirahatJum;
      if (istirahat && i >= 2 && i !== 6) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F0E8' } };
        c.font = { italic: true, color: { argb: 'FF777777' } }; c.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
    ws.getRow(r).height = b.istirahatReg && b.istirahatJum ? 18 : 30;
  });

  let r = hr + tabel.baris.length + 3;
  ws.mergeCells(r, 1, r, 8);
  ws.getCell(r, 1).value = 'Rekap Jam Pelajaran (JP) per Minggu';
  ws.getCell(r, 1).font = { bold: true };
  r += 1;
  tabel.ringkasan.forEach(([mapel, jp]) => {
    ws.mergeCells(r, 1, r, 7);
    const a = ws.getCell(r, 1); a.value = mapel; a.border = kotak;
    const b = ws.getCell(r, 8); b.value = jp; b.border = kotak; b.alignment = { horizontal: 'center' };
    r += 1;
  });
  ws.mergeCells(r, 1, r, 7);
  const t = ws.getCell(r, 1); t.value = 'Total'; t.font = { bold: true }; t.border = kotak;
  const tj = ws.getCell(r, 8); tj.value = tabel.totalJp; tj.font = { bold: true }; tj.border = kotak; tj.alignment = { horizontal: 'center' };
  ws.views = [{ state: 'frozen', ySplit: hr }];
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });
  const supabase = supabaseAdmin();

  const pilih = String((event.queryStringParameters || {}).kelas || 'SEMUA').trim();
  let kelasList;
  try { kelasList = await daftarKelas(supabase); } catch { return json(500, { error: 'Gagal memuat daftar kelas.' }); }
  const terpilih = pilih.toUpperCase() === 'SEMUA' ? kelasList : kelasList.filter((k) => k.grup === pilih);
  if (!terpilih.length) return json(404, { error: 'Kelas tidak ditemukan.' });

  const [rs, rj, rm, rsek] = await Promise.all([
    supabase.from('absensi_jam_belajar').select('*').order('urut'),
    supabase.from('absensi_jadwal_mapel').select('kelas_grup, hari, jam_ke, mapel').in('kelas_grup', terpilih.map((k) => k.grup)),
    Promise.resolve(null),
    supabase.from('school_settings').select('nama_sekolah').eq('id', 1).single(),
  ]);
  if (rs.error || rj.error) return json(500, { error: 'Gagal memuat jadwal. Pastikan migration_05 sudah dijalankan.' });

  const slots = { PAKET_B: { REGULER: [], JUMAT: [] }, PAKET_C: { REGULER: [], JUMAT: [] } };
  for (const s of rs.data || []) if (slots[s.program]) slots[s.program][s.tipe_hari].push(s);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Absensi Digital PKBM';
  wb.created = new Date();
  const sekolah = (rsek.data && rsek.data.nama_sekolah) || 'PKBM Nurul Islam';
  for (const info of terpilih.slice().sort((a, b) => bandingGrup(a.grup, b.grup))) {
    const tabel = susunTabelJadwal({ slotsProgram: slots[info.program], jadwal: (rj.data || []).filter((j) => j.kelas_grup === info.grup) });
    tulisSheet(wb, { sekolah, info, tabel });
  }

  await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'EXPORT_JADWAL_EXCEL', detail: { kelas: terpilih.map((k) => k.grup) } });

  const buffer = await wb.xlsx.writeBuffer();
  const nama = terpilih.length === 1 ? `Jadwal-Pelajaran_Kelas-${terpilih[0].grup}.xlsx` : 'Jadwal-Pelajaran_Semua-Kelas.xlsx';
  return {
    statusCode: 200,
    headers: { 'Content-Type': MIME_XLSX, 'Content-Disposition': `attachment; filename="${nama}"` },
    body: Buffer.from(buffer).toString('base64'),
    isBase64Encoded: true,
  };
};
