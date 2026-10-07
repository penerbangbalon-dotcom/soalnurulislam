# Perubahan terbaru

## v12.0 — Paket Remedial online + tombol "Ikuti Remedial" untuk siswa
**Wajib dijalankan:** `migrasi-v14-remedial.sql` (bila belum), lalu `migrasi-v15-paket-remedial.sql`, di Supabase SQL Editor. Setelah itu unggah semua file ke GitHub (Vercel deploy otomatis). Ada fungsi server baru `api/remedial-siswa.js`.
1. **Menu baru "Paket Remedial"** (grup Paket Ujian; index.html)
   - Buat paket: pilih Jenjang, Kelas, Mata Pelajaran, **komponen yang diremedial (UH / UTS / UAS)**, Tahun Ajaran, Semester, durasi, acak soal, batas waktu (opsional), status awal (draft / langsung dibuka).
   - Soal diambil **otomatis hanya dari soal yang belum terpakai di paket mana pun**, sehingga selalu berbeda dari soal ujian asli. Soal bertanda **Khusus Remedial** di Bank Soal diprioritaskan; bila kurang bisa dilengkapi soal belum terpakai lain. Jumlah per jenis (PG / Isian / Essay) bisa diatur; hitungan soal tersedia dan daftar siswa yang masih di bawah KKM tampil sebelum paket dibuat.
   - Daftar paket: jumlah soal, siswa belum tuntas, siswa sudah mengerjakan, jumlah tuntas dan rata-rata, tombol Buka / Tutup, Edit Soal, Cetak, Hapus.
2. **Siswa: tab "Ikuti Remedial"** (ujian.html)
   - Siswa cukup memasukkan NISN (+PIN bila dipakai), tanpa kode akses. Muncul daftar mapel/komponen yang nilainya di bawah KKM, lengkap dengan nilai, KKM, dan statusnya (tersedia / lanjutkan / menunggu penilaian / belum ada paket / sudah tuntas).
   - Paket diberikan **otomatis** sesuai mapel, kelas, semester, dan komponen. Bila ada beberapa paket dan siswa masih di bawah KKM, ia mendapat paket berikutnya yang belum pernah ia kerjakan.
   - **Server memeriksa kelayakan**: siswa yang nilainya sudah tuntas, atau mapel yang tidak sesuai, ditolak walau memakai kode akses paket remedial (mulai-ujian.js + ujian-core.js).
3. **Nilai remedial online tersambung ke laporan**
   - Nilai paket remedial (terbaik dari semua percobaan) otomatis menjadi nilai remedial untuk Leger, Transkrip, Rekap Nilai, dan Perlu Remedial, memakai aturan di Pengaturan Nilai (maks KKM / tertinggi / rata-rata / nonaktif). Nilai yang diinput manual guru di Input Nilai Tambahan tetap didahulukan.
   - Leger kini memberi tanda **R** (layar) dan tanda * (Excel) pada nilai setelah remedial. Transkrip sudah bertanda * sejak v11.9.
   - Input Nilai Tambahan, Remedial menampilkan nilai remedial online di bawah kotak isian.
   - Essay pada paket remedial dinilai lewat menu Perlu Dinilai seperti biasa; nilainya ikut masuk setelah selesai dinilai.
4. **Perlu Remedial**: kolom baru "Paket Remedial Online" (belum ada paket / draft / tersedia online / ditutup) dengan tautan "Buat paket" yang langsung membuka formulir Paket Remedial terisi; kolom ikut di Unduh Excel.
5. **Bank Soal**: kotak centang **Khusus Remedial** pada soal manual dan pada Generate dengan AI; lencana di daftar soal. Soal khusus remedial tidak ditawarkan di paket UTS/UAS/UH dan tidak ikut "Jadikan Paket Ujian Otomatis".
6. Paket remedial tidak dihitung sebagai ujian reguler di Belum Mengikuti Ujian, Laporan Siswa, Rapor, Kartu Ujian, dan peringkat; nilainya masuk lewat remedial. Form Buat Paket Ujian punya pilihan jenis Remedial + komponen untuk mengedit paket remedial.

## v11.9 — Perlu Remedial, Transkrip Massal, Paket Otomatis (tanpa migrasi SQL baru)
1. **Menu baru "Perlu Remedial (di bawah KKM)"** (Laporan Nilai; index.html)
   - Daftar siswa belum tuntas KKM per **kelas** (urut nama siswa) atau per **mata pelajaran** (urut kelas, lalu siswa).
   - Filter Jenjang, Kelas, Mata Pelajaran, Tahun Ajaran, Semester, cari nama/NISN; pilihan "Nilai akhir di bawah KKM" atau "Nilai akhir ATAU salah satu UH/UTS/UAS di bawah KKM"; opsi "Hanya yang belum remedial".
   - Tiap baris memuat UH/UTS/UAS (yang di bawah KKM merah), nilai akhir, KKM, kekurangan, **komponen yang perlu diremedial**, dan **status remedial**. Chip ringkasan per mapel bisa diklik untuk menyaring.
   - Memakai nilai SETELAH remedial (aturan di Pengaturan Nilai), jadi siswa yang sudah tuntas setelah remedial otomatis keluar dari daftar.
   - **Cetak Daftar** (kop sekolah + tanda tangan) dan **Unduh Excel** (3 sheet: Daftar Remedial dengan kolom kosong untuk nilai/tanggal remedial, Rekap per Mapel, Rekap per Siswa).
   - Hanya membaca data; kelas IPA/IPS tampil lewat kolom rombel di bawah nama siswa.
