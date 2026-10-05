-- Migrasi v8: tarik absensi ke nilai tambahan, rapor, dan leger.
-- SUDAH dijalankan di project Supabase "PKBM Nurul Islam Project". File ini hanya cadangan
-- (untuk instalasi baru / project Supabase lain). Aman dijalankan ulang.
-- Prasyarat: fungsi rekap_kehadiran() dari aplikasi absensi sudah ada.

-- 1) Kolom Hadir di catatan semester
alter table public.catatan_siswa_semester
  add column if not exists hadir integer check (hadir is null or hadir >= 0);

-- 2) Tanggal pertama ada data absensi
create or replace function public.tanggal_mulai_absensi()
returns date
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'service_role') then
    raise exception 'Tidak diizinkan' using errcode = '42501';
  end if;
  return (select min(a.tanggal) from attendance a);
end;
$$;
revoke all on function public.tanggal_mulai_absensi() from public, anon;
grant execute on function public.tanggal_mulai_absensi() to authenticated, service_role;

-- 3) Rekap absensi per siswa (membungkus rekap_kehadiran; hanya guru login)
create or replace function public.tarik_absensi_nilai(
  p_start date, p_end date, p_program text default null, p_kelas text default null)
returns table (
  siswa_nisn text, siswa_nama text, program text, kelas text, kelas_romawi text,
  total_hari int, hadir int, terlambat int, izin int, sakit int, alpa int,
  persentase numeric, nilai int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sb int; v_b int; v_c int;
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'service_role') then
    raise exception 'Tidak diizinkan' using errcode = '42501';
  end if;

  select ss.ambang_sangat_baik, ss.ambang_baik, ss.ambang_cukup
    into v_sb, v_b, v_c
    from school_settings ss where ss.id = 1;

  return query
  select
    r.nisn, r.nama,
    case r.program::text when 'PAKET_B' then 'Paket B' else 'Paket C' end,
    r.kelas, x.romawi, r.total_hari, r.hadir, r.terlambat, r.izin, r.sakit, r.alpa, r.persentase,
    case
      when r.persentase >= coalesce(v_sb, 95) then 100
      when r.persentase >= coalesce(v_b, 85) then 90
      when r.persentase >= coalesce(v_c, 75) then 80
      else 70
    end
  from rekap_kehadiran(p_start, p_end) r
  cross join lateral (
    select case substring(r.kelas from '\d+')::int
      when 7 then 'VII' when 8 then 'VIII' when 9 then 'IX'
      when 10 then 'X' when 11 then 'XI' when 12 then 'XII'
    end as romawi
  ) x
  where r.program::text in ('PAKET_B', 'PAKET_C')
    and r.nisn is not null and r.nisn <> ''
    and (p_program is null or r.program::text = upper(replace(p_program, ' ', '_')))
    and (p_kelas is null or x.romawi = upper(p_kelas))
  order by r.kelas, r.nama;
end;
$$;
revoke all on function public.tarik_absensi_nilai(date, date, text, text) from public, anon;
grant execute on function public.tarik_absensi_nilai(date, date, text, text) to authenticated, service_role;
