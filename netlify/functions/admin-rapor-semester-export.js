const ExcelJS = require('exceljs');
const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');
const { buildRapor } = require('./admin-rapor-semester');

const HEADERS = ['NISN', 'Nama', 'Kelas', 'Program', 'Jenjang', 'Total Hari', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa', 'Persentase (%)', 'Deskripsi Kehadiran (untuk Rapor)'];

function toRowArray(r) {
  return [
    r.nisn || '-', r.nama, r.kelas, (r.program || '').replace('_', ' '), r.jenjang,
    r.total_hari, r.hadir, r.terlambat, r.izin, r.sakit, r.alpa, r.persentase, r.deskripsi,
  ];
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
  const format = (q.format || 'xlsx').toLowerCase();

  let result;
  try {
    result = await buildRapor(supabase, q);
  } catch (e) {
    console.error('admin-rapor-semester-export error:', e);
    return json(500, { error: 'Gagal mengambil data untuk ekspor.' });
  }
  const data = result.data;

  const namaFile = `Rekap_Semester_${q.program || 'Semua'}_${q.tanggal_mulai}_${q.tanggal_akhir}`;

  await writeAudit(supabase, {
    actorType: 'ADMIN',
    actorId: auth.sub,
    action: 'EXPORT_RAPOR_SEMESTER',
    detail: { format, filter: q, jumlah: data.length },
  });

  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rekap Semester');
    ws.addRow(HEADERS).font = { bold: true };
    data.forEach((r) => ws.addRow(toRowArray(r)));
    ws.columns.forEach((c, i) => { c.width = i === HEADERS.length - 1 ? 70 : 16; });
    ws.getColumn(HEADERS.length).alignment = { wrapText: true, vertical: 'top' };
    data.forEach((r, i) => {
      if (r.persentase < 75) {
        ws.getRow(i + 2).eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBE7E5' } };
        });
      }
    });
    const buffer = await wb.xlsx.writeBuffer();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${namaFile}.xlsx"`,
      },
      body: Buffer.from(buffer).toString('base64'),
      isBase64Encoded: true,
    };
  }

  const lines = [HEADERS.map(csvEscape).join(',')];
  data.forEach((r) => lines.push(toRowArray(r).map(csvEscape).join(',')));
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${namaFile}.csv"`,
    },
    body: '\uFEFF' + lines.join('\n'),
  };
};
