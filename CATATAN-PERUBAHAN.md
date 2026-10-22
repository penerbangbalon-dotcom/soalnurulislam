# Perubahan terbaru

## v15.14 — Mapel tidak diujikan lebih mudah dilihat dan diatur
File berubah: `index.html` saja (tanpa migrasi SQL).
- **Menu Mata Pelajaran**: filter *Semua / Diujikan saja / Tidak diujikan saja*, kotak cari, ringkasan jumlah, baris mapel tidak diujikan tampil redup dengan lencana, dan tombol satu klik **Tidak diujikan / Ujikan kembali** di tiap baris.
- **Laporan Siswa**: kotak baru di bawah tabel berisi daftar mapel tidak diujikan untuk kelas & program siswa yang dipilih, tombol **Ujikan kembali**, dan pilihan untuk menandai mapel lain sebagai tidak diujikan.
- **Dashboard**: kartu **Mapel tidak diujikan** yang langsung membuka daftarnya.
- Tombol lama "Tandai Tidak Diujikan" di tabel laporan tidak pernah muncul lagi di versi sebelumnya; fungsinya kini ada di kotak baru di atas.

## v15.13 — Dashboard lebih lengkap
File berubah: `index.html` saja (tanpa migrasi SQL).
- **10 kartu ringkasan** (sedang ujian, perlu dinilai, ujian hari ini, rata-rata nilai, sudah dinilai, paket dibuka, paket draft, bank soal, mata pelajaran, siswa aktif) plus **pengingat** di bagian atas bila ada yang perlu ditindaklanjuti.
- **Panel baru**: siswa yang sedang ujian, jawaban menunggu penilaian per paket, grafik ujian 7 hari terakhir, sebaran nilai, paket ujian yang dibuka, dan jumlah siswa per kelas.
- **Pintasan lengkap**: semua menu dikelompokkan seperti menu samping (mengikuti peran akun) dengan kotak pencarian menu.
- Tombol **Segarkan** untuk memuat ulang data.

## v15.12 — Dashboard + keamanan login
File berubah: `index.html` saja (tanpa migrasi SQL).
- **Dashboard** (menu paling atas, halaman pertama setelah login): kartu ringkasan (sedang ujian, perlu dinilai, sudah dinilai, paket dibuka, bank soal, siswa), pintasan, dan 8 aktivitas ujian terbaru. Kartu bisa diklik.
- **Login diminta lagi saat aplikasi dibuka baru**: sesi hanya hidup selama tab/browser terbuka. Muat ulang halaman di tab yang sama tidak keluar.
- **Keluar otomatis** setelah 3 jam tanpa aktivitas (angka ada di `BATAS_TIDAK_AKTIF_MS`), disertai pesan di halaman login.
- Setelah pemasangan, semua pengguna perlu login sekali lagi (sesi lama dihapus).

## v15.11 — Warna kuning emas + pilihan warna untuk seluruh sekolah
File berubah: `index.html` dan `ujian.html`. Kolom `tema_warna` di tabel `pengaturan_sekolah` sudah ditambahkan (lihat `migrasi-v23-tema-warna.sql`); unggah kedua file lalu deploy ulang.
- **Warna bawaan kuning emas**: tombol berwarna kuning dengan tulisan cokelat tua agar terbaca; menu samping gelap dengan menu aktif berwarna kuning.
- **Menu baru "Warna Aplikasi"** (khusus Super Admin, di grup Pengaturan): pilih Kuning Emas, Biru, Hijau, Ungu, Teal, atau Merah Muda. Pilihan terlihat langsung sebagai pratinjau, lalu **Simpan untuk semua** menerapkannya ke admin dan halaman siswa.
- Cetakan (rapor, piagam, kartu ujian, rekap) tidak berubah.

## v15.10 — Tampilan lebih modern
File berubah: `index.html` dan `ujian.html` (hanya tampilan/CSS). Tanpa migrasi SQL; unggah kedua file lalu deploy ulang.
- **Gaya baru**: huruf Plus Jakarta Sans (lebih ramah, tanpa huruf serif), sudut membulat, bayangan lembut, tombol dan isian lebih nyaman, bingkai fokus saat mengetik.
- **Menu samping**: item berbentuk kapsul membulat, submenu dengan garis penuntun, warna biru tetap.
- **Tabel & kartu**: header tabel lebih ringan, garis antar baris tipis, kartu dengan bayangan halus.
- **Halaman login & jendela popup**: lebih lega, latar lembut.
- **Halaman siswa**: pilihan jawaban berupa baris yang bisa diklik dan menyorot pilihan yang dicentang; timer berbentuk kapsul.
- **Ponsel**: jarak dan kolom menyesuaikan layar kecil (kolom 2/3 menjadi 1).
- Cetakan (rapor, piagam, kartu ujian, rekap) tidak berubah.

