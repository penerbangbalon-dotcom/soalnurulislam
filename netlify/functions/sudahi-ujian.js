// Netlify Function: sudahi-ujian
// Dipanggil guru dari menu "Monitoring Ujian" untuk mengakhiri paksa ujian satu/banyak siswa.
// Jawaban yang sudah tersimpan di server (jawaban_sementara, dikirim halaman siswa lewat heartbeat)
// langsung dinilai memakai mesin penilaian yang sama dengan submit-ujian.
// Hanya guru yang sudah login yang boleh memakai function ini.

const { adaKonfigurasi, sb, pastikanLogin, nilaiDanSimpanSesi, UUID } = require('../lib/ujian-core');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!adaKonfigurasi()) return { statusCode: 500, body: JSON.stringify({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel Environment Variables.' }) };

  const pemanggil = await pastikanLogin(event);
  if (!pemanggil) return { statusCode: 401, body: JSON.stringify({ error: 'Sesi login tidak valid. Silakan login ulang.' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Body tidak valid' }) }; }

  const ids = (Array.isArray(body.sesi_ids) ? body.sesi_ids : []).filter((x) => UUID.test(String(x))).slice(0, 100);
  if (!ids.length) return { statusCode: 400, body: JSON.stringify({ error: 'Tidak ada sesi yang dipilih' }) };

  // pulihkan=true: untuk sesi yang menggantung berstatus "selesai" TANPA satu pun jawaban terhitung
  // (muncul di menu Perlu Dinilai dengan "0 soal"). Sesi dibuka sebentar lalu dinilai ulang dari cadangan
  // jawaban di server; waktu selesai aslinya dikembalikan.
  const pulihkan = body.pulihkan === true;
  const hasil = [];
  const cachePaket = {};
  for (const id of ids) {
    let waktuAsli = null, dibuka = false;
    try {
      let [sesi] = await sb(`sesi_ujian?id=eq.${id}&select=*`);
      if (!sesi) { hasil.push({ id, ok: false, error: 'Sesi tidak ditemukan' }); continue; }
      if (pulihkan) {
        if (sesi.status !== 'selesai') { hasil.push({ id, ok: false, error: 'Sesi tidak dalam status selesai' }); continue; }
        const ada = await sb(`detail_jawaban?sesi_ujian_id=eq.${id}&select=id&limit=1`);
        if (ada && ada.length) { hasil.push({ id, ok: false, error: 'Sesi ini sudah punya jawaban terhitung — gunakan tombol Nilai Essay' }); continue; }
        waktuAsli = sesi.waktu_selesai;
        const buka = await sb(`sesi_ujian?id=eq.${id}&status=eq.selesai`, {
          method: 'PATCH', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ status: 'berlangsung', waktu_selesai: null, total_skor: null }),
        });
        if (!buka || !buka.length) { hasil.push({ id, ok: false, error: 'Sesi sedang diproses pihak lain' }); continue; }
        dibuka = true;
        sesi = buka[0];
      }
      if (sesi.status !== 'berlangsung') { hasil.push({ id, ok: false, error: 'Sesi sudah selesai' }); continue; }
      if (!cachePaket[sesi.paket_ujian_id]) {
        const [p] = await sb(`paket_ujian?id=eq.${sesi.paket_ujian_id}&select=durasi_menit,bobot_pg,bobot_isian,bobot_essay`);
        cachePaket[sesi.paket_ujian_id] = p || {};
      }
      const r = await nilaiDanSimpanSesi({
        sesi,
        paketInfo: cachePaket[sesi.paket_ujian_id],
        jawabanRaw: null,
        jawabanTersimpan: sesi.jawaban_sementara,
        pelanggaran: sesi.pelanggaran,
      });
      if (r.status === 200) {
        if (pulihkan && waktuAsli) await sb(`sesi_ujian?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ waktu_selesai: waktuAsli }) });
        const adaCadangan = !!(sesi.jawaban_sementara && Object.keys(sesi.jawaban_sementara).length);
        hasil.push({ id, ok: true, nilai: r.body.nilai, tanpa_cadangan: pulihkan && !adaCadangan });
      } else {
        if (pulihkan && dibuka) await sb(`sesi_ujian?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'selesai', waktu_selesai: waktuAsli }) }).catch(() => {});
        hasil.push({ id, ok: false, error: r.body.error || 'Gagal' });
      }
    } catch (err) {
      if (pulihkan && dibuka) await sb(`sesi_ujian?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'selesai', waktu_selesai: waktuAsli }) }).catch(() => {});
      hasil.push({ id, ok: false, error: err.message });
    }
  }

  return { statusCode: 200, body: JSON.stringify({ hasil }) };
};
