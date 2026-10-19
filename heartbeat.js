// Netlify Function: heartbeat
// Dipanggil halaman siswa (ujian.html) tiap ~20 detik selama ujian berlangsung.
// Fungsi:
//  1. Memberi tahu guru bahwa siswa masih online (terakhir_aktif), plus progres & jumlah pindah tab.
//  2. Menyimpan cadangan jawaban di server (jawaban_sementara) supaya tombol "Sudahi" dari guru
//     tetap bisa menilai jawaban siswa walau HP siswa mati / koneksi putus.
//  3. Mengembalikan perintah dari guru: waktu tambahan, status kunci, pesan/peringatan, atau
//     sesi sudah diakhiri/direset.
// Sesi diidentifikasi lewat sesi_id (UUID acak yang hanya diketahui siswa yang bersangkutan).

const { UUID, adaKonfigurasi, sb } = require('../lib/ujian-core');

const MAKS_UKURAN_JAWABAN = 300000; // ~300 KB per sesi, jaga-jaga penyalahgunaan

function bersihkanJawaban(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const out = {};
  for (const k of Object.keys(obj)) {
    if (!UUID.test(k)) continue;
    const v = obj[k];
    out[k] = (v == null ? '' : String(v)).slice(0, 8000);
  }
  return JSON.stringify(out).length > MAKS_UKURAN_JAWABAN ? null : out;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!adaKonfigurasi()) return { statusCode: 500, body: JSON.stringify({ error: 'Konfigurasi server belum lengkap.' }) };

  let body;
  try { body = JSON.parse(event.body); } catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Body tidak valid' }) }; }

  const { sesi_id, pelanggaran, terjawab, total, jawaban } = body;
  if (!UUID.test(String(sesi_id))) return { statusCode: 400, body: JSON.stringify({ error: 'sesi_id tidak valid' }) };

  try {
    const list = await sb(`sesi_ujian?id=eq.${sesi_id}&select=id,status,total_skor,pelanggaran,tambahan_menit,dikunci,pesan_guru,pesan_id`);
    const sesi = list && list[0];
    const server_time = Date.now();

    // Sesi sudah tidak ada -> guru menekan "Reset"
    if (!sesi) return { statusCode: 200, body: JSON.stringify({ status: 'dihapus', server_time }) };

    // Sesi sudah ditutup (dikumpulkan sendiri / diakhiri guru)
    if (sesi.status !== 'berlangsung') {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: sesi.status, nilai: sesi.total_skor, perlu_nilai_manual: sesi.status === 'selesai', server_time }),
      };
    }

    const patch = { terakhir_aktif: new Date().toISOString() };
    const pel = Math.min(Math.max(parseInt(pelanggaran) || 0, Number(sesi.pelanggaran) || 0), 999);
    if (pel !== (Number(sesi.pelanggaran) || 0)) patch.pelanggaran = pel;
    if (Number.isFinite(Number(terjawab))) patch.progres = Math.max(0, Math.min(parseInt(terjawab) || 0, 1000));
    if (Number.isFinite(Number(total))) patch.total_soal = Math.max(0, Math.min(parseInt(total) || 0, 1000));
    const j = bersihkanJawaban(jawaban);
    if (j) patch.jawaban_sementara = j;

    // Hanya tulis kalau sesi masih berlangsung (hindari menimpa sesi yang baru ditutup guru)
    await sb(`sesi_ujian?id=eq.${sesi_id}&status=eq.berlangsung`, { method: 'PATCH', body: JSON.stringify(patch) });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'berlangsung',
        dikunci: !!sesi.dikunci,
        tambahan_menit: Number(sesi.tambahan_menit) || 0,
        pesan_id: Number(sesi.pesan_id) || 0,
        pesan: sesi.pesan_guru || '',
        server_time,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
