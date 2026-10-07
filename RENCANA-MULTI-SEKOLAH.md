# Rencana Multi-Sekolah (Multi-Tenant) & Pemisahan dari Aplikasi Absensi

Status: **rancangan**, belum dijalankan. Perubahan ini menyentuh seluruh tabel dan data yang sudah ada,
jadi dikerjakan sebagai tahap terpisah setelah keputusan di bagian "Keputusan yang dibutuhkan" dijawab.

## Tujuan
1. Satu instalasi bisa melayani banyak sekolah; data sekolah A tidak pernah terlihat oleh sekolah B.
2. Data siswa dikelola di aplikasi ini (tidak lagi wajib bergantung pada tabel `students` milik aplikasi absensi).
3. Instalasi PKBM Nurul Islam saat ini tetap berjalan tanpa kehilangan data (menjadi sekolah pertama).

## A. Skema
Tabel baru:
- `sekolah` (id uuid, nama, slug, aktif, paket, batas_siswa, dibuat)
- `anggota_sekolah` (user_id → auth.users, sekolah_id, peran: `admin` | `guru` | `wali_kelas`)
- `siswa` (id, sekolah_id, nisn, nama, kelas, program, pin_hash, status, tanggal_lahir)  ← pengganti `students`
- `pengaturan_sekolah` ditambah `sekolah_id` (menggantikan `id = 1`)

Kolom `sekolah_id uuid not null` ditambahkan ke: `mata_pelajaran`, `bank_soal`, `paket_ujian`, `paket_soal` (lewat paket),
`sesi_ujian`, `detail_jawaban` (lewat sesi), `arsip_nilai`, `nilai_manual_komponen`, `catatan_siswa_semester`,
`pengaturan_nilai`, `pengaturan_ttd`, `piagam_log`, `ujian_pengecualian`, `paket_jurusan`.

## B. Keamanan (RLS)
Fungsi bantu `sekolah_saya()` membaca sekolah milik pengguna login dari `anggota_sekolah`.
Semua kebijakan berbentuk: `using (sekolah_id = sekolah_saya())`. Ini menggantikan kebijakan sekarang
(`auth.role() = 'authenticated'` = semua guru melihat semua data).
Fungsi server (service_role) wajib menyaring `sekolah_id` secara eksplisit karena service_role melewati RLS.

## C. Migrasi data yang sudah ada
1. Buat satu baris `sekolah` untuk PKBM Nurul Islam.
2. Tambah kolom `sekolah_id` (nullable) → isi semua baris lama dengan id sekolah itu → ubah menjadi `not null`.
3. Semua akun login yang ada dimasukkan ke `anggota_sekolah` (admin sesuai peran sekarang).
4. Salin `students` → `siswa` (satu kali), lalu fungsi `mulai-ujian` membaca `siswa`.
Seluruh langkah dibungkus transaksi dan didahului backup penuh.

## D. Siswa & aplikasi absensi
- Bawaan: siswa dikelola di aplikasi ini (impor Excel/CSV: NISN, nama, kelas, program, tanggal lahir).
- Opsional: integrasi absensi tetap ada sebagai "konektor" per sekolah (URL/kunci disimpan per sekolah),
  bukan lagi syarat. Tarik-data-absensi di Input Nilai Tambahan hanya muncul bila konektor aktif.
- PIN siswa disimpan sebagai hash; tanggal lahir hanya dipakai saat impor untuk membuat PIN awal.

## E. Peran
- `admin`: kelola pengguna, identitas sekolah, pengaturan nilai, semua data sekolah.
- `guru`: bank soal & paket ujian untuk mata pelajaran yang ditugaskan; menilai essay; melihat nilainya.
- `wali_kelas`: melihat nilai, kehadiran, dan mengisi sikap/catatan untuk kelas yang diampu.
Penugasan guru → mapel/kelas disimpan di tabel `penugasan_guru` (user_id, mapel_id, kelas).

## F. Urutan pengerjaan yang aman
1. Backup. 2. Skema baru + `sekolah_id` nullable. 3. Isi data lama. 4. Perbarui fungsi server & frontend agar membaca `sekolah_id`.
5. Aktifkan `not null` + RLS baru. 6. Uji dengan dua sekolah percobaan (pastikan data tidak bocor). 7. Baru buka pendaftaran sekolah lain.

## Keputusan yang dibutuhkan sebelum mulai
1. **Sekolah lain mendaftar sendiri**, atau Anda yang membuatkan akun sekolahnya (lebih sederhana untuk tahap awal)?
2. **Aplikasi absensi**: tetap dipertahankan sebagai konektor opsional untuk PKBM Nurul Islam, atau semua sekolah memakai data siswa internal?
3. **Peran guru**: cukup admin vs guru dulu, atau langsung dengan pembatasan per mapel/kelas dan wali kelas?
