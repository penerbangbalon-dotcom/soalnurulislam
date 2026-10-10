# Generator Soal UTS/UAS — PKBM Nurul Islam

Aplikasi web untuk membuat, mengelola, dan mencetak/menguji soal UTS & UAS.
Dibangun dengan stack yang sama seperti aplikasi absensi: **Netlify (hosting +
Functions)** + **Supabase (database)**.

## 1. Siapkan Database (Supabase)

1. Buka project Supabase yang sama dengan aplikasi absensi (supaya bisa
   pakai tabel `siswa` yang sudah ada).
2. Buka **SQL Editor** → jalankan isi file `supabase-schema.sql`.
3. Aplikasi ini memakai tabel `students` milik aplikasi absensi (kolom `nisn`, `nama`, `status`)
   (dari aplikasi absensi). Kalau nama kolomnya beda, sesuaikan di file
   `netlify/functions/mulai-ujian.js`.
4. Aktifkan **Supabase Auth** (Email/Password) di menu Authentication. Setelah
   deploy, akun guru/admin berikutnya bisa dibuat langsung dari menu
   **"Manajemen User"** di dalam aplikasi (tidak perlu lagi buka dashboard
   Supabase satu-satu) — akun pertama tetap harus dibuat manual lewat
   Authentication → Users → Add user, karena aplikasi butuh minimal satu akun
   untuk login pertama kali.

## 2. Ambil Kredensial Supabase

Di Settings → API, catat:
- **Project URL**
- **anon public key**
- **service_role key** (JANGAN pernah taruh ini di file HTML/frontend!)

## 3. Isi Konfigurasi Frontend

Buka `index.html`, cari baris:
```js
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
```
Ganti dengan Project URL dan anon key kamu. Lakukan hal yang sama di
`ujian.html` untuk `SUPABASE_URL`.

## 4. Deploy ke Vercel (versi yang disarankan)

Folder `api/` pada versi ini adalah adapter Vercel untuk seluruh backend lama:
`generate-soal`, `kelola-user`, `mulai-ujian`, `submit-ujian`, `heartbeat`, `sudahi-ujian`, dan `tugas-siswa`
(total 10 fungsi; batas paket Hobby Vercel adalah 12).
Jadi URL frontend seperti `/api/generate-soal` tidak lagi bergantung pada redirect Netlify.


**Deploy dari GitHub (disarankan):**
1. Login ke Vercel
2. Klik "Add new site" → "Deploy manually"
3. Drag seluruh folder `generator-soal` ke area upload
   (pastikan folder `netlify/functions` ikut ter-upload)

