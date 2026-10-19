const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, nowJakarta } = require('./_lib/utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });

  const supabase = supabaseAdmin();
  const { tanggal, instant } = nowJakarta();

  const { data: sessions } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('tanggal', tanggal)
    .eq('is_active', true)
    .gt('expires_at', instant.toISOString())
    .order('issued_at', { ascending: false });

  const result = {};
  for (const combo of ['PAKET_B:DATANG', 'PAKET_B:PULANG', 'PAKET_C:DATANG', 'PAKET_C:PULANG']) {
    const [program, sesi] = combo.split(':');
    const found = (sessions || []).find((s) => s.program === program && s.sesi === sesi);
    result[combo] = found
      ? { token: found.token, issued_at: found.issued_at, expires_at: found.expires_at, auto_rotate: found.auto_rotate }
      : null;
  }

  return json(200, { tanggal, server_time: instant.toISOString(), sessions: result });
};
