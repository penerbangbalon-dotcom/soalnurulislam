// Netlify Function: mulai-ujian
// Tidak pakai library npm apapun (langsung fetch ke Supabase REST API)
// supaya deploy drag-and-drop tidak perlu proses build sama sekali.

const { ipDari, hitungGagal, catatGagal } = require('../lib/ujian-core');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Nama tabel & kolom siswa mengikuti aplikasi absensi. Bisa di-override lewat
// env var TABEL_SISWA / KOLOM_NISN / KOLOM_NAMA_SISWA kalau skemanya beda.
const TABEL_SISWA = process.env.TABEL_SISWA || 'students';
const KOLOM_NISN = process.env.KOLOM_NISN || 'nisn';
const KOLOM_NAMA_SISWA = process.env.KOLOM_NAMA_SISWA || 'nama';
// Opsional: kolom PIN (mis. tanggal_lahir). Jika diisi, siswa wajib memasukkan PIN yang cocok.
const KOLOM_PIN = process.env.KOLOM_PIN || '';
// WAJIB_PIN=true: tolak ujian kalau KOLOM_PIN belum diatur (mencegah siswa masuk hanya dengan NISN).
const WAJIB_PIN = String(process.env.WAJIB_PIN || '').toLowerCase() === 'true';
// Pembatas percobaan gagal (anti tebak NISN / PIN / kode akses).
const MAKS_GAGAL_NISN = 5, MAKS_GAGAL_IP = 100, JENDELA_MENIT = 10; // batas IP dibuat longgar karena satu kelas biasanya berbagi satu WiFi/IP

function headers() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { ...headers(), ...(opts.headers || {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Supabase error (${res.status})`);
  return data;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel Environment Variables.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body tidak valid' }) };
  }

  const { kode_akses, nisn, pin } = body;
  if (!kode_akses || !nisn) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Kode akses dan NISN wajib diisi' }) };
  }

  if (WAJIB_PIN && !KOLOM_PIN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server diatur WAJIB_PIN=true tetapi KOLOM_PIN belum diisi. Hubungi admin.' }) };
  }
  const ip = ipDari(event);
  const kunciNisn = `nisn:${String(nisn).trim()}`, kunciIp = `ip:${ip}`;
  const [gagalNisn, gagalIp] = await Promise.all([hitungGagal(kunciNisn, JENDELA_MENIT), hitungGagal(kunciIp, JENDELA_MENIT)]);
  if (gagalNisn >= MAKS_GAGAL_NISN || gagalIp >= MAKS_GAGAL_IP) {
    return { statusCode: 429, body: JSON.stringify({ error: `Terlalu banyak percobaan gagal. Coba lagi ${JENDELA_MENIT} menit lagi atau hubungi guru.` }) };
  }

  try {
    // 1. Cari paket ujian
    const paketList = await sb(`paket_ujian?kode_akses=eq.${encodeURIComponent(kode_akses.trim())}&status=eq.siap&select=*`);
    const paket = paketList && paketList[0];
    if (!paket) {
      await catatGagal(kunciIp);
      return { statusCode: 404, body: JSON.stringify({ error: 'Kode akses tidak ditemukan atau ujian belum dibuka' }) };
    }

    // 2. Cari data siswa dari tabel siswa (aplikasi absensi)
    const siswaList = await sb(`${TABEL_SISWA}?${KOLOM_NISN}=eq.${encodeURIComponent(nisn.trim())}&select=${KOLOM_NISN},${KOLOM_NAMA_SISWA}${KOLOM_PIN ? ',' + KOLOM_PIN : ''}${TABEL_SISWA === 'students' ? '&status=eq.AKTIF' : ''}`);
    const siswa = siswaList && siswaList[0];
    if (!siswa) {
      await catatGagal(kunciNisn, kunciIp);
      return { statusCode: 404, body: JSON.stringify({ error: 'NISN tidak ditemukan di data siswa' }) };
    }
    if (KOLOM_PIN) {
      const n = (v) => String(v == null ? '' : v).trim().toLowerCase();
      if (!n(pin) || n(pin) !== n(siswa[KOLOM_PIN])) {
        await catatGagal(kunciNisn, kunciIp);
        return { statusCode: 401, body: JSON.stringify({ error: 'PIN salah. Tanyakan ke guru.' }) };
      }
    }
    const namaSiswa = siswa[KOLOM_NAMA_SISWA];

    // 3. Cek/buat sesi ujian
    const sesiList = await sb(`sesi_ujian?paket_ujian_id=eq.${paket.id}&siswa_nisn=eq.${encodeURIComponent(nisn.trim())}&select=*`);
    let sesi = sesiList && sesiList[0];

    if (sesi && sesi.status !== 'berlangsung') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Kamu sudah menyelesaikan ujian ini' }) };
    }

    if (!sesi) {
      const created = await sb('sesi_ujian', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ paket_ujian_id: paket.id, siswa_nisn: nisn.trim(), siswa_nama: namaSiswa }),
      });
      sesi = created[0];
    }

    // 4. Ambil soal (tanpa kunci_jawaban!)
    const soalList = await sb(
      `paket_soal?paket_ujian_id=eq.${paket.id}&select=nomor,poin,bank_soal(id,jenis,pertanyaan,opsi_a,opsi_b,opsi_c,opsi_d,opsi_e,gambar)&order=nomor`
    );

    const soal = soalList.map((s) => ({
      nomor: s.nomor,
      poin: s.poin,
      id: s.bank_soal.id,
      jenis: s.bank_soal.jenis,
      pertanyaan: s.bank_soal.pertanyaan,
      opsi_a: s.bank_soal.opsi_a,
      opsi_b: s.bank_soal.opsi_b,
      opsi_c: s.bank_soal.opsi_c,
      opsi_d: s.bank_soal.opsi_d,
      opsi_e: s.bank_soal.opsi_e,
      gambar: s.bank_soal.gambar,
    }));

    // Acak stabil: seed dari id sesi, jadi urutan sama saat siswa masuk lagi
    function seededShuffle(arr, seedStr) {
      let h = 1779033703 ^ seedStr.length;
      for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
      let a = h >>> 0;
      const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const r = arr.slice();
      for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
      return r;
    }
    const finalSoal = paket.acak_soal ? seededShuffle(soal, sesi.id) : soal;

    // Catat siswa sudah masuk (untuk Monitoring Ujian guru). Kalau kolom monitoring belum
    // dimigrasi, jangan gagalkan ujian — cukup lewati.
    try {
      await sb(`sesi_ujian?id=eq.${sesi.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ terakhir_aktif: new Date().toISOString(), total_soal: finalSoal.length }),
      });
    } catch (e) { /* jalankan migrasi-lengkap.sql untuk mengaktifkan monitoring */ }

    return {
      statusCode: 200,
      body: JSON.stringify({
        sesi_id: sesi.id,
        judul: paket.judul,
        durasi_menit: paket.durasi_menit,
        waktu_mulai: sesi.waktu_mulai,
        nama_siswa: namaSiswa,
        acak: !!paket.acak_soal,
        tambahan_menit: Number(sesi.tambahan_menit) || 0,
        dikunci: !!sesi.dikunci,
        pesan_id: Number(sesi.pesan_id) || 0,
        jawaban_tersimpan: sesi.jawaban_sementara || {},
        server_time: Date.now(),
        soal: finalSoal,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
