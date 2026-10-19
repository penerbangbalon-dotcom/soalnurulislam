const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, nowJakarta, writeAudit, getClientIp } = require('./_lib/utils');
const { simpanAbsenManual } = require('./_lib/absenManual');

const MAX_ITEMS = 100; // cukup untuk satu kelas / rombel sekaligus

/**
 * Input absen manual untuk BANYAK siswa dalam satu kelas sekaligus (satu
 * tanggal), supaya admin tidak perlu klik satu-satu setiap hari untuk
 * siswa yang tidak punya HP (mis. seluruh siswa SD/UMUM).
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const auth = requireAdmin(event, { superAdminOnly: true });
  if (!auth) return json(403, { error: 'Hanya Super Admin yang dapat menginput absen manual.' });

  const supabase = supabaseAdmin();
  const ip = getClientIp(event);
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }

  const { tanggal: hariIni, jam: jamSekarang } = nowJakarta();
  const tanggal = body.tanggal || hariIni;
  const items = Array.isArray(body.items) ? body.items : [];

  if (!items.length) return json(400, { error: 'Tidak ada siswa yang dikirim.' });
  if (items.length > MAX_ITEMS) return json(400, { error: `Maksimum ${MAX_ITEMS} siswa per pengiriman.` });

  const hasil = [];
  for (const item of items) {
    const r = await simpanAbsenManual(supabase, {
      studentId: item.student_id,
      tanggal,
      hariIni,
      jamSekarang,
      status: item.status,
      jamDatang: item.jam_datang,
      jamPulang: item.jam_pulang,
      keterangan: item.keterangan,
      adminId: auth.sub,
      adminEmail: auth.email,
    });
    hasil.push({ student_id: item.student_id, nama: r.nama, status: item.status, ok: r.ok, error: r.error || null });
  }

  const berhasil = hasil.filter((h) => h.ok).length;
  await writeAudit(supabase, {
    actorType: 'ADMIN',
    actorId: auth.sub,
    actorLabel: auth.email,
    action: 'ABSEN_MANUAL_MASSAL',
    detail: { tanggal, kelas: body.kelas || null, jumlah: items.length, berhasil },
    ip,
  });

  return json(200, { ok: true, tanggal, total: items.length, berhasil, hasil });
};
