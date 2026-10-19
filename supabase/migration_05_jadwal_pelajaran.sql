-- ============================================================
-- MIGRASI 05 — Jadwal Pelajaran, Jam Belajar, Daftar Mapel,
--              dan Jam Absen Khusus Jumat.
-- Jalankan SEKALI di Supabase SQL Editor, SETELAH migration_04.
-- CATATAN: tabel diberi awalan absensi_ agar tidak bentrok dengan tabel mata_pelajaran
-- milik aplikasi ujian pada database yang sama.
-- Aman dijalankan ulang (pakai IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- Dipakai oleh menu "Jadwal Pelajaran" dan tombol "Rekap Word Harian".
-- ============================================================

-- ---------- 1) Daftar Mata Pelajaran (untuk dropdown) ----------
-- program: SEMUA = tampil di Paket B & C; PAKET_B / PAKET_C = khusus program itu.
-- Daftar awal mengikuti struktur Kurikulum Merdeka pendidikan kesetaraan
-- (kelompok umum + pemberdayaan & keterampilan). Sesuaikan lewat menu
-- Jadwal Pelajaran -> Daftar Mapel (tambah / sembunyikan / hapus).
create table if not exists absensi_mapel (
  id uuid primary key default uuid_generate_v4(),
  nama text not null unique,
  program text not null default 'SEMUA' check (program in ('SEMUA','PAKET_B','PAKET_C')),
  kelompok text not null default 'Umum',
  urut int not null default 500,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);
alter table absensi_mapel enable row level security;

insert into absensi_mapel (nama, program, kelompok, urut) values
  ('Pendidikan Agama dan Budi Pekerti','SEMUA','Umum',10),
  ('Pendidikan Pancasila','SEMUA','Umum',20),
  ('Bahasa Indonesia','SEMUA','Umum',30),
  ('Matematika','SEMUA','Umum',40),
  ('Bahasa Inggris','SEMUA','Umum',50),
  ('IPA (Ilmu Pengetahuan Alam)','PAKET_B','Umum',60),
  ('IPS (Ilmu Pengetahuan Sosial)','PAKET_B','Umum',70),
  ('Seni dan Budaya','SEMUA','Umum',80),
  ('PJOK (Pendidikan Jasmani, Olahraga, dan Kesehatan)','SEMUA','Umum',90),
  ('Informatika','SEMUA','Umum',100),
  ('Sejarah','PAKET_C','Umum',110),
  ('Fisika','PAKET_C','Peminatan IPA',120),
  ('Kimia','PAKET_C','Peminatan IPA',130),
  ('Biologi','PAKET_C','Peminatan IPA',140),
  ('Ekonomi','PAKET_C','Peminatan IPS',150),
  ('Geografi','PAKET_C','Peminatan IPS',160),
  ('Sosiologi','PAKET_C','Peminatan IPS',170),
  ('Antropologi','PAKET_C','Peminatan IPS',180),
  ('Pemberdayaan dan Keterampilan','SEMUA','Pemberdayaan dan Keterampilan',200),
  ('Kewirausahaan','PAKET_C','Pemberdayaan dan Keterampilan',210),
  ('Muatan Lokal (Bahasa Sunda)','SEMUA','Muatan Lokal',220)
on conflict (nama) do nothing;

-- ---------- 2) Jam Belajar (slot jam pelajaran) per program & tipe hari ----------
-- tipe_hari: REGULER = Senin-Kamis, JUMAT = hari Jumat (semua masuk pagi).
-- jenis: PELAJARAN (bernomor "Jam ke-n") atau ISTIRAHAT (tidak bernomor).
-- Default: Paket B 07.30-12.00, Paket C 12.30-17.00, Jumat keduanya pagi 07.30.
-- Semua bisa diubah bebas di menu Jadwal Pelajaran -> Jam Belajar.
create table if not exists absensi_jam_belajar (
  id uuid primary key default uuid_generate_v4(),
  program text not null check (program in ('PAKET_B','PAKET_C')),
  tipe_hari text not null check (tipe_hari in ('REGULER','JUMAT')),
  urut int not null,
  jenis text not null default 'PELAJARAN' check (jenis in ('PELAJARAN','ISTIRAHAT')),
  jam_ke int,
  mulai time not null,
  selesai time not null,
  label text,
  unique (program, tipe_hari, urut)
);
alter table absensi_jam_belajar enable row level security;

