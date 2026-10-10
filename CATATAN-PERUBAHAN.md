# Perubahan terbaru

## v14.0 — Menu CP & TP per Mapel, terhubung ke Bank Soal (generate soal berdasarkan CP) dan Rapor
**Wajib jalankan `migrasi-v17-cp-tp.sql`** di Supabase SQL Editor (sekali; aman diulang), lalu unggah semua file ke GitHub (Vercel deploy otomatis). Data lama tidak berubah. Sebelum migrasi dijalankan, semua menu lama tetap normal dan menu CP & TP menampilkan petunjuk migrasi. **Tidak ada fungsi serverless baru** (tetap 10; batas Hobby 12).

**1. Menu baru: Bank Soal → CP & TP per Mapel.** Filter Jenjang / Kelas / Mata Pelajaran; tiap mapel berisi beberapa CP (per elemen), tiap CP berisi beberapa TP (dengan semester Ganjil/Genap). Fase otomatis dari kelas (Paket B VII-IX = Fase D; Paket C X = Fase E, XI-XII = Fase F). Tersedia jumlah soal terkait per CP/TP, daftar "mapel yang belum punya CP", dan tombol pintas **CP & TP** di menu Mata Pelajaran. Tiga cara mengisi:
- **Manual**: Tambah CP, + TP, Edit, Hapus (kode otomatis CP-1, 1.1, ... bila dikosongkan).
- **Input Cepat (tempel teks)**: salin CP/TP dari dokumen, tulis `CP:` / `TP:` / `Elemen:` (butir `-` atau `1.` di bawah CP otomatis jadi TP; baris tanpa awalan = lanjutan baris sebelumnya; `(Ganjil)`/`(Genap)` di akhir TP mengisi semester). Ada konfirmasi jumlah sebelum disimpan.
- **Upload Excel/CSV** (+ Unduh Template, + Ekspor Excel): kolom `cp_kode, elemen, cp_deskripsi, tp_kode, tp_deskripsi, semester`.
- **Generate dengan AI**: "CP baru + TP-nya" (jumlah CP maks 6, TP per CP maks 8, semester, catatan cakupan materi) atau "TP baru untuk CP yang sudah ada" (tombol *TP dgn AI* pada tiap CP; TP yang sudah ada tidak diulang). Hasil tampil sebagai **draft yang bisa disunting dan dicentang** sebelum disimpan. Memakai rantai AI cadangan yang sama dengan generate soal (Gemini -> Groq -> Cerebras -> Mistral -> OpenRouter).
  > Penting: CP resmi Kurikulum Merdeka ditetapkan pemerintah (BSKAP). Rumusan CP dari AI hanyalah draf; **cocokkan dengan dokumen CP resmi** mapel & fase terkait sebelum dipakai di rapor. Cara paling aman: tempel/unggah CP resmi lewat Input Cepat atau Excel, lalu minta AI menyusun TP-nya saja.

**2. Soal di-generate berdasarkan CP/TP.** Di *Bank Soal → Generate dengan AI* ada pilihan **Capaian Pembelajaran (CP)** dan kotak centang **TP**. Soal dibuat mengukur CP/TP yang dipilih, dibagi rata ke TP yang dicentang, dan tiap soal otomatis tersimpan **terkait CP & TP**-nya (AI diminta menyebut TP yang diukur; bila hanya satu TP dicentang, otomatis ke TP itu). Topik/Materi menjadi opsional bila CP dipilih. Tombol **✦ Buat Soal** pada tiap CP dan **✦ Soal** pada tiap TP di menu CP & TP langsung membuka Generate AI dengan pilihan terisi.

**3. CP/TP juga terhubung di bagian lain Bank Soal.**
- Tambah/Edit Soal Manual: pilihan CP dan TP.
- Daftar Bank Soal: lencana CP/TP pada tiap soal dan filter **CP** (muncul setelah memilih mapel; ada "Soal tanpa CP").
- Import Excel Bank Soal: kolom opsional `cp_kode` & `tp_kode` (template dan ekspor ikut diperbarui; kode tidak ditemukan -> soal tetap masuk tanpa tautan, dengan peringatan).
- Buat Paket Ujian: filter **CP** pada daftar pilihan soal (dengan jumlah soal per CP), sehingga paket bisa disusun per CP.

