const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');

/**
 * Kalender hari libur (nasional, cuti bersama, libur khusus sekolah).
 * Tanggal di tabel ini DIKECUALIKAN dari perhitungan "hari efektif" di
 * rekap_kehadiran() -- lihat migration_03_hari_libur.sql.
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });
  const supabase = supabaseAdmin();

  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    let query = supabase.from('hari_libur').select('*').order('tanggal', { ascending: true });
    if (q.tahun) query = query.gte('tanggal', `${q.tahun}-01-01`).lte('tanggal', `${q.tahun}-12-31`);
    const { data, error } = await query;
    if (error) return json(500, { error: 'Gagal mengambil kalender hari libur.' });
    return json(200, { data });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }
    const tanggal = body.tanggal;
    const keterangan = String(body.keterangan || '').trim();
    if (!tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !keterangan) {
      return json(400, { error: 'Tanggal (YYYY-MM-DD) dan keterangan wajib diisi.' });
    }
    const { data, error } = await supabase
      .from('hari_libur')
      .upsert({ tanggal, keterangan }, { onConflict: 'tanggal' })
      .select()
      .single();
    if (error) return json(500, { error: 'Gagal menyimpan hari libur.' });
    await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'TAMBAH_HARI_LIBUR', detail: { tanggal, keterangan } });
    return json(201, { data });
  }

  if (event.httpMethod === 'DELETE') {
    const tanggal = (event.queryStringParameters || {}).tanggal;
    if (!tanggal) return json(400, { error: 'Parameter tanggal wajib diisi.' });
    const { error } = await supabase.from('hari_libur').delete().eq('tanggal', tanggal);
    if (error) return json(500, { error: 'Gagal menghapus hari libur.' });
    await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'HAPUS_HARI_LIBUR', detail: { tanggal } });
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
};
