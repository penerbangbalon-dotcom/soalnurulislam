-- ============================================================
-- v15.0 — Kenaikan Kelas (naik / tidak naik / lulus / pindah / keluar)
-- Jalankan SEKALI di Supabase SQL Editor (aman diulang). Data lama tidak berubah.
-- ============================================================

-- 1) Keputusan kenaikan kelas: satu baris per siswa per tahun ajaran, dengan data lama untuk pembatalan.
create table if not exists public.kenaikan_kelas (
  id bigserial primary key,
  siswa_nisn text not null,
  siswa_nama text,
  tahun_ajaran text not null,
  program text not null,                 -- 'Paket B' / 'Paket C'
  kelas_asal text not null,              -- romawi, mis. 'X'
  kelas_asal_asli text,                  -- ejaan di tabel students, mis. '10 IPS 1'
  keputusan text not null check (keputusan in ('naik','tinggal','lulus','pindah','keluar')),
  saran text,                            -- saran otomatis saat keputusan dibuat
  alasan text,                           -- wajib bila keputusan berbeda dari saran
  kelas_tujuan text,                     -- romawi, hanya untuk 'naik'
  status text not null default 'direncanakan' check (status in ('direncanakan','diterapkan')),
  lama_kelas text, lama_jenjang text, lama_program text, lama_status text,   -- data siswa sebelum diterapkan
  baru_kelas text, baru_status text,                                         -- data siswa setelah diterapkan
  diterapkan_pada timestamptz, diterapkan_oleh text,
  updated_at timestamptz not null default now(),
  unique (siswa_nisn, tahun_ajaran)
);
create index if not exists idx_kenaikan_kelas_ta on public.kenaikan_kelas(tahun_ajaran, program, kelas_asal);

alter table public.kenaikan_kelas enable row level security;
drop policy if exists "guru login bisa akses kenaikan kelas" on public.kenaikan_kelas;
create policy "guru login bisa akses kenaikan kelas" on public.kenaikan_kelas for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 2) Kriteria saran naik kelas (satu kolom JSON di pengaturan nilai)
alter table public.pengaturan_nilai add column if not exists kenaikan jsonb;

-- 3) Status siswa LULUS / PINDAH / KELUAR di tabel students (milik aplikasi absensi).
--    Bila kolom status bertipe ENUM, nilai yang belum ada ditambahkan. Bila bertipe teks biasa
--    (dengan atau tanpa CHECK), skrip hanya memberi catatan: pastikan CHECK mengizinkan ketiga nilai itu.
do $$
declare t text; v text; tipe_enum boolean;
begin
  select c.udt_name into t from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = 'students' and c.column_name = 'status';
  if t is null then
    raise notice 'Kolom students.status tidak ditemukan; lewati langkah status.';
    return;
  end if;
  select exists (select 1 from pg_type ty where ty.typname = t and ty.typtype = 'e') into tipe_enum;
  if tipe_enum then
    foreach v in array array['LULUS','PINDAH','KELUAR'] loop
      if not exists (select 1 from pg_enum e join pg_type ty on ty.oid = e.enumtypid where ty.typname = t and e.enumlabel = v) then
        execute format('alter type %I add value %L', t, v);
        raise notice 'Status % ditambahkan ke tipe %', v, t;
      end if;
    end loop;
  else
    raise notice 'students.status bertipe % (bukan enum). Bila ada CHECK constraint pada kolom status, pastikan LULUS, PINDAH, KELUAR diizinkan.', t;
  end if;
end $$;
