const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, nowJakarta, writeAudit } = require('./_lib/utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });

  const supabase = supabaseAdmin();
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }

  const program = body.program;
  const sesi = body.sesi;
  if (!['PAKET_B', 'PAKET_C'].includes(program) || !['DATANG', 'PULANG'].includes(sesi)) {
    return json(400, { error: 'Program atau sesi tidak valid.' });
  }

  const { tanggal } = nowJakarta();
  const { error } = await supabase
    .from('attendance_sessions')
    .update({ is_active: false, auto_rotate: false })
    .eq('program', program)
    .eq('sesi', sesi)
    .eq('tanggal', tanggal)
    .eq('is_active', true);

  if (error) return json(500, { error: 'Gagal menghentikan sesi.' });

  await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'STOP_SESI', detail: { program, sesi } });
  return json(200, { ok: true });
};
