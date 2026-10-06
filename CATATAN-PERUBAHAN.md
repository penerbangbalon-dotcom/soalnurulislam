# Perubahan terbaru

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

