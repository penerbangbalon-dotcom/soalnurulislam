-- ============================================================
-- MIGRASI 02 — Rekap & Persentase Kehadiran Otomatis, Rapor Semester,
--              dan Absen Manual oleh Super Admin.
-- Jalankan file ini SEKALI di Supabase SQL Editor, setelah schema.sql.
-- Aman dijalankan ulang (pakai IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- ---------- 1) FUNGSI rekap_kehadiran ----------
-- PENTING: fungsi ini sebenarnya SUDAH dipanggil oleh kode yang ada
-- (admin-persentase.js, siswa-riwayat.js) tapi belum pernah dibuat di
-- database pada file schema.sql sebelumnya — jadi fitur Persentase
-- Kehadiran & Riwayat Siswa akan gagal (error 500) tanpa migrasi ini.
--
-- Untuk setiap siswa AKTIF (bisa difilter per siswa/kelas/program), fungsi
-- ini menghitung, dalam rentang [p_start, p_end], HANYA hari-hari sekolah
-- yang sudah lewat (mengikuti school_settings.hari_aktif):
--   total_hari : jumlah hari efektif tsb
--   hadir      : status HADIR + TERLAMBAT
--   terlambat  : khusus status TERLAMBAT (subset dari hadir)
--   izin       : status IZIN
--   sakit      : status SAKIT
--   alpa       : status lain / tidak ada catatan absensi sama sekali
--   persentase : hadir / total_hari * 100 (1 desimal)
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

  -- Jangan hitung hari yang belum lewat (hari ini dianggap "belum selesai").
  v_boundary := least(p_end, ((now() at time zone 'Asia/Jakarta')::date - 1));
  if v_boundary < p_start then
    v_boundary := p_start - 1; -- rentang seluruhnya di masa depan -> 0 hari efektif
  end if;

  return query
  with hari_efektif as (
    select d::date as tanggal
    from generate_series(p_start, v_boundary, interval '1 day') as d
    where extract(isodow from d)::int = any (v_hari_aktif)
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

-- ---------- 2) TEMPLAT DESKRIPSI KEHADIRAN (dapat diedit admin) ----------
-- Kalimat penilaian yang muncul di Rekap Semester / Lampiran Rapor.
-- Placeholder yang didukung: {nama}
-- Admin dapat mengubah kata-katanya sendiri lewat menu Pengaturan Sekolah.
alter table school_settings
  add column if not exists templat_deskripsi_sangat_baik text not null
    default 'Ananda {nama} menunjukkan kedisiplinan kehadiran yang sangat baik dan patut dipertahankan.',
  add column if not exists templat_deskripsi_baik text not null
    default 'Ananda {nama} menunjukkan kedisiplinan kehadiran yang baik dan diharapkan dapat terus ditingkatkan.',
  add column if not exists templat_deskripsi_cukup text not null
    default 'Kedisiplinan kehadiran ananda {nama} tergolong cukup dan masih perlu ditingkatkan pada semester berikutnya.',
  add column if not exists templat_deskripsi_kurang text not null
    default 'Tingkat kehadiran ananda {nama} masih kurang dan memerlukan perhatian serta kerja sama orang tua/wali.';

-- ---------- 3) Index bantu pencarian siswa tanpa No. HP (untuk Absen Manual) ----------
create index if not exists idx_students_hp on students ((coalesce(hp, '')));
