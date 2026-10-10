-- ============================================================
-- MIGRASI v16 — TUGAS TULIS ONLINE + SYARAT RAPOR + KEHADIRAN SEBAGAI KOMPONEN NILAI
-- Jalankan SEKALI di Supabase SQL Editor. Aman dijalankan ulang (idempotent).
-- Hanya MENAMBAH tabel / kolom baru; data lama tidak diubah.
-- Prasyarat: migrasi-v7.sql (tabel pengaturan_nilai) sudah dijalankan.
-- ============================================================

-- 1) TUGAS (uraian tulis, bukan soal bank soal)
--    Mapel, jenjang, kelas, semester, dan tahun ajaran disalin ke baris tugas, sehingga nilai tugas tetap
--    terbaca walau data mapel diubah kemudian.
create table if not exists public.tugas (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  instruksi text not null,
  mapel_id uuid references public.mata_pelajaran(id) on delete set null,
  mapel_nama text not null,
  program text not null check (program in ('Paket B','Paket C')),
  kelas text not null check (kelas in ('VII','VIII','IX','X','XI','XII')),
  jurusan text check (jurusan is null or jurusan in ('IPA','IPS')),
  semester text not null check (semester in ('Ganjil','Genap')),
  tahun_ajaran text not null,
  status text not null default 'draft' check (status in ('draft','dibuka','ditutup')),
  batas_waktu timestamptz,                       -- tenggat (boleh kosong = tanpa tenggat)
  terima_terlambat boolean not null default true, -- true: tetap bisa dikumpulkan setelah tenggat (ditandai terlambat)
  wajib boolean not null default true,           -- false = tugas tambahan (bonus): hanya dihitung bila dikerjakan
  nilai_maks numeric not null default 100 check (nilai_maks > 0),
  min_kata integer not null default 0 check (min_kata >= 0),
  maks_kata integer not null default 0 check (maks_kata >= 0),  -- 0 = tanpa batas
  batas_pelanggaran integer not null default 3 check (batas_pelanggaran >= 0), -- 0 = hanya dicatat
  dibuat_oleh text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tugas_kelas on public.tugas(program, kelas, tahun_ajaran, semester);

-- 2) JAWABAN TUGAS SISWA
create table if not exists public.tugas_jawaban (
  id uuid primary key default gen_random_uuid(),
  tugas_id uuid not null references public.tugas(id) on delete cascade,
  siswa_nisn text not null,
  siswa_nama text,
  jawaban text not null default '',
  jumlah_kata integer not null default 0,
  status text not null default 'draf' check (status in ('draf','dikumpulkan','dinilai','dibebaskan')),
  skor numeric check (skor is null or skor >= 0),          -- skala 0..nilai_maks tugas
  catatan_guru text,
  pelanggaran integer not null default 0,
  alasan_pelanggaran jsonb not null default '[]'::jsonb,
  terlambat boolean not null default false,
  diakhiri_otomatis boolean not null default false,        -- true = dikumpulkan otomatis karena batas pelanggaran
  mode text not null default 'online' check (mode in ('online','manual')),
  dimulai_pada timestamptz not null default now(),
  terakhir_disimpan timestamptz,
  dikumpulkan_pada timestamptz,
  dinilai_pada timestamptz,
  dinilai_oleh text,
  created_at timestamptz not null default now(),
  unique (tugas_id, siswa_nisn)
);
create index if not exists idx_tugas_jawaban_tugas on public.tugas_jawaban(tugas_id);
create index if not exists idx_tugas_jawaban_nisn on public.tugas_jawaban(siswa_nisn);

-- 3) RLS: guru yang login boleh mengelola; siswa tidak punya akses langsung
--    (siswa lewat fungsi server /api/tugas-siswa memakai service role).
alter table public.tugas enable row level security;
alter table public.tugas_jawaban enable row level security;
drop policy if exists "guru login bisa akses tugas" on public.tugas;
create policy "guru login bisa akses tugas" on public.tugas for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "guru login bisa akses jawaban tugas" on public.tugas_jawaban;
create policy "guru login bisa akses jawaban tugas" on public.tugas_jawaban for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 4) Pengaturan SYARAT RAPOR (satu baris pengaturan_nilai yang sama dengan bobot & KKM)
--    ujian.aktif/jenis/min_persen : persentase ujian (paket siap/ditutup) yang sudah diikuti siswa
--    tugas.aktif/min_persen       : persentase tugas wajib yang sudah dikumpulkan
--    hadir.aktif/min_persen       : persentase kehadiran minimum
alter table public.pengaturan_nilai add column if not exists syarat_rapor jsonb not null default
  '{"ujian":{"aktif":true,"jenis":["UTS","UAS","Ulangan Harian"],"min_persen":100},"tugas":{"aktif":true,"min_persen":100},"hadir":{"aktif":true,"min_persen":75}}'::jsonb;

-- 5) Bobot Nilai Akhir kini mengenal komponen "hadir" (Kehadiran). Bobot bawaan 0 sehingga nilai lama TIDAK berubah
--    sampai admin mengisinya di menu Pengaturan Nilai. (Bobot disimpan di kolom jsonb yang sudah ada; tidak perlu ubah skema.)
update public.pengaturan_nilai
   set bobot = bobot || '{"hadir":0}'::jsonb
 where id = 'umum' and not (bobot ? 'hadir');
