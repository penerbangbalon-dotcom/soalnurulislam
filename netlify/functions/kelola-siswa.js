// Netlify/Vercel Function: kelola-siswa
// Menambah siswa ke tabel `students` (tabel yang SAMA dengan aplikasi absensi) dari menu "Data Siswa".
// Hanya admin / super admin. Kata sandi awal siswa di absensi = tanggal lahir DDMMYYYY (bcrypt),
// dibuat oleh fungsi database tambah_siswa_massal (lihat migrasi-v13-tambah-siswa.sql).
//
// Aksi: "ubah" { nisn, data:{ nama, kelas, jk, tanggal_lahir, tempat_lahir, nipd, hp, alamat } } (satu siswa)
// Aksi: "kenaikan" { rows: [{ nisn, aksi: 'naik'|'lulus'|'pindah'|'keluar' }] } (maks 100/permintaan): menaikkan kelas (7->8, 8->9, 10->11, 11->12, rombel tetap)
//   atau mengubah status siswa AKTIF menjadi LULUS / PINDAH / KELUAR. Mengembalikan data lama per siswa (untuk pembatalan).
// Aksi: "batalkan_kenaikan" { rows: [{ nisn, kelas, jenjang, program, status, baru_kelas, baru_status }] }: mengembalikan data lama,
//   hanya bila data siswa sekarang masih sama dengan hasil kenaikan (tidak menimpa perubahan lain).
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