**Set Environment Variables** (Site settings → Environment variables):
| Key | Value |
|---|---|
| `GEMINI_API_KEY` | API key Gemini kamu (gratis, ambil di [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) |
| `SUPABASE_URL` | Project URL Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key Supabase |
| `GROQ_API_KEY` *(opsional, disarankan)* | AI cadangan #1 — gratis & sangat cepat, ambil di [console.groq.com/keys](https://console.groq.com/keys) |
| `CEREBRAS_API_KEY` *(opsional)* | AI cadangan #2 — gratis, ambil di [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| `MISTRAL_API_KEY` *(opsional)* | AI cadangan #3 — tier gratis "Experiment", ambil di [console.mistral.ai](https://console.mistral.ai) |
| `OPENROUTER_API_KEY` *(opsional)* | AI cadangan #4 — model gratis (`:free`), ambil di [openrouter.ai/keys](https://openrouter.ai/keys) |

**AI Generator dengan cadangan otomatis.** Isi `GEMINI_API_KEY` *dan/atau* key provider lain di atas
(cukup salah satu juga bisa). Saat generate soal, sistem mencoba berurutan: Gemini (model utama → `gemini-2.5-flash`
→ `gemini-2.5-flash-lite`) → Groq → Cerebras → Mistral → OpenRouter. Provider yang key-nya kosong dilewati. Kalau satu
gagal (server sibuk/overload 503, limit 429, model tidak tersedia), langsung pindah ke berikutnya — guru tidak perlu
klik ulang. Soal dibuat **bertahap ±10 soal per bagian**, soal yang sudah jadi langsung tampil, dan bagian yang gagal
bisa diulang lewat tombol *Ulangi yang gagal*. Variabel opsional: `AI_PROVIDER_ORDER` (mis. `groq,gemini`),
`GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`, `GROQ_MODEL`, `CEREBRAS_MODEL`, `MISTRAL_MODEL`, `OPENROUTER_MODEL`,
`AI_BUDGET_MS`. Nama model & batas gratis tiap provider bisa berubah sewaktu-waktu — kalau ada model yang 404, cukup
ganti lewat variabel `*_MODEL` tanpa mengubah kode.
> Catatan: provider gratis biasanya boleh memakai prompt/jawaban untuk pelatihan model mereka. Prompt yang dikirim
> hanya berisi mapel, topik, dan jenis soal (tanpa data siswa), jadi aman untuk pembuatan soal.

> Cara ambil `GEMINI_API_KEY` gratis: buka [Google AI Studio](https://aistudio.google.com/apikey),
> login pakai akun Google, klik **"Create API key"**, lalu copy key-nya. Free tier
> cukup untuk pemakaian normal generate soal (ada limit harian, kalau kena limit
> tinggal coba lagi beberapa saat kemudian).

Setelah environment variable diisi, lakukan **Redeploy** supaya
Netlify Functions membaca variable barunya.

> Catatan: karena upload manual (drag-and-drop) tidak otomatis install
> dependency npm, cek dulu apakah Netlify berhasil build function
> `mulai-ujian` dan `submit-ujian` (yang pakai `@supabase/supabase-js`).
> Kalau gagal karena dependency, cara paling gampang adalah connect
> repo ini ke GitHub lalu deploy dari Git (Netlify otomatis `npm install`).

## 5. Cara Pakai

**Guru** (`index.html` / domain utama):
1. Login pakai akun yang dibuat di Supabase Auth
2. Tambah Mata Pelajaran dulu (tab "Mata Pelajaran") — isi Nama, Jenjang (Program), dan **Kelas**.
   Kalau satu mapel dipakai di beberapa kelas (mis. Matematika di Kelas VII, VIII, IX), buat
   entri terpisah untuk tiap kelas supaya Bank Soal-nya tidak tercampur.
3. Isi Bank Soal — manual atau pakai tombol "Generate dengan AI" (bisa centang
   lebih dari satu jenis soal sekaligus — Pilihan Ganda, Isian Singkat, Essay —
   supaya AI membuat satu lembar soal campuran dalam sekali generate, maksimal
   100 soal per generate)
4. Racik Paket Ujian — pilih soal dari bank, simpan (status: draft)
5. Di tab "Daftar & Cetak":
   - Klik **Cetak** untuk soal siap print (PDF via print browser) + kunci jawaban
   - Klik **Aktifkan Online** untuk membuka akses ujian online ke siswa —
     ini akan menampilkan **kode akses** yang dibagikan ke siswa
6. Saat ujian berlangsung, buka tab **Monitoring Ujian** untuk memantau siswa secara langsung dan mengambil tindakan
   (lihat bagian *Monitoring Ujian* di bawah)
7. Setelah siswa selesai ujian, buka tab **Hasil Ujian Online** untuk
   melihat skor otomatis (PG & isian singkat) dan menilai soal essay manual

**Siswa** (`ujian.html`):
1. Buka halaman `ujian.html` (misal: `namasite.netlify.app/ujian.html`)
2. Masukkan kode akses + NISN
3. Kerjakan soal sebelum waktu habis (auto-submit saat waktu habis)

## Struktur File
```
generator-soal/
├── index.html                     # Aplikasi guru
├── ujian.html                     # Ujian online siswa
├── netlify.toml                   # Konfigurasi Netlify
├── logo.png                       # Logo untuk kop soal cetak
├── migrasi-v7.sql                 # Jalankan sekali: Ulangan Harian, pengaturan nilai/KKM, nilai tambahan
├── migrasi-lengkap.sql                 # Jalankan sekali di Supabase (izin tombol Reset, kolom Kelas, dll)
├── supabase-schema.sql            # Skema database
├── netlify/lib/
│   └── ujian-core.js              # Kode bersama: penilaian otomatis, akses Supabase, cek login guru
└── netlify/functions/
    ├── generate-soal.js           # Generate soal dgn cadangan otomatis: Gemini -> Groq -> Cerebras -> Mistral -> OpenRouter
    ├── mulai-ujian.js             # Validasi kode akses + mulai sesi siswa
    ├── submit-ujian.js            # Simpan & auto-nilai jawaban siswa
    ├── heartbeat.js               # Detak dari halaman siswa (online/progres/cadangan jawaban) + terima perintah guru
    ├── sudahi-ujian.js            # Guru mengakhiri paksa ujian siswa (menilai jawaban tersimpan)
    └── tugas-siswa.js             # Tugas tulis siswa (daftar/buka/simpan draf/kumpulkan) + Syarat Rapor siswa & kelas
```

## Monitoring Ujian (real-time)

Menu **Monitoring Ujian** menampilkan siswa satu paket ujian: status (**Online / Terputus / Dikunci / Selesai / Belum
masuk**), progres jawaban, sisa waktu, jumlah pindah tab, dan waktu terakhir aktif — diperbarui otomatis tiap 8 detik.
Halaman siswa mengirim "detak" ke server tiap ±20 detik (ubah `HEARTBEAT_MS` di `ujian.html` bila perlu); siswa tanpa
detak >45 detik ditandai *Terputus*. Tindakan guru (per siswa atau massal lewat kotak centang):

| Aksi | Efek |
|---|---|
| **Pesan** | Peringatan kuning muncul di layar siswa (mis. "Harap tetap fokus"), ada pilihan pesan cepat |
| **+ Waktu** | Menambah menit ujian; timer siswa ikut bertambah, batas waktu server ikut naik |
| **Kunci / Buka** | Layar siswa tertutup sementara sampai dibuka lagi (waktu tetap berjalan — tambahkan waktu bila perlu) |
| **Sudahi** | Ujian diakhiri paksa; jawaban yang sudah tersimpan di server langsung dinilai. Berfungsi walau HP siswa mati/koneksi putus |
| **Reset** | Sesi dihapus (jawaban & nilai hilang); siswa diminta masuk ulang dari awal |

Jawaban siswa dicadangkan ke server ±5 detik setelah berhenti mengetik, sehingga **Sudahi** hanya kehilangan
ketikan beberapa detik terakhir. Jawaban juga otomatis dipulihkan bila siswa pindah HP/browser.
> **Untuk instalasi lama**: jalankan ulang `migrasi-lengkap.sql` di Supabase SQL Editor (menambah kolom monitoring di
> `sesi_ujian`), lalu deploy ulang **seluruh folder** — termasuk `netlify/lib/` dan `netlify/functions/`.
> Catatan biaya: tiap siswa ±3 panggilan function per menit selama ujian (mis. 40 siswa × 90 menit ≈ 11 ribu
> panggilan). Kalau kuota Netlify terbatas, naikkan `HEARTBEAT_MS` ke 30000.

## Versi 7 — Ulangan Harian, Rekap/Leger/Transkrip Nilai, KKM

**Untuk instalasi lama**: jalankan `migrasi-v7.sql` SEKALI di Supabase SQL Editor (aman dijalankan ulang; hanya menambah tabel
baru dan melonggarkan aturan jenis ujian). Pastikan `migrasi-arsip-nilai.sql` juga sudah pernah dijalankan.

Menu baru (di bawah Laporan Siswa):
- **Rekap Nilai Siswa** — cari nama/NISN atau dropdown; nilai UH, UTS, UAS, Tugas, Praktik, Nilai Akhir, KKM, status Tuntas; unduh Excel.
- **Leger Nilai (Excel)** — per jenjang/kelas/tahun ajaran/semester; kolom per mapel + Jumlah, Rata-rata, Peringkat, Sikap, S/I/A,
  jumlah nilai di bawah KKM. Excel berisi sheet Leger, Di Bawah KKM (calon remedial), dan Keterangan.
- **Transkrip Nilai** — akumulasi semua semester & tahun ajaran per siswa (cetak / Excel), termasuk sikap & kehadiran.
- **Input Nilai Tambahan** — nilai Tugas & Praktik per mapel, serta Sikap (A-D) & kehadiran (sakit/izin/alpa) per siswa per semester.
- **Pengaturan Nilai** — bobot Nilai Akhir (UH/UTS/UAS/Tugas/Praktik), KKM standar (bawaan 70; umumnya 70-75) dan KKM per mapel.
  Disimpan di database sehingga sama untuk semua guru.

Aturan hitung: UH = rata-rata semua ulangan harian di mapel itu; UTS/UAS = nilai terbaru; Tugas/Praktik = nilai yang diinput.
Bobot bawaan 30/30/40 (Tugas & Praktik 0%, jadi Nilai Akhir lama tidak berubah). Hanya nilai **final** yang dihitung.

Ulangan Harian: pilihan baru di *Buat Paket Ujian → Jenis Ujian*. Ulangan Harian **tidak** ikut menu Laporan Siswa/Rapor/peringkat lama
(perilaku menu lama tetap seperti sebelumnya); ia tampil di Rekap Nilai Siswa, Leger, dan Transkrip.

Soal terpakai: saat menyimpan paket, aplikasi memeriksa ulang ke database dan MENOLAK bila ada soal yang sudah dipakai di paket lain
(berlaku walau centang "Sembunyikan soal yang sudah dipakai" dimatikan). Paket lama yang sudah berisi soal bersama tetap bisa diedit.

## Riwayat Perbaikan

**Pembaruan terbaru (AI cadangan & Monitoring Ujian):**
- **Generate AI multi-provider**: kalau Gemini sibuk/limit, otomatis pindah ke model Gemini lain lalu ke Groq, Cerebras,
  Mistral, dan OpenRouter (yang key-nya diisi). Generate dibuat bertahap ±10 soal per bagian dengan daftar "hindari soal
  yang sudah ada" agar tidak dobel; bagian yang gagal bisa diulang tanpa mengulang semuanya.
- **Menu Monitoring Ujian** + tombol Pesan, +Waktu, Kunci/Buka, Sudahi, Reset (lihat bagian di atas).
- Halaman siswa: pesan dari pengawas, layar kunci, tambahan waktu, cadangan jawaban ke server, dan timer memakai jam server.
- `submit-ujian` kini menutup sesi secara atomik (siswa & guru tidak bisa menilai ganda) dan memperhitungkan waktu tambahan.

**Pembaruan sebelumnya:**
- **Laporan Siswa — perbaikan filter Tahun Ajaran/Semester**: paket ujian LAMA yang
  menyimpan Semester & Tahun Ajaran digabung jadi satu teks (mis. "Ganjil 2026/2027",
  peninggalan sebelum keduanya jadi dropdown terpisah) sekarang otomatis dipisah lagi
  di laporan, sehingga bisa difilter dengan benar per Tahun Ajaran maupun per Semester
  (sebelumnya baris ini HANYA muncul kalau filter dikosongkan ke "Semua Tahun Ajaran").
  Dropdown **Semester** juga sekarang memakai pilihan baku yang sama dengan saat
  meracik Paket Ujian ("Semester 1 (Ganjil)" / "Semester 2 (Genap)"), bukan teks bebas
  dari data.
- **Laporan Siswa — "Ujian Diikuti"**: sekarang menghitung ujian yang BENAR-BENAR
  dikerjakan siswa saja (bukan seluruh mapel yang seharusnya diujikan), dengan
  keterangan totalnya, contoh: **"2 dari 5 ujian yang harus diikuti"**.
- **Laporan Siswa**: baris "Paket ujian belum dibuat" sekarang punya tombol **Tandai Tidak
  Diujikan** — dipakai kalau memang ada mapel yang tidak diujikan (UTS/UAS), supaya baris itu
  tidak terus muncul di laporan. Bisa dibatalkan lagi lewat tab "Mata Pelajaran" (checkbox
  "Mapel ini tidak diujikan"). Dropdown **Tahun Ajaran** di Laporan Siswa sekarang selalu
  terisi (tahun ajaran berjalan + 4 tahun ke depan), tidak lagi kosong hanya karena siswa
  belum punya paket ujian dengan tahun ajaran tersimpan — sebelumnya ini membuat Rapor/Piagam
  bisa tercetak untuk "Semua Tahun Ajaran" tanpa disadari.
- **Mata Pelajaran**: dropdown **"Pilih dari Daftar Mapel (Kurikulum Merdeka)"** — daftar mapel
  umum Pendidikan Kesetaraan Paket B/Paket C sesuai Kurikulum Merdeka, tinggal pilih untuk
  mengisi otomatis kolom "Nama Mapel" (kolom manual tetap bisa diisi/diedit bebas, pilih
  "Lainnya / isi manual" untuk mapel di luar daftar).
- **Paket Ujian yang sudah "Ditutup"**: tombol **Aktifkan Kembali** (menggantikan tombol
  "Tutup" yang tidak relevan lagi) — mengaktifkan ulang paket untuk ujian online dengan
  **kode akses BARU** (kode lama tidak berlaku lagi). Sebelumnya paket yang sudah ditutup
  tidak bisa diaktifkan lagi lewat menu Edit (Edit hanya mengubah judul/durasi/soal, bukan
  status).
- **Kartu Ujian**: sekarang punya **QR code** yang mengarah ke link ujian online siswa
  (`ujian.html?kode=...`) — siswa tinggal scan, kode akses otomatis terisi, tinggal ketik
  NISN. Juga ada pilihan **cetak per siswa** (dropdown "Cetak Kartu Untuk") selain cetak
  semua siswa sekaligus.
- **Halaman ujian.html** (link ujian untuk siswa): sekarang menampilkan **logo PKBM Nurul
  Islam** di layar masuk.
- **Untuk instalasi lama**: jalankan ulang `migrasi-lengkap.sql` di Supabase SQL Editor
  (menambah kolom `tidak_diujikan` pada `mata_pelajaran`).

**Pembaruan sebelumnya (Ujian Cetak & Nilai Manual):**
- Menu baru **"Ujian Cetak & Nilai Manual"** untuk siswa yang tidak punya HP:
  - **Cetak Kartu Ujian**: kartu peserta (Nama, NISN, Kelas, Mapel, Kode Akses) untuk semua siswa di kelas/program paket ujian, siap print.
  - **Input nilai manual**: guru mengetik ulang jawaban hasil koreksi lembar cetak dalam bentuk tabel (grid) per siswa. Nilai Pilihan Ganda & Isian Singkat dihitung **otomatis** (mesin penilaian yang sama dengan ujian online), Essay tinggal diisi angka skornya saja — guru tidak perlu menghitung nilai akhir sendiri.
  - Tersedia juga **Unduh Template Excel** & **Upload Excel Jawaban**, untuk guru yang lebih nyaman mengoreksi/mengisi di Excel dulu sebelum disimpan.
  - Hasilnya otomatis tergabung dengan tabel ujian online, jadi langsung muncul di **Hasil Ujian Online**, **Laporan Siswa**, **Rapor**, dan **Piagam** — tidak ada rekap terpisah untuk siswa manual vs online.
  - **Untuk instalasi lama**: jalankan `migrasi-lengkap.sql` di Supabase SQL Editor (menambah kolom `mode_ujian` pada `sesi_ujian` dan izin insert nilai manual bagi guru yang login).

**Pembaruan sebelumnya:**
- **Racik Paket Ujian**: field **Semester** dan **Tahun Ajaran** yang tadinya teks bebas sekarang jadi
  dropdown. Semester pilihannya "Semester 1 (Ganjil)" / "Semester 2 (Genap)". Tahun Ajaran otomatis
  dimulai dari tahun ajaran berjalan (5 tahun ke depan). Paket ujian lama yang datanya tidak cocok
  dengan pilihan baru tetap muncul sebagai opsi "(data lama)" saat diedit, supaya datanya tidak
  berubah diam-diam.
- **Nomor Piagam resmi & urut**: piagam sekarang punya nomor surat dengan format resmi
  `001/PIAGAM/PKBM-NI/IX/2026` (nomor urut 3 digit / kode piagam / kode lembaga / bulan romawi /
  tahun), disimpan di tabel `piagam_log` supaya nomornya urut dan tidak pernah dobel walau dicetak
  oleh beberapa guru bersamaan.
  > **Untuk instalasi lama**: jalankan `migrasi-lengkap.sql` di Supabase SQL Editor supaya tabel
  > `piagam_log` dibuat.
- **Laporan Siswa** (menu baru): rekap nilai satu siswa dari semua ujian online, cetak **Rapor**
  (transkrip 1 lembar semua mapel + peringkat sekelas) dan **Piagam** (sertifikat 1 lembar berisi
  transkrip semua mapel + peringkat, bernomor resmi).

**Pembaruan sebelumnya:**
- Batas Generate AI dinaikkan 40 → 100 soal per sekali generate (gabungan semua jenis soal).
- Kolom Kelas pada Mata Pelajaran: tiap mapel wajib punya Jenjang (Program) *dan* Kelas
  (VII-IX untuk Paket B, X-XII untuk Paket C). Bank Soal jadi otomatis terpisah per kelas & jenjang.
  Mata Pelajaran sekarang juga bisa **diedit** dan **dihapus**.
- Template Bank Soal dirombak jadi 1 file Excel (.xlsx) dengan sheet terpisah per jenis soal.

**Pembaruan v7:**
- **Racik Paket**: panel *Pilih cepat soal* — pilih semua, kosongkan, ambil N soal (urut/acak), atau rentang nomor, terpisah per jenis (mis. PG 25, Isian 10, Essay 5). Soal di daftar dikelompokkan per jenis.
- **Cetak Word** (menggantikan Cetak B): unduh file `.doc` lengkap dengan kop, soal, gambar, dan kunci jawaban yang bisa diedit di Microsoft Word. Rumus `$...$` tampil sebagai teks di Word.

**Pembaruan v6:** nilai akhir 0-100 berbobot per jenis soal (PG/isian/essay).

**Pembaruan v4:**
- Tabel siswa sekarang `students` (sesuai database absensi) dan hanya siswa berstatus AKTIF yang bisa masuk ujian. Untuk PIN, isi env var `KOLOM_PIN` dengan `tanggal_lahir` (opsional).

**Pembaruan v3:**
- **Pembahasan** soal (tampil di kunci jawaban cetak), **gambar** pada soal, dan **rumus** (tulis `$x^2+3x$`) di layar ujian & cetak.
- **Import soal dari Excel/CSV** (tombol *Unduh Template* di Bank Soal). Untuk file Word: salin tabelnya ke Excel dulu.
- **Cetak Versi B**: urutan soal & opsi PG diacak, kunci otomatis menyesuaikan.
- **Opsi PG diacak** di ujian online bila paket diberi acak soal.
- **Analisis butir soal** & **deteksi pindah tab** (jumlah tampil di tabel hasil).
- **PIN siswa (opsional)**: set env var `KOLOM_PIN` (mis. `tanggal_lahir`, nama kolom di tabel siswa). Siswa wajib mengisi PIN yang cocok.

**Pembaruan v2:**
- **Kop soal** PKBM Nurul Islam (logo + identitas + Jenjang/Mapel/Kurikulum/Nama/Kelas) pada hasil cetak. Ganti `logo.png` untuk mengubah logo.
- **Batas waktu dicek di server** (toleransi 3 menit); soal di luar paket & duplikat ditolak.
- **Acak soal stabil**: urutan tetap sama saat siswa masuk lagi.
- **Isian singkat** mendukung kunci alternatif dengan tanda `|` (contoh: `Jakarta|DKI Jakarta`), spasi ganda diabaikan.
- **Hasil ujian**: statistik (rata-rata/tertinggi/terendah), **ekspor CSV** (buka di Excel), dan tombol **Reset** sesi siswa (jalankan `migrasi-lengkap.sql` dulu).

**Update terbaru:**
- **Fix bug penting**: `mulai-ujian.js` sebelumnya query ke tabel `students`, seharusnya `siswa`
  (sesuai skema aplikasi absensi) — kalau tidak diperbaiki, siswa selalu gagal login ujian.
  Nama tabel/kolom siswa sekarang juga bisa dikustomisasi lewat env var opsional
  `TABEL_SISWA`, `KOLOM_NISN`, `KOLOM_NAMA_SISWA` kalau skema kamu berbeda.
- Soal di Bank Soal sekarang bisa **diedit**, tidak cuma dihapus.
- Paket Ujian sekarang bisa **diedit** (ganti judul/durasi/soal) dan **dihapus**.
- Bank Soal punya **pencarian** (cari teks di pertanyaan/topik) dan **filter jenis soal**.
- Jawaban siswa saat ujian online sekarang **autosave ke localStorage browser** —
  kalau tab tidak sengaja ter-refresh atau tertutup, jawaban tidak hilang saat
  siswa masuk lagi dengan kode akses + NISN yang sama. Ada juga peringatan browser
  sebelum menutup tab saat ujian masih berlangsung.
- Halaman cetak soal sekarang punya baris jawaban yang proporsional: isian singkat
  1 baris, essay 4 baris, dan kunci jawaban dipisah ke halaman baru saat print.

## Arsip nilai permanen
Jalankan `migrasi-arsip-nilai.sql` sekali di Supabase SQL Editor (sudah dijalankan pada proyek PKBM Nurul Islam).
- Setiap nilai ujian yang selesai/dinilai otomatis disalin ke tabel `arsip_nilai` oleh trigger database.
- Salinan ini tidak ikut terhapus saat paket dihapus atau sesi siswa di-reset; hanya bisa dibaca dari aplikasi (menu **Arsip Nilai**).
- Menghapus paket yang sudah punya hasil sekarang berarti **mengarsipkan** paket (nilai tetap utuh di Hasil Ujian, Laporan, Rapor).