**4. Rapor Semester mencantumkan CP & TP.** Setelah tabel nilai, muncul bagian **Capaian Pembelajaran (CP) & Tujuan Pembelajaran (TP)** per mapel (hanya mapel yang punya CP). Bila siswa punya skor pada soal yang terkait TP (ujian berstatus dinilai pada tahun ajaran & semester itu, termasuk remedial), tertulis deskripsi otomatis: *"Ananda telah mampu ..."* (TP dengan penguasaan >= KKM mapel) dan *"Ananda perlu bimbingan/penguatan pada ..."* (di bawah KKM). TP yang belum punya data tidak dinilai (ditulis "n TP lain belum diukur"). Bila belum ada soal terkait TP, rapor menampilkan CP dan daftar TP semester itu. Berlaku untuk cetak satu siswa maupun massal. Kegagalan bagian ini tidak menggagalkan cetak rapor.
> Agar deskripsi capaian di rapor terisi: (a) isi CP/TP, (b) buat soal yang terkait TP (via Generate AI berdasarkan CP/TP atau manual), (c) pakai soal itu di paket ujian. Soal yang sudah ada sebelumnya bisa dikaitkan lewat Edit Soal atau impor ulang dengan kolom `cp_kode`/`tp_kode`.

**File berubah/baru:** `index.html`, `netlify/functions/generate-soal.js` (adapter `api/generate-soal.js` tidak berubah), baru: `migrasi-v17-cp-tp.sql`. Tabel baru: `capaian_pembelajaran`, `tujuan_pembelajaran`; kolom baru `bank_soal.cp_id`, `bank_soal.tp_id` (hapus CP/TP tidak menghapus soal, hanya melepas tautan).

## v13.1 — Pencarian lebih pintar di Daftar & Cetak (dan menu lain), kelas "X" tidak lagi membawa XI/XII
Tanpa migrasi SQL. Hanya `index.html` yang berubah.
**Masalah yang diperbaiki:** pencarian memakai "mengandung huruf", sehingga mengetik `X` ikut menampilkan kelas XI, XII, dan semua kata yang memuat huruf x (kode akses, Eksak, dst.). Kini:
- Kata yang berupa kelas (VII, VIII, IX, X, XI, XII, atau angka 7-12) dicocokkan **persis** dengan kelas. `X` hanya kelas X; `XI` hanya XI. `10` sama dengan X, dan `kelas x` juga bekerja.
- Kata satu huruf (mis. `B`, `C`) hanya cocok sebagai kata utuh ("Paket B", "B. Indonesia"), tidak menyusup ke "Biologi".
- Kata lain tetap cocok sebagian dan tidak peduli huruf besar/kecil maupun aksen. Semua kata yang diketik harus cocok.
- Operator baru: kecualikan `-draft`, frasa `"ulangan harian"`, filter khusus `kelas:XI jenis:uas status:siap mapel:ipa program:b smt:ganjil ta:2026 kode:ab12`.
**Menu Daftar & Cetak (Paket Ujian) ditingkatkan:**
1. Filter dropdown Kelas, Jenis, Tahun Ajaran dan pilihan urutan (terbaru, judul A-Z, mapel A-Z, kelas lalu mapel, status).
2. Chip status dengan jumlah (Semua / Siap / Draft / Ditutup / Diarsipkan) yang ikut berubah mengikuti pencarian; klik lagi untuk melepas.
3. Kata yang dicari disorot kuning; tombol hapus (x) dan tombol Esc; tombol Reset menghapus semua filter; tombol "? Tips" menampilkan cara memakai pencarian.
4. Kolom Kelas kini menampilkan semester dan tahun ajaran (ikut bisa dicari).
5. Daftar tampil 50 baris dulu lalu "Tampilkan lagi" agar tetap ringan saat paket sudah ratusan; pencarian ditunda 0,15 detik saat mengetik.
6. Klik kode akses untuk menyalinnya.
**Mesin pencarian yang sama dipakai di:** Ujian Terlaksana, Perlu Penilaian, dan Arsip Nilai (di Arsip kini pencarian per kata, bukan satu potongan teks utuh, dan bisa mencari kelas/program/jenis). Kolom pencarian Monitoring, Belum Mengikuti Ujian, Syarat Rapor, dan Penilaian Tugas hanya mencari nama/NISN sehingga tidak berubah.

