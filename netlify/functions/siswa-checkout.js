const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireSiswa } = require('./_lib/auth');
const {
  json, preflight, haversineMeters, nowJakarta, isoWeekdayJakarta,
  writeAudit, writeSecurityEvent, checkRateLimit, getClientIp,
} = require('./_lib/utils');
const { ambilJadwalAbsen } = require('./_lib/jadwalAbsen');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const auth = requireSiswa(event);
  if (!auth) return json(401, { error: 'Sesi tidak valid. Silakan login kembali.' });

  const supabase = supabaseAdmin();
  const ip = getClientIp(event);
  const studentId = auth.sub;

  const okRate = await checkRateLimit(supabase, `checkout:${studentId}`, { max: 6, windowSeconds: 60 });
  if (!okRate) return json(429, { error: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const accuracy = body.accuracy != null ? Number(body.accuracy) : null;
  const token = body.token ? String(body.token).trim().toUpperCase() : null;
  const deviceInfo = body.device_info || {};
  const isMockLocation = Boolean(body.is_mock_location);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json(400, { error: 'Lokasi/GPS Anda belum aktif. Aktifkan lokasi kemudian coba kembali.' });
  }

  const { data: student, error: studentErr } = await supabase.from('students').select('*').eq('id', studentId).maybeSingle();
  if (studentErr || !student) return json(404, { error: 'Data siswa tidak ditemukan.' });
  if (student.program !== 'PAKET_B' && student.program !== 'PAKET_C') {
    return json(400, { error: 'Program siswa ini belum memiliki jadwal absensi digital.' });
  }

  const { tanggal, instant, jam } = nowJakarta();
  const { data: settings } = await supabase.from('school_settings').select('*').eq('id', 1).single();
  const schedule = await ambilJadwalAbsen(supabase, student.program, isoWeekdayJakarta(instant)); // Jumat bisa punya jam khusus

  const { data: existing } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', studentId)
    .eq('tanggal', tanggal)
    .maybeSingle();

  if (!existing || !existing.checkin_time) {
    return json(403, { error: 'Anda belum melakukan absensi datang hari ini.' });
  }
  if (existing.checkout_time) {
    return json(409, { error: 'Anda sudah melakukan absensi pulang hari ini.' });
  }

  const [curH, curM] = jam.split(':').map(Number);
  const [jpH, jpM] = schedule.jam_pulang.split(':').map(Number);
  const menitSekarang = curH * 60 + curM;
  const menitJamPulang = jpH * 60 + jpM;
  if (menitSekarang < menitJamPulang) {
    return json(403, { error: 'Absensi pulang belum dibuka.' });
  }

  const { data: activeSessions } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('program', student.program)
    .eq('sesi', 'PULANG')
    .eq('tanggal', tanggal)
    .eq('is_active', true)
    .gt('expires_at', instant.toISOString())
    .order('issued_at', { ascending: false })
    .limit(1);
  const activeSession = activeSessions && activeSessions[0];
  if (!activeSession) return json(403, { error: 'Sesi absensi belum dibuka.' });
  if (!token || token !== activeSession.token) {
    await writeSecurityEvent(supabase, { studentId, eventType: 'INVALID_TOKEN', detail: { submitted: token, sesi: 'PULANG' } });
    return json(403, { error: 'Kode/QR absensi tidak valid atau sudah kedaluwarsa. Minta kode terbaru ke admin.' });
  }

  if (accuracy != null && accuracy > settings.gps_accuracy_max_m) {
    await writeSecurityEvent(supabase, { studentId, eventType: 'LOW_ACCURACY', detail: { accuracy } });
    return json(403, { error: 'Lokasi belum cukup akurat. Tunggu beberapa saat dan coba kembali.' });
  }
  if (isMockLocation) {
    await writeSecurityEvent(supabase, { studentId, eventType: 'MOCK_LOCATION', detail: { lat, lng } });
    return json(403, { error: 'Lokasi perangkat tidak dapat diverifikasi. Silakan gunakan lokasi GPS asli.' });
  }

  const distance = haversineMeters(lat, lng, settings.latitude, settings.longitude);
  if (distance > settings.radius_m) {
    await writeSecurityEvent(supabase, { studentId, eventType: 'OUT_OF_RADIUS', detail: { distance, radius: settings.radius_m } });
    return json(403, {
      error: 'Tidak dapat melakukan absensi. Anda berada di luar area sekolah.',
      jarak_meter: Math.round(distance),
      radius_meter: settings.radius_m,
    });
  }

  const { error: saveError } = await supabase
    .from('attendance')
    .update({
      checkout_time: instant.toISOString(),
      checkout_status: 'SUDAH_PULANG',
      checkout_lat: lat,
      checkout_lng: lng,
      checkout_distance_m: Math.round(distance),
      checkout_accuracy_m: accuracy,
      checkout_session_id: activeSession.id,
      checkout_photo_url: body.photo_url || null,
      checkout_device: deviceInfo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id);

  if (saveError) return json(500, { error: 'Gagal menyimpan absensi. Coba lagi.' });

  await writeAudit(supabase, {
    actorType: 'SISWA', actorId: studentId, actorLabel: student.nama, action: 'ABSEN_PULANG',
    detail: { jarak: Math.round(distance) }, ip,
  });

  return json(200, { ok: true, jam: jam.slice(0, 5), jarak_meter: Math.round(distance), radius_meter: settings.radius_m });
};
