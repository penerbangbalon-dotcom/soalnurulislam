/**
 * Pembuat berkas Word "Daftar Hadir & Tanda Tangan Siswa per Mata Pelajaran".
 * Satu berkas = satu grup kelas (mis. "7", "10", "11") pada satu tanggal.
 * Format mengikuti contoh rekap-absensi-ttd-siswa: kop surat, judul, info, lalu tabel
 * No | Nama Siswa | Jam Scan | kolom tanda tangan per mapel | Ket.
 * Kolom mapel diisi otomatis dari Jadwal Pelajaran hari tsb (kosong bila jadwal belum diisi).
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, ImageRun, Footer, PageNumber,
  WidthType, AlignmentType, BorderStyle, ShadingType, VerticalAlign, HeightRule, TableLayoutType,
  VerticalMergeType, PageOrientation,
} = require('docx');
const { PROGRAM_LABEL, tanggalPanjang } = require('./kelasGrup');

const FONT = 'Arial';
const KOLOM_KOSONG = 4; // jumlah kolom kosong bila jadwal hari itu belum diisi (sama seperti contoh)
const MAKS_PORTRAIT = 4; // lebih dari ini -> kertas dibuat landscape agar kolom tidak sempit

const tanpaBorder = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};
const garis = { style: BorderStyle.SINGLE, size: 6, color: '444444' };
const borderGrid = { top: garis, bottom: garis, left: garis, right: garis };
const marginSel = { top: 40, bottom: 40, left: 70, right: 70 };

const titik = (hhmm) => String(hhmm).slice(0, 5).replace(':', '.');

/**
 * Susun kolom mapel dari slot jam belajar + jadwal hari tsb.
 * - Hanya slot PELAJARAN yang punya mapel yang jadi kolom.
 * - Jam berurutan (tanpa istirahat di antaranya) dengan mapel sama digabung (mis. "Jam ke: 1–2").
 */
function susunKolomMapel(slots, jadwalHari) {
  const peta = new Map((jadwalHari || []).map((j) => [Number(j.jam_ke), String(j.mapel || '').trim()]));
  const kolom = [];
  let terakhir = null;
  for (const s of (slots || []).filter((x) => x.jenis === 'PELAJARAN')) {
    const mapel = peta.get(Number(s.jam_ke));
    if (!mapel) { terakhir = null; continue; }
    const bersambung = terakhir
      && terakhir.mapel.toLowerCase() === mapel.toLowerCase()
      && terakhir.urutAkhir + 1 === s.urut;
    if (bersambung) {
      terakhir.jamAkhir = s.jam_ke; terakhir.selesai = String(s.selesai).slice(0, 5); terakhir.urutAkhir = s.urut;
    } else {
      terakhir = { mapel, jamAwal: s.jam_ke, jamAkhir: s.jam_ke, mulai: String(s.mulai).slice(0, 5), selesai: String(s.selesai).slice(0, 5), urutAkhir: s.urut };
      kolom.push(terakhir);
    }
  }
  return kolom.map((k) => ({
    mapel: k.mapel,
    jamKe: k.jamAwal === k.jamAkhir ? String(k.jamAwal) : `${k.jamAwal}–${k.jamAkhir}`,
    waktu: `${titik(k.mulai)}–${titik(k.selesai)}`,
  }));
}

function run(text, { size = 18, bold = false, italics = false, color } = {}) {
  return new TextRun({ text: String(text ?? ''), font: FONT, size, bold, italics, color });
}
function para(children, { align = AlignmentType.LEFT, before = 0, after = 0 } = {}) {
  return new Paragraph({ alignment: align, spacing: { before, after }, children: Array.isArray(children) ? children : [children] });
}

/** Ukuran asli PNG dari header-nya (supaya logo tidak gepeng). */
function ukuranPng(buf) {
  if (buf.length > 24 && buf.toString('ascii', 1, 4) === 'PNG') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  return null;
}
function ambilLogo(sekolah) {
  let buf = null;
  const url = sekolah && sekolah.kop_logo;
  if (typeof url === 'string' && url.startsWith('data:image/png;base64,')) {
    try { buf = Buffer.from(url.split(',')[1], 'base64'); } catch { buf = null; }
  }
  if (!buf) {
    try { buf = fs.readFileSync(path.join(__dirname, 'logo-pkbm.png')); } catch { buf = null; }
  }
  if (!buf) return null;
  const lebar = Math.min(Math.max(Number(sekolah && sekolah.kop_logo_lebar) || 76, 40), 140);
  const dim = ukuranPng(buf);
  const tinggi = dim ? Math.round((lebar * dim.h) / dim.w) : lebar;
  return { buf, lebar, tinggi };
}

