-- ============================================================
-- v14.3 — Ekstrakurikuler (nilai per siswa per semester) + NIP pada tanda tangan
-- Jalankan SEKALI di Supabase SQL Editor (aman diulang). Data lama tidak berubah.
-- ============================================================

-- 1) Nilai ekstrakurikuler: satu baris = satu kegiatan milik satu siswa pada satu semester.
create table if not exists ekstrakurikuler_siswa (
  id uuid primary key default gen_random_uuid(),
  siswa_nisn text not null,
  siswa_nama text,
  program text not null,
  kelas text not null,
  tahun_ajaran text not null,
  semester text not null check (semester in ('Ganjil','Genap')),
  kegiatan text not null,                                   -- mis. Pramuka
  predikat text not null check (predikat in ('A','B','C','D')),   -- A Sangat Baik, B Baik, C Cukup, D Kurang
  keterangan text,                                          -- kosong = kalimat otomatis di rapor
  updated_at timestamptz default now(),
  unique (siswa_nisn, program, kelas, tahun_ajaran, semester, kegiatan)
);
create index if not exists idx_ekskul_kelas on ekstrakurikuler_siswa(program, kelas, tahun_ajaran, semester);

alter table ekstrakurikuler_siswa enable row level security;
drop policy if exists "guru login bisa akses ekskul siswa" on ekstrakurikuler_siswa;
create policy "guru login bisa akses ekskul siswa" on ekstrakurikuler_siswa for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 2) NIP Kepala dan Wali Kelas (dicetak di bawah nama pada Rapor Semester)
alter table pengaturan_ttd add column if not exists nip text;
