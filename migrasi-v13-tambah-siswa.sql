-- migrasi-v13-tambah-siswa.sql
-- Fungsi untuk menambah siswa dari menu "Data Siswa" aplikasi ujian ke tabel `students`
-- (tabel yang sama dengan aplikasi absensi, jadi siswa langsung muncul di kedua aplikasi).
-- Jalankan SEKALI di Supabase -> SQL Editor. Aman dijalankan ulang.
--
-- Kata sandi awal siswa di absensi = tanggal lahir DDMMYYYY, disimpan sebagai bcrypt (cost 10, awalan $2a$),
-- sama dengan 360 siswa lain yang belum mengganti sandi. must_change_password = true.
-- Hanya bisa dipanggil oleh server (service_role), bukan dari browser.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.tambah_siswa_massal(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r jsonb;
  n bigint;
  v_nisn text;
  v_nama text;
  v_tgl date;
  v_ditambah int := 0;
  v_dilewati jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Tidak diizinkan' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Data harus berupa daftar siswa';
  end if;

  for r, n in select e.value, e.ordinality from jsonb_array_elements(p_rows) with ordinality as e loop
    begin
      v_nama := nullif(btrim(r->>'nama'), '');
      v_nisn := nullif(btrim(r->>'nisn'), '');
      if v_nama is null then raise exception 'Nama kosong'; end if;
      if v_nisn is null then raise exception 'NISN kosong'; end if;
      if exists (select 1 from public.students s where s.nisn = v_nisn) then
        raise exception 'NISN % sudah terdaftar', v_nisn;
      end if;
      v_tgl := (r->>'tanggal_lahir')::date;
      if v_tgl is null then raise exception 'Tanggal lahir kosong'; end if;

      insert into public.students
        (nisn, nipd, nama, jk, jenjang, program, kelas, tempat_lahir, tanggal_lahir, alamat, hp,
         status, password_hash, must_change_password)
      values
        (v_nisn, nullif(btrim(r->>'nipd'), ''), v_nama, nullif(btrim(r->>'jk'), ''),
         (r->>'jenjang')::jenjang_t, (r->>'program')::program_t, btrim(r->>'kelas'),
         nullif(btrim(r->>'tempat_lahir'), ''), v_tgl, nullif(btrim(r->>'alamat'), ''), nullif(btrim(r->>'hp'), ''),
         'AKTIF', crypt(to_char(v_tgl, 'DDMMYYYY'), gen_salt('bf', 10)), true);
      v_ditambah := v_ditambah + 1;
    exception when others then
      v_dilewati := v_dilewati || jsonb_build_array(jsonb_build_object(
        'baris', coalesce((r->>'baris')::int, n::int), 'nama', r->>'nama', 'nisn', r->>'nisn', 'alasan', sqlerrm));
    end;
  end loop;

  return jsonb_build_object('ditambah', v_ditambah, 'dilewati', v_dilewati);
end;
$$;

revoke all on function public.tambah_siswa_massal(jsonb) from public, anon, authenticated;
grant execute on function public.tambah_siswa_massal(jsonb) to service_role;
