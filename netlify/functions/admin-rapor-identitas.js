const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');
const { validasiTtd, validasiLebar } = require('./_lib/tandaTangan');

/**
 * Identitas kop surat (Yayasan/PKBM/NPSN/SK/Ijin Operasional) & tanda tangan
 * Kepala PKBM, dipakai untuk mencetak Rekap Semester (Rapor).
 * Sengaja DIPISAH dari admin-settings.js (yang membatasi PUT hanya Super Admin)
 * karena mengelola identitas kop & tanda tangan rapor adalah pekerjaan
 * operasional sehari-hari yang wajar dilakukan Admin biasa.
 */
const FIELDS = [
  'yayasan_nama', 'npsn', 'sk_kemenhukum', 'ijin_operasional', 'kota_ttd',
  'kepala_pkbm_nama', 'kepala_pkbm_ttd', 'kepala_pkbm_ttd_lebar',
  'kop_logo', 'kop_logo_lebar',
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });
  const supabase = supabaseAdmin();

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('school_settings')
      .select('nama_sekolah, alamat, ' + FIELDS.join(', '))
      .eq('id', 1)
      .single();
    if (error) return json(500, { error: 'Gagal mengambil identitas sekolah.' });
    return json(200, { data });
  }

  if (event.httpMethod === 'PUT') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }

    const vTtd = validasiTtd(body.kepala_pkbm_ttd);
    if (!vTtd.ok) return json(400, { error: vTtd.error });
    const vLebar = validasiLebar(body.kepala_pkbm_ttd_lebar);
    if (!vLebar.ok) return json(400, { error: vLebar.error });
    const vLogo = validasiTtd(body.kop_logo);
    if (!vLogo.ok) return json(400, { error: vLogo.error });
    const vLogoLebar = validasiLebar(body.kop_logo_lebar);
    if (!vLogoLebar.ok) return json(400, { error: vLogoLebar.error });

    const update = {};
    for (const k of FIELDS) if (body[k] !== undefined) update[k] = body[k];
    if (body.hapus_ttd_kepala) { update.kepala_pkbm_ttd = null; update.kepala_pkbm_ttd_lebar = 140; }
    if (body.hapus_logo) { update.kop_logo = null; update.kop_logo_lebar = 70; }
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('school_settings')
      .update(update)
      .eq('id', 1)
      .select('nama_sekolah, alamat, ' + FIELDS.join(', '))
      .single();
    if (error) return json(500, { error: 'Gagal menyimpan identitas sekolah.' });

    await writeAudit(supabase, {
      actorType: 'ADMIN',
      actorId: auth.sub,
      actorLabel: auth.email,
      action: 'UPDATE_IDENTITAS_RAPOR',
      detail: { ...update, kepala_pkbm_ttd: update.kepala_pkbm_ttd ? '(diperbarui)' : update.kepala_pkbm_ttd, kop_logo: update.kop_logo ? '(diperbarui)' : update.kop_logo },
    });
    return json(200, { data });
  }

  return json(405, { error: 'Method not allowed' });
};
