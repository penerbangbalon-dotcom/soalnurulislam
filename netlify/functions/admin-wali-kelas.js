const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');
const { validasiTtd, validasiLebar } = require('./_lib/tandaTangan');

/**
 * Nama & tanda tangan Wali Kelas per Kelas, dipakai untuk mencetak
 * Rekap Semester (Rapor). "Kelas" adalah teks bebas, sama seperti
 * kolom students.kelas, jadi admin mengetik nilai Kelas yang sama
 * (mis. "10", "11 IPA") supaya laporan siswa di kelas itu memakai
 * tanda tangan wali kelas ini secara otomatis.
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });
  const supabase = supabaseAdmin();

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase.from('wali_kelas').select('*').order('kelas', { ascending: true });
    if (error) return json(500, { error: 'Gagal mengambil data wali kelas.' });
    return json(200, { data: data || [] });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }

    const kelas = String(body.kelas || '').trim();
    if (!kelas) return json(400, { error: 'Kelas wajib diisi.' });

    const vTtd = validasiTtd(body.ttd);
    if (!vTtd.ok) return json(400, { error: vTtd.error });
    const vLebar = validasiLebar(body.ttd_lebar);
    if (!vLebar.ok) return json(400, { error: vLebar.error });

    const { data: existing } = await supabase.from('wali_kelas').select('*').eq('kelas', kelas).maybeSingle();

    const payload = {
      kelas,
      nama: body.nama !== undefined ? (String(body.nama || '').trim() || null) : (existing ? existing.nama : null),
      ttd: body.hapus_ttd ? null : (body.ttd !== undefined ? body.ttd : (existing ? existing.ttd : null)),
      ttd_lebar: body.hapus_ttd ? 140 : (body.ttd_lebar !== undefined ? Number(body.ttd_lebar) : (existing ? existing.ttd_lebar : 140)),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('wali_kelas').upsert(payload, { onConflict: 'kelas' }).select().single();
    if (error) return json(500, { error: 'Gagal menyimpan data wali kelas.' });

    await writeAudit(supabase, {
      actorType: 'ADMIN',
      actorId: auth.sub,
      actorLabel: auth.email,
      action: 'SIMPAN_WALI_KELAS',
      detail: { kelas, nama: payload.nama, ttd: payload.ttd ? '(ada)' : '(kosong)' },
    });
    return json(200, { data });
  }

  if (event.httpMethod === 'DELETE') {
    const kelas = (event.queryStringParameters || {}).kelas;
    if (!kelas) return json(400, { error: 'Parameter kelas wajib diisi.' });
    const { error } = await supabase.from('wali_kelas').delete().eq('kelas', kelas);
    if (error) return json(500, { error: 'Gagal menghapus data wali kelas.' });
    await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, actorLabel: auth.email, action: 'HAPUS_WALI_KELAS', detail: { kelas } });
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
};