## v15.9 — Peringkat di Piagam & Rekap Nilai dibedakan dari peringkat Rapor
File berubah: `index.html`. Tanpa migrasi SQL; unggah file lalu deploy ulang.
- **Label jelas**: di Piagam dan cetak Rekap Nilai (Laporan Siswa), peringkat kini tertulis "Peringkat Ujian UTS ke-5 dari 36 siswa" (mengikuti jenis ujian). Rapor tetap "Peringkat di Kelas" (berdasarkan rata-rata Nilai Akhir semua mapel), jadi kedua peringkat tidak lagi terkesan bertentangan.
- **Jenis ujian ikut filter**: bila filter Jenis Ujian dipilih (mis. UTS), pembanding antar siswa hanya memakai ujian jenis itu. Bila "Semua", memakai semua kecuali Ulangan Harian dan Remedial (seperti sebelumnya).
- **Nilai sama = peringkat sama**, mengikuti aturan rapor (sebelumnya urutan data menentukan).
- **Siswa yang belum mengikuti semua ujian**: bila jumlah ujiannya kurang dari jumlah yang lazim diikuti teman sekelas, ia tidak ikut diperingkat. Di piagam peringkatnya tidak dicetak; di rekap nilai tertulis "belum ditampilkan (belum mengikuti semua ujian)".

## v15.8 — Kaitkan soal ke CP/TP secara massal
File berubah: `index.html`. Tanpa migrasi SQL baru (memakai kolom `bank_soal.cp_id` / `tp_id` dari migrasi-v17); unggah file lalu deploy ulang.
- **Kaitkan dari soal terpilih** (Bank Soal): centang soal, klik **🔗 Kaitkan ke CP/TP**, pilih CP dan TP, simpan sekali untuk semuanya. Bisa untuk soal yang dicentang atau **semua hasil filter** (termasuk halaman lain). Filter "(Soal tanpa CP)" tetap dipakai untuk menyaring soal yang belum berkait. Kosongkan CP untuk melepas kaitan.
- **Kaitkan per topik** (tombol **🔗 Kaitkan per Topik**): pilih mapel; muncul daftar topik beserta jumlah soal, mis. "Pecahan (24 soal)". CP/TP ditebak otomatis dari kemiripan kata (tanpa AI, tidak memakai kuota), bisa diganti per topik, lalu **Simpan Semua**. Bawaan hanya menyentuh soal yang belum berkait CP. Soal tanpa topik dikaitkan lewat cara pertama.
- Tebakan hanya saran: topik yang tidak ada kecocokannya diberi "Lewati" dan tidak diubah.

## v15.7 — Cadangan Data mencakup tabel baru
File berubah: `netlify/functions/cadangan-data.js`. Tanpa migrasi SQL; unggah file lalu deploy ulang.
- Menu **Cadangan Data** kini ikut mencadangkan dan memulihkan `catatan_pelanggaran`, `kenaikan_kelas`, dan `rapor_mapel_sembunyi` (sebelumnya tidak ikut, sehingga keputusan kenaikan kelas, catatan pelanggaran, dan pilihan mapel rapor tidak ada di file cadangan). Cadangan lama tetap bisa dipulihkan; tabel baru hanya terisi bila ada di file.
- Urutan migrasi SQL lengkap kini ada di `DEPLOY-VERCEL.md` (bagian 7).

## v15.1–v15.6 — Rapor sesuai jurusan, Rekap semua mapel, tombol "Di Rapor Cetak"
**Jalankan `migrasi-v21-mapel-jurusan.sql` lalu `migrasi-v22-rapor-mapel-sembunyi.sql`** di Supabase SQL Editor (sekali; aman diulang). File berubah: `index.html`.

### Rapor: penanda mapel yang belum ada nilai
- Mapel tanpa komponen nilai (belum ujian/tugas/praktik) kini tampil "Belum ada nilai" di kolom Nilai Akhir, dengan kalimat penjelas di Capaian Kompetensi (sebelumnya "-").
- Angka 0 tetap hanya muncul bila ada komponen yang benar-benar bernilai 0 (mis. tugas wajib lewat tenggat tidak dikerjakan).

### Rapor: semua mapel jenjang & kelas selalu tampil
- Lembar rapor menampilkan seluruh mapel pada jenjang dan kelas siswa (kecuali mapel bertanda "Tidak diujikan" di menu Mata Pelajaran). Mapel yang belum punya nilai ditulis "Belum ada nilai".
- Siswa yang belum punya data nilai sama sekali pada semester itu tetap tidak dibuatkan rapor (perilaku lama).

