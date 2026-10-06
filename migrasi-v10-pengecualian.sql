-- Migrasi v10: penanda "Susulan / Tidak wajib" per siswa per ujian, dan paket khusus jurusan (IPA/IPS).
-- Jalankan SEKALI di Supabase SQL Editor. Aman dijalankan ulang. Hanya MENAMBAH tabel baru; data lama tidak diubah.

-- 1) Pengecualian per siswa per paket ujian
create table if not exists public.ujian_pengecualian (
  id uuid primary key default gen_random_uuid(),
  paket_ujian_id uuid not null references public.paket_ujian(id) on delete cascade,
  siswa_nisn text not null,
  status text not null check (status in ('susulan','tidak_wajib')),
  catatan text,
  created_at timestamptz default now(),
  unique (paket_ujian_id, siswa_nisn)
);
create index if not exists idx_ujian_pengecualian_paket on public.ujian_pengecualian(paket_ujian_id);
alter table public.ujian_pengecualian enable row level security;
drop policy if exists "guru login bisa akses pengecualian ujian" on public.ujian_pengecualian;
create policy "guru login bisa akses pengecualian ujian" on public.ujian_pengecualian for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 2) Paket yang hanya berlaku untuk satu jurusan (tanpa baris = berlaku untuk semua siswa kelas tsb)
create table if not exists public.paket_jurusan (
  id uuid primary key default gen_random_uuid(),
  paket_ujian_id uuid not null unique references public.paket_ujian(id) on delete cascade,
  jurusan text not null check (jurusan in ('IPA','IPS')),
  created_at timestamptz default now()
);
alter table public.paket_jurusan enable row level security;
drop policy if exists "guru login bisa akses paket jurusan" on public.paket_jurusan;
create policy "guru login bisa akses paket jurusan" on public.paket_jurusan for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
