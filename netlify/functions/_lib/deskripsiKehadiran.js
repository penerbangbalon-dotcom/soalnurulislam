/**
 * Membangun deskripsi kehadiran otomatis (untuk lampiran rapor) dari satu baris
 * hasil rekap_kehadiran() + templat kalimat penilaian yang bisa diedit admin
 * lewat menu Pengaturan Sekolah (school_settings.templat_deskripsi_*).
 *
 * Kalimat rincian angka (hadir/izin/sakit/alpa) SELALU dibuat otomatis dari data
 * supaya konsisten & akurat. Hanya kalimat penilaian akhir yang memakai kata-kata
 * milik sekolah (templat), sehingga sekolah bisa menyesuaikan gaya bahasanya sendiri.
 */
function pilihTemplat(persentase, settings) {
  if (persentase >= 95) return settings.templat_deskripsi_sangat_baik;
  if (persentase >= 85) return settings.templat_deskripsi_baik;
  if (persentase >= 75) return settings.templat_deskripsi_cukup;
  return settings.templat_deskripsi_kurang;
}

function predikatKehadiran(persentase) {
  if (persentase >= 95) return 'Sangat Baik';
  if (persentase >= 85) return 'Baik';
  if (persentase >= 75) return 'Cukup';
  return 'Kurang';
}

function buatDeskripsiKehadiran(row, periodeLabel, settings) {
  const {
    nama, hadir = 0, terlambat = 0, izin = 0, sakit = 0, alpa = 0, total_hari = 0, persentase = 0,
  } = row;

  if (!total_hari) {
    return `Belum terdapat hari efektif sekolah yang dapat dihitung pada ${periodeLabel} untuk ananda ${nama}.`;
  }

  const kalimat = [];
  kalimat.push(
    `Selama ${periodeLabel}, ananda ${nama} hadir sebanyak ${hadir} hari dari ${total_hari} hari efektif sekolah, ` +
    `dengan persentase kehadiran ${persentase}% (predikat ${predikatKehadiran(persentase)}).`
  );

  const rincian = [];
  if (terlambat > 0) rincian.push(`${terlambat} hari di antaranya terlambat`);
  if (izin > 0) rincian.push(`izin ${izin} hari`);
  if (sakit > 0) rincian.push(`sakit ${sakit} hari`);
  if (alpa > 0) rincian.push(`tanpa keterangan (alpa) ${alpa} hari`);
  if (rincian.length) kalimat.push(`Rincian ketidakhadiran: ${rincian.join(', ')}.`);

  const templat = pilihTemplat(persentase, settings) || '';
  kalimat.push(templat.replace(/\{nama\}/g, nama));

  return kalimat.join(' ');
}

module.exports = { buatDeskripsiKehadiran, predikatKehadiran };
