const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, nowJakarta, writeAudit } = require('./_lib/utils');

const ALLOWED_STATUS = ['IZIN', 'SAKIT', 'TIDAK_HADIR', 'HADIR', 'TERLAMBAT'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });

  const supabase = supabaseAdmin();
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }

  const { student_id, status, keterangan } = body;
  const tanggal = body.tanggal || nowJakarta().tanggal;

  if (!student_id || !ALLOWED_STATUS.includes(status)) {
    return json(400, { error: 'student_id dan status (IZIN/SAKIT/TIDAK_HADIR/HADIR/TERLAMBAT) wajib diisi.' });
  }

  const { data: existing } = await supabase
    .from('attendance').select('id').eq('student_id', student_id).eq('tanggal', tanggal).maybeSingle();

  const row = {
    student_id, tanggal, checkin_status: status, keterangan: keterangan || null,
    set_by_admin: auth.sub, verified_by_admin: true, updated_at: new Date().toISOString(),
  };

  let error;
  if (existing) {
    ({ error } = await supabase.from('attendance').update(row).eq('id', existing.id));
  } else {
    ({ error } = await supabase.from('attendance').insert(row));
  }
  if (error) return json(500, { error: 'Gagal menyimpan status.' });

  await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'SET_STATUS_MANUAL', detail: { student_id, tanggal, status } });
  return json(200, { ok: true });
};