### Rapor: sesuai jurusan & siswa tanpa nilai tetap dicetak
- Migrasi baru: migrasi-v21-mapel-jurusan.sql (kolom jurusan pada mata_pelajaran). Menu Mata Pelajaran punya isian Jurusan (Semua/IPA/IPS).
- Mapel "kosong" di rapor hanya yang umum (jurusan kosong) atau sesuai jurusan siswa (dibaca dari nama kelas, mis. "11 IPA", "11 IPS 1"). Mapel yang sudah punya nilai tetap tampil.
- Siswa aktif tanpa nilai sama sekali pada semester itu tetap dibuatkan rapor (kelas dan jenjang siswa saat ini).

### Rekap Nilai Siswa: tombol Tampil / Tidak tampil di rapor cetak
- Kolom baru "Di Rapor Cetak" (setelah Status). Tombol per mapel per siswa per semester; mapel "Tidak tampil" tidak ikut dicetak di rapor (rata-rata di rapor dihitung dari mapel yang tampil). Rekap, Leger, dan Transkrip tidak berubah.
- Migrasi baru: migrasi-v22-rapor-mapel-sembunyi.sql (tabel rapor_mapel_sembunyi). Sebelum dijalankan, semua mapel tetap tampil dan tombol memberi peringatan.

### Rekap Nilai Siswa menampilkan SEMUA mapel (v15_6)
- Bila Tahun Ajaran & Semester dipilih, Rekap menampilkan semua mapel jenjang/kelas siswa; yang belum bernilai diberi keterangan "belum ada nilai" (+ "di luar jurusan" bila jurusan mapel berbeda).
- Tombol "Di Rapor Cetak": bawaan Tampil; mapel belum bernilai & di luar jurusan bawaannya Tidak tampil. Klik untuk mengubah; pilihan manual disimpan (tabel rapor_mapel_sembunyi, kolom sembunyi).
- migrasi-v22 diperbarui (kolom sembunyi). Jalankan migrasi-v22 sebelum memakai tombol.

## v15.0 — Kenaikan Kelas (naik / tidak naik / lulus / pindah / keluar)
**Jalankan `migrasi-v20-kenaikan-kelas.sql`** di Supabase SQL Editor (sekali; aman diulang), lalu unggah semua file dan deploy ulang. File berubah: `index.html`, `netlify/functions/kelola-siswa.js`; file baru: `migrasi-v20-kenaikan-kelas.sql`. Jumlah fungsi Vercel tetap (aksi baru ada di `kelola-siswa`). Sertakan juga perubahan v14.9 di bawah (migrasi-v19 bila belum dijalankan).
- **Menu Kenaikan Kelas** (Laporan Nilai): pilih Jenjang, Kelas, Tahun Ajaran. Saran per siswa dari nilai akhir Semester Genap (jumlah mapel di bawah KKM atau tanpa nilai), persentase kehadiran, dan Sikap. Kriteria bawaan: maks. 3 mapel belum tuntas, kehadiran minimal 75%, Sikap D menahan; bisa diubah di menu itu.
- **Keputusan** per siswa: kelas biasa Naik / Tidak Naik; kelas akhir (IX dan XII) Lulus / Tidak Lulus; semua kelas bisa Pindah / Keluar. Keputusan yang berbeda dari saran wajib beralasan. Disimpan di tabel `kenaikan_kelas` (satu baris per siswa per tahun ajaran).
- **Terapkan ke Data Siswa** (admin; wajib mengetik TERAPKAN): Naik mengubah kelas di tabel `students` (7->8, 8->9, 10->11, 11->12, rombel tetap, mis. 10 IPS 1 -> 11 IPS 1; jenjang/program ikut), Lulus/Pindah/Keluar mengubah status menjadi LULUS/PINDAH/KELUAR, Tidak Naik tidak mengubah apa pun. Data lama disimpan; **Batalkan yang Sudah Diterapkan** mengembalikannya selama data siswa belum diubah lagi. Tabel `students` dipakai bersama aplikasi absensi, jadi perubahan terlihat di sana juga.
- **Migrasi status**: bila kolom `students.status` bertipe enum, nilai LULUS/PINDAH/KELUAR ditambahkan otomatis; bila bertipe teks dengan CHECK, pastikan ketiga nilai itu diizinkan (skrip memberi catatan).
- **Rapor Semester Genap** mencetak kotak *Keputusan* (mis. "Naik ke kelas XI", "Tidak naik (tetap di kelas VII)", "LULUS") bila keputusan sudah disimpan. **Cetak Daftar** menghasilkan daftar kenaikan/kelulusan per kelas dengan tanda tangan Wali Kelas dan Kepala.
- Urutan aman di akhir tahun: simpan keputusan -> cetak rapor Genap -> unduh Cadangan Data -> Terapkan. Setelah diterapkan, daftar kelas lama kosong di menu per kelas (Leger, Rekap Nilai, Input Nilai Tambahan).