## v13.0 — Tugas Tulis Online, Syarat Rapor, dan Kehadiran sebagai Komponen Nilai
**Wajib jalankan `migrasi-v16-tugas-syarat-rapor.sql`** di Supabase SQL Editor (sekali; aman diulang), lalu unggah semua file ke GitHub (Vercel deploy otomatis). Data lama tidak berubah. Nilai akhir lama juga tidak berubah sampai Anda mengisi bobot Tugas/Kehadiran di Pengaturan Nilai.

**1. Tugas tulis (uraian) tanpa upload.** Siswa mengetik jawaban langsung di HP lewat tab **Tugas** di halaman ujian (NISN, + PIN bila dipakai). Tidak ada file yang diunggah sehingga kuota gratis Supabase/Vercel aman: hanya teks, draf tersimpan otomatis ~10 detik setelah berhenti mengetik (dan salinan cadangan di HP).
- Menu guru baru grup **Tugas Siswa**: *Kelola Tugas* (judul, instruksi, mapel, kelas, semester, jurusan, tenggat, min/maks kata, nilai maksimal, batas pelanggaran, wajib/tambahan, terima terlambat, status Draft/Dibuka/Ditutup) dan *Penilaian Tugas* (baca jawaban, nilai + catatan, simpan & berikutnya, nilai manual untuk siswa tanpa HP, bebaskan siswa, buka kembali, reset, unduh Excel).
- **Deteksi kecurangan tetap berlaku** memakai mesin yang sama dengan ujian: pindah tab/aplikasi, blur, salin, tempel (paste), seret teks, tombol developer, plus deteksi **teks masuk sekaligus >120 karakter** (tempel lewat keyboard HP) yang otomatis dibatalkan. Alarm + peringatan layar penuh. Pada batas pelanggaran (bawaan 3, bisa 0 = hanya dicatat) tugas **dikumpulkan otomatis dengan jawaban yang sudah ditulis**. Guru melihat jumlah, waktu, dan alasan tiap pelanggaran, dan bisa **Buka Kembali** (pelanggaran direset).

**2. Semua komponen masuk Nilai Akhir.** *Tugas*: rata-rata semua tugas (nilai/nilai maks x 100). Tugas wajib yang **tidak dikerjakan dihitung 0** setelah tugas ditutup atau tenggatnya lewat, jadi makin banyak tugas dikerjakan makin tinggi nilai akhir. Tugas tambahan (bukan wajib) hanya menambah bila dikerjakan. Jawaban yang menunggu nilai dan siswa yang dibebaskan tidak dihitung. Nilai manual di Input Nilai Tambahan tetap didahulukan. *Kehadiran*: komponen baru dengan bobot sendiri (bawaan 0). Atur semua bobot di **Pengaturan Nilai**, mis. UH 20 / UTS 25 / UAS 30 / Tugas 15 / Kehadiran 10. Berlaku di Rekap, Leger, Transkrip, Rapor.
- Kehadiran dipakai dari Input Nilai Tambahan. Menu *Syarat Rapor* punya tombol **Simpan kehadiran ke nilai** (hanya mengisi siswa yang belum punya data; tidak menimpa input guru). Jalankan di akhir semester.

**3. Menu Syarat Rapor (guru) + tab Syarat Rapor (siswa).** Syarat: (a) semua ujian yang berlaku diikuti (UTS/UAS/UH dapat dipilih; "Tidak wajib" dari menu Belum Mengikuti Ujian dihormati), (b) semua tugas wajib dikumpulkan, (c) kehadiran minimal X% (bawaan 75%). Ambang batas diatur di Pengaturan Nilai (bawaan 100% / 100% / 75%).
- Guru: tabel per kelas dengan status dan rincian kekurangan, filter, cari, "hanya yang belum memenuhi", unduh Excel, cetak daftar.
- Siswa: banner memenuhi/belum, progress tiap syarat, daftar ujian & tugas yang belum, tombol langsung ke tugas. Siswa jadi tahu kekurangannya sendiri.
- **Cetak rapor** (Rapor Semester satu/semua, dan Rapor di Laporan Siswa) kini memberi peringatan bila siswa belum memenuhi syarat; cetak massal menawarkan "hanya yang memenuhi / semua / batal". Peringatan bisa dilewati (tidak memblokir).

**File berubah/baru:** `index.html`, `ujian.html`, `netlify/lib/ujian-core.js`, baru: `netlify/functions/tugas-siswa.js`, `api/tugas-siswa.js`, `migrasi-v16-tugas-syarat-rapor.sql`. Hanya 1 fungsi serverless baru (total 10; batas Hobby 12).

