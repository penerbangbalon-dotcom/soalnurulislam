/**
 * Grup kelas = nama kelas TANPA rombel dan TANPA peminatan.
 *   Paket B : "7 A", "7 B"                 -> "7"
 *   Paket C : "10 IPA", "10 IPS 1", "10 IPS 2" -> "10"   (IPA/IPS diabaikan;
 *             "11 IPA", "11 IPS 1", ...    -> "11", "12 ..." -> "12")
 * Satu grup = satu jadwal mapel = satu berkas rekap Word.
 */
const PROGRAM_LABEL = {
  PAKET_B: 'Paket B (Setara SMP/MTs)',
  PAKET_C: 'Paket C (Setara SMA/MA)',
};

function grupKelas(kelas, program) {
  const k = String(kelas || '').trim().replace(/\s+/g, ' ');
  if (program !== 'PAKET_B' && program !== 'PAKET_C') return k;
  // Paket C: cukup tingkat kelasnya saja (10, 11, 12) — peminatan IPA/IPS dan rombel digabung.
  if (program === 'PAKET_C') {
    const m = k.match(/^(?:kelas\s+)?(\d{1,2})(?:\s|$)/i);
    if (m) return m[1];
  }
  const parts = k.split(' ');
  if (parts.length > 1 && /^([A-Za-z]|\d+)$/.test(parts[parts.length - 1])) parts.pop();
  return parts.join(' ');
}

/** Urutkan grup kelas secara natural: 7, 8, 9, 10, 11, 12 */
function bandingGrup(a, b) {
  return String(a).localeCompare(String(b), 'id', { numeric: true, sensitivity: 'base' });
}

/** 1=Senin .. 7=Minggu untuk string tanggal "YYYY-MM-DD" (tanpa terpengaruh zona waktu). */
function hariIsoDariTanggal(tanggal) {
  const d = new Date(`${tanggal}T00:00:00Z`).getUTCDay(); // 0=Minggu
  return d === 0 ? 7 : d;
}

const NAMA_HARI = { 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu', 7: 'Minggu' };
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function tanggalPanjang(tanggal) {
  const [y, m, d] = tanggal.split('-').map(Number);
  return `${NAMA_HARI[hariIsoDariTanggal(tanggal)]}, ${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

module.exports = { PROGRAM_LABEL, grupKelas, bandingGrup, hariIsoDariTanggal, tanggalPanjang, NAMA_HARI };
