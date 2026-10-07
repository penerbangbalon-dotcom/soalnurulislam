-- ============================================================
-- MIGRASI v11 — KEAMANAN & IDENTITAS SEKOLAH
-- Jalankan sekali di Supabase SQL Editor. Aman dijalankan ulang.
-- ============================================================

-- 1) Pembatas percobaan masuk siswa (anti tebak NISN/PIN/kode akses).
--    Hanya diakses oleh server (service_role); tidak ada policy = tidak bisa dibaca dari browser.
create table if not exists public.percobaan_masuk_siswa (
  id bigserial primary key,
  kunci text not null,
  waktu timestamptz not null default now()
);
create index if not exists percobaan_masuk_siswa_kunci_waktu on public.percobaan_masuk_siswa (kunci, waktu);
alter table public.percobaan_masuk_siswa enable row level security;

-- 2) Identitas sekolah (kop surat, rapor, kartu, dst). Satu baris (id = 1) untuk saat ini.
--    Siapa pun yang login boleh membaca; hanya ADMIN yang boleh mengubah.
--    Peran admin disimpan di app_metadata.role (hanya bisa diubah lewat server).
create table if not exists public.pengaturan_sekolah (
  id int primary key default 1 check (id = 1),
  nama_yayasan text,
  nama_lembaga text,       -- mis. PUSAT KEGIATAN BELAJAR MASYARAKAT (PKBM)
  nama_singkat text,       -- mis. NURUL ISLAM (judul besar di kop)
  nama_aplikasi text,      -- mis. PKBM Nurul Islam
  npsn text,
  sk_pendirian text,
  ijin_operasional text,
  alamat text,
  kota_ttd text,           -- kota di tanda tangan, mis. Karawang
  jabatan_kepala text,     -- mis. Kepala PKBM Nurul Islam
  logo_url text,           -- bila kosong dipakai logo.png
  updated_at timestamptz default now()
);
alter table public.pengaturan_sekolah enable row level security;

drop policy if exists "login boleh baca identitas sekolah" on public.pengaturan_sekolah;
create policy "login boleh baca identitas sekolah" on public.pengaturan_sekolah
  for select using (auth.role() = 'authenticated');

-- Halaman ujian siswa (belum login) hanya perlu nama & logo; izinkan baca publik.
drop policy if exists "publik boleh baca identitas sekolah" on public.pengaturan_sekolah;
create policy "publik boleh baca identitas sekolah" on public.pengaturan_sekolah
  for select using (true);

drop policy if exists "admin boleh ubah identitas sekolah" on public.pengaturan_sekolah;
create policy "admin boleh ubah identitas sekolah" on public.pengaturan_sekolah
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Isi awal = data PKBM Nurul Islam saat ini (supaya tampilan tidak berubah).
insert into public.pengaturan_sekolah
  (id, nama_yayasan, nama_lembaga, nama_singkat, nama_aplikasi, npsn, sk_pendirian, ijin_operasional, alamat, kota_ttd, jabatan_kepala)
values
  (1, 'YAYASAN NURUL ISLAM SINDANGPALAY', 'PUSAT KEGIATAN BELAJAR MASYARAKAT (PKBM)', 'NURUL ISLAM', 'PKBM Nurul Islam',
   'P9934650', 'AHU-0011701.AH.01.04',
   '503/3278/23/IMPBM/VIII/DPMPTSP/2020-No. SK. Penyelenggaraan : 421.9/SK-IO-PKBM-001.2/PAUD-DIKMAS',
   'Dusun Sindangpalay RT. 009 RW. 003 Desa Pasirmukti Kec. Telagasari Kab. Karawang . 41381',
   'Karawang', 'Kepala PKBM Nurul Islam')
on conflict (id) do nothing;