**Catatan penting:** tutup tugas di akhir semester (siswa yang tidak mengerjakan baru dihitung 0 setelah ditutup/lewat tenggat). Kehadiran dihitung sampai kemarin. Jika migrasi belum dijalankan, menu lama tetap normal dan syarat tugas dianggap kosong.

## v12.5 — Menu baru "Monitoring per Siswa" (reset per mapel / reset semua mapel)
Tanpa migrasi SQL. Hanya `index.html` yang berubah. Unggah ke GitHub, Vercel deploy otomatis.
1. **Menu baru** di grup Pelaksanaan Ujian: **Monitoring per Siswa** (hanya tampil untuk Admin / Super Admin).
2. Tiap siswa tampil dengan daftar mata pelajaran (paket ujian) yang sudah dikerjakan: jenis (UTS/UAS/UH/Remedial), semester & tahun ajaran, status (sedang mengerjakan / selesai / dinilai), nilai, dan jumlah pelanggaran pindah tab.
3. **Tombol Reset** pada tiap mapel (hapus jawaban & nilai mapel itu, siswa mengerjakan ulang dari awal) dan **Reset Semua Mapel** per siswa. Reset Semua hanya mencakup mapel yang sedang tampil sesuai filter; daftar mapelnya ditampilkan di jendela konfirmasi.
4. Filter: Kelas, Tahun Ajaran (default terbaru), Jenis Ujian, pencarian nama/NISN, urutan (nama atau pelanggaran terbanyak), dan "Hanya yang pernah melanggar".
5. Salinan nilai lama tetap tersimpan di Arsip Nilai. Nilai manual (ujian cetak) diberi peringatan khusus karena harus diinput ulang.
6. Tombol hanya membawa id sesi / NISN (aman untuk nama berapostrof, seperti perbaikan v12.4).

