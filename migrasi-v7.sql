-- ============================================================
-- MIGRASI v7 — jalankan SEKALI di Supabase SQL Editor (aman dijalankan ulang)
-- 1) Izinkan jenis ujian "Ulangan Harian"
-- 2) Pengaturan nilai (bobot, mode, KKM) disimpan di database, bukan di browser
-- 3) Nilai tambahan per mapel (Tugas & Praktik)
-- 4) Sikap & kehadiran per siswa per semester
-- Hanya MENAMBAH objek baru / melonggarkan aturan; data lama tidak diubah.
-- ============================================================

-- 1) Ulangan Harian
alter table paket_ujian drop constraint if exists paket_ujian_jenis_ujian_check;
alter table paket_ujian add constraint paket_ujian_jenis_ujian_check
  check (jenis_ujian in ('UTS','UAS','Ulangan Harian'));

-- 2) Pengaturan nilai (satu baris, id = 'umum')
create table if not exists pengaturan_nilai (
  id text primary key default 'umum',
  bobot jsonb not null default '{"uh":30,"uts":30,"uas":40,"tugas":0,"praktik":0}'::jsonb,
  mode text not null default 'sebagian' check (mode in ('sebagian','lengkap')),
  kkm numeric not null default 70 check (kkm >= 0 and kkm <= 100),
  kkm_mapel jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
insert into pengaturan_nilai (id) values ('umum') on conflict (id) do nothing;
alter table pengaturan_nilai enable row level security;
drop policy if exists "guru login bisa akses pengaturan nilai" on pengaturan_nilai;
create policy "guru login bisa akses pengaturan nilai" on pengaturan_nilai for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 3) Nilai Tugas & Praktik per siswa per mapel per semester
create table if not exists nilai_manual_komponen (
  id uuid primary key default gen_random_uuid(),
  siswa_nisn text not null,
  siswa_nama text,
  program text not null,
  kelas text not null,
  tahun_ajaran text not null,
  semester text not null check (semester in ('Ganjil','Genap')),
  mapel_nama text not null,
  komponen text not null check (komponen in ('tugas','praktik')),
  nilai numeric not null check (nilai >= 0 and nilai <= 100),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (siswa_nisn, program, kelas, tahun_ajaran, semester, mapel_nama, komponen)
);
create index if not exists idx_nmk_kelas on nilai_manual_komponen(program, kelas, tahun_ajaran, semester);
alter table nilai_manual_komponen enable row level security;
drop policy if exists "guru login bisa akses nilai manual komponen" on nilai_manual_komponen;
create policy "guru login bisa akses nilai manual komponen" on nilai_manual_komponen for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 4) Sikap & kehadiran per siswa per semester
create table if not exists catatan_siswa_semester (
  id uuid primary key default gen_random_uuid(),
  siswa_nisn text not null,
  siswa_nama text,
  program text not null,
  kelas text not null,
  tahun_ajaran text not null,
  semester text not null check (semester in ('Ganjil','Genap')),
  sikap text check (sikap in ('A','B','C','D')),
  sakit integer not null default 0 check (sakit >= 0),
  izin integer not null default 0 check (izin >= 0),
  alpa integer not null default 0 check (alpa >= 0),
  catatan text,
  updated_at timestamptz default now(),
  unique (siswa_nisn, program, kelas, tahun_ajaran, semester)
);
alter table catatan_siswa_semester enable row level security;
drop policy if exists "guru login bisa akses catatan siswa semester" on catatan_siswa_semester;
create policy "guru login bisa akses catatan siswa semester" on catatan_siswa_semester for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
