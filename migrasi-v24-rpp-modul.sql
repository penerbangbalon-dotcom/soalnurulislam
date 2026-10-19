-- ============================================================
-- v24: PERANGKAT AJAR — GENERATE RPP & MODUL AJAR (dengan AI)
-- Jalankan SEKALI di Supabase SQL Editor (aman dijalankan ulang).
-- Hanya MENAMBAH tabel baru; data lama tidak diubah.
-- Syarat: migrasi-v17-cp-tp.sql (CP & TP) sebaiknya sudah dijalankan,
--         tetapi tabel di bawah tidak bergantung padanya.
-- ============================================================

-- 1) Pengaturan format RPP & Modul Ajar (satu baris untuk seluruh sekolah).
--    Siapa pun yang login boleh membaca; hanya ADMIN yang boleh mengubah.
create table if not exists pengaturan_perangkat (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table pengaturan_perangkat enable row level security;

drop policy if exists "login boleh baca pengaturan perangkat" on pengaturan_perangkat;
create policy "login boleh baca pengaturan perangkat" on pengaturan_perangkat
  for select using (auth.role() = 'authenticated');

drop policy if exists "admin boleh ubah pengaturan perangkat" on pengaturan_perangkat;
create policy "admin boleh ubah pengaturan perangkat" on pengaturan_perangkat
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into pengaturan_perangkat (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- 2) RPP & Modul Ajar yang sudah disimpan guru.
--    "html"   = isi dokumen siap tampil/unduh (sudah termasuk hasil edit guru).
--    "konten" = data terstruktur hasil AI (untuk dibuat ulang / diolah lagi).
create table if not exists perangkat_ajar (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('rpp','modul')),
  format text,                         -- mis. merdeka | ringkas | mendalam (RPP); standar (Modul)
  judul text not null,
  mapel_id uuid references mata_pelajaran(id) on delete set null,
  mapel_nama text,
  program text,
  kelas text,
  fase text,
  semester text,
  tahun_ajaran text,
  cp_id uuid,
  tp_ids uuid[] default '{}',
  topik text,
  nama_guru text,
  nip_guru text,
  html text,
  konten jsonb,
  dibuat_oleh text,                    -- email akun guru
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_perangkat_jenis on perangkat_ajar(jenis);
create index if not exists idx_perangkat_mapel on perangkat_ajar(mapel_id);
create index if not exists idx_perangkat_oleh on perangkat_ajar(dibuat_oleh);

alter table perangkat_ajar enable row level security;
drop policy if exists "guru login bisa akses perangkat ajar" on perangkat_ajar;
create policy "guru login bisa akses perangkat ajar" on perangkat_ajar for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