## v14.9 — Catatan Pelanggaran, Sikap otomatis, Surat Panggilan Orang Tua
**Jalankan `migrasi-v19-pelanggaran.sql`** di Supabase SQL Editor (sekali; aman diulang), lalu unggah semua file dan deploy ulang. File berubah: `index.html`, `netlify/lib/ujian-core.js`; file baru: `migrasi-v19-pelanggaran.sql`. Sebelum migrasi dijalankan semua menu lama tetap normal; hanya catatan manual, penyimpanan poin, dan tanda "disesuaikan" yang belum bisa disimpan (aplikasi memberi peringatan).
- **Menu Catatan Pelanggaran** (Laporan Nilai): per kelas/semester, tiap siswa menampilkan alpa dan terlambat (rekap absensi; alpa yang sudah disimpan di Input Nilai Tambahan didahulukan), pelanggaran saat ujian (UH/UTS/UAS/Remedial) dan saat tugas (pindah tab/aplikasi, paste), serta catatan manual (kategori Ringan/Sedang/Berat + keterangan + tanggal; bisa dihapus). Tombol Rincian/Catat dan unduh Excel.
- **Poin dan Sikap otomatis**: poin diatur di Pengaturan Nilai (bawaan: alpa 3/hari, terlambat 1/kali, pelanggaran ujian dan tugas 1/kejadian, +5 bila diakhiri otomatis, maks. 10 poin dari ujian+tugas, manual 2/5/10). Ambang predikat bawaan: A sampai 5 poin, B sampai 15, C sampai 30, selebihnya D.
- **Input Nilai Tambahan -> Sikap & Kehadiran**: predikat terisi otomatis dari poin (rapor otomatis memakai kalimat sesuai predikat). Mengubah predikat dari hasil otomatis wajib mengisi alasan dan ditandai "disesuaikan" (kolom `sikap_disesuaikan`, `sikap_alasan`, `poin_pelanggaran` di `catatan_siswa_semester`). Sikap lama yang diisi manual sebelum v14.9 akan tampil sebagai hasil otomatis saat menu dibuka; baru berubah bila disimpan.
- **Menu Surat Panggilan Orang Tua**: pilih siswa, isi nomor surat (opsional), panggilan ke-, hari/tanggal, pukul, tempat, keperluan; uraian pelanggaran terisi otomatis dan bisa diedit. Cetak memakai kop lembaga, tanggal surat = tanggal saat dicetak (kota dari Identitas Sekolah), tanda tangan Wali Kelas dan Ketua/Kepala PKBM (jabatan mengikuti Identitas Sekolah) beserta NIP bila ada.
- Catatan: siswa tanpa data absensi dan tanpa pelanggaran otomatis bersikap A (0 poin). Pindah tab bisa tidak disengaja, karena itu poin ujian+tugas dibatasi.

## v14.8 — Nilai Tugas otomatis masuk Nilai Akhir
Hanya `index.html` yang berubah; tanpa migrasi SQL. Unggah `index.html` ke GitHub, Vercel/Netlify deploy otomatis.
- **Penyebab**: bobot Tugas bawaan = 0%, sehingga nilai Tugas (rata-rata tugas online maupun input manual) sudah terhitung tetapi diabaikan saat menghitung Nilai Akhir.
- **Perbaikan**: bila bobot Tugas di Pengaturan Nilai masih 0 dan siswa punya nilai Tugas pada suatu mapel, nilai itu tetap ikut Nilai Akhir dengan **bobot otomatis 20%** (proporsional bersama UH/UTS/UAS). Mapel tanpa nilai tugas tidak berubah. Isi bobot Tugas > 0 di Pengaturan Nilai bila ingin bobot sendiri; angka otomatis bisa diubah di konstanta `BOBOT_TUGAS_OTOMATIS` (index.html).
- Berlaku di semua tempat: Rekap Nilai, Leger, Transkrip, Laporan Siswa, dan Rapor Semester (semuanya memakai satu fungsi `hitungMapel`).
- Tugas yang masih berstatus *dikumpulkan* (belum dinilai) belum dihitung; tugas wajib yang tidak dikerjakan setelah tenggat/ditutup dihitung 0.
- **Input Nilai Tambahan -> Tugas**: kolom Tugas kini terisi otomatis dengan nilai tugas online (latar biru muda). Angka yang tidak diubah tidak disimpan sebagai nilai manual, jadi tetap mengikuti nilai online bila tugas bertambah; ketik angka lain untuk menimpa, kosongkan untuk kembali ke online.
- **Remedial hanya untuk UTS dan UAS**: Ulangan Harian tidak diremedial (pilihan UH dihapus dari Paket Remedial dan Input Nilai Tambahan -> Remedial; UH tetap rata-rata semua ulangan). File berubah juga: `netlify/lib/ujian-core.js` (daftar remedial di jendela siswa). Nilai remedial UH lama yang mungkin sudah tersimpan diabaikan; tidak ada migrasi.
- Teks bobot di Rekap dan label Pengaturan Nilai diperbarui; Input Nilai Tambahan menampilkan "dipakai, otomatis masuk Nilai Akhir".

