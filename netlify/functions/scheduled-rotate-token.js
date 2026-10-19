/**
 * Netlify Scheduled Function.
 * Jalan otomatis tiap 15 menit (lihat konfigurasi jadwal di netlify.toml).
 * Memperpanjang (membuat token baru) untuk sesi yang masih auto_rotate=true
 * dan sudah/hampir kedaluwarsa, TANPA perlu tab admin tetap terbuka.
 */
const crypto = require('crypto');
const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { nowJakarta, writeAudit } = require('./_lib/utils');

const TOKEN_DURATION_MINUTES = 15;

function generateToken() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

exports.handler = async (event) => {
  // Fungsi terjadwal Netlify ("Scheduled Functions") masih berstatus BETA dan
  // beberapa paket (termasuk paket gratis) dilaporkan punya batas minimum
  // jadwal per JAM, bukan per 15 menit. Agar rotasi token tetap bisa
  // diandalkan di paket gratis, endpoint ini JUGA bisa dipicu dari luar
  // (mis. cron-job.org yang gratis, tiap 15 menit) dengan mengirim header
  // "x-cron-secret" berisi nilai environment variable CRON_SECRET.
  // Header hanya diperiksa BILA dikirim (supaya invokasi terjadwal asli dari
  // Netlify, yang tidak mengirim header ini, tetap selalu diizinkan).
  const cronSecret = process.env.CRON_SECRET;
  const diberikan = event && event.headers && (event.headers['x-cron-secret'] || event.headers['X-Cron-Secret']);
  if (cronSecret && diberikan && diberikan !== cronSecret) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Cron secret tidak valid.' }) };
  }

  const supabase = supabaseAdmin();
  const { tanggal, instant } = nowJakarta();

  const { data: candidates } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('tanggal', tanggal)
    .eq('is_active', true)
    .eq('auto_rotate', true)
    .lte('expires_at', new Date(instant.getTime() + 60 * 1000).toISOString()); // sudah/segera kedaluwarsa

  for (const s of candidates || []) {
    const token = generateToken();
    const expiresAt = new Date(instant.getTime() + TOKEN_DURATION_MINUTES * 60 * 1000);

    await supabase.from('attendance_sessions').update({ is_active: false }).eq('id', s.id);
    await supabase.from('attendance_sessions').insert({
      tanggal, program: s.program, sesi: s.sesi, token, token_type: s.token_type,
      issued_at: instant.toISOString(), expires_at: expiresAt.toISOString(),
      issued_by: s.issued_by, is_active: true, auto_rotate: true,
    });
    await writeAudit(supabase, {
      actorType: 'SYSTEM', action: 'AUTO_ROTATE_TOKEN',
      detail: { program: s.program, sesi: s.sesi, token },
    });
  }

  return { statusCode: 200, body: JSON.stringify({ rotated: (candidates || []).length }) };
};

// Jadwal cron Netlify Scheduled Functions: tiap 15 menit
exports.config = {
  schedule: '*/15 * * * *',
};
