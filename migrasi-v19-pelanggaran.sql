-- ============================================================
-- v14.9 — Catatan Pelanggaran, Sikap otomatis, Surat Panggilan Orang Tua
-- Jalankan SEKALI di Supabase SQL Editor (aman diulang). Data lama tidak berubah.
-- ============================================================

-- 1) Catatan pelanggaran MANUAL (alpa, terlambat, pelanggaran ujian dan tugas dibaca otomatis dari data yang sudah ada)
create table if not exists public.catatan_pelanggaran (
  id bigserial primary key,
  siswa_nisn text not null,
  siswa_nama text,
  program text not null,
  kelas text not null,
  tahun_ajaran text not null,
  semester text not null check (semester in ('Ganjil','Genap')),
  tanggal date not null default current_date,
  kategori text not null check (kategori in ('ringan','sedang','berat')),
  poin integer not null default 0 check (poin >= 0),
  keterangan text not null,
  dicatat_oleh text,
  created_at timestamptz not null default now()
);
create index if not exists idx_catatan_pelanggaran_kelas
  on public.catatan_pelanggaran(program, kelas, tahun_ajaran, semester);
create index if not exists idx_catatan_pelanggaran_siswa
  on public.catatan_pelanggaran(siswa_nisn);

alter table public.catatan_pelanggaran enable row level security;
drop policy if exists "guru login bisa akses catatan pelanggaran" on public.catatan_pelanggaran;
create policy "guru login bisa akses catatan pelanggaran" on public.catatan_pelanggaran for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 2) Pengaturan poin pelanggaran dan ambang predikat Sikap (satu kolom JSON di pengaturan nilai)
alter table public.pengaturan_nilai add column if not exists pelanggaran jsonb;

-- 3) Sikap otomatis: tanda bila wali kelas menyesuaikan predikat (wajib beralasan) dan poin saat disimpan
alter table public.catatan_siswa_semester add column if not exists sikap_disesuaikan boolean not null default false;
alter table public.catatan_siswa_semester add column if not exists sikap_alasan text;
alter table public.catatan_siswa_semester add column if not exists poin_pelanggaran integer;
