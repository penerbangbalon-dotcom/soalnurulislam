-- Migrasi v23: warna aplikasi yang diatur Super Admin (berlaku untuk admin & halaman siswa).
-- Aman dijalankan berulang kali. (Sudah dijalankan di database; file ini hanya arsip.)
alter table public.pengaturan_sekolah add column if not exists tema_warna text not null default 'kuning';
alter table public.pengaturan_sekolah drop constraint if exists pengaturan_sekolah_tema_warna_check;
alter table public.pengaturan_sekolah add constraint pengaturan_sekolah_tema_warna_check
  check (tema_warna in ('kuning','biru','hijau','ungu','teal','mawar'));
