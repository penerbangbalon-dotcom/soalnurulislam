const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, nowJakarta, writeAudit, getClientIp } = require('./_lib/utils');
const { simpanAbsenManual, ALLOWED_STATUS } = require('./_lib/absenManual');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  // Menu ini KHUSUS Super Admin — dipakai untuk siswa yang tidak punya HP
  // sehingga tidak bisa absen mandiri lewat aplikasi.
  const auth = requireAdmin(event, { superAdminOnly: true });
  if (!auth) return json(403, { error: 'Hanya Super Admin yang dapat menginput absen manual.' });

  const supabase = supabaseAdmin();
  const ip = getClientIp(event);
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }

  const { student_id, status, keterangan } = body;
  const { tanggal: hariIni, jam: jamSekarang } = nowJakarta();
  const tanggal = body.tanggal || hariIni;

  if (!student_id || !ALLOWED_STATUS.includes(status)) {
    return json(400, { error: `student_id dan status (${ALLOWED_STATUS.join('/')}) wajib diisi.` });
  }

  const hasil = await simpanAbsenManual(supabase, {
    studentId: student_id, tanggal, hariIni, jamSekarang, status,
    jamDatang: body.jam_datang, jamPulang: body.jam_pulang, keterangan,
    adminId: auth.sub, adminEmail: auth.email,
  });

  if (!hasil.ok) return json(400, { error: hasil.error });

  await writeAudit(supabase, {
    actorType: 'ADMIN',
    actorId: auth.sub,
    actorLabel: auth.email,
    action: 'ABSEN_MANUAL',
    detail: { student_id, nama: hasil.nama, tanggal, status, jam_datang: body.jam_datang || null, jam_pulang: body.jam_pulang || null },
    ip,
  });

  return json(200, { ok: true, tanggal, status });
};
