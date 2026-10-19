const ExcelJS = require('exceljs');
const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');
const { fetchPersentase } = require('./admin-persentase');

const HEADERS = ['NISN', 'Nama', 'Kelas', 'Program', 'Jenjang', 'Total Hari', 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Persentase (%)'];

function toRowArray(r) {
  return [
    r.nisn || '-', r.nama, r.kelas, (r.program || '').replace('_', ' '), r.jenjang,
    r.total_hari, r.hadir, r.izin, r.sakit, r.alpa, r.persentase,
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
  const format = (q.format || 'csv').toLowerCase();

  let data;
  try {
    data = await fetchPersentase(supabase, q);
  } catch (e) {
    console.error('admin-persentase-export error:', e);
    return json(500, { error: 'Gagal mengambil data untuk ekspor.' });
  }

  const namaFile = `Persentase_Kehadiran_${q.program || 'Semua'}_${q.tanggal_mulai}_${q.tanggal_akhir}`;

  await writeAudit(supabase, {
    actorType: 'ADMIN',
    actorId: auth.sub,
    action: 'EXPORT_PERSENTASE_KEHADIRAN',
    detail: { format, filter: q, jumlah: data.length },
  });

  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Persentase Kehadiran');
    ws.addRow(HEADERS).font = { bold: true };
    data.forEach((r) => ws.addRow(toRowArray(r)));
    ws.columns.forEach((c) => { c.width = 16; });
    // Warnai baris dengan persentase rendah (<75%) supaya langsung kelihatan.
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

  // default: CSV
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
