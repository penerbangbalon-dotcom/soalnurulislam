const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight } = require('./_lib/utils');
const { bandingGrup } = require('./_lib/kelasGrup');

/**
 * Daftar kelas yang ada di tabel students (untuk tombol filter kelas di halaman admin).
 * Mengembalikan satu baris per kombinasi (kelas, program, jenjang) beserta jumlah siswa.
 *   { data: [{ kelas: '10 IPA', program: 'PAKET_C', jenjang: 'SMA', jumlah: 31, jumlah_aktif: 30 }, ...] }
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const supabase = supabaseAdmin();
  const rows = [];
  const PAGE = 1000; // batas default Supabase per permintaan
  for (let from = 0; from < 50000; from += PAGE) {
    const { data, error } = await supabase
      .from('students')
      .select('kelas, program, jenjang, status')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return json(500, { error: 'Gagal mengambil daftar kelas.' });
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }

  const map = new Map();
  for (const r of rows) {
    const kelas = r.kelas == null ? '' : String(r.kelas); // nilai asli, agar cocok persis dengan filter eq('kelas', ...)
    if (!kelas.trim()) continue;
    const key = `${r.program}|${r.jenjang}|${kelas}`;
    if (!map.has(key)) map.set(key, { kelas, program: r.program, jenjang: r.jenjang, jumlah: 0, jumlah_aktif: 0 });
    const item = map.get(key);
    item.jumlah += 1;
    if (r.status === 'AKTIF') item.jumlah_aktif += 1;
  }

  const data = [...map.values()].sort((a, b) =>
    String(a.program).localeCompare(String(b.program)) || bandingGrup(a.kelas, b.kelas));
  return json(200, { data });
};
