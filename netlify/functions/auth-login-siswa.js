const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { signSiswaToken } = require('./_lib/auth');
const { json, preflight, writeAudit, checkRateLimit, getClientIp } = require('./_lib/utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabase = supabaseAdmin();
  const ip = getClientIp(event);

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Body tidak valid' });
  }
  const nisn = String(body.nisn || '').trim();
  const password = String(body.password || '');

  if (!nisn || !password) {
    return json(400, { error: 'NISN dan password wajib diisi.' });
  }

  const okRate = await checkRateLimit(supabase, `login:${nisn}:${ip}`, { max: 10, windowSeconds: 300 });
  if (!okRate) {
    await writeAudit(supabase, { actorType: 'SYSTEM', action: 'LOGIN_RATE_LIMITED', detail: { nisn }, ip });
    return json(429, { error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' });
  }

  const { data: student, error } = await supabase
    .from('students')
    .select('*')
    .eq('nisn', nisn)
    .maybeSingle();

  if (error || !student) {
    await writeAudit(supabase, { actorType: 'SYSTEM', action: 'LOGIN_GAGAL', detail: { nisn, alasan: 'NISN tidak ditemukan' }, ip });
    return json(401, { error: 'NISN atau password salah.' });
  }

  if (student.status !== 'AKTIF') {
    return json(403, { error: 'Akun siswa tidak aktif. Hubungi admin.' });
  }

  if (!student.password_hash) {
    return json(403, { error: 'Akun belum diaktifkan admin (data tanggal lahir belum lengkap). Hubungi admin.' });
  }

  const match = bcrypt.compareSync(password, student.password_hash);
  if (!match) {
    await writeAudit(supabase, { actorType: 'SISWA', actorId: student.id, actorLabel: student.nama, action: 'LOGIN_GAGAL', detail: { alasan: 'password salah' }, ip });
    return json(401, { error: 'NISN atau password salah.' });
  }

  const token = signSiswaToken(student);
  await writeAudit(supabase, { actorType: 'SISWA', actorId: student.id, actorLabel: student.nama, action: 'LOGIN', ip });

  const { password_hash, ...safeStudent } = student;
  return json(200, {
    token,
    must_change_password: student.must_change_password,
    student: safeStudent,
  });
};
