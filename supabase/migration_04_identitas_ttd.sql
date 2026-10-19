-- ============================================================
-- MIGRASI 04 — Identitas Yayasan/PKBM & Tanda Tangan untuk
--              Rekap Semester (Rapor).
-- Jalankan SEKALI di Supabase SQL Editor, SETELAH migration_03.
-- Aman dijalankan ulang (pakai IF NOT EXISTS).
-- ============================================================

-- ---------- 1) Identitas kop surat & Kepala PKBM ----------
-- Field ini dipakai untuk mencetak kop Laporan Hasil Absensi Siswa
-- (Rekap Semester / Lampiran Rapor) persis seperti format lama:
--   Yayasan -> Nama PKBM -> NPSN -> SK Kemenhukum -> Ijin Operasional -> Alamat
alter table school_settings
  add column if not exists yayasan_nama text,
  add column if not exists npsn text,
  add column if not exists sk_kemenhukum text,
  add column if not exists ijin_operasional text,
  add column if not exists kota_ttd text not null default 'Karawang',
  add column if not exists kepala_pkbm_nama text,
  add column if not exists kepala_pkbm_ttd text,          -- data URL PNG (base64), null = belum ada tanda tangan
  add column if not exists kepala_pkbm_ttd_lebar int not null default 140;

-- ---------- 2) Tanda tangan Wali Kelas per Kelas ----------
-- "Kelas" pada tabel students berupa teks bebas (mis. "10", "11 IPA"),
-- jadi pemetaan wali kelas juga per teks kelas tsb, bisa ditambah manual
-- oleh admin lewat menu Rekap Semester (Rapor) -> Kelola Tanda Tangan.
create table if not exists wali_kelas (
  kelas text primary key,
  nama text,
  ttd text,                              -- data URL PNG (base64), null = belum ada tanda tangan
  ttd_lebar int not null default 140,
  updated_at timestamptz not null default now()
);
alter table wali_kelas enable row level security;
-- (tidak ada "create policy" -> anon/authenticated ditolak semua; service_role selalu bypass RLS)
