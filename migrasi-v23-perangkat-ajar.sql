-- ============================================================
-- v23: PERANGKAT AJAR (RPP & MODUL AJAR) + PENGATURANNYA
-- Jalankan SEKALI di Supabase SQL Editor (aman diulang). Hanya menambah tabel baru.
-- ============================================================
create table if not exists public.pengaturan_perangkat (
  id integer primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.perangkat_ajar (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('rpp','modul')),
  mapel_id uuid references public.mata_pelajaran(id) on delete set null,
  judul text not null,
  kelas text,
  semester text,
  html text not null,
  meta jsonb default '{}'::jsonb,
  dibuat_oleh text,
  created_at timestamptz default now()
);
create index if not exists idx_perangkat_jenis on public.perangkat_ajar(jenis, created_at desc);

alter table public.pengaturan_perangkat enable row level security;
alter table public.perangkat_ajar enable row level security;
drop policy if exists "guru login akses pengaturan perangkat" on public.pengaturan_perangkat;
create policy "guru login akses pengaturan perangkat" on public.pengaturan_perangkat for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "guru login akses perangkat ajar" on public.perangkat_ajar;
create policy "guru login akses perangkat ajar" on public.perangkat_ajar for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