// Ubah data satu siswa di tabel `students` (tabel yang sama dengan aplikasi absensi, jadi otomatis sinkron).
// NISN tidak bisa diubah (dipakai sebagai kunci nilai/ujian); kata sandi dan status tidak disentuh.
function siapkanUbah(d) {
  const nama = rapikan(d.nama);
  if (!nama) throw new Error('Nama kosong');
  // kelas_tetap: kolom Kelas tidak diubah di formulir -> jangan menyentuh kelas/jenjang/program (ejaan kelas lama dari absensi tetap).
  const k = d.kelas_tetap ? null : normalKelas(d.kelas);
  return {
    nama, ...(k ? { kelas: k.kelas, jenjang: k.jenjang, program: k.program } : {}),
    jk: normalJk(d.jk), tanggal_lahir: normalTanggal(d.tanggal_lahir),
    tempat_lahir: rapikan(d.tempat_lahir) || null, nipd: rapikan(d.nipd) || null,
    hp: rapikan(d.hp) || null, alamat: rapikan(d.alamat) || null,
  };
}
async function ubahSiswa(body) {
  const nisn = rapikan(body.nisn);
  if (!/^\d{5,20}$/.test(nisn)) return resp(400, { error: 'NISN siswa tidak valid.' });
  let data;
  try { data = siapkanUbah(body.data || {}); } catch (e) { return resp(400, { error: e.message }); }
  const hasil = await sb(`students?nisn=eq.${encodeURIComponent(nisn)}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(data),
  });
  if (!hasil || !hasil.length) return resp(404, { error: 'Siswa dengan NISN tersebut tidak ditemukan.' });
  return resp(200, { ok: true, siswa: hasil[0] });
}

// ---------- KENAIKAN KELAS (v15.0) ----------
const STATUS_AKSI = { lulus: 'LULUS', pindah: 'PINDAH', keluar: 'KELUAR' };
// "10 IPS 1" -> "11 IPS 1". Hanya kelas 7, 8, 10, 11 yang bisa naik; kelas 9 dan 12 adalah kelas akhir (Lulus).
function kelasBerikutnya(kelasLama) {
  const k = normalKelas(kelasLama);
  const m = k.kelas.match(/^(\d{1,2})(?:\s+(.*))?$/);
  if (!m) throw new Error('Kelas SD/umum tidak bisa dinaikkan dari menu ini');
  const angka = parseInt(m[1], 10);
  if (angka === 9 || angka === 12) throw new Error(`Kelas ${angka} adalah kelas akhir: pilih Lulus atau Tidak Lulus`);
  if (![7, 8, 10, 11].includes(angka)) throw new Error(`Kelas ${angka} tidak bisa dinaikkan dari menu ini`);
  return normalKelas(`${angka + 1}${m[2] ? ' ' + m[2] : ''}`);
}
function ramahErrorStatus(e) {
  return /enum|check constraint|invalid input value/i.test(e.message || '')
    ? 'Database menolak nilai status ini. Jalankan migrasi-v20-kenaikan-kelas.sql di Supabase SQL Editor (menambah status LULUS/PINDAH/KELUAR).'
    : e.message;
}
async function ambilSiswaMap(nisns) {
  const hasil = await sb(`students?nisn=in.(${nisns.map(encodeURIComponent).join(',')})&select=nisn,kelas,jenjang,program,status`);
  return new Map((hasil || []).map((x) => [x.nisn, x]));
}
async function kenaikanKelas(body) {
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return resp(400, { error: 'Tidak ada data.' });
  if (rows.length > MAKS_BARIS) return resp(400, { error: `Maksimal ${MAKS_BARIS} siswa per permintaan.` });
  const nisns = rows.map((r) => rapikan(r && r.nisn)).filter((n) => /^\d{5,20}$/.test(n));
  const ada = nisns.length ? await ambilSiswaMap(nisns) : new Map();
  const hasil = [];
  for (const r of rows) {
    const nisn = rapikan(r && r.nisn), aksi = rapikan(r && r.aksi);
    const lapor = (o) => hasil.push({ nisn, ...o });
    const cur = ada.get(nisn);
    if (!cur) { lapor({ ok: false, error: 'Siswa tidak ditemukan' }); continue; }
    if (cur.status !== 'AKTIF') { lapor({ ok: false, error: `Status siswa bukan AKTIF (${cur.status})` }); continue; }
    const lama = { kelas: cur.kelas, jenjang: cur.jenjang, program: cur.program, status: cur.status };
    try {
      let data;
      if (aksi === 'naik') { const k = kelasBerikutnya(cur.kelas); data = { kelas: k.kelas, jenjang: k.jenjang, program: k.program }; }
      else if (STATUS_AKSI[aksi]) {
        if (aksi === 'lulus') {
          const angka = parseInt((normalKelas(cur.kelas).kelas.match(/^\d+/) || [0])[0], 10);
          if (angka !== 9 && angka !== 12) throw new Error('Lulus hanya untuk kelas akhir (9 atau 12)');
        }
        data = { status: STATUS_AKSI[aksi] };
      } else throw new Error('Aksi tidak dikenali');
      const upd = await sb(`students?nisn=eq.${encodeURIComponent(nisn)}&status=eq.AKTIF`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(data) });
      if (!upd || !upd.length) throw new Error('Tidak ada baris yang berubah');
      lapor({ ok: true, lama, baru: { kelas: upd[0].kelas, jenjang: upd[0].jenjang, program: upd[0].program, status: upd[0].status } });
    } catch (e) { lapor({ ok: false, error: ramahErrorStatus(e) }); }
  }
  return resp(200, { ok: true, hasil });
}
async function batalkanKenaikan(body) {
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return resp(400, { error: 'Tidak ada data.' });
  if (rows.length > MAKS_BARIS) return resp(400, { error: `Maksimal ${MAKS_BARIS} siswa per permintaan.` });
  const nisns = rows.map((r) => rapikan(r && r.nisn)).filter((n) => /^\d{5,20}$/.test(n));
  const ada = nisns.length ? await ambilSiswaMap(nisns) : new Map();
  const hasil = [];
  for (const r of rows) {
    const nisn = rapikan(r && r.nisn), cur = ada.get(nisn);
    const lapor = (o) => hasil.push({ nisn, ...o });
    if (!cur) { lapor({ ok: false, error: 'Siswa tidak ditemukan' }); continue; }
    if (cur.kelas !== r.baru_kelas || cur.status !== r.baru_status) { lapor({ ok: false, error: 'Data siswa sudah berubah setelah kenaikan; tidak dibatalkan otomatis' }); continue; }
    if (rapikan(r.status) !== 'AKTIF') { lapor({ ok: false, error: 'Data lama tidak valid' }); continue; }
    try {
      const k = normalKelas(r.kelas);
      const upd = await sb(`students?nisn=eq.${encodeURIComponent(nisn)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ kelas: rapikan(r.kelas), jenjang: k.jenjang, program: k.program, status: 'AKTIF' }) });
      if (!upd || !upd.length) throw new Error('Tidak ada baris yang berubah');
      lapor({ ok: true });
    } catch (e) { lapor({ ok: false, error: ramahErrorStatus(e) }); }
  }
  return resp(200, { ok: true, hasil });
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!adaKonfigurasi()) return resp(500, { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel Environment Variables.' });

  const guard = await wajibAdmin(event);
  if (guard.error) return guard.error;

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return resp(400, { error: 'Body tidak valid' }); }

  try {
    if (body.action === 'ubah') return await ubahSiswa(body);
    if (body.action === 'kenaikan') return await kenaikanKelas(body);
    if (body.action === 'batalkan_kenaikan') return await batalkanKenaikan(body);
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

exports._uji = { kelasBerikutnya, normalKelas, normalJk, normalTanggal, siapkanBaris, siapkanUbah };
