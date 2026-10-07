// Netlify/Vercel Function: kelola-siswa
// Menambah siswa ke tabel `students` (tabel yang SAMA dengan aplikasi absensi) dari menu "Data Siswa".
// Hanya admin / super admin. Kata sandi awal siswa di absensi = tanggal lahir DDMMYYYY (bcrypt),
// dibuat oleh fungsi database tambah_siswa_massal (lihat migrasi-v13-tambah-siswa.sql).
//
// Aksi: "tambah" { rows: [{ nama, nisn, jk, kelas, tanggal_lahir, tempat_lahir, nipd, hp, alamat }] } (maks 100 baris/permintaan)

const { adaKonfigurasi, wajibAdmin, sb } = require('../lib/ujian-core');

const resp = (statusCode, obj) => ({ statusCode, body: JSON.stringify(obj) });
const MAKS_BARIS = 100;
const ROMAWI = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };

const rapikan = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());

// "10 ips 1" -> { kelas:'10 IPS 1', jenjang:'SMA', program:'PAKET_C' }; "Kelas 5" / "V" -> 'Kelas 5'
function normalKelas(raw) {
  let s = rapikan(raw).replace(/^kelas\s+/i, '');
  if (!s) throw new Error('Kelas kosong');
  const m = s.match(/^(\d{1,2}|[IVXivx]{1,4})(?:\s+(.*))?$/);
  if (!m) throw new Error(`Kelas "${raw}" tidak dikenali (contoh: 8 A, 10 IPS 1, Kelas 5)`);
  const angka = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : ROMAWI[m[1].toUpperCase()];
  if (!angka || angka < 1 || angka > 12) throw new Error(`Kelas "${raw}" di luar rentang 1-12`);
  const sisa = rapikan(m[2] || '').toUpperCase();
  if (angka <= 6) return { kelas: `Kelas ${angka}`, jenjang: 'SD', program: 'UMUM' };
  return {
    kelas: sisa ? `${angka} ${sisa}` : String(angka),
    jenjang: angka <= 9 ? 'SMP' : 'SMA',
    program: angka <= 9 ? 'PAKET_B' : 'PAKET_C',
  };
}

function normalJk(raw) {
  const s = rapikan(raw).toLowerCase();
  if (!s) return null;
  if (['l', 'lk', 'laki-laki', 'laki laki', 'pria', 'male'].includes(s)) return 'L';
  if (['p', 'pr', 'perempuan', 'wanita', 'female'].includes(s)) return 'P';
  throw new Error(`Jenis kelamin "${raw}" tidak dikenali (isi L atau P)`);
}

// Terima YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY. Mengembalikan 'YYYY-MM-DD'.
function normalTanggal(raw) {
  const s = rapikan(raw);
  if (!s) throw new Error('Tanggal lahir kosong');
  let y, mo, d, m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else throw new Error(`Tanggal lahir "${raw}" tidak dikenali (contoh: 05/03/2008)`);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) throw new Error(`Tanggal lahir "${raw}" tidak valid`);
  if (y < 1950 || y > new Date().getUTCFullYear()) throw new Error(`Tahun lahir "${y}" tidak masuk akal`);
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function siapkanBaris(r, idx) {
  const baris = r && r.baris ? parseInt(r.baris, 10) || idx + 1 : idx + 1;
  try {
    const nama = rapikan(r.nama);
    if (!nama) throw new Error('Nama kosong');
    const nisn = rapikan(r.nisn).replace(/\.0+$/, '');
    if (!/^\d{5,20}$/.test(nisn)) throw new Error('NISN harus angka (5-20 digit), tanpa spasi/huruf');
    const k = normalKelas(r.kelas);
    return { ok: true, data: {
      baris, nama, nisn, jk: normalJk(r.jk), kelas: k.kelas, jenjang: k.jenjang, program: k.program,
      tanggal_lahir: normalTanggal(r.tanggal_lahir),
      tempat_lahir: rapikan(r.tempat_lahir) || null, nipd: rapikan(r.nipd) || null,
      hp: rapikan(r.hp) || null, alamat: rapikan(r.alamat) || null,
    } };
  } catch (e) {
    return { ok: false, lewat: { baris, nama: rapikan(r && r.nama), nisn: rapikan(r && r.nisn), alasan: e.message } };
  }
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!adaKonfigurasi()) return resp(500, { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel Environment Variables.' });

  const guard = await wajibAdmin(event);
  if (guard.error) return guard.error;

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return resp(400, { error: 'Body tidak valid' }); }

  try {
    if (body.action !== 'tambah') return resp(400, { error: 'Aksi tidak dikenali' });
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return resp(400, { error: 'Tidak ada data siswa.' });
    if (rows.length > MAKS_BARIS) return resp(400, { error: `Maksimal ${MAKS_BARIS} siswa per permintaan.` });

    const siap = [], dilewati = [], terlihat = new Set();
    rows.forEach((r, i) => {
      const h = siapkanBaris(r || {}, i);
      if (!h.ok) return dilewati.push(h.lewat);
      if (terlihat.has(h.data.nisn)) return dilewati.push({ baris: h.data.baris, nama: h.data.nama, nisn: h.data.nisn, alasan: 'NISN dobel di data yang sama' });
      terlihat.add(h.data.nisn);
      siap.push(h.data);
    });

    let ditambah = 0;
    if (siap.length) {
      let hasil;
      try {
        hasil = await sb('rpc/tambah_siswa_massal', { method: 'POST', body: JSON.stringify({ p_rows: siap }) });
      } catch (e) {
        if (/tambah_siswa_massal|PGRST202|schema cache/i.test(e.message)) {
          return resp(500, { error: 'Fungsi database belum dibuat. Jalankan migrasi-v13-tambah-siswa.sql di Supabase SQL Editor.' });
        }
        throw e;
      }
      ditambah = (hasil && hasil.ditambah) || 0;
      ((hasil && hasil.dilewati) || []).forEach((x) => dilewati.push(x));
    }
    dilewati.sort((a, b) => a.baris - b.baris);
    return resp(200, { ok: true, ditambah, dilewati });
  } catch (err) {
    return resp(500, { error: err.message });
  }
};

exports._uji = { normalKelas, normalJk, normalTanggal, siapkanBaris };
