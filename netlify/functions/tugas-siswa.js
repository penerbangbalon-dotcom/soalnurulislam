// Netlify/Vercel Function: tugas-siswa
// Satu fungsi untuk semua kebutuhan Tugas Tulis & Syarat Rapor di jendela siswa (ujian.html) dan menu guru:
//   aksi "daftar"       siswa melihat daftar tugas untuk kelasnya + status masing-masing   (NISN + PIN)
//   aksi "buka"         siswa membuka satu tugas (membuat draf bila belum ada)             (NISN + PIN)
//   aksi "simpan"       simpan draf otomatis + catat pelanggaran (pindah tab / paste)      (jawaban_id)
//   aksi "kumpulkan"    siswa mengumpulkan tugas (atau otomatis saat batas pelanggaran)    (jawaban_id)
//   aksi "syarat"       siswa melihat syarat rapor miliknya (ujian, tugas, kehadiran)      (NISN + PIN)
//   aksi "syarat_kelas" GURU melihat syarat rapor satu kelas / semua kelas                 (token login guru)
// Dijadikan satu fungsi supaya jumlah fungsi di Vercel tetap sedikit (paket gratis maksimal 12 fungsi).
const {
  UUID, ipDari, hitungGagal, catatGagal, verifikasiSiswa, adaKonfigurasi, sb, sbSemua, potong, hitungKata,
  taSemesterBerjalan, profilKelasSiswa, wajibLogin, hitungSyaratRapor, ambilSiswaAktif,
} = require('../lib/ujian-core');

const MAKS_GAGAL_NISN = 5, MAKS_GAGAL_IP = 100, JENDELA_MENIT = 10;
const MAKS_KARAKTER = 30000;       // batas panjang jawaban (jaga-jaga penyalahgunaan)
const TOLERANSI_TENGGAT_MS = 60000; // toleransi selisih jam / jaringan lambat

const balas = (status, obj) => ({ statusCode: status, body: JSON.stringify(obj) });
const polaTA = /^\d{4}\/\d{4}$/;

// Tugas untuk jurusan lain tidak boleh tampil / dikerjakan.
const cocokJurusan = (t, prof) => !(t.jurusan && prof.jurusan && t.jurusan !== prof.jurusan);
const lewatTenggat = (t) => !!(t.batas_waktu && Date.now() > new Date(t.batas_waktu).getTime() + TOLERANSI_TENGGAT_MS);

async function verifikasiDenganPembatas(event, nisn, pin) {
  const kunciNisn = `nisn:${String(nisn).trim()}`, kunciIp = `ip:${ipDari(event)}`;
  const [gagalNisn, gagalIp] = await Promise.all([hitungGagal(kunciNisn, JENDELA_MENIT), hitungGagal(kunciIp, JENDELA_MENIT)]);
  if (gagalNisn >= MAKS_GAGAL_NISN || gagalIp >= MAKS_GAGAL_IP) {
    return { respons: balas(429, { error: `Terlalu banyak percobaan gagal. Coba lagi ${JENDELA_MENIT} menit lagi atau hubungi guru.` }) };
  }
  const v = await verifikasiSiswa(nisn, pin, ['kelas', 'program']);
  if (v.error) {
    if (v.status === 404 || v.status === 401) await catatGagal(kunciNisn, kunciIp);
    return { respons: balas(v.status, { error: v.error }) };
  }
  return { v, prof: profilKelasSiswa(v.siswa) };
}

