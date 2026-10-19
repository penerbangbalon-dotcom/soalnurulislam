const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

function preflight() {
  return { statusCode: 204, headers: CORS_HEADERS, body: '' };
}

/** Jarak antara dua koordinat GPS dalam meter (Haversine). */
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Tanggal & jam sekarang di WIB, berbasis WAKTU SERVER (bukan device siswa). */
function nowJakarta() {
  const now = new Date(); // instant absolut server, sumber kebenaran satu-satunya
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    instant: now, // Date object, gunakan untuk timestamptz
    tanggal: `${parts.year}-${parts.month}-${parts.day}`, // untuk kolom `date`
    jam: `${parts.hour}:${parts.minute}:${parts.second}`, // HH:mm:ss WIB
    hariISO: now.getUTCDay(), // dihitung ulang di bawah dgn timezone yg benar
  };
}

/** 1=Senin .. 7=Minggu, dihitung di zona Asia/Jakarta. */
function isoWeekdayJakarta(instant) {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(instant);
  const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[wd];
}

async function writeAudit(supabase, { actorType, actorId, actorLabel, action, detail, ip }) {
  await supabase.from('audit_logs').insert({
    actor_type: actorType,
    actor_id: actorId || null,
    actor_label: actorLabel || null,
    action,
    detail: detail || {},
    ip: ip || null,
  });
}

async function writeSecurityEvent(supabase, { studentId, eventType, detail }) {
  await supabase.from('attendance_security_events').insert({
    student_id: studentId || null,
    event_type: eventType,
    detail: detail || {},
  });
}

/**
 * Rate limit sederhana berbasis tabel `rate_limits`.
 * Menolak jika sudah ada >= `max` percobaan dalam `windowSeconds` terakhir untuk `bucket` ini.
 */
async function checkRateLimit(supabase, bucket, { max = 8, windowSeconds = 60 } = {}) {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count } = await supabase
    .from('rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('bucket', bucket)
    .gte('created_at', since);
  await supabase.from('rate_limits').insert({ bucket });
  return (count || 0) < max;
}

function getClientIp(event) {
  return (
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for'] ||
    'unknown'
  );
}

module.exports = {
  json,
  preflight,
  haversineMeters,
  nowJakarta,
  isoWeekdayJakarta,
  writeAudit,
  writeSecurityEvent,
  checkRateLimit,
  getClientIp,
};