## v14.7 — Menu "Cadangan Data" (khusus Super Admin) + pencarian mapel
Tanpa migrasi SQL. File berubah: `index.html`; file baru: `netlify/functions/cadangan-data.js` dan `api/cadangan-data.js`. Unggah SEMUA file lalu deploy ulang. Jumlah fungsi Vercel menjadi 11 (batas paket gratis 12).
- Menu baru **Cadangan Data** (hanya Super Admin; server juga menolak peran lain).
- **Unduh Cadangan Data**: satu klik menghasilkan satu file `cadangan-pkbm-TAHUN-BULAN-TANGGAL.json` berisi 37 tabel (siswa, bank soal, paket, sesi & jawaban, nilai, arsip nilai, absensi, tugas, CP/TP, ekstrakurikuler, pengaturan, dst). Hanya membaca. Bila ada tabel yang gagal dibaca, file TIDAK dibuat (tidak ada cadangan setengah jadi).
- **Pulihkan dari File**: untuk keadaan darurat. Menambah baris yang hilang dan menimpa baris ber-id sama; TIDAK pernah menghapus. Wajib mengetik PULIHKAN. Aman diulang bila terputus.
- Tidak tercakup: akun login guru/admin (Supabase Auth). File berisi data pribadi siswa dan kata sandi terenkripsi; simpan dengan aman.
- Sertakan juga perubahan v14.6 di bawah (pencarian mapel).

## v14.6 — Kolom pencarian kini bisa mencari mata pelajaran
Hanya `index.html` yang berubah; tanpa migrasi SQL. Unggah `index.html` ke GitHub, Vercel deploy otomatis.
Menu yang SUDAH mencari mapel sejak sebelumnya (tidak diubah): Daftar Paket, Ujian Terlaksana, Perlu Dinilai, Arsip Nilai.
Menu yang kini DITAMBAH pencarian mapel:
1. **Bank Soal**: kotak cari kini mencocokkan juga nama mata pelajaran (selain pertanyaan dan topik).
2. **Monitoring per Siswa**: cari nama / NISN / mapel / judul paket / jenis ujian. Mencari nama menampilkan semua mapel siswa itu; mencari mapel menampilkan mapel itu saja. Beberapa kata digabung (DAN), misalnya `budi matematika`. Tombol *Reset Semua Mapel* hanya mereset mapel yang sedang tampil (daftarnya ada di jendela konfirmasi).
3. **Belum Mengikuti Ujian**: bila kata yang diketik cocok dengan mapel/judul paket, tabel hanya menampilkan kolom mapel itu untuk semua siswa; bila tidak ada mapel yang cocok, kata dipakai mencari nama / NISN seperti sebelumnya.
4. **Remedial**: cari nama / NISN / mata pelajaran (pencarian ditunda 0,2 detik agar tetap ringan).
5. **Syarat Rapor**: cari nama / NISN / mapel yang masih kurang (mapel atau tugas yang belum diikuti/dikumpulkan siswa).
Tidak diubah karena daftarnya hanya berisi identitas siswa atau terkait satu tugas: pilihan siswa di Laporan Siswa, Rekap Nilai, Transkrip, Data Siswa, dan Penilaian Tugas.

