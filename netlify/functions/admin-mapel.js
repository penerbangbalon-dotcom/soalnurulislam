const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');

/**
 * Daftar mata pelajaran untuk dropdown Jadwal Pelajaran.
 * GET (semua), POST (tambah), PUT (ubah/sembunyikan), DELETE ?id= (hapus).
 * Pekerjaan operasional harian -> boleh Admin biasa.
 */
const PROGRAMS = ['SEMUA', 'PAKET_B', 'PAKET_C'];

function bersihkan(body) {
  const out = {};
  if (body.nama !== undefined) {
    const nama = String(body.nama).trim().replace(/\s+/g, ' ');
    if (!nama || nama.length > 80) return { error: 'Nama mapel wajib diisi (maksimal 80 karakter).' };
    out.nama = nama;
  }
  if (body.program !== undefined) {
    if (!PROGRAMS.includes(body.program)) return { error: 'Program tidak valid.' };
    out.program = body.program;
  }
  if (body.kelompok !== undefined) out.kelompok = String(body.kelompok).trim().slice(0, 60) || 'Umum';
  if (body.aktif !== undefined) out.aktif = Boolean(body.aktif);
  if (body.urut !== undefined && Number.isFinite(Number(body.urut))) out.urut = Number(body.urut);
  return { out };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });
  const supabase = supabaseAdmin();

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase.from('absensi_mapel').select('*').order('urut').order('nama');
    if (error) return json(500, { error: 'Gagal memuat daftar mapel. Pastikan migration_05 sudah dijalankan.' });
    return json(200, { data });
  }

  let body = {};
  if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }
  }

  if (event.httpMethod === 'POST') {
    const { out, error } = bersihkan(body);
    if (error) return json(400, { error });
    if (!out.nama) return json(400, { error: 'Nama mapel wajib diisi.' });
    // Sudah ada (tanpa memperhatikan huruf besar/kecil)? Anggap berhasil, jangan duplikat.
    const { data: ada } = await supabase.from('absensi_mapel').select('*').ilike('nama', out.nama).maybeSingle();
    if (ada) return json(200, { data: ada, sudah_ada: true });
    const { data, error: e2 } = await supabase
      .from('absensi_mapel')
      .insert({ program: 'SEMUA', kelompok: 'Tambahan', urut: 900, ...out })
      .select().single();
    if (e2) return json(500, { error: 'Gagal menambah mapel.' });
    await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'TAMBAH_MAPEL', detail: out });
    return json(200, { data });
  }

  if (event.httpMethod === 'PUT') {
    if (!body.id) return json(400, { error: 'ID mapel wajib diisi.' });
    const { out, error } = bersihkan(body);
    if (error) return json(400, { error });
    const { data, error: e2 } = await supabase.from('absensi_mapel').update(out).eq('id', body.id).select().single();
    if (e2) return json(500, { error: 'Gagal menyimpan perubahan mapel (nama mungkin sudah dipakai).' });
    await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'UBAH_MAPEL', detail: { id: body.id, ...out } });
    return json(200, { data });
  }

  if (event.httpMethod === 'DELETE') {
    const id = (event.queryStringParameters || {}).id;
    if (!id) return json(400, { error: 'ID mapel wajib diisi.' });
    const { error } = await supabase.from('absensi_mapel').delete().eq('id', id);
    if (error) return json(500, { error: 'Gagal menghapus mapel.' });
    await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'HAPUS_MAPEL', detail: { id } });
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
};