## v12.4 — Perbaikan tombol Reset + tombol "Aktifkan Kembali" di Monitoring Ujian
Tanpa migrasi SQL. 4 file yang berubah: `index.html`, `ujian.html`, `netlify/functions/sudahi-ujian.js`, `netlify/functions/mulai-ujian.js` (adapter di folder `api/` tidak berubah). Unggah ke GitHub, Vercel deploy otomatis.
1. **Perbaikan tombol Reset yang "tidak berfungsi"**. Penyebab: nama siswa disisipkan ke atribut `onclick`. Nama berapostrof (Ma'ruf, Sa'adah, Ni'matul, dst.) memutus string JavaScript sehingga klik tidak melakukan apa pun, tanpa pesan galat. Kini tombol hanya membawa id sesi, nama dicari dari data di layar. Reset juga memberi pesan jelas bila tidak ada baris yang terhapus.
2. **Tombol baru "Aktifkan Kembali"** pada siswa berstatus Selesai (termasuk yang sudah dinilai) di Monitoring Ujian. Siswa **melanjutkan dari jawaban terakhir**, tidak mengulang dari awal:
   - Jawaban dipulihkan dari hasil penilaian ke cadangan jawaban siswa; sesi dibuka lagi (berlangsung).
   - Guru mengisi sisa waktu minimal (menit); saran otomatis = sisa waktu asli (minimal 10 menit).
   - Nilai sementara & detail penilaian lama dihapus (termasuk nilai essay yang sudah diberi guru) dan dihitung ulang saat siswa mengumpulkan lagi. Arsip Nilai tetap menyimpan nilai lama sampai siswa mengumpulkan ulang.
   - Siswa membuka ulang halaman ujian dan masuk lagi (kode akses + NISN). Paket harus berstatus Siap.
   - Tidak berlaku untuk nilai input manual (ujian cetak).
3. **Perbaikan bug serupa di menu User**: tombol Ganti Sandi/Hapus bagi email yang mengandung apostrof.
4. **Siswa yang ujiannya berakhir karena melanggar aturan** (pelanggaran mencapai batas) kini ikut bisa dilanjutkan: saat diaktifkan kembali hitungan pelanggarannya direset ke 0 (tanpa ini ujian langsung ditutup lagi pada detak pertama). Halaman siswa kini memakai hitungan pelanggaran dari server (`mulai-ujian` mengirim `pelanggaran`), jadi hasil reset tidak tertimpa data lama di HP siswa. Server tetap menyimpan nilai tertinggi, sehingga memuat ulang halaman tidak bisa menghapus pelanggaran.
5. Pembedaan di layar: **Aktifkan Kembali** = lanjutkan; **Reset** = hapus total dan mulai dari awal.

## v12.3 — Nilai remedial masuk ke Laporan Siswa, Rapor & Piagam
Tanpa migrasi SQL baru (cukup v14 & v15 yang sudah ada). Hanya mengubah index.html.
- Laporan Siswa sebelumnya sengaja menyaring semua sesi paket Remedial, sehingga nilai remedial tidak tampil. Kini nilai remedial terbaik diterapkan ke baris UH/UTS/UAS yang sesuai (mapel, kelas, program, semester, tahun ajaran sama), memakai aturan Pengaturan Nilai (maks KKM / tertinggi / rata-rata / nonaktif) seperti di Leger & Transkrip.
- Nilai yang sudah direlai ditandai **R** (tooltip: nilai sebelum remedial). Rata-rata, Rapor, dan Piagam otomatis memakai nilai setelah remedial. Catatan "R = nilai setelah remedial" muncul di cetakan Rapor.
- Siswa yang tidak mengerjakan ujian lalu mengikuti remedial (susulan) kini barisnya terisi nilai remedial.
- Catatan: peringkat kelas & rata-rata "Semua siswa" masih dihitung dari nilai ujian asli.

## v12.2 — Perbaikan batas 1000 baris Supabase (tanpa migrasi SQL)
Supabase hanya mengembalikan maksimal 1000 baris per permintaan; sisanya dipotong tanpa pesan kesalahan. Sebagian besar menu (Bank Soal, Rekap/Leger/Transkrip, Arsip Nilai) sudah membaca halaman demi halaman. Perbaikan v12.2 menutup sisa kueri yang belum:
1. **Analisis Butir Soal** dan **Nilai Manual (Ujian Cetak)**: detail jawaban dibaca per 100 sesi + per halaman (sebelumnya 100 siswa x 40 soal = 4000 baris, hanya 1000 yang terbaca).
2. **Daftar Paket Ujian** dan pilihan paket di Hasil Ujian Online: kini membaca semua paket (penting setelah bertahun-tahun, termasuk yang diarsipkan).
3. **Ringkasan Semua Siswa Kelas**, **Peringkat Kelas**, dan **Nomor Urut Piagam** (roster alfabetis): membaca seluruh riwayat sesi.
4. **Data siswa aktif** (tabel students) dan pengecekan paket terkunci di Kelola Paket: kini tanpa batas 1000.

## v12.1 — Tombol "Ikuti UTS" dan "Ikuti UAS" di jendela siswa
**Tanpa migrasi SQL baru.** Unggah semua file ke GitHub (Vercel deploy otomatis). Ada fungsi server baru `api/ujian-siswa.js` (+ `netlify/functions/ujian-siswa.js`).
1. **Jendela siswa (ujian.html)** kini punya empat tombol: Ujian | Ikuti UTS | Ikuti UAS | Ikuti Remedial. Tab Ujian (kode akses) tetap ada untuk ujian harian dan kasus khusus.
2. **Cara kerja Ikuti UTS / Ikuti UAS**: siswa mengisi NISN (+PIN bila dipakai), lalu muncul daftar mata pelajaran UTS/UAS yang **sudah dibuka** (status Siap) untuk kelas dan program (Paket B/C) siswa itu. Siswa memilih mata pelajaran, lalu **langsung masuk ke paket ujiannya** tanpa mengetik kode akses (ada konfirmasi sebelum waktu berjalan).
3. **Status per mata pelajaran**: Mulai / Lanjutkan (sesi masih berlangsung) / menunggu penilaian essay / sudah dikerjakan (+ nilai). Kode akses hanya dikirim untuk paket yang masih boleh dikerjakan.
4. **Aturan yang dihormati**: paket khusus jurusan IPA/IPS hanya tampil untuk jurusan yang sesuai (dibaca dari nama kelas siswa); siswa yang ditandai **Tidak wajib** di menu Belum Mengikuti Ujian tidak melihat paketnya; paket draft, ditutup, atau diarsipkan tidak tampil. Paket Remedial dan Ulangan Harian tidak tercampur di sini.
5. Memakai pembatas percobaan gagal yang sama seperti Ikuti Remedial (NISN/PIN salah berulang akan dikunci sementara).
6. Siswa yang kelas atau programnya belum terdata (mis. SD/UMUM) mendapat pesan agar memakai tab Ujian dengan kode dari guru.

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
