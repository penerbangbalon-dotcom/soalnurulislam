const STATUS_HADIR = ['HADIR', 'TERLAMBAT'];
const STATUS_TANPA_JAM = ['IZIN', 'SAKIT', 'TIDAK_HADIR'];
const ALLOWED_STATUS = [...STATUS_HADIR, ...STATUS_TANPA_JAM];

/** Gabungkan tanggal (YYYY-MM-DD) + jam (HH:mm) sebagai waktu WIB (+07:00, tanpa DST). */
function jakartaTimestamp(tanggal, jam) {
  if (!tanggal || !jam) return null;
  return new Date(`${tanggal}T${jam}:00+07:00`).toISOString();
}

/**
 * Simpan satu baris absen manual (dipakai admin-absen-manual.js untuk satu
 * siswa, dan admin-absen-manual-bulk.js untuk satu kelas sekaligus).
 * Mengembalikan { ok: true } atau { ok: false, error } -- tidak pernah throw,
 * supaya proses bulk bisa lanjut ke siswa berikutnya walau satu baris gagal.
 */
async function simpanAbsenManual(supabase, { studentId, tanggal, hariIni, jamSekarang, status, jamDatang, jamPulang, keterangan, adminId, adminEmail }) {
  if (!studentId || !ALLOWED_STATUS.includes(status)) {
    return { ok: false, error: `status harus salah satu dari: ${ALLOWED_STATUS.join('/')}` };
  }
  if (tanggal > hariIni) {
    return { ok: false, error: 'tidak bisa menginput absen untuk tanggal yang belum terjadi' };
  }

  const { data: student, error: studentErr } = await supabase
    .from('students').select('id, nama, status').eq('id', studentId).maybeSingle();
  if (studentErr || !student) return { ok: false, error: 'siswa tidak ditemukan' };
  if (student.status !== 'AKTIF') return { ok: false, error: 'siswa berstatus nonaktif' };

  const manualMark = { manual: true, by_admin_id: adminId, by_admin_email: adminEmail, input_at: new Date().toISOString() };
  const row = {
    student_id: studentId,
    tanggal,
    keterangan: keterangan || null,
    set_by_admin: adminId,
    verified_by_admin: true,
    updated_at: new Date().toISOString(),
  };

  if (STATUS_HADIR.includes(status)) {
    let jd = jamDatang || null;
    if (!jd && tanggal === hariIni) jd = jamSekarang.slice(0, 5);
    if (!jd) return { ok: false, error: 'jam datang wajib diisi untuk tanggal yang sudah lewat' };

    row.checkin_time = jakartaTimestamp(tanggal, jd);
    row.checkin_status = status;
    row.checkin_session_id = null;
    row.checkin_device = manualMark;

    if (jamPulang) {
      row.checkout_time = jakartaTimestamp(tanggal, jamPulang);
      row.checkout_status = 'SUDAH_PULANG';
      row.checkout_session_id = null;
      row.checkout_device = manualMark;
    }
  } else {
    row.checkin_status = status;
    row.checkin_device = manualMark;
  }

  const { data: existing } = await supabase
    .from('attendance').select('id').eq('student_id', studentId).eq('tanggal', tanggal).maybeSingle();

  let error;
  if (existing) {
    ({ error } = await supabase.from('attendance').update(row).eq('id', existing.id));
  } else {
    ({ error } = await supabase.from('attendance').insert(row));
  }
  if (error) return { ok: false, error: 'gagal menyimpan ke database' };

  return { ok: true, nama: student.nama };
}

module.exports = { simpanAbsenManual, ALLOWED_STATUS, STATUS_HADIR, STATUS_TANPA_JAM };
