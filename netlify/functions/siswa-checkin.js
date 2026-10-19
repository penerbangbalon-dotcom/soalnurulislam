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
  const studentId = auth.sub; // identitas HANYA dari token, tidak pernah dari body

  const okRate = await checkRateLimit(supabase, `checkin:${studentId}`, { max: 6, windowSeconds: 60 });
  if (!okRate) return json(429, { error: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const accuracy = body.accuracy != null ? Number(body.accuracy) : null;
  const token = body.token ? String(body.token).trim().toUpperCase() : null;
  const deviceInfo = body.device_info || {};
  const isMockLocation = Boolean(body.is_mock_location); // dari Geolocation API (event.mocked) jika platform mendukung

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json(400, { error: 'Lokasi/GPS Anda belum aktif. Aktifkan lokasi kemudian coba kembali.' });
  }

  const { data: student, error: studentErr } = await supabase.from('students').select('*').eq('id', studentId).maybeSingle();
  if (studentErr || !student) return json(404, { error: 'Data siswa tidak ditemukan.' });
  if (student.status !== 'AKTIF') return json(403, { error: 'Akun tidak aktif.' });
  if (student.program !== 'PAKET_B' && student.program !== 'PAKET_C') {
    return json(400, { error: 'Program siswa ini belum memiliki jadwal absensi digital.' });
  }

  const { tanggal, instant, jam } = nowJakarta();
  const weekday = isoWeekdayJakarta(instant);

  const { data: settings } = await supabase.from('school_settings').select('*').eq('id', 1).single();
  const schedule = await ambilJadwalAbsen(supabase, student.program, weekday); // Jumat bisa punya jam khusus

  if (!settings.latitude || !settings.longitude) {
    return json(500, { error: 'Lokasi sekolah belum diatur admin. Hubungi admin.' });
  }
  if (!settings.hari_aktif.includes(weekday)) {
    return json(403, { error: 'Hari ini bukan hari aktif sekolah.' });
  }
  const { data: libur } = await supabase.from('hari_libur').select('keterangan').eq('tanggal', tanggal).maybeSingle();
  if (libur) {
    return json(403, { error: `Hari ini libur (${libur.keterangan}). Absensi tidak dibuka.` });
  }

  // 1) Sesi absensi datang harus aktif (token rotasi dari admin)
  let sessionQuery = supabase
    .from('attendance_sessions')
    .select('*')
    .eq('program', student.program)
    .eq('sesi', 'DATANG')
    .eq('tanggal', tanggal)
    .eq('is_active', true)
    .gt('expires_at', instant.toISOString())
    .order('issued_at', { ascending: false })
    .limit(1);
  const { data: activeSessions } = await sessionQuery;
  const activeSession = activeSessions && activeSessions[0];

  if (!activeSession) {
    return json(403, { error: 'Sesi absensi belum dibuka.' });
  }
  if (!token || token !== activeSession.token) {
    await writeSecurityEvent(supabase, { studentId, eventType: 'INVALID_TOKEN', detail: { submitted: token, sesi: 'DATANG' } });
    return json(403, { error: 'Kode/QR absensi tidak valid atau sudah kedaluwarsa. Minta kode terbaru ke admin.' });
  }

  // 2) Cek duplikasi - satu absen datang per hari
  const { data: existing } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', studentId)
    .eq('tanggal', tanggal)
    .maybeSingle();
  if (existing && existing.checkin_time) {
    return json(409, { error: 'Anda sudah melakukan absensi datang hari ini.' });
  }

  // 3) Validasi akurasi GPS
  if (accuracy != null && accuracy > settings.gps_accuracy_max_m) {
    await writeSecurityEvent(supabase, { studentId, eventType: 'LOW_ACCURACY', detail: { accuracy } });
    return json(403, { error: 'Lokasi belum cukup akurat. Tunggu beberapa saat dan coba kembali.' });
  }

  // 4) Deteksi indikasi mock location (jika dilaporkan platform)
  let perluVerifikasi = false;
  if (isMockLocation) {
    await writeSecurityEvent(supabase, { studentId, eventType: 'MOCK_LOCATION', detail: { lat, lng } });
    return json(403, { error: 'Lokasi perangkat tidak dapat diverifikasi. Silakan gunakan lokasi GPS asli.' });
  }

  // 5) Hitung jarak & radius
  const distance = haversineMeters(lat, lng, settings.latitude, settings.longitude);
  if (distance > settings.radius_m) {
    await writeSecurityEvent(supabase, { studentId, eventType: 'OUT_OF_RADIUS', detail: { distance, radius: settings.radius_m } });
    return json(403, {
      error: 'Tidak dapat melakukan absensi. Anda berada di luar area sekolah.',
      jarak_meter: Math.round(distance),
      radius_meter: settings.radius_m,
    });
  }

  // 6) Tentukan status: Hadir / Terlambat berdasarkan jadwal + toleransi (dibandingkan waktu SERVER)
  const [jmH, jmM] = schedule.jam_masuk_mulai.split(':').map(Number);
  const batasTerlambat = new Date(instant);
  batasTerlambat.setUTCHours(0, 0, 0, 0); // reset, lalu set berdasarkan komponen WIB
  // hitung batas keterlambatan dalam menit-sejak-tengah-malam WIB, lalu bandingkan ke jam WIB saat ini
  const [curH, curM] = jam.split(':').map(Number);
  const menitSekarang = curH * 60 + curM;
  const menitBatasTepat = jmH * 60 + jmM + schedule.toleransi_menit;
  const status = menitSekarang <= menitBatasTepat ? 'HADIR' : 'TERLAMBAT';

  const row = {
    student_id: studentId,
    tanggal,
    checkin_time: instant.toISOString(),
    checkin_status: perluVerifikasi ? 'PERLU_VERIFIKASI' : status,
    checkin_lat: lat,
    checkin_lng: lng,
    checkin_distance_m: Math.round(distance),
    checkin_accuracy_m: accuracy,
    checkin_session_id: activeSession.id,
    checkin_photo_url: body.photo_url || null,
    checkin_device: deviceInfo,
    updated_at: new Date().toISOString(),
  };

  let saveError;
  if (existing) {
    ({ error: saveError } = await supabase.from('attendance').update(row).eq('id', existing.id));
  } else {
    ({ error: saveError } = await supabase.from('attendance').insert(row));
  }
  if (saveError) {
    if (String(saveError.code) === '23505') {
      return json(409, { error: 'Anda sudah melakukan absensi datang hari ini.' });
    }
    return json(500, { error: 'Gagal menyimpan absensi. Coba lagi.' });
  }

  await writeAudit(supabase, {
    actorType: 'SISWA', actorId: studentId, actorLabel: student.nama, action: 'ABSEN_DATANG',
    detail: { jarak: Math.round(distance), status }, ip,
  });

  return json(200, {
    ok: true,
    status,
    jam: jam.slice(0, 5),
    jarak_meter: Math.round(distance),
    radius_meter: settings.radius_m,
  });
};