2. **Cetak Transkrip Massal** (menu Transkrip Nilai)
   - Tombol baru "Cetak Massal (semua siswa terfilter)"; tombol "Cetak Transkrip" saat memilih "★ Semua siswa Kelas ..." juga langsung mencetak massal.
   - Satu siswa satu halaman lengkap dengan kop, tanda tangan wali kelas (per kelas terakhir siswa) dan kepala. Mengikuti filter Kelas dan kotak pencarian. Di atas 80 siswa muncul konfirmasi.
   - Cetakan transkrip (satuan dan massal) kini memberi tanda * pada nilai setelah remedial.
3. **Jadikan Paket Ujian Otomatis** (menu Bank Soal)
   - Bila ada soal yang belum terpakai di paket mana pun, muncul banner hijau dengan tombol "Jadikan Paket Ujian Otomatis".
   - Pilih satu mata pelajaran (jumlah soal per jenis PG/Isian/Essay bisa diatur, bawaan semua; cara pilih urut atau acak) atau "Semua mata pelajaran" (satu paket per mapel, berisi semua soal belum terpakai, judul otomatis).
   - Jenis ujian, semester, tahun ajaran, durasi, acak urutan, bobot PG/Isian/Essay bisa diatur. Paket dibuat berstatus **draft** dengan kode akses baru; susunan masih bisa diubah di Daftar Paket Ujian.
   - Daftar soal terpakai dibaca ulang dari database tepat sebelum paket dibuat, sehingga soal tidak pernah dipakai dua kali. Bila gagal di tengah jalan, paket yang setengah jadi dihapus.


1. **Batas pelanggaran 3x** (ujian.html + netlify/functions/heartbeat.js + netlify/lib/ujian-core.js)
   - Pelanggaran 1 dan 2: peringatan bertahap ("x dari 3").
   - Pelanggaran ke-3: ujian diakhiri otomatis, jawaban yang sudah terisi langsung dinilai.
   - Server juga menutup sesi sendiri lewat heartbeat (tidak bergantung HP siswa).
   - Ubah batas: `ANTI_CURANG.batasPelanggaran` di ujian.html dan env `BATAS_PELANGGARAN` di server (default 3, 0 = nonaktif).
2. **Sesi macet di Perlu Dinilai** (submit-ujian.js, sudahi-ujian.js, index.html)
   - Submit terlambat tidak lagi dibuang dengan nilai 0; dinilai dari cadangan jawaban di server.
   - Tombol "Hitung Nilai" / "Hitung Nilai Sesi Macet" di menu Perlu Dinilai memulihkan sesi lama.
3. **Filter Kelas** di menu Ujian Cetak & Nilai Manual (index.html).
4. Rekap kehadiran (H/S/I/A) di Input Nilai Tambahan, Leger, Laporan Siswa, Rapor Semester (index.html).
   Membutuhkan kolom `hadir` di tabel catatan_siswa_semester dan fungsi database
   `tarik_absensi_nilai` / `tanggal_mulai_absensi` (sudah dibuat di Supabase).
5. **Menu baru "Belum Mengikuti Ujian"** (index.html, grup Pelaksanaan Ujian)
   - Tabel per kelas: baris = siswa, kolom = mata pelajaran; sel berisi ✔ nilai / ✖ belum / ⏳ mengerjakan / ⚠ macet.
   - Filter Program, Kelas, Tahun Ajaran, Semester, Jenis Ujian, Status Paket; pencarian nama/NISN;
     opsi "hanya siswa yang belum ujian atau sesinya macet".
   - Ringkasan jumlah belum per mapel (chip + baris total), Ekspor Excel, Cetak Daftar.
   - Tombol "Laporan" per siswa (dari sana bisa Cetak Kartu Ujian) dan "Buka paket" per mapel.
   - Hanya membaca data; tidak ada perubahan database / migrasi SQL.

6. **Penyempurnaan "Belum Mengikuti Ujian"** (index.html; tanpa migrasi SQL)
   - Kolom **Ringkasan** per siswa, mis. "Belum 4 dari 7: Matematika (UH), Fisika (UTS), ...".
   - Filter Jenis Ujian sekarang default **Semua jenis** (UTS, UH, UAS); pilihan "UTS & UAS saja" tetap ada.
   - Opsi **Urutkan yang paling banyak tertinggal di atas**.
   - Paket yang mapel + jenis + semesternya sama (mis. dua UH Matematika) kini dibedakan dengan judul paket di header kolom.
