-- Jalankan SEKALI di Supabase SQL Editor (aman jika dijalankan ulang)
alter table bank_soal add column if not exists pembahasan text;
alter table bank_soal add column if not exists gambar text;
alter table sesi_ujian add column if not exists pelanggaran integer default 0;
drop policy if exists "guru login bisa hapus sesi" on sesi_ujian;
create policy "guru login bisa hapus sesi" on sesi_ujian for delete using (auth.role() = 'authenticated');

-- Kolom Kelas pada Mata Pelajaran (supaya Bank Soal terpisah per jenjang & kelas,
-- bukan hanya per mapel). Mapel lama yang belum diisi kelasnya akan bernilai NULL
-- (tetap tampil, tapi sebaiknya diedit ulang / dibuat ulang per kelas).
alter table mata_pelajaran add column if not exists kelas text;
alter table mata_pelajaran drop constraint if exists mata_pelajaran_kelas_check;
alter table mata_pelajaran add constraint mata_pelajaran_kelas_check
  check (kelas in ('VII','VIII','IX','X','XI','XII'));

-- Catatan nomor urut Piagam (supaya nomor surat piagam urut resmi & tidak dobel).
create table if not exists piagam_log (
  id uuid primary key default gen_random_uuid(),
  tahun integer not null,
  nomor_urut integer not null,
  siswa_nisn text not null,
  siswa_nama text not null,
  created_at timestamptz default now(),
  unique (tahun, nomor_urut)
);
alter table piagam_log enable row level security;
drop policy if exists "guru login bisa akses catatan piagam" on piagam_log;
create policy "guru login bisa akses catatan piagam" on piagam_log for all using (auth.role() = 'authenticated');

-- ============================================================
-- UPDATE: Semester pada judul Rapor/Piagam, NISN & nomor urut
-- piagam alfabetis, dan Tanda Tangan Digital (Kepala PKBM & Wali Kelas)
-- ============================================================

-- Nomor urut piagam sekarang dihitung dari urutan alfabet nama siswa per
-- kelas & jenjang (bukan urutan cetak), supaya nomor tiap siswa konsisten
-- walau piagam dicetak ulang / tidak berurutan. Ditambah kolom kelas &
-- program supaya nomor boleh sama antar kelas yang berbeda pada tahun yang
-- sama (misal Kelas VII dan Kelas X sama-sama boleh punya nomor 001).
alter table piagam_log add column if not exists kelas text;
alter table piagam_log add column if not exists program text;
alter table piagam_log drop constraint if exists piagam_log_tahun_nomor_urut_key;
create unique index if not exists piagam_log_unik_siswa on piagam_log(tahun, kelas, program, siswa_nisn);

-- Tanda tangan digital Kepala PKBM & Wali Kelas (disimpan sebagai gambar
-- JPG/PNG dalam bentuk data URI base64), supaya Rapor & Piagam tidak perlu
-- ditandatangani manual satu per satu. kelas diisi '' (bukan NULL) khusus
-- untuk baris Kepala PKBM, supaya kombinasi (jenis, kelas) tetap unik.
create table if not exists pengaturan_ttd (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('kepala_pkbm','wali_kelas')),
  kelas text not null default '',
  nama text,
  ttd_base64 text,
  updated_at timestamptz default now(),
  unique (jenis, kelas)
);
alter table pengaturan_ttd enable row level security;
drop policy if exists "guru login bisa akses ttd" on pengaturan_ttd;
create policy "guru login bisa akses ttd" on pengaturan_ttd for all using (auth.role() = 'authenticated');

-- ============================================================
-- UPDATE: Dropdown siswa di Hasil Ujian Online & Laporan Siswa
-- diambil dari tabel `students` milik aplikasi Absensi (database
-- Supabase yang sama). Guru yang sudah login perlu izin baca tabel
-- ini (sudah dijalankan langsung di database produksi, baris di
-- bawah ini hanya arsip/dokumentasi kalau perlu redeploy dari nol).
-- ============================================================
drop policy if exists "guru login bisa lihat data siswa" on public.students;
create policy "guru login bisa lihat data siswa" on public.students for select using (auth.role() = 'authenticated');

