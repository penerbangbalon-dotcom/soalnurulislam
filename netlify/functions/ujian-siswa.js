// Netlify/Vercel Function: ujian-siswa
// Tombol "Ikuti UTS" / "Ikuti UAS" di jendela siswa. Siswa (NISN + PIN) mendapat daftar mata pelajaran
// UTS atau UAS yang sudah dibuka untuk kelas & program miliknya, lengkap dengan kode akses paketnya,
// sehingga siswa bisa langsung masuk ke paket ujian sesuai mata pelajaran yang dipilih.
const { ipDari, hitungGagal, catatGagal, daftarUjianSiswa, verifikasiSiswa, adaKonfigurasi } = require('../lib/ujian-core');

const MAKS_GAGAL_NISN = 5, MAKS_GAGAL_IP = 100, JENDELA_MENIT = 10;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!adaKonfigurasi()) return { statusCode: 500, body: JSON.stringify({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel Environment Variables.' }) };
  let body;
  try { body = JSON.parse(event.body); } catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Body tidak valid' }) }; }
  const { nisn, pin, jenis } = body;
  if (!nisn) return { statusCode: 400, body: JSON.stringify({ error: 'NISN wajib diisi' }) };
  if (!['UTS', 'UAS'].includes(String(jenis || '').toUpperCase())) return { statusCode: 400, body: JSON.stringify({ error: 'Jenis ujian harus UTS atau UAS' }) };

  const ip = ipDari(event);
  const kunciNisn = `nisn:${String(nisn).trim()}`, kunciIp = `ip:${ip}`;
  const [gagalNisn, gagalIp] = await Promise.all([hitungGagal(kunciNisn, JENDELA_MENIT), hitungGagal(kunciIp, JENDELA_MENIT)]);
  if (gagalNisn >= MAKS_GAGAL_NISN || gagalIp >= MAKS_GAGAL_IP) {
    return { statusCode: 429, body: JSON.stringify({ error: `Terlalu banyak percobaan gagal. Coba lagi ${JENDELA_MENIT} menit lagi atau hubungi guru.` }) };
  }
  try {
    const v = await verifikasiSiswa(nisn, pin, ['kelas', 'program']);
    if (v.error) {
      if (v.status === 404 || v.status === 401) await catatGagal(kunciNisn, kunciIp);
      return { statusCode: v.status, body: JSON.stringify({ error: v.error }) };
    }
    const d = await daftarUjianSiswa(nisn, v.siswa, jenis);
    return { statusCode: 200, body: JSON.stringify({ nama_siswa: v.nama, kelas: d.profil.kelasAsli, pesan: d.pesan || '', ujian: d.ujian }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
