-- ============================================================
-- v17: CAPAIAN PEMBELAJARAN (CP) & TUJUAN PEMBELAJARAN (TP) PER MAPEL
-- Jalankan SEKALI di Supabase SQL Editor (aman dijalankan ulang).
-- Hanya MENAMBAH tabel/kolom baru; data lama tidak diubah.
-- ============================================================

-- 1) Capaian Pembelajaran: satu mapel boleh punya beberapa CP (mis. per elemen / ruang lingkup)
create table if not exists capaian_pembelajaran (
  id uuid primary key default gen_random_uuid(),
  mapel_id uuid not null references mata_pelajaran(id) on delete cascade,
  kode text,                       -- mis. CP-1
  elemen text,                     -- elemen / ruang lingkup, mis. "Bilangan"
  deskripsi text not null,         -- isi CP
  urutan integer not null default 0,
  sumber text not null default 'manual' check (sumber in ('manual','upload','ai')),
  dibuat_oleh text,
  created_at timestamptz default now()
);

-- 2) Tujuan Pembelajaran: turunan CP
create table if not exists tujuan_pembelajaran (
  id uuid primary key default gen_random_uuid(),
  cp_id uuid not null references capaian_pembelajaran(id) on delete cascade,
  mapel_id uuid not null references mata_pelajaran(id) on delete cascade,
  kode text,                       -- mis. 1.1
  deskripsi text not null,
  semester text check (semester is null or semester in ('Ganjil','Genap')),
  urutan integer not null default 0,
  sumber text not null default 'manual' check (sumber in ('manual','upload','ai')),
  created_at timestamptz default now()
);

-- 3) Soal di Bank Soal boleh dikaitkan ke CP & TP.
--    Bila CP/TP dihapus, soal TIDAK ikut terhapus (hanya tautannya dikosongkan).
alter table bank_soal add column if not exists cp_id uuid references capaian_pembelajaran(id) on delete set null;
alter table bank_soal add column if not exists tp_id uuid references tujuan_pembelajaran(id) on delete set null;

create index if not exists idx_cp_mapel on capaian_pembelajaran(mapel_id);
create index if not exists idx_tp_cp on tujuan_pembelajaran(cp_id);
create index if not exists idx_tp_mapel on tujuan_pembelajaran(mapel_id);
create index if not exists idx_bank_soal_cp on bank_soal(cp_id);
create index if not exists idx_bank_soal_tp on bank_soal(tp_id);

-- 4) Keamanan: hanya guru/admin yang login
alter table capaian_pembelajaran enable row level security;
alter table tujuan_pembelajaran enable row level security;

drop policy if exists "guru login bisa akses semua" on capaian_pembelajaran;
create policy "guru login bisa akses semua" on capaian_pembelajaran for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "guru login bisa akses semua" on tujuan_pembelajaran;
create policy "guru login bisa akses semua" on tujuan_pembelajaran for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
