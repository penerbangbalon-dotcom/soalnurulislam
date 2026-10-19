-- ============================================================
-- MIGRASI 06 — Muatan Mapel per kelas (untuk Generate Jadwal Otomatis)
--              + penggabungan kelas Paket C menjadi 10, 11, 12.
-- Jalankan SEKALI di Supabase SQL Editor, SETELAH migration_05.
-- Aman dijalankan ulang.
-- ============================================================

-- ---------- 1) Muatan mapel (JP per minggu) per grup kelas ----------
-- Kelas yang belum punya baris di sini otomatis memakai muatan bawaan aplikasi
-- (bisa diubah di menu Jadwal Pelajaran -> Generate Otomatis).
-- Catatan aturan: Muatan Lokal maksimal 2 JP per minggu (dicek juga di server).
create table if not exists absensi_muatan_mapel (
  id uuid primary key default uuid_generate_v4(),
  kelas_grup text not null,
  mapel text not null,
  jp int not null check (jp between 1 and 20),
  urut int not null default 500,
  updated_at timestamptz not null default now(),
  unique (kelas_grup, mapel)
);
create index if not exists idx_absensi_muatan_kelas on absensi_muatan_mapel(kelas_grup);
alter table absensi_muatan_mapel enable row level security;

-- ---------- 2) Dropdown mapel: tambah "Mata Pelajaran Pilihan" (Paket C) ----------
insert into absensi_mapel (nama, program, kelompok, urut) values
  ('Mata Pelajaran Pilihan','PAKET_C','Umum',115)
on conflict (nama) do nothing;

-- ---------- 3) Paket C: "10 IPA"/"10 IPS" -> "10", "11 IPA"/"11 IPS" -> "11", dst ----------
-- Jadwal mapel yang sudah tersimpan dengan nama grup lama dipindah ke grup baru.
-- Bila IPA dan IPS sama-sama sudah punya jadwal, yang dipakai adalah baris pertama
-- yang ditemukan per (hari, jam) — periksa ulang hasilnya di menu Jadwal Pelajaran.
insert into absensi_jadwal_mapel (kelas_grup, hari, jam_ke, mapel)
select substring(kelas_grup from '^(10|11|12)'), hari, jam_ke, mapel
from absensi_jadwal_mapel
where kelas_grup ~ '^(10|11|12) '
order by kelas_grup
on conflict (kelas_grup, hari, jam_ke) do nothing;

delete from absensi_jadwal_mapel where kelas_grup ~ '^(10|11|12) ';

-- (tidak ada "create policy" -> anon/authenticated ditolak semua; service_role selalu bypass RLS)
