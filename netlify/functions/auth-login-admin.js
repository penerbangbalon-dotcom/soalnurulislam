const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { signAdminToken } = require('./_lib/auth');
const { json, preflight, writeAudit, checkRateLimit, getClientIp } = require('./_lib/utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabase = supabaseAdmin();
  const ip = getClientIp(event);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) return json(400, { error: 'Email dan password wajib diisi.' });

  const okRate = await checkRateLimit(supabase, `admin-login:${email}:${ip}`, { max: 10, windowSeconds: 300 });
  if (!okRate) return json(429, { error: 'Terlalu banyak percobaan login. Coba lagi nanti.' });

  const { data: admin, error } = await supabase.from('admins').select('*').eq('email', email).maybeSingle();
  if (error || !admin || !admin.aktif) {
    await writeAudit(supabase, { actorType: 'SYSTEM', action: 'ADMIN_LOGIN_GAGAL', detail: { email }, ip });
    return json(401, { error: 'Email atau password salah.' });
  }

  const match = bcrypt.compareSync(password, admin.password_hash);
  if (!match) {
    await writeAudit(supabase, { actorType: 'ADMIN', actorId: admin.id, actorLabel: admin.nama, action: 'ADMIN_LOGIN_GAGAL', ip });
    return json(401, { error: 'Email atau password salah.' });
  }

  const token = signAdminToken(admin);
  await writeAudit(supabase, { actorType: 'ADMIN', actorId: admin.id, actorLabel: admin.nama, action: 'ADMIN_LOGIN', ip });

  return json(200, { token, admin: { id: admin.id, nama: admin.nama, email: admin.email, role: admin.role } });
};
