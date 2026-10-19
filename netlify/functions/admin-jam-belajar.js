const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');

/**
 * Jam belajar (slot jam pelajaran) per program & tipe hari + jam absen khusus Jumat.
 *   GET                       -> { slots, jumat, reguler }
 *   PUT { program, tipe_hari, slots:[{jenis, mulai, selesai, label}] }  -> ganti seluruh slot (Admin)
 *   PUT { jumat:{program, jam_masuk_mulai, jam_masuk_selesai, jam_pulang, toleransi_menit, aktif} } -> Super Admin
 * Jam absen reguler (Senin-Kamis) tetap diatur di Pengaturan Sekolah.
 */
const PROGRAMS = ['PAKET_B', 'PAKET_C'];
const TIPE = ['REGULER', 'JUMAT'];
const RE_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;
const menit = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmm = (t) => String(t || '').slice(0, 5);

function validasiSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0 || slots.length > 20) {
    return { error: 'Jumlah baris jam belajar harus 1 sampai 20.' };
  }
  const rapi = [];
  let jamKe = 0;
  let akhirSebelumnya = -1;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i] || {};
    const jenis = s.jenis === 'ISTIRAHAT' ? 'ISTIRAHAT' : 'PELAJARAN';
    const mulai = hhmm(s.mulai);
    const selesai = hhmm(s.selesai);
    if (!RE_JAM.test(mulai) || !RE_JAM.test(selesai)) return { error: `Baris ${i + 1}: format jam tidak valid.` };
    if (menit(selesai) <= menit(mulai)) return { error: `Baris ${i + 1}: jam selesai harus lebih besar dari jam mulai.` };
    if (menit(mulai) < akhirSebelumnya) return { error: `Baris ${i + 1}: jam mulai bertabrakan dengan baris sebelumnya.` };
    akhirSebelumnya = menit(selesai);
    if (jenis === 'PELAJARAN') jamKe += 1;
    const label = String(s.label || '').trim().slice(0, 40) || (jenis === 'PELAJARAN' ? `Jam ke-${jamKe}` : 'Istirahat');
    rapi.push({ urut: i + 1, jenis, jam_ke: jenis === 'PELAJARAN' ? jamKe : null, mulai, selesai, label });
  }
  if (jamKe === 0) return { error: 'Minimal ada satu baris jam pelajaran (bukan istirahat).' };
  return { rapi };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });
  const supabase = supabaseAdmin();

  if (event.httpMethod === 'GET') {
    const { data: slots, error } = await supabase.from('absensi_jam_belajar').select('*').order('program').order('tipe_hari').order('urut');
    if (error) return json(500, { error: 'Gagal memuat jam belajar. Pastikan migration_05 sudah dijalankan.' });
    const { data: jumat } = await supabase.from('program_schedules_jumat').select('*').order('program');
    const { data: reguler } = await supabase.from('program_schedules').select('*').order('program');
    const norm = (r) => ({
      ...r,
      jam_masuk_mulai: hhmm(r.jam_masuk_mulai), jam_masuk_selesai: hhmm(r.jam_masuk_selesai), jam_pulang: hhmm(r.jam_pulang),
    });
    return json(200, {
      slots: slots.map((s) => ({ ...s, mulai: hhmm(s.mulai), selesai: hhmm(s.selesai) })),
      jumat: (jumat || []).map(norm),
      reguler: (reguler || []).map(norm),
    });
  }

  if (event.httpMethod !== 'PUT') return json(405, { error: 'Method not allowed' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }

  if (body.jumat) {
    const sa = requireAdmin(event, { superAdminOnly: true });
    if (!sa) return json(403, { error: 'Hanya Super Admin yang dapat mengubah jam absen datang/pulang.' });
    const j = body.jumat;
    if (!PROGRAMS.includes(j.program)) return json(400, { error: 'Program tidak valid.' });
    const mulai = hhmm(j.jam_masuk_mulai), selesai = hhmm(j.jam_masuk_selesai), pulang = hhmm(j.jam_pulang);
    if (![mulai, selesai, pulang].every((x) => RE_JAM.test(x))) return json(400, { error: 'Format jam absen tidak valid.' });
    if (menit(selesai) < menit(mulai)) return json(400, { error: 'Akhir absen datang tidak boleh lebih awal dari mulai absen datang.' });
    const tol = Number(j.toleransi_menit);
    if (!Number.isFinite(tol) || tol < 0 || tol > 120) return json(400, { error: 'Toleransi harus 0 sampai 120 menit.' });
    const row = {
      program: j.program, jam_masuk_mulai: mulai, jam_masuk_selesai: selesai, jam_pulang: pulang,
      toleransi_menit: tol, aktif: j.aktif !== false, updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('program_schedules_jumat').upsert(row, { onConflict: 'program' });
    if (error) return json(500, { error: 'Gagal menyimpan jam absen Jumat.' });
    await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'UPDATE_JADWAL_JUMAT', detail: row });
    return json(200, { ok: true });
  }

  if (!PROGRAMS.includes(body.program) || !TIPE.includes(body.tipe_hari)) {
    return json(400, { error: 'Program atau tipe hari tidak valid.' });
  }
  const { rapi, error } = validasiSlots(body.slots);
  if (error) return json(400, { error });

  const { error: eDel } = await supabase.from('absensi_jam_belajar').delete().eq('program', body.program).eq('tipe_hari', body.tipe_hari);
  if (eDel) return json(500, { error: 'Gagal menyimpan jam belajar.' });
  const { error: eIns } = await supabase.from('absensi_jam_belajar').insert(
    rapi.map((r) => ({ program: body.program, tipe_hari: body.tipe_hari, ...r }))
  );
  if (eIns) return json(500, { error: 'Gagal menyimpan jam belajar. Muat ulang halaman lalu coba lagi.' });

  await writeAudit(supabase, {
    actorType: 'ADMIN', actorId: auth.sub, action: 'UPDATE_JAM_BELAJAR',
    detail: { program: body.program, tipe_hari: body.tipe_hari, jumlah_baris: rapi.length },
  });
  return json(200, { ok: true, jumlah: rapi.length });
};
