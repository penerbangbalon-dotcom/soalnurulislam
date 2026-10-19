// Netlify Function: submit-ujian
// Tidak pakai library npm apapun (langsung fetch ke Supabase REST API).
// Logika penilaian ada di ../lib/ujian-core.js (dipakai juga oleh sudahi-ujian).

const { UUID, adaKonfigurasi, sb, nilaiDanSimpanSesi } = require('../lib/ujian-core');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!adaKonfigurasi()) {
    return { statusCode: 500, body: JSON.stringify({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel Environment Variables.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body tidak valid' }) };
  }

  const { sesi_id, jawaban: jawabanRaw, pelanggaran } = body; // jawaban: [{ soal_id, jawaban }]
  if (!UUID.test(String(sesi_id)) || !Array.isArray(jawabanRaw)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Data tidak lengkap' }) };
  }

  try {
    const sesiList = await sb(`sesi_ujian?id=eq.${sesi_id}&select=*`);
    const sesi = sesiList && sesiList[0];
    if (!sesi) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Sesi ujian tidak ditemukan' }) };
    }
    if (sesi.status !== 'berlangsung') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Sesi ujian sudah selesai' }) };
    }

    // Cek batas waktu di server (toleransi 3 menit untuk jaringan lambat).
    // Waktu tambahan dari guru (tambahan_menit) ikut dihitung.
    const [paketInfo] = await sb(`paket_ujian?id=eq.${sesi.paket_ujian_id}&select=durasi_menit,bobot_pg,bobot_isian,bobot_essay`);
    const totalMenit = (paketInfo?.durasi_menit || 90) + (Number(sesi.tambahan_menit) || 0) + 3;
    const batas = new Date(sesi.waktu_mulai).getTime() + totalMenit * 60000;
    if (Date.now() > batas) {
      await sb(`sesi_ujian?id=eq.${sesi_id}`, { method: 'PATCH', body: JSON.stringify({ status: 'selesai', waktu_selesai: new Date().toISOString(), total_skor: 0 }) });
      return { statusCode: 403, body: JSON.stringify({ error: 'Waktu ujian sudah habis, jawaban tidak dapat disimpan.' }) };
    }

    const pel = Math.max(parseInt(pelanggaran) || 0, Number(sesi.pelanggaran) || 0);
    const hasil = await nilaiDanSimpanSesi({ sesi, paketInfo, jawabanRaw, pelanggaran: pel });
    return { statusCode: hasil.status, body: JSON.stringify(hasil.body) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
