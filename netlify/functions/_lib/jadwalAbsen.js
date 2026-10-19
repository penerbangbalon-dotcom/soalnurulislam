/**
 * Jadwal absen datang/pulang yang berlaku pada hari tertentu.
 * Hari Jumat memakai tabel `program_schedules_jumat` (bila ada & aktif),
 * hari lain memakai `program_schedules`. Jika migrasi 05 belum dijalankan,
 * otomatis jatuh ke jadwal reguler (perilaku lama tidak berubah).
 */
async function ambilJadwalAbsen(supabase, program, weekday) {
  if (weekday === 5) {
    const { data } = await supabase
      .from('program_schedules_jumat')
      .select('*')
      .eq('program', program)
      .eq('aktif', true)
      .maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase.from('program_schedules').select('*').eq('program', program).single();
  return data;
}

module.exports = { ambilJadwalAbsen };