// ---------------------------------------------------------------------------
// SISWA: daftar / buka / syarat
// ---------------------------------------------------------------------------
async function aksiSiswa(event, aksi, body) {
  const { nisn, pin } = body;
  if (!nisn) return balas(400, { error: 'NISN wajib diisi' });
  const ver = await verifikasiDenganPembatas(event, nisn, pin);
  if (ver.respons) return ver.respons;
  const { v, prof } = ver;
  const infoSiswa = { nama_siswa: v.nama, kelas: prof.kelasAsli };
  if (!prof.kelas || !prof.program) {
    return balas(200, { ...infoSiswa, pesan: 'Kelas atau program kamu belum terdata di sistem. Hubungi guru.', tugas: [] });
  }
  const nisnStr = String(nisn).trim();

  if (aksi === 'syarat') {
    const sk = taSemesterBerjalan();
    const ta = polaTA.test(String(body.ta || '')) ? body.ta : sk.ta;
    const smt = ['Ganjil', 'Genap'].includes(body.smt) ? body.smt : sk.smt;
    const h = await hitungSyaratRapor({ ta, smt, siswaList: [{ nisn: nisnStr, nama: v.nama, kelasAsli: prof.kelasAsli, kelas: prof.kelas, program: prof.program, jurusan: prof.jurusan }] });
    return balas(200, { ...infoSiswa, config: h.config, periode: h.periode, syarat: h.siswa[0] || null });
  }

  if (aksi === 'daftar') {
    const { ta } = taSemesterBerjalan();
    let rows;
    try {
      rows = await sbSemua(`tugas?kelas=eq.${encodeURIComponent(prof.kelas)}&program=eq.${encodeURIComponent(prof.program)}&status=in.(dibuka,ditutup)&select=id,judul,mapel_nama,jurusan,semester,tahun_ajaran,status,batas_waktu,terima_terlambat,wajib,nilai_maks,min_kata,maks_kata`, 'created_at');
    } catch (e) {
      return balas(500, { error: 'Fitur tugas belum aktif di database. Admin perlu menjalankan migrasi-v16-tugas-syarat-rapor.sql di Supabase. (' + e.message + ')' });
    }
    rows = rows.filter((t) => cocokJurusan(t, prof) && (t.status === 'dibuka' || t.tahun_ajaran === ta));
    const jawab = new Map();
    for (const grup of potong(rows.map((t) => t.id), 30)) {
      const js = await sb(`tugas_jawaban?siswa_nisn=eq.${encodeURIComponent(nisnStr)}&tugas_id=in.(${grup.join(',')})&select=tugas_id,status,skor,catatan_guru,terlambat,jumlah_kata,diakhiri_otomatis,dikumpulkan_pada`);
      (js || []).forEach((j) => jawab.set(j.tugas_id, j));
    }
    const hasil = rows.map((t) => {
      const j = jawab.get(t.id) || null;
      const terkirim = !!(j && (j.status === 'dikumpulkan' || j.status === 'dinilai'));
      let status = j ? j.status : 'belum';
      let boleh = false;
      if (!terkirim && status !== 'dibebaskan') {
        if (t.status !== 'dibuka' || (lewatTenggat(t) && !t.terima_terlambat)) status = 'terlewat';
        else boleh = true;
      }
      return {
        tugas_id: t.id, judul: t.judul, mapel: t.mapel_nama, semester: t.semester, tahun_ajaran: t.tahun_ajaran,
        batas_waktu: t.batas_waktu, terima_terlambat: t.terima_terlambat, wajib: t.wajib !== false, nilai_maks: Number(t.nilai_maks) || 100,
        min_kata: t.min_kata || 0, maks_kata: t.maks_kata || 0,
        status, boleh_kerjakan: boleh, terlambat: !!(j && j.terlambat),
        skor: j && j.status === 'dinilai' && j.skor != null ? Number(j.skor) : null,
        catatan_guru: j && j.status === 'dinilai' ? (j.catatan_guru || '') : '',
        diakhiri_otomatis: !!(j && j.diakhiri_otomatis), jumlah_kata: j ? j.jumlah_kata : 0,
      };
    });
    const bobot = { true: 0, false: 1 };
    hasil.sort((a, b) => (bobot[a.boleh_kerjakan] - bobot[b.boleh_kerjakan])
      || String(a.batas_waktu || '9999').localeCompare(String(b.batas_waktu || '9999'))
      || a.mapel.localeCompare(b.mapel, 'id'));
    return balas(200, { ...infoSiswa, tugas: hasil });
  }

  // aksi === 'buka'
  const tugasId = String(body.tugas_id || '');
  if (!UUID.test(tugasId)) return balas(400, { error: 'tugas_id tidak valid' });
  const [t] = await sb(`tugas?id=eq.${tugasId}&select=*`);
  if (!t || t.kelas !== prof.kelas || t.program !== prof.program || !cocokJurusan(t, prof) || t.status === 'draft') {
    return balas(404, { error: 'Tugas tidak ditemukan untuk kelasmu.' });
  }
  const bacaJawaban = async () => (await sb(`tugas_jawaban?tugas_id=eq.${tugasId}&siswa_nisn=eq.${encodeURIComponent(nisnStr)}&select=*`))[0] || null;
  let j = await bacaJawaban();
  const info = { judul: t.judul, mapel: t.mapel_nama, instruksi: t.instruksi, min_kata: t.min_kata || 0, maks_kata: t.maks_kata || 0, batas_waktu: t.batas_waktu, nilai_maks: Number(t.nilai_maks) || 100, batas_pelanggaran: t.batas_pelanggaran };
  if (j && (j.status === 'dikumpulkan' || j.status === 'dinilai')) {
    return balas(200, { mode: 'lihat', ...infoSiswa, tugas: info, jawaban: j.jawaban, status: j.status, skor: j.status === 'dinilai' && j.skor != null ? Number(j.skor) : null, catatan_guru: j.catatan_guru || '', terlambat: j.terlambat, diakhiri_otomatis: j.diakhiri_otomatis, jumlah_kata: j.jumlah_kata, dikumpulkan_pada: j.dikumpulkan_pada });
  }
  if (j && j.status === 'dibebaskan') return balas(403, { error: 'Kamu dibebaskan dari tugas ini oleh guru.' });
  if (t.status !== 'dibuka') return balas(403, { error: 'Tugas ini sudah ditutup oleh guru.' });
  if (lewatTenggat(t) && !t.terima_terlambat) return balas(403, { error: 'Tenggat pengumpulan tugas ini sudah lewat.' });
  if (!j) {
    await sb('tugas_jawaban?on_conflict=tugas_id,siswa_nisn', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ tugas_id: tugasId, siswa_nisn: nisnStr, siswa_nama: v.nama, status: 'draf' }),
    });
    j = await bacaJawaban();
    if (!j) return balas(500, { error: 'Gagal membuat draf tugas. Coba lagi.' });
  }
  return balas(200, {
    mode: 'tulis', ...infoSiswa, tugas: info, jawaban_id: j.id, jawaban: j.jawaban || '', pelanggaran: Number(j.pelanggaran) || 0,
    terakhir_disimpan: j.terakhir_disimpan ? new Date(j.terakhir_disimpan).getTime() : 0, lewat_tenggat: lewatTenggat(t), server_time: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// SISWA: simpan draf / kumpulkan  (diidentifikasi lewat jawaban_id, UUID acak milik siswa itu)
// ---------------------------------------------------------------------------
async function aksiSimpanKumpul(aksi, body) {
  const id = String(body.jawaban_id || '');
  if (!UUID.test(id)) return balas(400, { error: 'jawaban_id tidak valid' });
  const [row] = await sb(`tugas_jawaban?id=eq.${id}&select=*,tugas(id,status,batas_waktu,terima_terlambat,batas_pelanggaran,min_kata,maks_kata)`);
  if (!row) return balas(200, { status: 'dihapus', server_time: Date.now() });
  if (row.status !== 'draf') return balas(200, { status: row.status, server_time: Date.now() });
  const t = row.tugas;
  if (!t || t.status !== 'dibuka') return balas(403, { error: 'Tugas ini sudah ditutup oleh guru.', status: 'ditutup' });

  const teks = String(body.jawaban == null ? row.jawaban : body.jawaban).slice(0, MAKS_KARAKTER);
  const kata = hitungKata(teks);
  const pelBaru = Math.min(Math.max(parseInt(body.pelanggaran, 10) || 0, Number(row.pelanggaran) || 0), 999);
  const alasanList = Array.isArray(row.alasan_pelanggaran) ? row.alasan_pelanggaran.slice(-19) : [];
  if (pelBaru > (Number(row.pelanggaran) || 0) && body.alasan) alasanList.push({ w: new Date().toISOString(), a: String(body.alasan).slice(0, 160) });
  const sekarang = new Date().toISOString();
  const patch = { jawaban: teks, jumlah_kata: kata, pelanggaran: pelBaru, alasan_pelanggaran: alasanList, terakhir_disimpan: sekarang };

  // Batas pelanggaran tercapai -> tugas dikumpulkan otomatis (asal sudah ada isinya).
  const otomatis = t.batas_pelanggaran > 0 && pelBaru >= t.batas_pelanggaran && kata > 0;
  if (aksi === 'kumpulkan' || otomatis) {
    if (!otomatis) {
      if (kata === 0) return balas(400, { error: 'Jawaban masih kosong. Tulis jawabanmu dulu.' });
      if (t.min_kata > 0 && kata < t.min_kata) return balas(400, { error: `Jawaban minimal ${t.min_kata} kata. Sekarang baru ${kata} kata.` });
      if (t.maks_kata > 0 && kata > t.maks_kata) return balas(400, { error: `Jawaban maksimal ${t.maks_kata} kata. Sekarang ${kata} kata, mohon dipersingkat.` });
    }
    const telat = lewatTenggat(t);
    if (telat && !t.terima_terlambat) return balas(403, { error: 'Tenggat pengumpulan tugas ini sudah lewat.' });
    Object.assign(patch, { status: 'dikumpulkan', dikumpulkan_pada: sekarang, terlambat: telat, diakhiri_otomatis: otomatis });
  }
  const klaim = await sb(`tugas_jawaban?id=eq.${id}&status=eq.draf`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) });
  if (!klaim || !klaim.length) return balas(200, { status: 'selesai', server_time: Date.now() });   // sudah ditutup proses lain
  return balas(200, {
    ok: true, status: patch.status || 'draf', alasan: otomatis ? 'pelanggaran' : undefined, pelanggaran: pelBaru,
    terlambat: !!patch.terlambat, jumlah_kata: kata, server_time: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// GURU: syarat rapor satu kelas / semua kelas (butuh login)
// ---------------------------------------------------------------------------
async function aksiSyaratKelas(event, body) {
  const g = await wajibLogin(event);
  if (g.error) return g.error;
  const sk = taSemesterBerjalan();
  const ta = polaTA.test(String(body.ta || '')) ? body.ta : sk.ta;
  const smt = ['Ganjil', 'Genap'].includes(body.smt) ? body.smt : sk.smt;
  const program = ['Paket B', 'Paket C'].includes(body.program) ? body.program : null;
  const kelas = ['VII', 'VIII', 'IX', 'X', 'XI', 'XII'].includes(body.kelas) ? body.kelas : null;
  const semua = await ambilSiswaAktif();
  const siswaList = semua.filter((s) => s.kelas && s.program && (!program || s.program === program) && (!kelas || s.kelas === kelas));
  const h = await hitungSyaratRapor({ ta, smt, siswaList });
  // Daftar rinci item tidak dikirim (hanya yang kurang) supaya respons tetap kecil.
  h.siswa.forEach((s) => { delete s.ujian.items; delete s.tugas.items; });
  return balas(200, h);
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!adaKonfigurasi()) return balas(500, { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel Environment Variables.' });
  let body;
  try { body = JSON.parse(event.body); } catch (e) { return balas(400, { error: 'Body tidak valid' }); }
  const aksi = String(body.aksi || '');
  try {
    if (aksi === 'syarat_kelas') return await aksiSyaratKelas(event, body);
    if (aksi === 'simpan' || aksi === 'kumpulkan') return await aksiSimpanKumpul(aksi, body);
    if (aksi === 'daftar' || aksi === 'buka' || aksi === 'syarat') return await aksiSiswa(event, aksi, body);
    return balas(400, { error: 'Aksi tidak dikenali' });
  } catch (err) {
    return balas(500, { error: err.message });
  }
};