## v14.5 — Tombol Edit Data Siswa (sinkron dengan aplikasi absensi)
Tanpa migrasi SQL baru. File berubah: `index.html` dan `netlify/functions/kelola-siswa.js` (adapter `api/kelola-siswa.js` tidak berubah; jumlah fungsi tetap 10). Unggah semua file lalu deploy ulang.
- Menu **Data Siswa** (khusus Admin) kini punya kartu **Daftar & Edit Siswa**: seluruh siswa, pencarian (nama/NISN/NIPD/kelas), filter kelas, dan tombol **Edit** pada tiap baris.
- Yang bisa diubah: nama, kelas, tanggal lahir, jenis kelamin, tempat lahir, NIPD, No. HP, alamat. Disimpan langsung ke tabel `students` yang **sama dengan aplikasi absensi**, jadi perubahan langsung terlihat di kedua aplikasi (dan sebaliknya).
- **NISN tidak bisa diubah** (dipakai sebagai kunci nilai, ujian, dan rapor). Kata sandi dan status siswa tidak disentuh; mengubah tanggal lahir tidak mengganti kata sandi.
- Bila kolom Kelas tidak diubah, ejaan kelas dari absensi dibiarkan apa adanya. Bila diubah, jenjang dan program ikut disesuaikan seperti pada Tambah Siswa.
- Setelah menyimpan, data nilai/rapor dimuat ulang otomatis supaya nama/kelas baru dipakai.

## v14.4 — Header rapor ringkas, daftar saran ekstrakurikuler, deskripsi otomatis per predikat
Hanya `index.html` yang berubah; tanpa migrasi baru (tetap butuh `migrasi-v18-ekskul-nip.sql` dari v14.3).
- **Header Rapor Semester**: logo kini di kiri, sejajar dengan judul *LAPORAN HASIL BELAJAR / (RAPOR) / PROGRAM PAKET C* (judul tetap di tengah halaman); jarak atas-bawah dipadatkan agar header tidak memakan tempat.
- **Input Ekstrakurikuler**: ada daftar saran kegiatan yang lazim (Pramuka, PMR, Paskibra, Pembinaan Rohani/Keagamaan, Tilawah dan BTQ, Hadroh/Rebana, Kaligrafi, Muhadharah, Futsal, Sepak Bola, Bola Voli, Bulu Tangkis, Tenis Meja, Seni Tari, Seni Musik, Paduan Suara, TIK, Keterampilan/Kewirausahaan, Tata Boga, Menjahit, Jurnalistik, KIR, English Club) sebagai pilihan klik dan saran saat mengetik. Kegiatan lain tetap bisa diketik; daftar disesuaikan dengan kegiatan yang ada di sekolah Anda.
- **Deskripsi otomatis** (bila Keterangan dikosongkan), contoh: A "... sangat baik dalam mengikuti kegiatan Pramuka; sangat aktif, disiplin, dan menunjukkan keterampilan yang menonjol." B "... baik ...; aktif dan menunjukkan perkembangan keterampilan yang baik." C "... cukup baik ...; perlu meningkatkan keaktifan dan kesungguhan dalam berlatih." D "... masih kurang ...; perlu bimbingan serta peningkatan kehadiran dan keaktifan." Contoh kalimat tampil di kolom Keterangan saat predikat dipilih. Kalimat bisa diubah di `DESKRIPSI_EKSKUL` (index.html).

## v14.3 — Ekstrakurikuler dan NIP pada Rapor Semester
**Wajib jalankan `migrasi-v18-ekskul-nip.sql`** di Supabase SQL Editor (sekali; aman diulang), lalu unggah semua file ke GitHub. Sebelum migrasi dijalankan semua menu lama tetap normal; rapor tetap tercetak tanpa ekstrakurikuler/NIP. Hanya `index.html` yang berubah, ditambah file migrasi baru.
- **Input Ekstrakurikuler** (menu Input Nilai Tambahan -> Yang diisi: *Ekstrakurikuler (per kegiatan)*): pilih Jenjang, Kelas, Tahun Ajaran, Semester, ketik nama kegiatan (mis. Pramuka; nama yang sudah pernah dipakai muncul sebagai saran), klik Muat Siswa, lalu pilih predikat **Sangat Baik / Baik / Cukup / Kurang** per siswa. Biarkan "—" bagi siswa yang tidak mengikuti; mengosongkan predikat menghapus data. Keterangan opsional.
- **Rapor Semester**: tabel *Ekstrakurikuler* (No | Ekstrakurikuler | Predikat | Keterangan) tercetak di bawah tabel nilai, hanya bila siswa punya data. Keterangan kosong diganti kalimat otomatis, mis. "Taufik Hidayat sangat baik dalam mengikuti kegiatan Pramuka."
- **NIP**: kolom NIP (opsional) pada menu Tanda Tangan Digital untuk Kepala dan tiap Wali Kelas. Dicetak sebagai "NIP. ..." di bawah nama pada Rapor Semester saja (piagam dan laporan lain tidak berubah). Bila NIP dikosongkan, barisnya tidak dicetak.
- Tabel baru: `ekstrakurikuler_siswa`; kolom baru `pengaturan_ttd.nip`.

