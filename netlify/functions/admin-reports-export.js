const ExcelJS = require('exceljs');
const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');
const { fetchRekap } = require('./admin-reports');

const HEADERS = ['NISN', 'Nama', 'Jenjang', 'Program', 'Kelas', 'Tanggal', 'Jam Datang', 'Status Datang', 'Jam Pulang', 'Status Pulang', 'Keterangan'];

function toRowArray(r) {
  return [
    r.nisn, r.nama, r.jenjang, r.program, r.kelas, r.tanggal,
    r.jam_datang ? new Date(r.jam_datang).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-',
    r.status_datang || '-',
    r.jam_pulang ? new Date(r.jam_pulang).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-',
    r.status_pulang || '-',
    r.keterangan || '',
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

  const supabase = supabaseAdmin();
  const q = event.queryStringParameters || {};
  const format = (q.format || 'csv').toLowerCase();

  let data;
  try {
    data = await fetchRekap(supabase, q);
  } catch {
    return json(500, { error: 'Gagal mengambil data untuk ekspor.' });
  }

  const namaFile = `Rekap_Absensi_${q.program || 'Semua'}_${(q.tanggal_mulai || 'awal')}_${(q.tanggal_akhir || 'akhir')}`;

  await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'EXPORT_REKAP', detail: { format, filter: q, jumlah: data.length } });

  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rekap Absensi');
    ws.addRow(HEADERS).font = { bold: true };
    data.forEach((r) => ws.addRow(toRowArray(r)));
    ws.columns.forEach((c) => { c.width = 16; });
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
