-- v25: jadwal ujian untuk Agenda Ujian & kalender di Dashboard.
-- Jalankan sekali di Supabase SQL Editor (aman diulang).
alter table paket_ujian add column if not exists tanggal_ujian date;
alter table paket_ujian add column if not exists jam_ujian text;
