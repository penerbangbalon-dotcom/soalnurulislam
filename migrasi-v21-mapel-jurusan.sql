-- ============================================================
-- v21 — Jurusan pada Mata Pelajaran (agar rapor hanya menampilkan mapel sesuai jurusan siswa)
-- Jalankan SEKALI di Supabase SQL Editor (aman diulang). Data lama tidak berubah.
-- NULL = berlaku untuk semua jurusan. Isi 'IPA' atau 'IPS' untuk mapel khusus jurusan,
-- lewat menu Mata Pelajaran > Edit > Jurusan.
-- ============================================================
alter table public.mata_pelajaran add column if not exists jurusan text;
alter table public.mata_pelajaran drop constraint if exists mata_pelajaran_jurusan_check;
alter table public.mata_pelajaran add constraint mata_pelajaran_jurusan_check
  check (jurusan is null or jurusan in ('IPA','IPS'));
