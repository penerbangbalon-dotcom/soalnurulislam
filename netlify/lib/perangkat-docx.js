// Pembuat berkas Word (.docx) untuk RPP & Modul Ajar.
// Isi dokumen = daftar bagian bertipe "markdown ringan" (lihat perangkat-format.js) -> dikonversi ke paragraf, daftar, dan tabel Word.
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, ImageRun, Footer, PageNumber,
  WidthType, AlignmentType, BorderStyle, ShadingType, VerticalAlign, LevelFormat,
} = require('docx');
const { FORMAT } = require('./perangkat-format');

const FONT = 'Times New Roman';
const UKURAN = 22;            // 11 pt
const LEBAR = 9638;           // lebar isi A4 dengan margin 2 cm (DXA)
const MARGIN = 1134;

const tanpaBorder = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};
const garisTipis = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
const borderGrid = { top: garisTipis, bottom: garisTipis, left: garisTipis, right: garisTipis };

// ---------------------------------------------------------------------------------------------
// Parser markdown ringan -> blok
// ---------------------------------------------------------------------------------------------
function parseMd(teks) {
  const lines = String(teks || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let para = [], list = null, tbl = null;
  const flushPara = () => { if (para.length) { blocks.push({ t: 'p', text: para.join(' ') }); para = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };
  const flushTbl = () => {
    if (!tbl) return;
    const kolom = Math.max(...tbl.rows.map((r) => r.length));
    const rows = tbl.rows.map((r) => { const x = r.slice(); while (x.length < kolom) x.push(''); return x; });
    blocks.push({ t: 'table', rows, header: tbl.header });
    tbl = null;
  };
  const flushAll = () => { flushPara(); flushList(); flushTbl(); };

  for (const raw of lines) {
    const l = raw.trim();
    if (!l) { flushAll(); continue; }
    if (/^#{1,6}\s+/.test(l)) { flushAll(); blocks.push({ t: 'h', text: l.replace(/^#{1,6}\s+/, '') }); continue; }
    if (l.startsWith('|')) {
      flushPara(); flushList();
      if (!tbl) tbl = { rows: [], header: false };
      if (/^\|?[\s:|-]+\|?$/.test(l) && /-{2,}/.test(l)) { tbl.header = true; continue; }   // baris pemisah |---|---|
      tbl.rows.push(l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
      continue;
    }
    flushTbl();
    let m;
    if ((m = l.match(/^[-*\u2022]\s+(.*)$/))) {
      flushPara();
      if (!list || list.t !== 'ul') { flushList(); list = { t: 'ul', items: [] }; }
      list.items.push(m[1]); continue;
    }
    if ((m = l.match(/^(\d+)[.)]\s+(.*)$/))) {
      flushPara();
      if (!list || list.t !== 'ol') { flushList(); list = { t: 'ol', items: [] }; }
      list.items.push(m[2]); continue;
    }
    flushList();
    para.push(l);
  }
  flushAll();
  return blocks;
}

// "teks **tebal** teks" -> TextRun[]
function runs(teks, opsi = {}) {
  const bersih = String(teks || '').replace(/`/g, '').replace(/(^|[^*])\*(?!\*)([^*]+)\*(?!\*)/g, '$1$2');
  return bersih.split('**').map((seg, i) => ({ seg, tebal: i % 2 === 1 }))
    .filter((x) => x.seg !== '')
    .map((x) => new TextRun({ text: x.seg, bold: !!(opsi.bold || x.tebal), italics: !!opsi.italics, size: opsi.size || UKURAN, font: FONT, color: opsi.color }));
}

const P = (children, opts = {}) => new Paragraph({ children, ...opts });

function sel(isi, lebar, opts = {}) {
  const children = (Array.isArray(isi) ? isi : [isi]).map((x) => (typeof x === 'string'
    ? P(runs(x, { bold: opts.bold, size: opts.size }), { spacing: { after: 40 }, alignment: opts.align || AlignmentType.LEFT })
    : x));
  return new TableCell({
    children: children.length ? children : [P([])],
    width: { size: lebar, type: WidthType.DXA },
    borders: opts.borders || borderGrid,
    shading: opts.shade ? { type: ShadingType.CLEAR, fill: opts.shade, color: 'auto' } : undefined,
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
    verticalAlign: opts.valign || VerticalAlign.TOP,
  });
}

function tabelBlok(b) {
  const kolom = b.rows[0].length;
  const dasar = Math.floor(LEBAR / kolom);
  const lebar = Array.from({ length: kolom }, (_, i) => (i === kolom - 1 ? LEBAR - dasar * (kolom - 1) : dasar));
  const rows = b.rows.map((r, ri) => new TableRow({
    tableHeader: b.header && ri === 0,
    cantSplit: true,
    children: r.map((c, ci) => sel(c.split(/<br\s*\/?>/i), lebar[ci], { bold: b.header && ri === 0, shade: b.header && ri === 0 ? 'D9E2F3' : undefined, size: 20 })),
  }));
  return [new Table({ width: { size: LEBAR, type: WidthType.DXA }, columnWidths: lebar, rows }), P([], { spacing: { after: 80 } })];
}

function blokKeParagraf(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.t === 'h') {
      out.push(P(runs(b.text, { bold: true }), { spacing: { before: 120, after: 40 }, keepNext: true }));
    } else if (b.t === 'p') {
      out.push(P(runs(b.text), { alignment: AlignmentType.JUSTIFIED, spacing: { after: 80, line: 276 } }));
    } else if (b.t === 'ul') {
      b.items.forEach((it) => out.push(P(runs(it), { numbering: { reference: 'poin', level: 0 }, alignment: AlignmentType.LEFT, spacing: { after: 40, line: 276 } })));
    } else if (b.t === 'ol') {
      b.items.forEach((it, i) => out.push(P([new TextRun({ text: `${i + 1}.\t`, size: UKURAN, font: FONT }), ...runs(it)],
        { indent: { left: 360, hanging: 360 }, alignment: AlignmentType.LEFT, spacing: { after: 40, line: 276 } })));
    } else if (b.t === 'table') {
      out.push(...tabelBlok(b));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Bagian-bagian dokumen
// ---------------------------------------------------------------------------------------------
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function tanggalIndo(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).split('-');
  return `${parseInt(f[2], 10)} ${BULAN[parseInt(f[1], 10) - 1]} ${f[0]}`;
}

function bacaLogo() {
  try { return fs.readFileSync(path.join(__dirname, '..', 'functions', '_lib', 'logo-pkbm.png')); } catch (e) { return null; }
}

function kop(sekolah) {
  const logo = bacaLogo();
  const teks = [];
  if (sekolah.nama_yayasan) teks.push(P(runs(String(sekolah.nama_yayasan).toUpperCase(), { bold: true, size: 20 }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }));
  if (sekolah.nama_lembaga) teks.push(P(runs(String(sekolah.nama_lembaga).toUpperCase(), { bold: true, size: 22 }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }));
  if (sekolah.nama_singkat) teks.push(P(runs(String(sekolah.nama_singkat).toUpperCase(), { bold: true, size: 30 }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }));
  if (sekolah.alamat) teks.push(P(runs(sekolah.alamat, { size: 17 }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }));
  const kiri = logo
    ? [P([new ImageRun({ type: 'png', data: logo, transformation: { width: 72, height: 72 }, altText: { title: 'Logo', description: 'Logo PKBM', name: 'logo' } })], { alignment: AlignmentType.CENTER })]
    : [P([])];
  const tabel = new Table({
    width: { size: LEBAR, type: WidthType.DXA }, columnWidths: [1500, LEBAR - 1500],
    rows: [new TableRow({ children: [
      sel(kiri, 1500, { borders: tanpaBorder, valign: VerticalAlign.CENTER }),
      sel(teks, LEBAR - 1500, { borders: tanpaBorder, valign: VerticalAlign.CENTER }),
    ] })],
  });
  const garis = P([], { spacing: { after: 160 }, border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: '000000', space: 4 } } });
  return [tabel, garis];
}

function identitas(rows) {
  if (!rows || !rows.length) return [];
  const w1 = 2700, w2 = LEBAR - w1;
  const t = new Table({
    width: { size: LEBAR, type: WidthType.DXA }, columnWidths: [w1, w2],
    rows: rows.map(([l, v]) => new TableRow({ cantSplit: true, children: [
      sel(String(l || ''), w1, { bold: true, shade: 'F2F2F2', size: 21 }),
      sel(String(v == null ? '' : v).split('\n'), w2, { size: 21 }),
    ] })),
  });
  return [t, P([], { spacing: { after: 120 } })];
}

function blokTtd(perangkat, sekolah, ttd) {
  const kota = sekolah.kota_ttd || '';
  const tgl = ttd.tanggal || tanggalIndo();
  const garisNama = (nama, nip) => [
    P([], { spacing: { after: 700 } }),
    P(runs(nama || '..........................................', { bold: true }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
    P(runs(nip ? `NIP/NIK. ${nip}` : 'NIP/NIK. ......................', { size: 20 }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
  ];
  const kiri = [
    P(runs('Mengetahui,'), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
    P(runs(sekolah.jabatan_kepala || 'Kepala PKBM'), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
    ...garisNama(ttd.kepala_nama, ttd.kepala_nip),
  ];
  const kanan = [
    P(runs(`${kota ? kota + ', ' : ''}${tgl}`), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
    P(runs('Pendidik Mata Pelajaran'), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
    ...garisNama(perangkat.penyusun, perangkat.nip_penyusun),
  ];
  const tampilKepala = ttd.tampil_ttd_kepala !== false;
  const w = tampilKepala ? LEBAR / 2 : LEBAR;
  const sels = tampilKepala
    ? [sel(kiri, LEBAR / 2, { borders: tanpaBorder }), sel(kanan, LEBAR / 2, { borders: tanpaBorder })]
    : [sel(kanan, w, { borders: tanpaBorder })];
  const lebarKolom = tampilKepala ? [LEBAR / 2, LEBAR / 2] : [LEBAR];
  return [
    P([], { spacing: { before: 240, after: 120 } }),
    new Table({ width: { size: LEBAR, type: WidthType.DXA }, columnWidths: lebarKolom, rows: [new TableRow({ cantSplit: true, children: sels })] }),
  ];
}

// ---------------------------------------------------------------------------------------------
async function buatDokumen({ perangkat, sekolah = {}, ttd = {} }) {
  const jenis = perangkat.jenis === 'modul' ? 'modul' : 'rpp';
  const fmt = FORMAT[perangkat.format] || FORMAT.pm;
  const isi = perangkat.isi || {};
  const children = [];

  children.push(...kop(sekolah));
  children.push(P(runs(fmt.judul[jenis], { bold: true, size: 28 }), { alignment: AlignmentType.CENTER, spacing: { after: 40 } }));
  if (perangkat.judul) children.push(P(runs(perangkat.judul, { bold: true, size: 24 }), { alignment: AlignmentType.CENTER, spacing: { after: 40 } }));
  children.push(P(runs(fmt.acuan, { italics: true, size: 18, color: '555555' }), { alignment: AlignmentType.CENTER, spacing: { after: 160 } }));
  children.push(...identitas(isi.identitas));

  let grupSekarang = null;
  for (const b of isi.bagian || []) {
    if (b.grup && b.grup !== grupSekarang) {
      grupSekarang = b.grup;
      children.push(new Paragraph({
        children: runs(b.grup, { bold: true, size: 23 }),
        shading: { type: ShadingType.CLEAR, fill: 'E7ECF4', color: 'auto' },
        spacing: { before: 240, after: 100 }, keepNext: true,
      }));
    }
    if (b.judul) children.push(P(runs(b.judul, { bold: true }), { spacing: { before: 100, after: 40 }, keepNext: true }));
    children.push(...blokKeParagraf(parseMd(b.teks)));
  }
  children.push(...blokTtd(perangkat, sekolah, ttd));

  const doc = new Document({
    creator: sekolah.nama_singkat || 'PKBM',
    title: perangkat.judul || fmt.judul[jenis],
    styles: { default: { document: { run: { font: FONT, size: UKURAN } } } },
    numbering: { config: [{ reference: 'poin', levels: [{
      level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 540, hanging: 270 } } },
    }] }] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      footers: { default: new Footer({ children: [P([
        new TextRun({ text: `${perangkat.mapel_nama || ''}${perangkat.mapel_nama ? ' - ' : ''}${perangkat.judul || ''}   |   Halaman `, size: 16, font: FONT, color: '666666' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, font: FONT, color: '666666' }),
      ], { alignment: AlignmentType.CENTER })] }) },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}

module.exports = { buatDokumen, parseMd, tanggalIndo };