function barisKop(sekolah) {
  const baris = [];
  const tambah = (t, opts) => { if (t) baris.push(para(run(t, opts), { align: AlignmentType.CENTER })); };
  tambah(sekolah.yayasan_nama && String(sekolah.yayasan_nama).toUpperCase(), { size: 22, bold: true });
  baris.push(para(run('PUSAT KEGIATAN BELAJAR MASYARAKAT (PKBM)', { size: 24, bold: true }), { align: AlignmentType.CENTER }));
  const namaPkbm = String(sekolah.nama_sekolah || '').replace(/^\s*PKBM\s+/i, '').trim().toUpperCase();
  tambah(namaPkbm, { size: 40, bold: true });
  tambah(sekolah.npsn && `NPSN : ${sekolah.npsn}`, { size: 20, bold: true });
  tambah(sekolah.sk_kemenhukum && `SK Kemenhukam No : ${sekolah.sk_kemenhukum}`, { size: 17 });
  const ijin = String(sekolah.ijin_operasional || '').trim();
  tambah(ijin && (/^ij[ie]n/i.test(ijin) ? ijin : `Ijin Operasional No. ${ijin}`), { size: 17 });
  tambah(sekolah.alamat, { size: 17 });
  return baris;
}

function tabelKop(sekolah, W) {
  const logo = ambilLogo(sekolah);
  const sel = (lebar, anak) => new TableCell({
    width: { size: lebar, type: WidthType.DXA }, borders: tanpaBorder, verticalAlign: VerticalAlign.CENTER, children: anak,
  });
  const anakLogo = logo
    ? [new Paragraph({ alignment: AlignmentType.LEFT, children: [new ImageRun({ type: 'png', data: logo.buf, transformation: { width: logo.lebar, height: logo.tinggi }, altText: { title: 'Logo', description: 'Logo PKBM', name: 'logo' } })] })]
    : [new Paragraph({ children: [] })];
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [1500, W - 1500], layout: TableLayoutType.FIXED,
    borders: { ...tanpaBorder, insideHorizontal: tanpaBorder.top, insideVertical: tanpaBorder.top },
    rows: [new TableRow({ children: [sel(1500, anakLogo), sel(W - 1500, barisKop(sekolah))] })],
  });
}

function tabelInfo(W, { tanggal, grup, program, jumlah }) {
  const baris = (label, nilai) => new TableRow({
    children: [
      new TableCell({ width: { size: 2500, type: WidthType.DXA }, borders: tanpaBorder, children: [para(run(label, { size: 21, bold: true }))] }),
      new TableCell({ width: { size: W - 2500, type: WidthType.DXA }, borders: tanpaBorder, children: [para(run(`: ${nilai}`, { size: 21 }))] }),
    ],
  });
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [2500, W - 2500], layout: TableLayoutType.FIXED,
    borders: { ...tanpaBorder, insideHorizontal: tanpaBorder.top, insideVertical: tanpaBorder.top },
    rows: [
      baris('Hari / Tanggal', tanggalPanjang(tanggal)),
      baris('Kelas', `${grup}  —  ${PROGRAM_LABEL[program] || program}`),
      baris('Sudah scan masuk', `${jumlah} siswa`),
    ],
  });
}

function selHeader(lebar, anak, { span, vMerge, align = AlignmentType.CENTER, valign = VerticalAlign.CENTER, isi = true } = {}) {
  return new TableCell({
    width: { size: lebar, type: WidthType.DXA },
    columnSpan: span,
    verticalMerge: vMerge,
    borders: borderGrid,
    margins: marginSel,
    verticalAlign: valign,
    shading: isi ? { type: ShadingType.CLEAR, fill: 'E8EEFC', color: 'auto' } : undefined,
    children: anak,
  });
}

