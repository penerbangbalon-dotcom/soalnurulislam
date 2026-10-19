-- ============================================================
-- SISTEM ABSENSI SISWA — PKBM NURUL ISLAM
-- Jalankan file ini di Supabase SQL Editor (satu kali, saat setup).
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---------- ENUM TYPES ----------
create type jenjang_t as enum ('SD', 'SMP', 'SMA');
create type program_t as enum ('UMUM', 'PAKET_B', 'PAKET_C');
create type admin_role_t as enum ('SUPER_ADMIN', 'ADMIN');
create type sesi_t as enum ('DATANG', 'PULANG');
create type token_type_t as enum ('QR', 'MANUAL');
create type kehadiran_status_t as enum
  ('BELUM_ABSEN','HADIR','TERLAMBAT','SUDAH_PULANG','TIDAK_HADIR','IZIN','SAKIT','PERLU_VERIFIKASI');

-- ---------- SCHOOL SETTINGS (single row) ----------
create table school_settings (
  id int primary key default 1,
  nama_sekolah text not null default 'PKBM Nurul Islam',
  alamat text,
  latitude double precision,
  longitude double precision,
  radius_m int not null default 100 check (radius_m between 50 and 100),
  gps_accuracy_max_m int not null default 50,
  selfie_wajib boolean not null default false,
  timezone text not null default 'Asia/Jakarta',
  hari_aktif int[] not null default '{1,2,3,4,5,6}', -- 1=Senin..7=Minggu
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into school_settings (id) values (1) on conflict (id) do nothing;

-- ---------- PROGRAM SCHEDULES ----------
create table program_schedules (
  id uuid primary key default uuid_generate_v4(),
  program program_t not null unique,
  jam_masuk_mulai time not null,
  jam_masuk_selesai time not null,
  jam_pulang time not null,
  toleransi_menit int not null default 15,
  updated_at timestamptz not null default now()
);
insert into program_schedules (program, jam_masuk_mulai, jam_masuk_selesai, jam_pulang, toleransi_menit) values
  ('PAKET_B', '07:00', '08:00', '12:00', 15),
  ('PAKET_C', '12:30', '13:15', '17:00', 15)
on conflict (program) do nothing;

-- ---------- ADMINS ----------
create table admins (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  nama text not null,
  role admin_role_t not null default 'ADMIN',
  password_hash text not null,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- STUDENTS ----------
create table students (
  id uuid primary key default uuid_generate_v4(),
  nisn text unique, -- null sementara untuk siswa tanpa NISN (lihat kolom butuh_konfirmasi)
  nipd text,
  nama text not null,
  jk text check (jk in ('L','P')),
  jenjang jenjang_t not null,
  program program_t not null default 'UMUM',
  kelas text not null,
  tempat_lahir text,
  tanggal_lahir date,
  alamat text,
  hp text,
  status text not null default 'AKTIF' check (status in ('AKTIF','NONAKTIF')),
  foto_url text,
  password_hash text,
  must_change_password boolean not null default true,
  butuh_konfirmasi_admin boolean not null default false,
  catatan_konfirmasi text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_students_nisn on students(nisn);
create index idx_students_jenjang_program on students(jenjang, program);
create index idx_students_nama on students using gin (to_tsvector('simple', nama));

-- ---------- ATTENDANCE SESSIONS (token / QR yang berotasi) ----------
create table attendance_sessions (
  id uuid primary key default uuid_generate_v4(),
  tanggal date not null default (now() at time zone 'Asia/Jakarta')::date,
  program program_t not null,
  sesi sesi_t not null,
  token text not null,
  token_type token_type_t not null default 'QR',
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  issued_by uuid references admins(id),
  is_active boolean not null default true,
  auto_rotate boolean not null default true
);
create index idx_sessions_active on attendance_sessions(program, sesi, is_active, expires_at);

-- ---------- ATTENDANCE (1 baris per siswa per hari) ----------
create table attendance (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  tanggal date not null,

  checkin_time timestamptz,
  checkin_status kehadiran_status_t,
  checkin_lat double precision,
  checkin_lng double precision,
  checkin_distance_m numeric,
  checkin_accuracy_m numeric,
  checkin_session_id uuid references attendance_sessions(id),
  checkin_photo_url text,
  checkin_device jsonb,

  checkout_time timestamptz,
  checkout_status kehadiran_status_t,
  checkout_lat double precision,
  checkout_lng double precision,
  checkout_distance_m numeric,
  checkout_accuracy_m numeric,
  checkout_session_id uuid references attendance_sessions(id),
  checkout_photo_url text,
  checkout_device jsonb,

  keterangan text, -- Izin / Sakit / catatan admin
  set_by_admin uuid references admins(id),
  verified_by_admin boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, tanggal)
);
create index idx_attendance_tanggal on attendance(tanggal);
create index idx_attendance_student on attendance(student_id);

-- ---------- AUDIT LOG ----------
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_type text not null check (actor_type in ('SISWA','ADMIN','SYSTEM')),
  actor_id uuid,
  actor_label text,
  action text not null,
  detail jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index idx_audit_created on audit_logs(created_at desc);

-- ---------- SECURITY EVENTS (anti-kecurangan) ----------
create table attendance_security_events (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id),
  event_type text not null, -- OUT_OF_RADIUS, LOW_ACCURACY, MOCK_LOCATION, INVALID_TOKEN, DUPLICATE_ATTEMPT, RATE_LIMIT
  detail jsonb,
  created_at timestamptz not null default now()
);
create index idx_security_created on attendance_security_events(created_at desc);

-- ---------- RATE LIMIT (percobaan login/absen) ----------
create table rate_limits (
  id uuid primary key default uuid_generate_v4(),
  bucket text not null, -- ex: 'login:<nisn>' atau 'checkin:<student_id>'
  created_at timestamptz not null default now()
);
create index idx_rate_bucket on rate_limits(bucket, created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY: kunci total dari browser.
-- Semua akses HARUS lewat Netlify Functions memakai SERVICE ROLE KEY.
-- anon / authenticated key TIDAK diberi policy apa pun (default deny).
-- ============================================================
alter table school_settings enable row level security;
alter table program_schedules enable row level security;
alter table admins enable row level security;
alter table students enable row level security;
alter table attendance_sessions enable row level security;
alter table attendance enable row level security;
alter table audit_logs enable row level security;
alter table attendance_security_events enable row level security;
alter table rate_limits enable row level security;
-- (tidak ada "create policy" -> berarti anon/authenticated ditolak semua; service_role selalu bypass RLS)