-- ============================================================
-- UPDATE: Ukuran tanda tangan bisa diatur manual (px) per Kepala
-- PKBM & per Wali Kelas, dipakai saat mencetak Rapor/Piagam.
-- Sudah dijalankan langsung di database produksi; baris di bawah
-- ini hanya arsip/dokumentasi kalau perlu redeploy dari nol.
-- ============================================================
alter table pengaturan_ttd add column if not exists tinggi_px integer not null default 90;
alter table pengaturan_ttd drop constraint if exists pengaturan_ttd_tinggi_px_check;
alter table pengaturan_ttd add constraint pengaturan_ttd_tinggi_px_check check (tinggi_px >= 20 and tinggi_px <= 200);

-- ============================================================
-- UPDATE: Ujian Cetak & Nilai Manual (untuk siswa tanpa HP)
-- Menu baru "Ujian Cetak & Nilai Manual" menyimpan hasil koreksi manual
-- ke tabel sesi_ujian/detail_jawaban yang SAMA dengan ujian online, supaya
-- otomatis muncul di Hasil Ujian, Laporan Siswa, Rapor & Piagam tanpa
-- perlu mengubah menu-menu tersebut. Kolom & policy di bawah ini murni
-- tambahan (tidak mengubah data/izin yang sudah ada).
-- ============================================================
alter table sesi_ujian add column if not exists mode_ujian text not null default 'online';
alter table sesi_ujian drop constraint if exists sesi_ujian_mode_ujian_check;
alter table sesi_ujian add constraint sesi_ujian_mode_ujian_check check (mode_ujian in ('online','manual'));

-- Sebelumnya sesi_ujian & detail_jawaban hanya bisa diisi lewat Netlify
-- Function (service role) untuk ujian online. Untuk input nilai manual,
-- guru yang login perlu izin insert langsung dari aplikasi (index.html).
drop policy if exists "guru login bisa input sesi manual" on sesi_ujian;
create policy "guru login bisa input sesi manual" on sesi_ujian for insert with check (auth.role() = 'authenticated');
drop policy if exists "guru login bisa input detail manual" on detail_jawaban;
create policy "guru login bisa input detail manual" on detail_jawaban for insert with check (auth.role() = 'authenticated');
drop policy if exists "guru login bisa hapus detail sebelum nilai ulang" on detail_jawaban;
create policy "guru login bisa hapus detail sebelum nilai ulang" on detail_jawaban for delete using (auth.role() = 'authenticated');

-- ============================================================
-- UPDATE: Tandai Mata Pelajaran "Tidak Diujikan" (UTS/UAS)
-- Dipakai di Laporan Siswa: mapel yang ditandai tidak diujikan tidak lagi
-- muncul sebagai baris "Paket ujian belum dibuat" di laporan siswa, supaya
-- laporan/rapor/piagam tidak salah menganggap siswa belum mengerjakan
-- padahal mapel tsb memang tidak ada UTS/UAS-nya.
-- ============================================================
alter table mata_pelajaran add column if not exists tidak_diujikan boolean not null default false;

-- ============================================================
-- UPDATE: Monitoring Ujian Real-time
-- Kolom tambahan di sesi_ujian untuk: (1) "detak" dari halaman siswa supaya
-- guru tahu siapa yang sedang online, (2) progres pengerjaan, (3) simpanan
-- jawaban sementara di server (supaya tombol "Sudahi" tetap bisa menilai
-- jawaban siswa walau HP siswa mati/koneksi putus), (4) tambah waktu,
-- (5) kunci sementara, dan (6) pesan/peringatan dari guru ke siswa.
-- Aman dijalankan ulang. Tidak mengubah data/izin yang sudah ada.
-- ============================================================
alter table sesi_ujian add column if not exists terakhir_aktif timestamptz;
alter table sesi_ujian add column if not exists progres integer not null default 0;
alter table sesi_ujian add column if not exists total_soal integer not null default 0;
alter table sesi_ujian add column if not exists jawaban_sementara jsonb;
alter table sesi_ujian add column if not exists tambahan_menit integer not null default 0;
alter table sesi_ujian add column if not exists dikunci boolean not null default false;
alter table sesi_ujian add column if not exists pesan_guru text;
alter table sesi_ujian add column if not exists pesan_id integer not null default 0;
-- (Izin guru untuk melihat/mengubah sesi_ujian sudah ada dari skema awal:
--  "guru login bisa lihat semua" & "guru login bisa update sesi".)