insert into absensi_jam_belajar (program, tipe_hari, urut, jenis, jam_ke, mulai, selesai, label) values
  ('PAKET_B','REGULER',1,'PELAJARAN',1,'07:30','08:10','Jam ke-1'),
  ('PAKET_B','REGULER',2,'PELAJARAN',2,'08:10','08:50','Jam ke-2'),
  ('PAKET_B','REGULER',3,'PELAJARAN',3,'08:50','09:30','Jam ke-3'),
  ('PAKET_B','REGULER',4,'ISTIRAHAT',null,'09:30','10:00','Istirahat'),
  ('PAKET_B','REGULER',5,'PELAJARAN',4,'10:00','10:40','Jam ke-4'),
  ('PAKET_B','REGULER',6,'PELAJARAN',5,'10:40','11:20','Jam ke-5'),
  ('PAKET_B','REGULER',7,'PELAJARAN',6,'11:20','12:00','Jam ke-6'),
  ('PAKET_C','REGULER',1,'PELAJARAN',1,'12:30','13:10','Jam ke-1'),
  ('PAKET_C','REGULER',2,'PELAJARAN',2,'13:10','13:50','Jam ke-2'),
  ('PAKET_C','REGULER',3,'PELAJARAN',3,'13:50','14:30','Jam ke-3'),
  ('PAKET_C','REGULER',4,'ISTIRAHAT',null,'14:30','15:00','Istirahat'),
  ('PAKET_C','REGULER',5,'PELAJARAN',4,'15:00','15:40','Jam ke-4'),
  ('PAKET_C','REGULER',6,'PELAJARAN',5,'15:40','16:20','Jam ke-5'),
  ('PAKET_C','REGULER',7,'PELAJARAN',6,'16:20','17:00','Jam ke-6'),
  ('PAKET_B','JUMAT',1,'PELAJARAN',1,'07:30','08:00','Jam ke-1'),
  ('PAKET_B','JUMAT',2,'PELAJARAN',2,'08:00','08:30','Jam ke-2'),
  ('PAKET_B','JUMAT',3,'PELAJARAN',3,'08:30','09:00','Jam ke-3'),
  ('PAKET_B','JUMAT',4,'ISTIRAHAT',null,'09:00','09:15','Istirahat'),
  ('PAKET_B','JUMAT',5,'PELAJARAN',4,'09:15','09:45','Jam ke-4'),
  ('PAKET_B','JUMAT',6,'PELAJARAN',5,'09:45','10:15','Jam ke-5'),
  ('PAKET_B','JUMAT',7,'PELAJARAN',6,'10:15','10:45','Jam ke-6'),
  ('PAKET_C','JUMAT',1,'PELAJARAN',1,'07:30','08:00','Jam ke-1'),
  ('PAKET_C','JUMAT',2,'PELAJARAN',2,'08:00','08:30','Jam ke-2'),
  ('PAKET_C','JUMAT',3,'PELAJARAN',3,'08:30','09:00','Jam ke-3'),
  ('PAKET_C','JUMAT',4,'ISTIRAHAT',null,'09:00','09:15','Istirahat'),
  ('PAKET_C','JUMAT',5,'PELAJARAN',4,'09:15','09:45','Jam ke-4'),
  ('PAKET_C','JUMAT',6,'PELAJARAN',5,'09:45','10:15','Jam ke-5'),
  ('PAKET_C','JUMAT',7,'PELAJARAN',6,'10:15','10:45','Jam ke-6')
on conflict (program, tipe_hari, urut) do nothing;

-- ---------- 3) Jadwal Mapel per Kelas ----------
-- kelas_grup = nama kelas TANPA rombel: "7 A"/"7 B" -> "7", "10 IPS 1"/"10 IPS 2" -> "10 IPS".
-- Satu jadwal dipakai bersama oleh semua rombel dalam grup kelas yang sama.
-- mapel = teks bebas (dari dropdown ATAU isian manual).
create table if not exists absensi_jadwal_mapel (
  id uuid primary key default uuid_generate_v4(),
  kelas_grup text not null,
  hari int not null check (hari between 1 and 5),   -- 1=Senin .. 5=Jumat
  jam_ke int not null check (jam_ke >= 1),
  mapel text not null,
  updated_at timestamptz not null default now(),
  unique (kelas_grup, hari, jam_ke)
);
create index if not exists idx_absensi_jadwal_kelas on absensi_jadwal_mapel(kelas_grup);
alter table absensi_jadwal_mapel enable row level security;

-- ---------- 4) Jam Absen Datang/Pulang KHUSUS JUMAT ----------
-- Jika aktif, hari Jumat memakai jam ini (menggantikan program_schedules).
-- Tanpa ini, siswa Paket C (jam pulang 17.00) tidak bisa absen pulang pada
-- hari Jumat yang masuk pagi.
create table if not exists program_schedules_jumat (
  program program_t primary key,
  jam_masuk_mulai time not null,
  jam_masuk_selesai time not null,
  jam_pulang time not null,
  toleransi_menit int not null default 15,
  aktif boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table program_schedules_jumat enable row level security;

insert into program_schedules_jumat (program, jam_masuk_mulai, jam_masuk_selesai, jam_pulang, toleransi_menit, aktif) values
  ('PAKET_B', '07:00', '08:00', '10:45', 15, true),
  ('PAKET_C', '07:00', '08:00', '10:45', 15, true)
on conflict (program) do nothing;

-- (tidak ada "create policy" -> anon/authenticated ditolak semua; service_role selalu bypass RLS)
