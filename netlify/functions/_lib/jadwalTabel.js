/**
 * Menyusun tabel jadwal pelajaran satu kelas (jam x hari) dari jam belajar + isian mapel.
 * Dipisah dari penulis Excel supaya logikanya bisa diuji tanpa library.
 *
 * Kolom: Jam | Waktu (Sen–Kam) | Senin | Selasa | Rabu | Kamis | Waktu (Jumat) | Jumat
 * Baris sejajar menurut urutan slot; hari Jumat memakai jam belajar Jumat sendiri.
 */
const HARI_REG = [1, 2, 3, 4];
const NAMA_HARI = { 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat' };
const t5 = (t) => String(t || '').slice(0, 5).replace(':', '.');
const urut = (a) => a.slice().sort((x, y) => (x.urut ?? 0) - (y.urut ?? 0));

function susunTabelJadwal({ slotsProgram, jadwal }) {
  const reg = urut((slotsProgram && slotsProgram.REGULER) || []);
  const jum = urut((slotsProgram && slotsProgram.JUMAT) || []);
  const isi = new Map();
  for (const j of jadwal || []) isi.set(`${j.hari}-${j.jam_ke}`, j.mapel);

  const header = ['Jam', 'Waktu (Sen–Kam)', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Waktu (Jumat)', 'Jumat'];
  const n = Math.max(reg.length, jum.length);
  const baris = [];
  const hitung = new Map();

  const sel = (slot, hari) => {
    if (!slot) return '';
    if (slot.jenis !== 'PELAJARAN') return slot.label || 'Istirahat';
    const m = isi.get(`${hari}-${slot.jam_ke}`) || '';
    if (m) hitung.set(m, (hitung.get(m) || 0) + 1);
    return m;
  };

  for (let i = 0; i < n; i++) {
    const r = reg[i]; const j = jum[i];
    const jam = r && r.jenis === 'PELAJARAN' ? r.jam_ke : (j && j.jenis === 'PELAJARAN' ? j.jam_ke : '');
    baris.push({
      istirahatReg: !!r && r.jenis !== 'PELAJARAN',
      istirahatJum: !!j && j.jenis !== 'PELAJARAN',
      sel: [
        jam === '' ? '' : jam,
        r ? `${t5(r.mulai)}–${t5(r.selesai)}` : '',
        ...HARI_REG.map((h) => sel(r, h)),
        j ? `${t5(j.mulai)}–${t5(j.selesai)}` : '',
        sel(j, 5),
      ],
    });
  }
  const ringkasan = [...hitung.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'id'));
  return { header, baris, ringkasan, totalJp: ringkasan.reduce((a, [, v]) => a + v, 0) };
}

module.exports = { susunTabelJadwal, NAMA_HARI };
