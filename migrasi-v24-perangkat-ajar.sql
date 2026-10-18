-- ============================================================
-- v24: PERANGKAT AJAR (RPP & MODUL AJAR) + PENGATURANNYA
-- Jalankan SEKALI di Supabase SQL Editor (aman dijalankan ulang).
-- Hanya MENAMBAH tabel baru; data lama tidak diubah.
-- ============================================================

-- 1) Pengaturan perangkat ajar (satu baris, id = 1). Hanya admin yang boleh mengubah.
create table if not exists public.pengaturan_perangkat_ajar (
  id int primary key default 1 check (id = 1),
  format_rpp text not null default 'pm'
    check (format_rpp in ('pm','satu_lembar','merdeka')),
  format_modul text not null default 'merdeka'
    check (format_modul in ('pm','satu_lembar','merdeka')),
  menit_jp_b int not null default 40,       -- Paket B (SMP): 1 JP = 40 menit
  menit_jp_c int not null default 45,       -- Paket C (SMA): 1 JP = 45 menit
  model_default text,                       -- mis. "Problem Based Learning"
  karakter_peserta text,                    -- karakter peserta didik PKBM (dipakai AI)
  catatan_ai text,                          -- instruksi tambahan untuk AI
  tampil_ttd_kepala boolean not null default true,
  updated_at timestamptz default now()
);
alter table public.pengaturan_perangkat_ajar enable row level security;

drop policy if exists "login boleh baca pengaturan perangkat ajar" on public.pengaturan_perangkat_ajar;
create policy "login boleh baca pengaturan perangkat ajar" on public.pengaturan_perangkat_ajar
  for select using (auth.role() = 'authenticated');

drop policy if exists "admin boleh ubah pengaturan perangkat ajar" on public.pengaturan_perangkat_ajar;
create policy "admin boleh ubah pengaturan perangkat ajar" on public.pengaturan_perangkat_ajar
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into public.pengaturan_perangkat_ajar (id, karakter_peserta)
values (1, 'Peserta didik PKBM beragam usia dan latar belakang; sebagian bekerja atau membantu keluarga, sehingga pembelajaran perlu kontekstual, fleksibel, dan menghargai pengalaman hidup mereka.')
on conflict (id) do nothing;

-- 2) Perpustakaan RPP & Modul Ajar. Semua guru yang login bisa melihat dan mengunduh.
create table if not exists public.perangkat_ajar (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('rpp','modul')),
  format text not null default 'pm' check (format in ('pm','satu_lembar','merdeka')),
  judul text not null,
  mapel_id uuid references public.mata_pelajaran(id) on delete set null,
  mapel_nama text,
  program text,
  kelas text,
  fase text,
  semester text,
  tahun_ajaran text,
  alokasi_jp int,
  jumlah_pertemuan int default 1,
  penyusun text,
  nip_penyusun text,
  isi jsonb not null default '{}'::jsonb,   -- {identitas:[[label,nilai]], bagian:[{kunci,judul,teks}]}
  dibuat_oleh text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_perangkat_ajar_jenis on public.perangkat_ajar(jenis);
create index if not exists idx_perangkat_ajar_mapel on public.perangkat_ajar(mapel_id);

alter table public.perangkat_ajar enable row level security;
drop policy if exists "guru login bisa akses perangkat ajar" on public.perangkat_ajar;
create policy "guru login bisa akses perangkat ajar" on public.perangkat_ajar
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
