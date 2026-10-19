const crypto = require('crypto');
const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, nowJakarta, writeAudit } = require('./_lib/utils');

const TOKEN_DURATION_MINUTES = 15;

function generateToken() {
  // 6 karakter alfanumerik, hindari karakter ambigu (0/O, 1/I)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });

  const supabase = supabaseAdmin();
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }

  const program = body.program; // PAKET_B | PAKET_C
  const sesi = body.sesi; // DATANG | PULANG
  if (!['PAKET_B', 'PAKET_C'].includes(program) || !['DATANG', 'PULANG'].includes(sesi)) {
    return json(400, { error: 'Program atau sesi tidak valid.' });
  }

  const autoRotate = body.auto_rotate !== false; // default true

  const { tanggal, instant } = nowJakarta();
  const token = generateToken();
  const expiresAt = new Date(instant.getTime() + TOKEN_DURATION_MINUTES * 60 * 1000);

  // Nonaktifkan sesi lama yang sejenis (program+sesi+tanggal) sebelum membuat yang baru
  await supabase
    .from('attendance_sessions')
    .update({ is_active: false })
    .eq('program', program)
    .eq('sesi', sesi)
    .eq('tanggal', tanggal)
    .eq('is_active', true);

  const { data: session, error } = await supabase
    .from('attendance_sessions')
    .insert({
      tanggal, program, sesi, token, token_type: 'QR',
      issued_at: instant.toISOString(), expires_at: expiresAt.toISOString(),
      issued_by: auth.sub, is_active: true, auto_rotate: autoRotate,
    })
    .select()
    .single();

  if (error) return json(500, { error: 'Gagal membuat token absensi.' });

  await writeAudit(supabase, {
    actorType: 'ADMIN', actorId: auth.sub, action: 'ROTATE_TOKEN',
    detail: { program, sesi, token, expires_at: expiresAt.toISOString() },
  });

  return json(200, {
    id: session.id,
    program, sesi, token,
    issued_at: session.issued_at,
    expires_at: session.expires_at,
    durasi_menit: TOKEN_DURATION_MINUTES,
  });
};