## v14.2 — Rapor Semester: unsur rapor lama dikembalikan ke format baru
Hanya `index.html` yang berubah; tanpa migrasi. Format Rpr-1 (v14.1) tetap, ditambah kembali:
- **Rata-rata Nilai + predikat** dan **Peringkat di Kelas** (ke-n dari N siswa), di bawah tabel nilai.
- **Persentase Kehadiran** pada kotak Ketidakhadiran (Sakit / Izin / Tanpa Keterangan / Persentase).
- Kotak **Sikap dan Catatan Wali Kelas** (dari Input Nilai Tambahan; catatan otomatis bila kosong).
Berlaku untuk cetak satu siswa maupun satu kelas. Bagian yang gagal dimuat (peringkat/catatan) menampilkan "-" dan tidak menggagalkan cetak. Ekstrakurikuler dan NIP tetap belum ada.

## v14.1 — Format Rapor Semester mengikuti contoh (khusus Rekap Nilai Siswa)
Hanya **Rekap Nilai Siswa -> Cetak Rapor Semester** (satu siswa maupun satu kelas) yang berubah. Leger, Transkrip, Laporan Siswa, Syarat Rapor, dan semua cetakan lain tetap memakai header lama. Tidak perlu migrasi baru.
- **Header**: hanya **logo** (tanpa nama sekolah/yayasan, NPSN, SK, dan alamat), disusul judul 3 baris *LAPORAN HASIL BELAJAR / (RAPOR) / PROGRAM PAKET C*.
- **Identitas 2 kolom**: Nama Peserta Didik, NISN / NIPD, Sekolah, Alamat | Kelas (mis. XI (sebelas)), Fase, Semester (I (Satu)/II (Dua)), Tahun Pelajaran. Nama sekolah dan alamat tetap ada di blok identitas ini, persis seperti contoh. NIPD diambil dari data siswa bila tersedia.
- **Tabel nilai**: No | Muatan Pelajaran | Nilai Akhir | Capaian Kompetensi. Kolom UH/UTS/UAS/Tugas/Praktik/KKM/Predikat tidak dicetak lagi (tampilan Rekap di layar tidak berubah).
- **Capaian Kompetensi** (menyatu dengan fitur CP & TP v14.0): *"{Nama} menunjukkan pemahaman dalam {TP}; perlu bimbingan dalam {TP}."* TP diambil dari menu CP & TP per Mapel (TP semester itu). Aturan: bila ada skor soal yang terkait TP, TP >= KKM mapel = menunjukkan pemahaman, di bawah KKM = perlu bimbingan; bila belum ada skor per TP, mengikuti Nilai Akhir mapel terhadap KKM; bila mapel hanya punya CP, rumusan CP dipakai; bila mapel belum punya CP/TP, ditulis kalimat predikat (mis. "mencapai predikat Baik pada muatan pelajaran ini"); nilai belum final = "-".
- **Ketidakhadiran** (Sakit / Izin / Tanpa Keterangan, dalam hari) dan tanda tangan **Orang Tua, Wali Kelas, Kepala** (Mengetahui).
- **Tidak ada di v14.1** (dikembalikan di v14.2): ringkasan rata-rata/peringkat, kotak Sikap dan Catatan Wali Kelas, persentase kehadiran. Masih belum ada: bagian ekstrakurikuler (aplikasi belum punya data ekstrakurikuler) dan baris NIP (tabel tanda tangan belum punya kolom NIP).
- File berubah: index.html saja.

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

**4. Rapor Semester mencantumkan CP & TP** (sejak v14.1 menyatu di kolom Capaian Kompetensi; lihat bagian v14.1). Setelah tabel nilai, muncul bagian **Capaian Pembelajaran (CP) & Tujuan Pembelajaran (TP)** per mapel (hanya mapel yang punya CP). Bila siswa punya skor pada soal yang terkait TP (ujian berstatus dinilai pada tahun ajaran & semester itu, termasuk remedial), tertulis deskripsi otomatis: *"Ananda telah mampu ..."* (TP dengan penguasaan >= KKM mapel) dan *"Ananda perlu bimbingan/penguatan pada ..."* (di bawah KKM). TP yang belum punya data tidak dinilai (ditulis "n TP lain belum diukur"). Bila belum ada soal terkait TP, rapor menampilkan CP dan daftar TP semester itu. Berlaku untuk cetak satu siswa maupun massal. Kegagalan bagian ini tidak menggagalkan cetak rapor.
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

