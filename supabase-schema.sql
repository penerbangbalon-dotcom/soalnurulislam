-- ============================================================
-- SKEMA DATABASE: Generator Soal UTS/UAS - PKBM Nurul Islam
-- Jalankan di Supabase SQL Editor (project yang sama dengan
-- aplikasi absensi, supaya bisa pakai tabel siswa yang sama)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- MATA PELAJARAN ----------
create table if not exists mata_pelajaran (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  program text not null check (program in ('Paket B','Paket C')),
  kelas text check (kelas in ('VII','VIII','IX','X','XI','XII')),
  tidak_diujikan boolean not null default false,
  created_at timestamptz default now()
);

-- ---------- BANK SOAL ----------
create table if not exists bank_soal (
  id uuid primary key default gen_random_uuid(),
  mapel_id uuid references mata_pelajaran(id) on delete cascade,
  jenis text not null check (jenis in ('pilihan_ganda','essay','isian_singkat')),
  tingkat_kesulitan text default 'sedang' check (tingkat_kesulitan in ('mudah','sedang','sulit')),
  topik text,
  pertanyaan text not null,
  opsi_a text,
  opsi_b text,
  opsi_c text,
  opsi_d text,
  opsi_e text,
  kunci_jawaban text,
  poin numeric default 1,
  sumber text default 'manual' check (sumber in ('manual','ai')),
  dibuat_oleh text,
  created_at timestamptz default now()
);

-- ---------- PAKET UJIAN (UTS/UAS) ----------
create table if not exists paket_ujian (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  jenis_ujian text not null check (jenis_ujian in ('UTS','UAS','Ulangan Harian')),
  mapel_id uuid references mata_pelajaran(id),
  kelas text,
  program text check (program in ('Paket B','Paket C')),
  semester text,
  tahun_ajaran text,
  durasi_menit integer default 90,
  acak_soal boolean default false,
  status text default 'draft' check (status in ('draft','siap','ditutup')),
  kode_akses text unique,
  dibuat_oleh text,
  created_at timestamptz default now()
);

-- ---------- RELASI SOAL DALAM PAKET ----------
create table if not exists paket_soal (
  id uuid primary key default gen_random_uuid(),
  paket_ujian_id uuid references paket_ujian(id) on delete cascade,
  soal_id uuid references bank_soal(id) on delete cascade,
  nomor integer not null,
  poin numeric default 1
);

-- ---------- SESI UJIAN SISWA ----------
create table if not exists sesi_ujian (
  id uuid primary key default gen_random_uuid(),
  paket_ujian_id uuid references paket_ujian(id),
  siswa_nisn text not null,
  siswa_nama text not null,
  waktu_mulai timestamptz default now(),
  waktu_selesai timestamptz,
  status text default 'berlangsung' check (status in ('berlangsung','selesai','dinilai')),
  total_skor numeric,
  created_at timestamptz default now(),
  unique (paket_ujian_id, siswa_nisn)
);

-- ---------- DETAIL JAWABAN SISWA ----------
create table if not exists detail_jawaban (
  id uuid primary key default gen_random_uuid(),
  sesi_ujian_id uuid references sesi_ujian(id) on delete cascade,
  soal_id uuid references bank_soal(id),
  jawaban text,
  skor numeric,
  perlu_nilai_manual boolean default false
);

-- ---------- CATATAN NOMOR PIAGAM (supaya nomor urut resmi, tidak dobel) ----------
-- Nomor urut dihitung dari urutan alfabet nama siswa per kelas & jenjang (bukan
-- urutan cetak), makanya unik-nya per (tahun, kelas, program, siswa), bukan per
-- (tahun, nomor_urut) — dua kelas berbeda boleh sama-sama punya nomor 001.
create table if not exists piagam_log (
  id uuid primary key default gen_random_uuid(),
  tahun integer not null,
  kelas text,
  program text,
  nomor_urut integer not null,
  siswa_nisn text not null,
  siswa_nama text not null,
  created_at timestamptz default now(),
  unique (tahun, kelas, program, siswa_nisn)
);

-- ---------- TANDA TANGAN DIGITAL (KEPALA PKBM & WALI KELAS) ----------
-- Gambar tanda tangan (JPG/PNG) disimpan sebagai data URI base64, supaya Rapor &
-- Piagam bisa dicetak tanpa perlu ditandatangani manual. kelas diisi '' (bukan
-- NULL) khusus untuk baris Kepala PKBM, supaya (jenis, kelas) tetap unik.
create table if not exists pengaturan_ttd (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('kepala_pkbm','wali_kelas')),
  kelas text not null default '',
  nama text,
  ttd_base64 text,
  updated_at timestamptz default now(),
  unique (jenis, kelas)
);

-- ---------- INDEX ----------
create index if not exists idx_bank_soal_mapel on bank_soal(mapel_id);
create index if not exists idx_paket_soal_paket on paket_soal(paket_ujian_id);
create index if not exists idx_sesi_ujian_paket on sesi_ujian(paket_ujian_id);
create index if not exists idx_detail_jawaban_sesi on detail_jawaban(sesi_ujian_id);

-- ---------- ROW LEVEL SECURITY ----------
-- Guru login pakai Supabase Auth. Siswa akses ujian tanpa akun
-- (pakai kode akses + NISN), jadi endpoint terkait ujian dibuka
-- lewat Netlify Function (service role), bukan langsung dari
-- browser siswa.
alter table mata_pelajaran enable row level security;
alter table bank_soal enable row level security;
alter table paket_ujian enable row level security;
alter table paket_soal enable row level security;
alter table sesi_ujian enable row level security;
alter table detail_jawaban enable row level security;
alter table piagam_log enable row level security;
alter table pengaturan_ttd enable row level security;

create policy "guru login bisa akses semua" on mata_pelajaran for all using (auth.role() = 'authenticated');
create policy "guru login bisa akses semua" on bank_soal for all using (auth.role() = 'authenticated');
create policy "guru login bisa akses semua" on paket_ujian for all using (auth.role() = 'authenticated');
create policy "guru login bisa akses semua" on paket_soal for all using (auth.role() = 'authenticated');
create policy "guru login bisa lihat semua" on sesi_ujian for select using (auth.role() = 'authenticated');
create policy "guru login bisa lihat semua" on detail_jawaban for select using (auth.role() = 'authenticated');
create policy "guru login bisa nilai manual" on detail_jawaban for update using (auth.role() = 'authenticated');
create policy "guru login bisa update sesi" on sesi_ujian for update using (auth.role() = 'authenticated');
create policy "guru login bisa akses catatan piagam" on piagam_log for all using (auth.role() = 'authenticated');
create policy "guru login bisa akses ttd" on pengaturan_ttd for all using (auth.role() = 'authenticated');

-- Catatan: insert ke sesi_ujian & detail_jawaban dari halaman siswa
-- dilakukan lewat Netlify Function memakai SUPABASE_SERVICE_ROLE_KEY,
-- jadi tidak perlu policy insert publik di sini.
