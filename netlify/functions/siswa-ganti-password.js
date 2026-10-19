const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireSiswa } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const auth = requireSiswa(event);
  if (!auth) return json(401, { error: 'Sesi tidak valid. Silakan login kembali.' });

  const supabase = supabaseAdmin();
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }

  const passwordBaru = String(body.password_baru || '');
  if (passwordBaru.length < 6) {
    return json(400, { error: 'Password baru minimal 6 karakter.' });
  }

  const hash = bcrypt.hashSync(passwordBaru, 10);
  const { error } = await supabase
    .from('students')
    .update({ password_hash: hash, must_change_password: false, updated_at: new Date().toISOString() })
    .eq('id', auth.sub);

  if (error) return json(500, { error: 'Gagal memperbarui password.' });

  await writeAudit(supabase, { actorType: 'SISWA', actorId: auth.sub, action: 'GANTI_PASSWORD' });
  return json(200, { ok: true });
};
