const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireSiswa } = require('./_lib/auth');
const { json, preflight, nowJakarta } = require('./_lib/utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireSiswa(event);
  if (!auth) return json(401, { error: 'Sesi tidak valid. Silakan login kembali.' });

  const supabase = supabaseAdmin();
  const { data: student, error } = await supabase.from('students').select('*').eq('id', auth.sub).maybeSingle();
  if (error || !student) return json(404, { error: 'Data siswa tidak ditemukan.' });

  const { tanggal, instant } = nowJakarta();

  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', student.id)
    .eq('tanggal', tanggal)
    .maybeSingle();

  let sesiInfo = { datang: null, pulang: null };
  if (student.program === 'PAKET_B' || student.program === 'PAKET_C') {
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('program', student.program)
      .eq('tanggal', tanggal)
      .eq('is_active', true)
      .gt('expires_at', instant.toISOString())
      .order('issued_at', { ascending: false });

    for (const s of sessions || []) {
      if (s.sesi === 'DATANG' && !sesiInfo.datang) sesiInfo.datang = { expires_at: s.expires_at, token_type: s.token_type };
      if (s.sesi === 'PULANG' && !sesiInfo.pulang) sesiInfo.pulang = { expires_at: s.expires_at, token_type: s.token_type };
    }
  }

  const { password_hash, ...safeStudent } = student;
  return json(200, {
    student: safeStudent,
    tanggal,
    server_time: instant.toISOString(),
    attendance: attendance || null,
    sesi_aktif: sesiInfo,
  });
};
