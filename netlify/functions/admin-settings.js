const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const supabase = supabaseAdmin();

  if (event.httpMethod === 'GET') {
    const auth = requireAdmin(event);
    if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });
    const { data: settings } = await supabase.from('school_settings').select('*').eq('id', 1).single();
    const { data: schedules } = await supabase.from('program_schedules').select('*').order('program');
    return json(200, { settings, schedules });
  }

  if (event.httpMethod === 'PUT') {
    // Hanya Super Admin yang boleh mengubah lokasi sekolah, radius, dan jadwal.
    const auth = requireAdmin(event, { superAdminOnly: true });
    if (!auth) return json(403, { error: 'Hanya Super Admin yang dapat mengubah pengaturan ini.' });

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }

    if (body.settings) {
      const s = body.settings;
      if (s.radius_m != null && (s.radius_m < 50 || s.radius_m > 100)) {
        return json(400, { error: 'Radius harus antara 50 dan 100 meter.' });
      }
      const allowed = [
        'nama_sekolah', 'alamat', 'latitude', 'longitude', 'radius_m', 'gps_accuracy_max_m', 'selfie_wajib', 'hari_aktif',
        'templat_deskripsi_sangat_baik', 'templat_deskripsi_baik', 'templat_deskripsi_cukup', 'templat_deskripsi_kurang',
      ];
      const update = {};
      for (const k of allowed) if (s[k] !== undefined) update[k] = s[k];
      update.updated_at = new Date().toISOString();
      const { error } = await supabase.from('school_settings').update(update).eq('id', 1);
      if (error) return json(500, { error: 'Gagal menyimpan pengaturan sekolah.' });
      await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'UPDATE_SETTINGS', detail: update });
    }

    if (Array.isArray(body.schedules)) {
      for (const sch of body.schedules) {
        if (!['PAKET_B', 'PAKET_C'].includes(sch.program)) continue;
        const update = {};
        for (const k of ['jam_masuk_mulai', 'jam_masuk_selesai', 'jam_pulang', 'toleransi_menit']) {
          if (sch[k] !== undefined) update[k] = sch[k];
        }
        update.updated_at = new Date().toISOString();
        await supabase.from('program_schedules').update(update).eq('program', sch.program);
      }
      await writeAudit(supabase, { actorType: 'ADMIN', actorId: auth.sub, action: 'UPDATE_JADWAL', detail: body.schedules });
    }

    const { data: settings } = await supabase.from('school_settings').select('*').eq('id', 1).single();
    const { data: schedules } = await supabase.from('program_schedules').select('*').order('program');
    return json(200, { settings, schedules });
  }

  return json(405, { error: 'Method not allowed' });
};
