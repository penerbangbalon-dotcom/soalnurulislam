// Netlify Function: sudahi-ujian
// Dipanggil guru dari menu "Monitoring Ujian" untuk mengakhiri paksa ujian satu/banyak siswa.
// Jawaban yang sudah tersimpan di server (jawaban_sementara, dikirim halaman siswa lewat heartbeat)
// langsung dinilai memakai mesin penilaian yang sama dengan submit-ujian.
// Hanya guru yang sudah login yang boleh memakai function ini.
//
// Mode aktifkan=true ("Aktifkan Kembali"): membuka lagi sesi yang sudah berstatus selesai/dinilai
// (mis. tidak sengaja disudahi, terkumpul otomatis karena waktu habis/pelanggaran, atau HP siswa bermasalah)
// supaya siswa MELANJUTKAN dari jawaban terakhirnya, bukan mengulang dari awal.
//  - Jawaban dipulihkan dari detail_jawaban ke jawaban_sementara (cadangan yang dibaca halaman siswa).
//  - Nilai lama & detail penilaian dihapus; nilai dihitung ulang saat siswa mengumpulkan lagi.
//  - Waktu: sisa waktu siswa dijamin minimal `menit` menit (lewat tambahan_menit).

const { adaKonfigurasi, sb, pastikanLogin, nilaiDanSimpanSesi, UUID, BATAS_PELANGGARAN } = require('../lib/ujian-core');

async function aktifkanKembali(id, menitBeri) {
  const [sesi] = await sb(`sesi_ujian?id=eq.${id}&select=*`);
  if (!sesi) return { id, ok: false, error: 'Sesi tidak ditemukan' };
  if (sesi.status === 'berlangsung') return { id, ok: false, error: 'Sesi masih berlangsung (tidak perlu diaktifkan)' };
  if (sesi.mode_ujian === 'manual') return { id, ok: false, error: 'Nilai input manual (ujian cetak) tidak bisa diaktifkan kembali' };

  const [paket] = await sb(`paket_ujian?id=eq.${sesi.paket_ujian_id}&select=durasi_menit,status`);
  if (!paket) return { id, ok: false, error: 'Paket ujian tidak ditemukan' };

  // Pulihkan jawaban dari hasil penilaian sebelumnya
  const detail = (await sb(`detail_jawaban?sesi_ujian_id=eq.${id}&select=soal_id,jawaban&limit=1000`)) || [];
  const cadangan = {};
  let terjawab = 0;
  for (const d of detail) {
    const v = d.jawaban == null ? '' : String(d.jawaban);
    cadangan[d.soal_id] = v;
    if (v.trim()) terjawab++;
  }

  // Sisa waktu minimal `menitBeri` menit dari sekarang (tambahan_menit tidak pernah negatif)
  const mulai = new Date(sesi.waktu_mulai).getTime();
  const durasi = Number(paket.durasi_menit) || 0;
  const tambahanBaru = Math.max(0, Math.ceil((Date.now() + menitBeri * 60000 - mulai) / 60000) - durasi);

  // Bila ujian dulu berakhir karena pelanggaran (mencapai batas), hitungan pelanggaran dikembalikan ke 0.
  // Kalau tidak, detak pertama siswa langsung menutup ujiannya lagi.
  const pelanggaranBaru = (BATAS_PELANGGARAN > 0 && (Number(sesi.pelanggaran) || 0) >= BATAS_PELANGGARAN) ? 0 : (Number(sesi.pelanggaran) || 0);

  // Buka sesi secara atomik (hanya bila masih selesai/dinilai)
  const buka = await sb(`sesi_ujian?id=eq.${id}&status=in.(selesai,dinilai)`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      status: 'berlangsung', waktu_selesai: null, total_skor: null,
      jawaban_sementara: cadangan, progres: terjawab, tambahan_menit: tambahanBaru,
      dikunci: false, terakhir_aktif: null, pelanggaran: pelanggaranBaru,
    }),
  });
  if (!buka || !buka.length) return { id, ok: false, error: 'Sesi sedang diproses pihak lain, coba lagi' };

  // Hapus detail penilaian lama supaya tidak dobel saat siswa mengumpulkan lagi
  try {
    await sb(`detail_jawaban?sesi_ujian_id=eq.${id}`, { method: 'DELETE' });
  } catch (err) {
    await sb(`sesi_ujian?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: sesi.status, waktu_selesai: sesi.waktu_selesai, total_skor: sesi.total_skor,
        jawaban_sementara: sesi.jawaban_sementara || null, progres: sesi.progres || 0,
        tambahan_menit: sesi.tambahan_menit || 0, dikunci: !!sesi.dikunci, terakhir_aktif: sesi.terakhir_aktif || null,
         pelanggaran: Number(sesi.pelanggaran) || 0,
      }),
    }).catch(() => {});
    return { id, ok: false, error: 'Gagal membersihkan nilai lama: ' + err.message };
  }

  const hasil = { id, ok: true, jawaban_dipulihkan: terjawab, total_jawaban: detail.length, pelanggaran_direset: pelanggaranBaru !== (Number(sesi.pelanggaran) || 0) };
  if (paket.status !== 'siap') hasil.peringatan = `Paket ujian berstatus "${paket.status}". Siswa baru bisa masuk setelah paket dibuka (status Siap).`;
  return hasil;
}

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
  const aktifkan = body.aktifkan === true;
  const menitBeri = Math.max(1, Math.min(180, parseInt(body.menit, 10) || 15));
  const hasil = [];
  const cachePaket = {};
  for (const id of ids) {
    if (aktifkan) {
      try { hasil.push(await aktifkanKembali(id, menitBeri)); }
      catch (err) { hasil.push({ id, ok: false, error: err.message }); }
      continue;
    }
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
