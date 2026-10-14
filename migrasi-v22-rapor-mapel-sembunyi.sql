-- ============================================================
-- v22 — Pilihan tampil / tidak tampil per mapel pada RAPOR CETAK
-- Jalankan SEKALI di Supabase SQL Editor (aman diulang).
-- Baris di tabel ini = pilihan manual tampil/tidak tampil mapel pada rapor cetak (per siswa, per semester):
--   sembunyi = true  -> mapel tidak dicetak;  sembunyi = false -> mapel dipaksa tampil.
-- Tanpa baris = aturan bawaan (tampil; kecuali mapel belum bernilai & di luar jurusan siswa).
-- Nilai di Rekap/Leger/Transkrip tidak berubah.
-- ============================================================
create table if not exists public.rapor_mapel_sembunyi (
  id uuid primary key default gen_random_uuid(),
  siswa_nisn text not null,
  program text not null,
  kelas text not null,
  tahun_ajaran text not null,
  semester text not null,
  mapel_nama text not null,
  sembunyi boolean not null default true,
  created_at timestamptz default now(),
  unique (siswa_nisn, program, kelas, tahun_ajaran, semester, mapel_nama)
);
alter table public.rapor_mapel_sembunyi add column if not exists sembunyi boolean not null default true;
alter table public.rapor_mapel_sembunyi enable row level security;
drop policy if exists "guru login bisa akses rapor mapel sembunyi" on public.rapor_mapel_sembunyi;
create policy "guru login bisa akses rapor mapel sembunyi" on public.rapor_mapel_sembunyi for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
