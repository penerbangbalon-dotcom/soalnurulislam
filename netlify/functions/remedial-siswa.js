// Netlify/Vercel Function: remedial-siswa
// Siswa (NISN + PIN) melihat mata pelajaran/komponen yang berhak diremedial, beserta paket remedial yang
// tersedia untuknya. Kode akses hanya dikirim untuk paket yang boleh dikerjakan siswa itu.
const { ipDari, hitungGagal, catatGagal, daftarRemedialSiswa, verifikasiSiswa, adaKonfigurasi } = require('../lib/ujian-core');

const MAKS_GAGAL_NISN = 5, MAKS_GAGAL_IP = 100, JENDELA_MENIT = 10;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!adaKonfigurasi()) return { statusCode: 500, body: JSON.stringify({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel Environment Variables.' }) };
  let body;
  try { body = JSON.parse(event.body); } catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Body tidak valid' }) }; }
  const { nisn, pin } = body;
  if (!nisn) return { statusCode: 400, body: JSON.stringify({ error: 'NISN wajib diisi' }) };

  const ip = ipDari(event);
  const kunciNisn = `nisn:${String(nisn).trim()}`, kunciIp = `ip:${ip}`;
  const [gagalNisn, gagalIp] = await Promise.all([hitungGagal(kunciNisn, JENDELA_MENIT), hitungGagal(kunciIp, JENDELA_MENIT)]);
  if (gagalNisn >= MAKS_GAGAL_NISN || gagalIp >= MAKS_GAGAL_IP) {
    return { statusCode: 429, body: JSON.stringify({ error: `Terlalu banyak percobaan gagal. Coba lagi ${JENDELA_MENIT} menit lagi atau hubungi guru.` }) };
  }
  try {
    const v = await verifikasiSiswa(nisn, pin);
    if (v.error) {
      if (v.status === 404 || v.status === 401) await catatGagal(kunciNisn, kunciIp);
      return { statusCode: v.status, body: JSON.stringify({ error: v.error }) };
    }
    const daftar = await daftarRemedialSiswa(nisn);
    return { statusCode: 200, body: JSON.stringify({ nama_siswa: v.nama, remedial: daftar }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