7. **Susulan / Tidak wajib & paket khusus jurusan** (index.html + migrasi-v10-pengecualian.sql, WAJIB dijalankan sekali)
   - Klik sel "✖ Belum" di menu Belum Mengikuti Ujian untuk menandai **Susulan** (tetap ditagih) atau **Tidak wajib** (tidak dihitung), lengkap dengan catatan. Tanda bisa dihapus.
   - Paket kelas X-XII (Paket C) bisa diatur **Khusus IPA / Khusus IPS** lewat pilihan di header kolom. Siswa jurusan lain melihat "-" dan tidak dihitung. Jurusan siswa dibaca dari nama kelas di absensi (mis. "11 IPS 1").
   - Hitungan "Belum X dari N" memakai N = ujian yang berlaku untuk siswa itu. Ekspor Excel dan Cetak Daftar ikut memuat Susulan.
   - Sebelum migrasi dijalankan, menu tetap jalan seperti v10; hanya fitur baru ini yang nonaktif dengan pesan pengingat.

## Pembaruan keamanan & identitas sekolah (langkah 1–2)
**Wajib dijalankan:** `migrasi-v11-keamanan.sql` di Supabase SQL Editor (tabel pembatas percobaan + identitas sekolah).

**Variabel lingkungan baru (Vercel → Environment Variables), semuanya opsional:**
| Key | Fungsi |
|---|---|
| `ADMIN_EMAILS` | Daftar email admin (pisahkan koma). Tanpa ini, bila belum ada admin, akun TERTUA otomatis jadi admin saat pertama membuka aplikasi. |
| `KOLOM_PIN` | Kolom di tabel siswa yang dipakai sebagai PIN (mis. `tanggal_lahir`). **Sangat disarankan diisi**, supaya siswa tidak masuk hanya dengan NISN. |
| `WAJIB_PIN` | `true` = ujian ditolak bila `KOLOM_PIN` belum diisi. |

**Perubahan:**
- `generate-soal` sekarang wajib login (sebelumnya terbuka untuk umum).
- `kelola-user`: peran admin/guru. Hanya admin yang boleh melihat/menambah/menghapus user, reset sandi, ubah peran.
- `mulai-ujian`: pembatas percobaan gagal (5x per NISN / 100x per IP dalam 10 menit; IP longgar karena satu kelas biasanya berbagi satu WiFi).
- Menu baru **Pengaturan → Identitas Sekolah** (admin): nama, NPSN, alamat, kota TTD, jabatan, logo. Dipakai di kop soal, kartu, rapor, transkrip, leger, dan halaman ujian siswa.
- Teks soal di cetakan kini di-escape (hanya tag b, i, u, sub, sup, br yang diizinkan).
- Rancangan tahap berikutnya (multi-sekolah): lihat `RENCANA-MULTI-SEKOLAH.md`.

## v11.4 — Super Admin
**Wajib dijalankan:** `migrasi-v11-keamanan.sql` (bila belum pernah), lalu `migrasi-v12-superadmin.sql`, di Supabase SQL Editor.
- Peran baru **Super Admin** (guru < admin < super admin). Super Admin otomatis juga admin.
- Menu **Manajemen User** (tambah user, ganti sandi, ubah peran, hapus) kini **khusus Super Admin**; server (`kelola-user`) juga menolak selain Super Admin. Admin biasa tetap bisa Identitas Sekolah.
- Halaman login punya tab **Super Admin**; akun yang bukan Super Admin ditolak di tab itu.
- Penentuan Super Admin: `app_metadata.role = superadmin`, atau email di env `SUPER_ADMIN_EMAILS` (opsional, pisahkan koma). Bila belum ada Super Admin, akun admin tertua (atau akun tertua) otomatis menjadi Super Admin saat login pertama.
- Server menolak menurunkan/menghapus satu-satunya Super Admin.

## v11.5 — Data Siswa (tambah / upload siswa, tersambung ke absensi)
**Wajib dijalankan:** `migrasi-v13-tambah-siswa.sql` di Supabase SQL Editor (membuat fungsi `tambah_siswa_massal`; tidak mengubah data).
- Menu baru **Pengaturan → Data Siswa** (Admin & Super Admin): tambah satu siswa lewat formulir, atau upload Excel/CSV (template bisa diunduh).
- Siswa disimpan ke tabel `students` yang SAMA dengan aplikasi absensi, jadi langsung muncul di absensi. Siswa yang ditambah dari absensi otomatis muncul di aplikasi ujian (dibaca langsung dari tabel yang sama; tidak ada penyalinan).
- Kata sandi awal di absensi = tanggal lahir DDMMYYYY (bcrypt cost 10, `$2a$`), `must_change_password = true`; sama dengan data siswa yang sudah ada.
- Jenjang/program diisi otomatis dari kelas: 1-6 = SD/UMUM (ditulis "Kelas N"), 7-9 = SMP/PAKET_B, 10-12 = SMA/PAKET_C. Angka Romawi dikonversi ke angka.
- NISN yang sudah terdaftar dilewati (tidak menimpa). Nama, NISN (angka), kelas, dan tanggal lahir wajib.
- Server: `netlify/functions/kelola-siswa.js` + `api/kelola-siswa.js`; maksimal 100 siswa/permintaan (upload dipecah otomatis per 50).
