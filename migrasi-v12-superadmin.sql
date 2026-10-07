-- migrasi-v12-superadmin.sql
-- Peran baru "superadmin" (di atas admin). Jalankan SEKALI di Supabase -> SQL Editor.
-- SYARAT: migrasi-v11-keamanan.sql harus sudah dijalankan lebih dulu (membuat tabel pengaturan_sekolah).
-- Kalau tabel belum ada, file ini tidak error; hanya memberi pesan agar v11 dijalankan dulu.

do $$
begin
  if to_regclass('public.pengaturan_sekolah') is null then
    raise notice 'Tabel pengaturan_sekolah belum ada. Jalankan migrasi-v11-keamanan.sql dulu, lalu jalankan file ini lagi.';
  else
    execute 'drop policy if exists "admin boleh ubah identitas sekolah" on public.pengaturan_sekolah';
    execute $p$create policy "admin boleh ubah identitas sekolah" on public.pengaturan_sekolah
      for all using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','superadmin'))
      with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','superadmin'))$p$;
    raise notice 'Kebijakan identitas sekolah diperbarui untuk admin dan superadmin.';
  end if;
end $$;