function tabelUtama(W, siswa, kolom) {
  const landscape = kolom.length > MAKS_PORTRAIT;
  const n = kolom.length || KOLOM_KOSONG;
  const wNo = landscape ? 500 : 450;
  const wJam = landscape ? 800 : 700;
  const wKet = landscape ? 1400 : 756;
  const wNama = landscape ? 3400 : 2900;
  const area = W - wNo - wNama - wJam - wKet;
  const wMapel = Math.floor(area / n);
  const lebarKolom = Array.from({ length: n }, (_, i) => (i === n - 1 ? area - wMapel * (n - 1) : wMapel));
  const grid = [wNo, wNama, wJam, ...lebarKolom, wKet];

  const kecil = (t, opts = {}) => para(run(t, { size: 16, ...opts }));
  const hdr1 = new TableRow({
    cantSplit: true, tableHeader: true,
    children: [
      selHeader(wNo, [para(run('No', { size: 17, bold: true }), { align: AlignmentType.CENTER })], { vMerge: VerticalMergeType.RESTART }),
      selHeader(wNama, [para(run('Nama Siswa', { size: 17, bold: true }), { align: AlignmentType.CENTER })], { vMerge: VerticalMergeType.RESTART }),
      selHeader(wJam, [para(run('Jam Scan', { size: 17, bold: true }), { align: AlignmentType.CENTER })], { vMerge: VerticalMergeType.RESTART }),
      selHeader(area, [para(run('TANDA TANGAN SISWA PER MATA PELAJARAN', { size: 17, bold: true }), { align: AlignmentType.CENTER })], { span: n }),
      selHeader(wKet, [para(run('Ket.', { size: 17, bold: true }), { align: AlignmentType.CENTER })], { vMerge: VerticalMergeType.RESTART }),
    ],
  });

  const selMapel = (k, i) => {
    const anak = k
      ? [
          para([run('Mapel: ', { size: 16, bold: true }), run(k.mapel, { size: 16 })], { after: 40 }),
          para([run('Jam ke: ', { size: 16, bold: true }), run(k.jamKe, { size: 16 })], { after: 20 }),
          kecil(k.waktu, { color: '555555', size: 14 }),
        ]
      : [para(run('Mapel:', { size: 16, bold: true }), { after: 260 }), kecil('Jam ke:', { bold: true })];
    return selHeader(lebarKolom[i], anak, { align: AlignmentType.LEFT, valign: VerticalAlign.TOP });
  };
  const hdr2 = new TableRow({
    cantSplit: true, tableHeader: true, height: { value: 900, rule: HeightRule.ATLEAST },
    children: [
      selHeader(wNo, [new Paragraph({ children: [] })], { vMerge: VerticalMergeType.CONTINUE, isi: false }),
      selHeader(wNama, [new Paragraph({ children: [] })], { vMerge: VerticalMergeType.CONTINUE, isi: false }),
      selHeader(wJam, [new Paragraph({ children: [] })], { vMerge: VerticalMergeType.CONTINUE, isi: false }),
      ...Array.from({ length: n }, (_, i) => selMapel(kolom[i], i)),
      selHeader(wKet, [new Paragraph({ children: [] })], { vMerge: VerticalMergeType.CONTINUE, isi: false }),
    ],
  });

  const selData = (lebar, teks, { size = 18, align = AlignmentType.LEFT } = {}) => new TableCell({
    width: { size: lebar, type: WidthType.DXA }, borders: borderGrid, margins: marginSel, verticalAlign: VerticalAlign.CENTER,
    children: [para(run(teks, { size }), { align })],
  });
  const barisSiswa = siswa.map((s, idx) => new TableRow({
    cantSplit: true, height: { value: 480, rule: HeightRule.ATLEAST },
    children: [
      selData(wNo, String(idx + 1), { align: AlignmentType.CENTER }),
      selData(wNama, s.nama, { size: 19 }),
      selData(wJam, s.jam || '', { align: AlignmentType.CENTER }),
      ...lebarKolom.map((l) => selData(l, '')),
      selData(wKet, ''),
    ],
  }));

  return {
    landscape,
    tabel: new Table({
      width: { size: W, type: WidthType.DXA }, columnWidths: grid, layout: TableLayoutType.FIXED,
      borders: { top: garis, bottom: garis, left: garis, right: garis, insideHorizontal: garis, insideVertical: garis },
      rows: [hdr1, hdr2, ...barisSiswa],
    }),
  };
}

/**
 * @param {object} p
 * @param {object} p.sekolah  baris school_settings (kop)
 * @param {string} p.grup     mis. "7", "10"
 * @param {string} p.program  PAKET_B | PAKET_C
 * @param {string} p.tanggal  YYYY-MM-DD
 * @param {{nama:string, jam:string}[]} p.siswa  sudah terurut
 * @param {{mapel:string, jamKe:string, waktu:string}[]} p.kolom  dari susunKolomMapel()
 * @returns {Promise<Buffer>}
 */
async function buatDokumenRekap({ sekolah, grup, program, tanggal, siswa, kolom }) {
  const landscape = (kolom || []).length > MAKS_PORTRAIT;
  const W = landscape ? 16838 - 1700 : 11906 - 1700; // lebar isi halaman (DXA)
  const { tabel } = tabelUtama(W, siswa, kolom || []);

  const doc = new Document({
    creator: 'Absensi Digital PKBM',
    title: `Daftar Hadir & Tanda Tangan Siswa — Kelas ${grup} — ${tanggal}`,
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
          margin: { top: 700, right: 850, bottom: 800, left: 850, header: 708, footer: 400 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: '999999', space: 4 } },
            children: [
              new TextRun({ text: `Daftar Hadir & Tanda Tangan Siswa  |  Kelas ${grup}  |  ${tanggalPanjang(tanggal)}  |  Hal. `, font: FONT, size: 15, color: '555555' }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 15, color: '555555' }),
            ],
          })],
        }),
      },
      children: [
        tabelKop(sekolah || {}, W),
        new Paragraph({ border: { bottom: { style: BorderStyle.DOUBLE, size: 12, color: '000000', space: 1 } }, spacing: { before: 40, after: 90 }, children: [] }),
        para(run('DAFTAR HADIR & TANDA TANGAN SISWA PER MATA PELAJARAN', { size: 24, bold: true }), { align: AlignmentType.CENTER, after: 40 }),
        para(run('Bukti kehadiran siswa di setiap jam pelajaran', { size: 18, italics: true, color: '444444' }), { align: AlignmentType.CENTER, after: 100 }),
        tabelInfo(W, { tanggal, grup, program, jumlah: siswa.length }),
        para(run('Catatan: tiap siswa menandatangani sendiri pada mapel yang diikuti; kolom kosong = tidak mengikuti mapel tersebut.', { size: 16, italics: true, color: '444444' }), { before: 80, after: 80 }),
        tabel,
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

module.exports = { buatDokumenRekap, susunKolomMapel };
