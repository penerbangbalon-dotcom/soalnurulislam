const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');

/**
 * Muatan mapel (JP per minggu) per kelas — bahan baku "Generate Jadwal Otomatis".
 *   GET                         -> { data: { "7": [{mapel, jp}], "10": [...] } }  (kelas tanpa data = pakai default di browser)
 *   PUT { kelas, rows:[{mapel, jp}] }   -> ganti seluruh muatan kelas tsb
 *   DELETE ?kelas=7             -> kembali ke default
 * Aturan: Muatan Lokal maksimal 2 JP per minggu (struktur kurikulum pendidikan kesetaraan).
 */
const MULOK_MAKS = 2;
const adalahMulok = (n) => /muatan lokal|^mulok/i.test(n);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });
  const supabase = supabaseAdmin();

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase.from('absensi_muatan_mapel').select('kelas_grup, mapel, jp, urut').order('urut');
    if (error) return json(500, { error: 'Gagal memuat muatan mapel. Pastikan migration_06 sudah dijalankan.' });
    const out = {};
    for (const r of data || []) (out[r.kelas_grup] = out[r.kelas_grup] || []).push({ mapel: r.mapel, jp: r.jp });
    return json(200, { data: out });
  }

  if (event.httpMethod === 'PUT') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }
    const kelas = String(body.kelas || '').trim();
    if (!kelas || kelas.length > 20) return json(400, { error: 'Kelas tidak valid.' });
    if (!Array.isArray(body.rows) || body.rows.length > 40) return json(400, { error: 'Daftar muatan tidak valid (maksimal 40 mapel).' });
    const unik = new Map();
    for (const r of body.rows) {
      const mapel = String(r.mapel || '').trim().replace(/\s+/g, ' ');
      const jp = Number(r.jp);
      if (!mapel) continue;
      if (mapel.length > 80) return json(400, { error: 'Nama mapel maksimal 80 karakter.' });
      if (!Number.isInteger(jp) || jp < 1 || jp > 20) return json(400, { error: `JP "${mapel}" harus 1 sampai 20.` });
      if (adalahMulok(mapel) && jp > MULOK_MAKS) return json(400, { error: `Muatan Lokal maksimal ${MULOK_MAKS} JP per minggu.` });
      unik.set(mapel.toLowerCase(), { mapel, jp });
    }
    const rows = [...unik.values()].map((r, i) => ({ kelas_grup: kelas, mapel: r.mapel, jp: r.jp, urut: i + 1 }));
    const { error: eDel } = await supabase.from('absensi_muatan_mapel').delete().eq('kelas_grup', kelas);
    if (eDel) return json(500, { error: 'Gagal menyimpan muatan mapel. Pastikan migration_06 sudah dijalankan.' });
    if (rows.length) {
      const { error: eIns } = await supabase.from('absensi_muatan_mapel').insert(rows);
      if (eIns) return json(500, { error: 'Gagal menyimpan muatan mapel.' });
    }
    await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'UBAH_MUATAN_MAPEL', detail: { kelas, jumlah_mapel: rows.length } });
    return json(200, { ok: true, jumlah: rows.length });
  }

  if (event.httpMethod === 'DELETE') {
    const kelas = (event.queryStringParameters || {}).kelas;
    if (!kelas) return json(400, { error: 'Kelas wajib diisi.' });
    const { error } = await supabase.from('absensi_muatan_mapel').delete().eq('kelas_grup', kelas);
    if (error) return json(500, { error: 'Gagal mengembalikan ke default.' });
    await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'RESET_MUATAN_MAPEL', detail: { kelas } });
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
};
