-- ============================================================
-- MIGRASI 03 — Kalender Hari Libur (agar Rekap/Persentase/Rapor akurat)
-- Jalankan SEKALI di Supabase SQL Editor, SETELAH migration_02.
-- Aman dijalankan ulang.
-- ============================================================

-- ---------- 1) Tabel Hari Libur ----------
-- Tanpa tabel ini, rekap_kehadiran() menganggap SEMUA hari kerja (sesuai
-- hari_aktif) sebagai hari efektif sekolah -- termasuk libur nasional,
-- cuti bersama, libur semester, dll -- sehingga siswa akan tercatat Alpa
-- secara keliru di hari-hari tersebut.
create table if not exists hari_libur (
  tanggal date primary key,
  keterangan text not null,
  created_at timestamptz not null default now()
);
alter table hari_libur enable row level security;
-- (tidak ada "create policy" -> anon/authenticated ditolak semua; service_role selalu bypass RLS)

-- ---------- 2) Data awal: Libur Nasional & Cuti Bersama 2026 ----------
-- Sumber: SKB 3 Menteri (Menteri Agama, Menteri Ketenagakerjaan, Menteri PANRB)
-- Nomor 1497/2025, 2/2025, 5/2025, ditetapkan 19 September 2025.
-- Silakan tambah/hapus tanggal libur khusus sekolah (libur semester, dsb.)
-- lewat menu Pengaturan Sekolah -> Kalender Hari Libur di aplikasi.
insert into hari_libur (tanggal, keterangan) values
  ('2026-01-01', 'Tahun Baru Masehi'),
  ('2026-01-16', 'Isra Mi''raj Nabi Muhammad SAW'),
  ('2026-02-16', 'Cuti Bersama Tahun Baru Imlek'),
  ('2026-02-17', 'Tahun Baru Imlek 2577 Kongzili'),
  ('2026-03-18', 'Cuti Bersama Hari Suci Nyepi'),
  ('2026-03-19', 'Hari Suci Nyepi (Tahun Baru Saka 1948)'),
  ('2026-03-20', 'Cuti Bersama Idul Fitri'),
  ('2026-03-21', 'Idul Fitri 1447 H (Hari Pertama)'),
  ('2026-03-22', 'Idul Fitri 1447 H (Hari Kedua)'),
  ('2026-03-23', 'Cuti Bersama Idul Fitri'),
  ('2026-03-24', 'Cuti Bersama Idul Fitri'),
  ('2026-04-03', 'Wafat Yesus Kristus'),
  ('2026-04-05', 'Kebangkitan Yesus Kristus (Paskah)'),
  ('2026-05-01', 'Hari Buruh Internasional'),
  ('2026-05-14', 'Kenaikan Yesus Kristus'),
  ('2026-05-15', 'Cuti Bersama Kenaikan Yesus Kristus'),
  ('2026-05-27', 'Idul Adha 1447 H'),
  ('2026-05-28', 'Cuti Bersama Idul Adha'),
  ('2026-05-31', 'Hari Raya Waisak 2570 BE'),
  ('2026-06-01', 'Hari Lahir Pancasila'),
  ('2026-06-16', 'Tahun Baru Islam 1448 H'),
  ('2026-08-17', 'Hari Kemerdekaan RI'),
  ('2026-08-25', 'Maulid Nabi Muhammad SAW'),
  ('2026-12-24', 'Cuti Bersama Hari Raya Natal'),
  ('2026-12-25', 'Hari Raya Natal')
on conflict (tanggal) do nothing;

-- ---------- 3) Perbarui rekap_kehadiran() supaya mengecualikan hari libur ----------
drop function if exists rekap_kehadiran(date, date, uuid, text, program_t);
create or replace function rekap_kehadiran(
  p_start date,
  p_end date,
  p_student_id uuid default null,
  p_kelas text default null,
  p_program program_t default null
)
returns table (
  student_id uuid,
  nisn text,
  nama text,
  jenjang jenjang_t,
  program program_t,
  kelas text,
  total_hari int,
  hadir int,
  terlambat int,
  izin int,
  sakit int,
  alpa int,
  persentase numeric
)
language plpgsql
stable
as $$
declare
  v_hari_aktif int[];
  v_boundary date;
begin
  select hari_aktif into v_hari_aktif from school_settings where id = 1;
  if v_hari_aktif is null then
    v_hari_aktif := '{1,2,3,4,5,6}';
  end if;

  v_boundary := least(p_end, ((now() at time zone 'Asia/Jakarta')::date - 1));
  if v_boundary < p_start then
    v_boundary := p_start - 1;
  end if;

  return query
  with hari_efektif as (
    select d::date as tanggal
    from generate_series(p_start, v_boundary, interval '1 day') as d
    where extract(isodow from d)::int = any (v_hari_aktif)
      and not exists (select 1 from hari_libur hl where hl.tanggal = d::date)
  ),
  target_siswa as (
    select s.id, s.nisn, s.nama, s.jenjang, s.program, s.kelas
    from students s
    where s.status = 'AKTIF'
      and (p_student_id is null or s.id = p_student_id)
      and (p_kelas is null or s.kelas = p_kelas)
      and (p_program is null or s.program = p_program)
  ),
  gabung as (
    select
      ts.id as student_id,
      he.tanggal,
      a.checkin_status
    from target_siswa ts
    cross join hari_efektif he
    left join attendance a
      on a.student_id = ts.id and a.tanggal = he.tanggal
  ),
  dihitung as (
    select
      g.student_id,
      count(*) as total_hari,
      count(*) filter (where g.checkin_status in ('HADIR', 'TERLAMBAT')) as hadir,
      count(*) filter (where g.checkin_status = 'TERLAMBAT') as terlambat,
      count(*) filter (where g.checkin_status = 'IZIN') as izin,
      count(*) filter (where g.checkin_status = 'SAKIT') as sakit,
      count(*) filter (
        where g.checkin_status is null
           or g.checkin_status not in ('HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT')
      ) as alpa
    from gabung g
    group by g.student_id
  )
  select
    ts.id,
    ts.nisn,
    ts.nama,
    ts.jenjang,
    ts.program,
    ts.kelas,
    coalesce(d.total_hari, 0)::int,
    coalesce(d.hadir, 0)::int,
    coalesce(d.terlambat, 0)::int,
    coalesce(d.izin, 0)::int,
    coalesce(d.sakit, 0)::int,
    coalesce(d.alpa, 0)::int,
    case when coalesce(d.total_hari, 0) = 0 then 0
         else round(coalesce(d.hadir, 0)::numeric / d.total_hari * 100, 1)
    end as persentase
  from target_siswa ts
  left join dihitung d on d.student_id = ts.id
  order by ts.nama;
end;
$$;