## Bonus "tidak pernah alpa" (Sikap otomatis)
- Pengaturan Nilai > Poin Pelanggaran: tambah "Bonus tidak pernah alpa (pengurang poin)" (bawaan 3) dan opsi "Sikap A wajib tanpa alpa" (bawaan aktif).
- Siswa dengan alpa 0 mendapat pengurang poin (total tidak kurang dari 0); siswa yang pernah alpa maksimal B bila opsi A-wajib aktif.
- Tidak perlu migrasi SQL baru; pengaturan disimpan di kolom JSON pelanggaran yang sudah ada.

## v23 — Perangkat Ajar (Generate RPP, Modul Ajar, Pengaturan)
Jalankan `migrasi-v23-perangkat-ajar.sql` di Supabase SQL Editor (sekali). File baru: `perangkat-ajar.js`, `netlify/functions/perangkat-ajar.js`; berubah: `index.html`, `api/_adapter.js` (+1 baris). `api/gateway.js` dihapus (tidak terpakai) agar jumlah function Vercel = 12.

## v25 — Modul Ajar mengikuti template "Modul Ajar IPA SMA (Contoh Lengkap)" (tanpa migrasi SQL baru)
Modul Ajar yang dihasilkan menu **Generate Modul Ajar** kini memakai susunan dan tampilan template: sampul + tabel identitas, lalu bagian **A** Informasi Umum, **B** Kesiapan dan Karakteristik Peserta Didik, **C** Desain Pembelajaran (CP, tujuan, kriteria ketercapaian, pemahaman bermakna, pertanyaan pemantik, materi esensial, dimensi, media), **D** Materi, **E** Langkah-langkah (tabel tahap/waktu | guru | peserta didik | asesmen), **F** LKPD, **G** Asesmen (formatif, sumatif + kunci, penskoran, rubrik), **H** Diferensiasi, **I** Tindak Lanjut, **J** Refleksi, **K** Sumber Rujukan. Gaya: Arial, judul hijau `#548235`, tabel berheader hijau dengan baris selang-seling `#F4F8F1`, header/footer halaman pada berkas Word.
- `netlify/functions/perangkat-ajar.js`: struktur JSON & prompt modul diganti (RPP dan LKPD tidak berubah). Hasil AI dengan format lama otomatis ditolak lalu diulang.
- `perangkat-ajar.js`: `renderModul` ditulis ulang; unduhan Word memakai margin & font template (header/footer hanya pada unduhan Word, tidak pada Cetak/PDF dari browser).
- Pengaturan yang tetap dihormati: "Sertakan Profil Pelajar Pancasila" (bagian Dimensi), "Sertakan Rubrik", "Sertakan Remedial & Pengayaan" (bagian Tindak Lanjut), kop sekolah, tanda tangan.
- Riwayat lama tetap dapat dibuka/diunduh (disimpan sebagai HTML). Tidak ada perubahan database.

## v26 — LKPD mengikuti "Format LKPD Permendikdasmen 1/2026" (tanpa migrasi SQL baru)
LKPD yang dihasilkan menu **Generate LKPD** kini memakai format lampiran: sampul + tabel identitas (termasuk nama murid/kelompok dan hari/tanggal), **A** Tujuan Pembelajaran, **B** Petunjuk Belajar, **C** Kegiatan 1 — Memahami (kotak stimulus, tabel data, pertanyaan pemahaman dengan kolom jawaban), **D** Kegiatan 2 — Mengaplikasi (tugas, tabel kerja, kesimpulan kelompok), **E** Kegiatan 3 — Merefleksi (tabel refleksi + penilaian diri), **F** Penilaian oleh Guru (rubrik 4 aspek, capaian, umpan balik, tindak lanjut), **G** Dasar Acuan (untuk guru). Kunci jawaban (bila dicentang) berada di halaman guru sebelum bagian G. Header "LKPD • Mapel • Topik" dan footer dengan nomor halaman pada unduhan Word.
- `netlify/functions/perangkat-ajar.js`: prompt & struktur JSON LKPD diganti (RPP dan Modul tidak berubah).
- `perangkat-ajar.js`: `renderLkpd` ditulis ulang; form LKPD: "Jumlah Kegiatan" menjadi "Jumlah Pertanyaan Pemahaman" (2-5) dan ada pilihan "Alokasi Waktu (JP)". Gambar AI tetap dibuat per gambar (letak: bahan belajar Kegiatan 1 atau Kegiatan 2), tombol ganti/hapus/buat ulang tetap berfungsi.
- Kop/logo tetap mengikuti pengaturan aplikasi. LKPD lama di riwayat tetap dapat dibuka dan diunduh.
