-- ============================================================
-- v14: REMEDIAL (jalankan sekali di Supabase SQL Editor)
-- ============================================================
-- 1) Nilai remedial disimpan di tabel nilai_manual_komponen sebagai komponen rem_uh / rem_uts / rem_uas
alter table nilai_manual_komponen drop constraint if exists nilai_manual_komponen_komponen_check;
alter table nilai_manual_komponen add constraint nilai_manual_komponen_komponen_check
  check (komponen in ('tugas','praktik','rem_uh','rem_uts','rem_uas'));

-- 2) Aturan remedial di Pengaturan Nilai
--    mode: 'nonaktif' | 'kkm' (nilai remedial maksimal = KKM) | 'tertinggi' (ambil yang lebih tinggi) | 'rata' (rata-rata nilai asli & remedial)
alter table pengaturan_nilai add column if not exists remedial jsonb not null default '{"mode":"kkm"}'::jsonb;
