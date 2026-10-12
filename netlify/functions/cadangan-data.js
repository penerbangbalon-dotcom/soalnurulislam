// Function: cadangan-data  (khusus Super Admin)
// Dipakai menu "Cadangan Data" di index.html untuk:
//   - daftar : daftar tabel yang dicadangkan (urut induk -> anak)
//   - baca   : membaca sebagian baris satu tabel (halaman demi halaman, supaya muat di batas ukuran respons Vercel)
//   - tulis  : memasukkan baris ke satu tabel dengan UPSERT (pemulihan). TIDAK pernah menghapus data.
// Hanya tabel di daftar putih di bawah yang boleh dibaca/ditulis.

const { adaKonfigurasi, sb, wajibSuperAdmin } = require('../lib/ujian-core');

const resp = (statusCode, obj) => ({ statusCode, body: JSON.stringify(obj) });

// Urutan = urutan pemulihan (tabel induk dulu). pk = kolom kunci untuk pengurutan & upsert.
// u = jumlah baris per halaman saat membaca (dibuat kecil untuk tabel yang barisnya bisa besar).
const TABEL = [
  { t: 'admins', pk: 'id' }, { t: 'students', pk: 'id' }, { t: 'school_settings', pk: 'id', u: 20 },
  { t: 'program_schedules', pk: 'id' }, { t: 'program_schedules_jumat', pk: 'program' },
  { t: 'semester', pk: 'id' }, { t: 'hari_libur', pk: 'id' }, { t: 'tanda_tangan', pk: 'id', u: 20 },
  { t: 'wali_kelas', pk: 'kelas', u: 20 }, { t: 'absensi_mapel', pk: 'id' }, { t: 'absensi_jam_belajar', pk: 'id' },
  { t: 'absensi_jadwal_mapel', pk: 'id' }, { t: 'attendance_sessions', pk: 'id' }, { t: 'attendance', pk: 'id' },
  { t: 'attendance_security_events', pk: 'id' }, { t: 'audit_logs', pk: 'id' },
  { t: 'pengaturan_sekolah', pk: 'id', u: 20 }, { t: 'pengaturan_nilai', pk: 'id' }, { t: 'pengaturan_ttd', pk: 'id', u: 20 },
  { t: 'mata_pelajaran', pk: 'id' }, { t: 'capaian_pembelajaran', pk: 'id' }, { t: 'tujuan_pembelajaran', pk: 'id' },
  { t: 'paket_ujian', pk: 'id' }, { t: 'bank_soal', pk: 'id' },
  { t: 'paket_soal', pk: 'id' }, { t: 'paket_jurusan', pk: 'id' }, { t: 'ujian_pengecualian', pk: 'id' },
  { t: 'sesi_ujian', pk: 'id', u: 200 }, { t: 'detail_jawaban', pk: 'id' },
  { t: 'nilai_komponen', pk: 'id' }, { t: 'nilai_manual_komponen', pk: 'id' },
  { t: 'catatan_siswa_semester', pk: 'id' }, { t: 'ekstrakurikuler_siswa', pk: 'id' },
  { t: 'tugas', pk: 'id', u: 100 }, { t: 'tugas_jawaban', pk: 'id', u: 40 }, { t: 'piagam_log', pk: 'id' },
  // paling akhir: isi aslinya menimpa baris yang dibuat otomatis oleh trigger saat sesi dipulihkan
  { t: 'arsip_nilai', pk: 'sesi_id' },
];
const PETA = new Map(TABEL.map((x) => [x.t, x]));
const UKURAN_BACA = 300, MAKS_TULIS = 500;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!adaKonfigurasi()) return resp(500, { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel Environment Variables.' });

  const guard = await wajibSuperAdmin(event);
  if (guard.error) return guard.error;

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return resp(400, { error: 'Body tidak valid' }); }
  const { action } = body;

  try {
    if (action === 'daftar') return resp(200, { tabel: TABEL });

    const info = PETA.get(String(body.tabel || ''));
    if (action === 'baca' || action === 'tulis') {
      if (!info) return resp(400, { error: 'Tabel tidak dikenal.' });
    }

    if (action === 'baca') {
      const dari = Math.max(0, parseInt(body.dari, 10) || 0);
      const batas = info.u || UKURAN_BACA;
      const jumlah = Math.min(batas, Math.max(1, parseInt(body.jumlah, 10) || batas));
      const baris = await sb(`${info.t}?select=*&order=${info.pk}.asc&limit=${jumlah}&offset=${dari}`);
      return resp(200, { baris: baris || [] });
    }

    if (action === 'tulis') {
      const baris = Array.isArray(body.baris) ? body.baris : null;
      if (!baris) return resp(400, { error: 'Data baris tidak valid.' });
      if (baris.length > MAKS_TULIS) return resp(400, { error: `Maksimal ${MAKS_TULIS} baris per kiriman.` });
      if (baris.length && !baris.every((b) => b && typeof b === 'object' && !Array.isArray(b) && b[info.pk] != null)) {
        return resp(400, { error: `Setiap baris harus punya kolom ${info.pk}.` });
      }
      if (baris.length) {
        await sb(`${info.t}?on_conflict=${info.pk}`, {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(baris),
        });
      }
      return resp(200, { ok: true, ditulis: baris.length });
    }

    return resp(400, { error: 'Aksi tidak dikenal.' });
  } catch (e) {
    return resp(500, { error: e.message || 'Terjadi kesalahan pada server.' });
  }
};
