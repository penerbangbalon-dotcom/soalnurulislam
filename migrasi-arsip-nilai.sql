-- ============================================================
-- ARSIP NILAI PERMANEN + ARSIP PAKET (aman dijalankan ulang)
-- Tujuan: nilai hasil ujian siswa TIDAK hilang walaupun paket
-- soal dihapus / sesi di-reset. Hanya MENAMBAH objek baru; tidak
-- mengubah atau menghapus data yang sudah ada.
-- ============================================================

-- 1) Paket bisa "diarsipkan" (disembunyikan) alih-alih dihapus
alter table paket_ujian add column if not exists diarsipkan boolean not null default false;
alter table paket_ujian add column if not exists diarsipkan_pada timestamptz;

-- 2) Salinan nilai permanen (tanpa foreign key, jadi tidak ikut terhapus)
create table if not exists arsip_nilai (
  id uuid primary key default gen_random_uuid(),
  sesi_id uuid not null unique,
  siswa_nisn text,
  siswa_nama text,
  paket_id uuid,
  paket_judul text,
  jenis_ujian text,
  mapel_nama text,
  program text,
  kelas text,
  semester text,
  tahun_ajaran text,
  mode_ujian text,
  status text,
  total_skor numeric,
  waktu_selesai timestamptz,
  sesi_dihapus_pada timestamptz,
  diarsipkan_pada timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now()
);
create index if not exists idx_arsip_nilai_nisn on arsip_nilai(siswa_nisn);
create index if not exists idx_arsip_nilai_paket on arsip_nilai(paket_id);

-- Guru login hanya boleh MEMBACA. Tidak ada izin ubah/hapus dari aplikasi.
alter table arsip_nilai enable row level security;
drop policy if exists "guru login bisa baca arsip nilai" on arsip_nilai;
create policy "guru login bisa baca arsip nilai" on arsip_nilai for select using (auth.role() = 'authenticated');
revoke all on arsip_nilai from anon;
revoke insert, update, delete, truncate on arsip_nilai from authenticated;
grant select on arsip_nilai to authenticated;

-- 3) Setiap kali sesi selesai/dinilai (atau nilainya diperbarui), salin ke arsip
create or replace function public.simpan_arsip_nilai() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select pu.judul, pu.jenis_ujian, pu.program, pu.kelas, pu.semester, pu.tahun_ajaran, mp.nama as mapel_nama
    into p
    from paket_ujian pu left join mata_pelajaran mp on mp.id = pu.mapel_id
   where pu.id = new.paket_ujian_id;
  insert into arsip_nilai (sesi_id, siswa_nisn, siswa_nama, paket_id, paket_judul, jenis_ujian, mapel_nama,
                           program, kelas, semester, tahun_ajaran, mode_ujian, status, total_skor, waktu_selesai)
  values (new.id, new.siswa_nisn, new.siswa_nama, new.paket_ujian_id, p.judul, p.jenis_ujian, p.mapel_nama,
          p.program, p.kelas, p.semester, p.tahun_ajaran, new.mode_ujian, new.status, new.total_skor, new.waktu_selesai)
  on conflict (sesi_id) do update set
    siswa_nama = excluded.siswa_nama, status = excluded.status, total_skor = excluded.total_skor,
    waktu_selesai = excluded.waktu_selesai, mode_ujian = excluded.mode_ujian,
    diperbarui_pada = now(), sesi_dihapus_pada = null;
  return new;
end $$;

drop trigger if exists trg_arsip_nilai on sesi_ujian;
create trigger trg_arsip_nilai after insert or update on sesi_ujian
  for each row when (new.status in ('selesai','dinilai'))
  execute function public.simpan_arsip_nilai();

-- 4) Kalau sesi dihapus (hapus paket / reset), arsip TETAP ada, hanya diberi tanda
create or replace function public.tandai_sesi_dihapus() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update arsip_nilai set sesi_dihapus_pada = now() where sesi_id = old.id;
  return old;
end $$;

drop trigger if exists trg_arsip_sesi_dihapus on sesi_ujian;
create trigger trg_arsip_sesi_dihapus after delete on sesi_ujian
  for each row execute function public.tandai_sesi_dihapus();

revoke all on function public.simpan_arsip_nilai() from public, anon, authenticated;
revoke all on function public.tandai_sesi_dihapus() from public, anon, authenticated;

-- 5) Salin semua nilai yang SUDAH ADA sekarang (tidak menimpa apa pun)
insert into arsip_nilai (sesi_id, siswa_nisn, siswa_nama, paket_id, paket_judul, jenis_ujian, mapel_nama,
                         program, kelas, semester, tahun_ajaran, mode_ujian, status, total_skor, waktu_selesai)
select s.id, s.siswa_nisn, s.siswa_nama, s.paket_ujian_id, pu.judul, pu.jenis_ujian, mp.nama,
       pu.program, pu.kelas, pu.semester, pu.tahun_ajaran, s.mode_ujian, s.status, s.total_skor, s.waktu_selesai
  from sesi_ujian s
  join paket_ujian pu on pu.id = s.paket_ujian_id
  left join mata_pelajaran mp on mp.id = pu.mapel_id
 where s.status in ('selesai','dinilai')
on conflict (sesi_id) do nothing;
