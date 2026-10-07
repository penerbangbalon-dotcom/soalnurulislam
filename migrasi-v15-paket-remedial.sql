-- ============================================================
-- v15: PAKET REMEDIAL ONLINE (jalankan SEKALI di Supabase SQL Editor; aman dijalankan ulang)
-- Prasyarat: migrasi-v14-remedial.sql sudah dijalankan.
-- Hanya MENAMBAH kolom / melonggarkan aturan; data lama tidak diubah.
-- ============================================================

-- 1) Jenis paket baru "Remedial" + komponen yang diremedial (UH / UTS / UAS) + batas waktu pendaftaran
alter table paket_ujian drop constraint if exists paket_ujian_jenis_ujian_check;
alter table paket_ujian add constraint paket_ujian_jenis_ujian_check
  check (jenis_ujian in ('UTS','UAS','Ulangan Harian','Remedial'));
alter table paket_ujian add column if not exists remedial_komponen text;
alter table paket_ujian drop constraint if exists paket_ujian_remedial_komponen_check;
alter table paket_ujian add constraint paket_ujian_remedial_komponen_check
  check (remedial_komponen is null or remedial_komponen in ('uh','uts','uas'));
alter table paket_ujian add column if not exists remedial_batas timestamptz;

-- 2) Soal "khusus remedial": dicadangkan untuk Paket Remedial, tidak ikut dipakai paket UTS/UAS/UH otomatis
alter table bank_soal add column if not exists khusus_remedial boolean not null default false;

-- 3) Arsip nilai ikut mencatat komponen yang diremedial, supaya nilai remedial online
--    otomatis masuk ke Leger, Transkrip, Rapor, dan daftar Perlu Remedial.
alter table arsip_nilai add column if not exists remedial_komponen text;

create or replace function public.simpan_arsip_nilai() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select pu.judul, pu.jenis_ujian, pu.program, pu.kelas, pu.semester, pu.tahun_ajaran, pu.remedial_komponen, mp.nama as mapel_nama
    into p
    from paket_ujian pu left join mata_pelajaran mp on mp.id = pu.mapel_id
   where pu.id = new.paket_ujian_id;
  insert into arsip_nilai (sesi_id, siswa_nisn, siswa_nama, paket_id, paket_judul, jenis_ujian, mapel_nama,
                           program, kelas, semester, tahun_ajaran, mode_ujian, status, total_skor, waktu_selesai, remedial_komponen)
  values (new.id, new.siswa_nisn, new.siswa_nama, new.paket_ujian_id, p.judul, p.jenis_ujian, p.mapel_nama,
          p.program, p.kelas, p.semester, p.tahun_ajaran, new.mode_ujian, new.status, new.total_skor, new.waktu_selesai, p.remedial_komponen)
  on conflict (sesi_id) do update set
    siswa_nama = excluded.siswa_nama, status = excluded.status, total_skor = excluded.total_skor,
    waktu_selesai = excluded.waktu_selesai, mode_ujian = excluded.mode_ujian,
    remedial_komponen = excluded.remedial_komponen,
    diperbarui_pada = now(), sesi_dihapus_pada = null;
  return new;
end $$;
revoke all on function public.simpan_arsip_nilai() from public, anon, authenticated;
