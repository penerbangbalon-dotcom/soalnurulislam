const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight, writeAudit } = require('./_lib/utils');
const { grupKelas, bandingGrup } = require('./_lib/kelasGrup');

/**
 * Jadwal mapel per kelas (grup kelas tanpa rombel).
 *   GET              -> { kelas: [{ grup, program, jumlah_siswa, rombel:[...] }] }
 *   GET ?kelas=7     -> { kelas, program, jadwal:[{hari, jam_ke, mapel}] }
 *   GET ?kelas=SEMUA -> { kelas:[...], jadwal:{ "7":[{hari,jam_ke,mapel}], "10":[...] } }  (untuk cetak & generator)
 *   PUT { semua:[{ kelas, jadwal }] } -> simpan beberapa kelas sekaligus (hasil Generate Jadwal)
 *   PUT { kelas, jadwal:[{hari, jam_ke, mapel}] } -> ganti seluruh jadwal kelas tsb
 */
async function daftarKelas(supabase) {
  const { data, error } = await supabase
    .from('students')
    .select('kelas, program')
    .eq('status', 'AKTIF')
    .in('program', ['PAKET_B', 'PAKET_C']);
  if (error) throw error;
  const peta = new Map();
  for (const s of data || []) {
    const grup = grupKelas(s.kelas, s.program);
    if (!grup) continue;
    if (!peta.has(grup)) peta.set(grup, { grup, program: s.program, jumlah_siswa: 0, rombel: new Set() });
    const g = peta.get(grup);
    g.jumlah_siswa += 1;
    g.rombel.add(String(s.kelas).trim());
  }
  return [...peta.values()]
    .map((g) => ({ ...g, rombel: [...g.rombel].sort(bandingGrup) }))
    .sort((a, b) => bandingGrup(a.grup, b.grup));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });
  const supabase = supabaseAdmin();

  let kelasList;
  try { kelasList = await daftarKelas(supabase); } catch { return json(500, { error: 'Gagal memuat daftar kelas.' }); }

  if (event.httpMethod === 'GET') {
    const kelas = (event.queryStringParameters || {}).kelas;
    if (!kelas) return json(200, { kelas: kelasList });
    if (kelas === 'SEMUA') {
      const { data, error } = await supabase.from('absensi_jadwal_mapel').select('kelas_grup, hari, jam_ke, mapel');
      if (error) return json(500, { error: 'Gagal memuat jadwal. Pastikan migration_05 sudah dijalankan.' });
      const jadwal = {};
      for (const k of kelasList) jadwal[k.grup] = [];
      for (const r of data || []) if (jadwal[r.kelas_grup]) jadwal[r.kelas_grup].push({ hari: r.hari, jam_ke: r.jam_ke, mapel: r.mapel });
      return json(200, { kelas: kelasList, jadwal });
    }
    const info = kelasList.find((k) => k.grup === kelas);
    if (!info) return json(404, { error: 'Kelas tidak ditemukan.' });
    const { data, error } = await supabase.from('absensi_jadwal_mapel').select('hari, jam_ke, mapel').eq('kelas_grup', kelas);
    if (error) return json(500, { error: 'Gagal memuat jadwal. Pastikan migration_05 sudah dijalankan.' });
    return json(200, { kelas, program: info.program, jadwal: data });
  }

  if (event.httpMethod === 'PUT') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }
    const paket = Array.isArray(body.semua) ? body.semua : [{ kelas: body.kelas, jadwal: body.jadwal }];
    if (!paket.length || paket.length > 20) return json(400, { error: 'Jumlah kelas yang disimpan tidak valid.' });

    // validasi SEMUA kelas dulu, baru tulis — supaya tidak ada kelas yang tersimpan setengah-setengah
    const siap = [];
    for (const item of paket) {
      const info = kelasList.find((k) => k.grup === item.kelas);
      if (!info) return json(400, { error: 'Kelas tidak valid.' });
      if (!Array.isArray(item.jadwal) || item.jadwal.length > 200) return json(400, { error: 'Data jadwal tidak valid.' });
      const unik = new Map();
      for (const j of item.jadwal) {
        const hari = Number(j.hari), jamKe = Number(j.jam_ke);
        const mapel = String(j.mapel || '').trim().replace(/\s+/g, ' ');
        if (!mapel) continue; // sel kosong = tidak ada mapel
        if (!Number.isInteger(hari) || hari < 1 || hari > 5) return json(400, { error: 'Hari harus Senin sampai Jumat.' });
        if (!Number.isInteger(jamKe) || jamKe < 1 || jamKe > 20) return json(400, { error: 'Jam ke- tidak valid.' });
        if (mapel.length > 80) return json(400, { error: 'Nama mapel maksimal 80 karakter.' });
        unik.set(`${hari}-${jamKe}`, { kelas_grup: item.kelas, hari, jam_ke: jamKe, mapel });
      }
      siap.push({ kelas: item.kelas, rows: [...unik.values()] });
    }

    for (const it of siap) {
      const { error: eDel } = await supabase.from('absensi_jadwal_mapel').delete().eq('kelas_grup', it.kelas);
      if (eDel) return json(500, { error: 'Gagal menyimpan jadwal.' });
      if (it.rows.length) {
        const { error: eIns } = await supabase.from('absensi_jadwal_mapel').insert(it.rows);
        if (eIns) return json(500, { error: 'Gagal menyimpan jadwal. Muat ulang halaman lalu coba lagi.' });
      }
    }
    await writeAudit(supabase, {
      actorType: 'ADMIN', actorId: auth.sub,
      action: paket.length > 1 ? 'GENERATE_JADWAL_PELAJARAN' : 'UPDATE_JADWAL_PELAJARAN',
      detail: { kelas: siap.map((x) => x.kelas), jumlah_sel: siap.reduce((a, x) => a + x.rows.length, 0) },
    });
    return json(200, { ok: true, jumlah: siap.reduce((a, x) => a + x.rows.length, 0) });
  }

  return json(405, { error: 'Method not allowed' });
};

exports.daftarKelas = daftarKelas;
