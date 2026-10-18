// Definisi FORMAT perangkat ajar (RPP & Modul Ajar) + penyusun prompt AI.
// Dipakai oleh generate-perangkat.js (AI) dan perangkat-docx.js (judul/acuan dokumen).
//
// Tiga format (dapat dipilih di menu Pengaturan Perangkat Ajar):
//  pm           : Perencanaan Pembelajaran Mendalam - Panduan Pembelajaran dan Asesmen (Edisi Revisi 2025):
//                 Identifikasi -> Desain Pembelajaran -> Pengalaman Belajar -> Asesmen
//  merdeka      : Modul Ajar Kurikulum Merdeka: Informasi Umum -> Komponen Inti -> Lampiran
//  satu_lembar  : RPP 1 Lembar (SE Mendikbud No. 14 Tahun 2019): Tujuan -> Langkah Kegiatan -> Penilaian
//
// Setiap bagian dokumen disimpan sebagai teks "markdown ringan" (subjudul ###, daftar -, daftar 1., tabel |, **tebal**)
// supaya mudah diedit guru, ditampilkan di layar, dan dikonversi ke Word.

const FORMAT = {
  pm: {
    label: 'Pembelajaran Mendalam (Panduan Pembelajaran & Asesmen, Edisi Revisi 2025)',
    acuan: 'Disusun mengacu pada Panduan Pembelajaran dan Asesmen Kurikulum Merdeka (Edisi Revisi 2025) dengan pendekatan Pembelajaran Mendalam.',
    judul: { rpp: 'RENCANA PEMBELAJARAN MENDALAM', modul: 'MODUL AJAR PEMBELAJARAN MENDALAM' },
  },
  merdeka: {
    label: 'Modul Ajar Kurikulum Merdeka (Informasi Umum, Komponen Inti, Lampiran)',
    acuan: 'Disusun mengacu pada komponen Modul Ajar Kurikulum Merdeka: Informasi Umum, Komponen Inti, dan Lampiran.',
    judul: { rpp: 'RENCANA PELAKSANAAN PEMBELAJARAN (RPP)', modul: 'MODUL AJAR' },
  },
  satu_lembar: {
    label: 'RPP 1 Lembar (SE Mendikbud No. 14 Tahun 2019)',
    acuan: 'Disusun mengacu pada Surat Edaran Mendikbud No. 14 Tahun 2019 tentang Penyederhanaan Rencana Pelaksanaan Pembelajaran (tujuan, langkah kegiatan, dan penilaian).',
    judul: { rpp: 'RENCANA PELAKSANAAN PEMBELAJARAN (RPP)', modul: 'MODUL AJAR' },
  },
};

const DIMENSI = 'Keimanan dan Ketakwaan terhadap Tuhan YME, Kewargaan, Penalaran Kritis, Kreativitas, Kolaborasi, Kemandirian, Kesehatan, Komunikasi';

// kata = perkiraan batas jumlah kata (untuk mengatur token & menjaga agar muat dalam batas waktu)
const S = (kunci, judul, petunjuk, kata = 130, extra = {}) => ({ kunci, judul, petunjuk, kata, ...extra });

// ---------------------------------------------------------------------------------------------
// Bagian-bagian per format
// ---------------------------------------------------------------------------------------------
function tahapPM(n, jenis) {
  const T = [];
  T.push({ id: 'identifikasi', label: 'Identifikasi: murid, materi, dimensi profil lulusan', grup: 'A. IDENTIFIKASI', sections: [
    S('murid', 'Kesiapan dan Karakteristik Peserta Didik', 'Uraikan 4-6 poin: pengetahuan/keterampilan awal yang perlu dimiliki, minat, kebutuhan belajar, kemungkinan hambatan, dan cara membedakan layanan (diferensiasi) sesuai karakter peserta didik PKBM yang diberikan.', 150),
    S('materi', 'Materi Pelajaran', 'Jabarkan cakupan materi esensial (konsep, fakta, prosedur), relevansinya dengan kehidupan peserta didik, tingkat kesulitan, dan miskonsepsi yang mungkin muncul. Gunakan daftar bernomor/berpoin.', 160),
    S('dimensi', 'Dimensi Profil Lulusan', `Pilih 2-4 dimensi yang paling relevan dari delapan dimensi profil lulusan (${DIMENSI}). Tulis sebagai daftar: nama dimensi (tebal) lalu satu kalimat tentang bagaimana dimensi itu dikuatkan lewat kegiatan pada topik ini.`, 110),
  ] });
  T.push({ id: 'desain', label: 'Desain pembelajaran', grup: 'B. DESAIN PEMBELAJARAN', sections: [
    S('cp', 'Capaian Pembelajaran', null, 0, { tetap: 'cp' }),
    S('lintas', 'Lintas Disiplin Ilmu', 'Sebutkan 1-3 mata pelajaran/disiplin lain yang terhubung dengan topik ini beserta bentuk keterkaitannya (satu kalimat per disiplin).', 70),
    S('tp', 'Tujuan Pembelajaran', null, 0, { tetap: 'tp' }),
    S('topik', 'Topik Pembelajaran', null, 0, { tetap: 'topik' }),
    S('praktik', 'Praktik Pedagogis', 'Tuliskan model/strategi pembelajaran utama (gunakan model yang ditentukan bila ada; contoh: pembelajaran berbasis masalah, proyek, inkuiri, kooperatif), alasan pemilihannya, dan sintaks/tahapan singkat. Sertakan pendekatan diferensiasi.', 120),
    S('lingkungan', 'Lingkungan Pembelajaran', 'Jelaskan pengaturan ruang belajar (fisik), suasana/budaya belajar yang dibangun (psikologis), dan pemanfaatan lingkungan sekitar peserta didik sebagai sumber belajar.', 80),
    S('kemitraan', 'Kemitraan Pembelajaran', 'Sebutkan mitra yang realistis untuk lingkungan PKBM (mis. tokoh masyarakat, pelaku usaha setempat, keluarga, perpustakaan desa, sesama peserta didik) dan peran masing-masing.', 70),
    S('digital', 'Pemanfaatan Digital', 'Sebutkan perangkat/aplikasi digital sederhana yang realistis (mis. ponsel, video, Google Form, kalkulator, peta daring) beserta fungsinya; sebutkan alternatif luring bila akses terbatas.', 70),
  ] });
  for (let i = 1; i <= n; i++) {
    T.push({ id: 'pengalaman_' + i, label: `Pengalaman belajar - pertemuan ${i}`, grup: 'C. PENGALAMAN BELAJAR', pertemuan: i, sections: [
      S('pengalaman_' + i, `Pertemuan ke-${i}`, 'Susun alur pengalaman belajar yang menerapkan prinsip berkesadaran (mindful), bermakna (meaningful), dan menggembirakan (joyful). Gunakan subjudul ### untuk: "Awal (apersepsi dan penyampaian tujuan)", "Memahami", "Mengaplikasi", "Merefleksi", dan "Penutup". Setiap subjudul memuat alokasi menit (jumlahnya sesuai durasi pertemuan) dan 3-5 poin kegiatan konkret yang menyebut apa yang dilakukan pendidik dan peserta didik. Kegiatan harus fokus pada tujuan pembelajaran pertemuan ini.', 360),
    ] });
  }
  T.push({ id: 'asesmen', label: 'Asesmen (awal, proses, akhir)', grup: 'D. ASESMEN', sections: [
    S('asesmen_awal', 'Asesmen pada Awal Pembelajaran', 'Rancang asesmen diagnostik singkat: tujuan, teknik, dan 2-3 contoh pertanyaan/tugas, serta tindak lanjut berdasarkan hasilnya.', 110),
    S('asesmen_proses', 'Asesmen pada Proses Pembelajaran', 'Rancang asesmen formatif: teknik (observasi, unjuk kerja, tanya jawab, produk), instrumen, dan umpan balik. Sertakan tabel rubrik singkat (kolom: Aspek | Perlu Bimbingan | Cakap | Mahir).', 170),
    S('asesmen_akhir', 'Asesmen pada Akhir Pembelajaran', 'Rancang asesmen sumatif: bentuk, 3-5 contoh butir soal/tugas yang selaras dengan tujuan pembelajaran (sertakan kunci/kriteria singkat), dan kriteria ketercapaian.', 200),
  ] });
  return T;
}

function tahapMerdeka(n, jenis) {
  const T = [];
  T.push({ id: 'info_umum', label: 'Informasi umum', grup: 'A. INFORMASI UMUM', sections: [
    S('kompetensi_awal', 'Kompetensi Awal', 'Tulis 3-5 poin pengetahuan/keterampilan prasyarat yang sebaiknya sudah dimiliki peserta didik sebelum mempelajari topik ini.', 80),
    S('dimensi', 'Dimensi Profil Lulusan', `Pilih 2-4 dimensi yang paling relevan dari delapan dimensi profil lulusan (${DIMENSI}) dan jelaskan satu kalimat untuk masing-masing tentang bagaimana dikuatkan pada topik ini.`, 100),
    S('sarpras', 'Sarana dan Prasarana', 'Daftar sarana, prasarana, media, alat, dan bahan yang dibutuhkan, realistis untuk PKBM.', 70),
    S('target', 'Target Peserta Didik', 'Jelaskan target peserta didik (reguler/tanpa kesulitan, dengan kesulitan, pencapaian tinggi) dan cara melayani masing-masing.', 80),
    S('model', 'Model Pembelajaran', 'Sebutkan model/pendekatan pembelajaran yang digunakan (gunakan model yang ditentukan bila ada), metode, dan alasan singkat pemilihannya.', 70),
  ] });
  T.push({ id: 'inti_1', label: 'Tujuan, pemahaman bermakna, pertanyaan pemantik', grup: 'B. KOMPONEN INTI', sections: [
    S('cp', 'Capaian Pembelajaran', null, 0, { tetap: 'cp' }),
    S('tp', 'Tujuan Pembelajaran', null, 0, { tetap: 'tp' }),
    S('topik', 'Topik Pembelajaran', null, 0, { tetap: 'topik' }),
    S('pemahaman', 'Pemahaman Bermakna', 'Tulis 3-4 poin pemahaman bermakna: manfaat dan nilai yang akan dipahami peserta didik dalam kehidupan sehari-hari.', 80),
    S('pemantik', 'Pertanyaan Pemantik', 'Tulis 4-5 pertanyaan pemantik terbuka yang merangsang rasa ingin tahu dan penalaran, terkait konteks peserta didik.', 70),
    S('persiapan', 'Persiapan Pembelajaran', 'Tulis langkah persiapan pendidik: media/bahan yang disiapkan, pengaturan kelas, dan pembagian kelompok.', 70),
  ] });
  for (let i = 1; i <= n; i++) {
    T.push({ id: 'kegiatan_' + i, label: `Kegiatan pembelajaran - pertemuan ${i}`, grup: 'B. KOMPONEN INTI', pertemuan: i, sections: [
      S('kegiatan_' + i, `Kegiatan Pembelajaran - Pertemuan ke-${i}`, 'Susun langkah pembelajaran dengan subjudul ### "Pendahuluan", "Kegiatan Inti", dan "Penutup". Setiap subjudul memuat alokasi menit (jumlahnya sesuai durasi pertemuan) dan 3-6 poin langkah konkret (apa yang dilakukan pendidik dan peserta didik). Kegiatan inti harus mengikuti sintaks model pembelajaran yang dipakai dan mengarah pada tujuan pembelajaran pertemuan ini.', 360),
    ] });
  }
  T.push({ id: 'asesmen', label: 'Asesmen (diagnostik, formatif, sumatif)', grup: 'B. KOMPONEN INTI', sections: [
    S('asesmen_diagnostik', 'Asesmen Diagnostik', 'Rancang asesmen diagnostik singkat sebelum pembelajaran: tujuan, teknik, 2-3 contoh pertanyaan.', 90),
    S('asesmen_formatif', 'Asesmen Formatif', 'Rancang asesmen selama proses: teknik, instrumen, dan tabel rubrik singkat (Aspek | Perlu Bimbingan | Cakap | Mahir).', 150),
    S('asesmen_sumatif', 'Asesmen Sumatif', 'Rancang asesmen akhir: bentuk, 3-5 contoh butir soal/tugas selaras tujuan (sertakan kunci/kriteria singkat), dan kriteria ketercapaian.', 200),
  ] });
  return T;
}

function tahapSatuLembar(n, jenis) {
  const T = [];
  T.push({ id: 'tujuan', label: 'Tujuan pembelajaran dan media', grup: 'A. TUJUAN PEMBELAJARAN', sections: [
    S('cp', 'Capaian Pembelajaran', null, 0, { tetap: 'cp' }),
    S('tp', 'Tujuan Pembelajaran', null, 0, { tetap: 'tp' }),
    S('media', 'Media, Alat, dan Sumber Belajar', 'Daftar ringkas (4-6 butir) media, alat/bahan, dan sumber belajar yang realistis untuk PKBM.', 60),
  ] });
  for (let i = 1; i <= n; i++) {
    T.push({ id: 'langkah_' + i, label: `Langkah kegiatan - pertemuan ${i}`, grup: 'B. LANGKAH-LANGKAH KEGIATAN PEMBELAJARAN', pertemuan: i, sections: [
      S('langkah_' + i, `Pertemuan ke-${i}`, 'Susun langkah kegiatan ringkas dengan subjudul ### "Pendahuluan", "Kegiatan Inti", dan "Penutup", masing-masing dengan alokasi menit (jumlahnya sesuai durasi pertemuan) dan 2-5 poin langkah konkret. Gunakan bahasa padat karena RPP ini sengaja dibuat ringkas.', 260),
    ] });
  }
  T.push({ id: 'penilaian', label: 'Penilaian pembelajaran', grup: 'C. PENILAIAN PEMBELAJARAN', sections: [
    S('penilaian', 'Penilaian', 'Tulis penilaian ringkas: (1) teknik dan instrumen, (2) tabel rubrik/kriteria singkat (Aspek | Perlu Bimbingan | Cakap | Mahir), (3) 3 contoh butir soal/tugas selaras tujuan beserta kunci/kriteria singkat.', 200),
  ] });
  return T;
}

function tahapTindakLanjut(format) {
  const grupTL = format === 'pm' ? 'E. TINDAK LANJUT DAN REFLEKSI' : (format === 'merdeka' ? 'B. KOMPONEN INTI' : 'D. TINDAK LANJUT DAN REFLEKSI');
  return [{ id: 'tindak_lanjut', label: 'Pengayaan, remedial, dan refleksi', grup: grupTL, sections: [
    S('pengayaan', 'Pengayaan', 'Rancang kegiatan pengayaan untuk peserta didik yang sudah mencapai tujuan (2-3 kegiatan konkret).', 80),
    S('remedial', 'Remedial', 'Rancang kegiatan remedial untuk peserta didik yang belum mencapai tujuan (2-3 kegiatan konkret dan cara menilai ulang).', 80),
    S('refleksi', 'Refleksi', 'Tulis 3-4 pertanyaan refleksi untuk peserta didik dan 3-4 pertanyaan refleksi untuk pendidik (gunakan dua subjudul ###).', 100),
  ] }];
}

function tahapLampiran(format) {
  const grup = format === 'pm' ? 'F. LAMPIRAN' : (format === 'merdeka' ? 'C. LAMPIRAN' : 'E. LAMPIRAN');
  return [
    { id: 'lampiran_lkpd', label: 'Lampiran: LKPD', grup, sections: [
      S('lkpd', 'Lembar Kerja Peserta Didik (LKPD)', 'Susun LKPD siap pakai: identitas (nama/kelas), petunjuk, 3-5 kegiatan/pertanyaan bertahap (dari memahami ke mengaplikasi), dan ruang refleksi. Tulis isinya lengkap, bukan kerangka kosong.', 380),
    ] },
    { id: 'lampiran_bahan', label: 'Lampiran: bahan bacaan', grup, sections: [
      S('bahan', 'Bahan Bacaan Pendidik dan Peserta Didik', 'Tulis ringkasan materi yang benar secara substansi dan mudah dipahami: konsep kunci, penjelasan, 1-2 contoh kontekstual. Gunakan subjudul ###.', 420),
    ] },
    { id: 'lampiran_lain', label: 'Lampiran: rubrik, glosarium, daftar pustaka', grup, sections: [
      S('rubrik', 'Rubrik Penilaian', 'Susun tabel rubrik penilaian produk/unjuk kerja (kolom: Kriteria | Skor 4 | Skor 3 | Skor 2 | Skor 1) dengan 3-4 kriteria, ditambah satu kalimat pedoman penghitungan nilai akhir (skor perolehan dibagi skor maksimal dikali 100).', 160),
      S('glosarium', 'Glosarium', 'Daftar 5-8 istilah penting beserta definisi singkatnya (format: **istilah**: definisi).', 90),
      S('pustaka', 'Daftar Pustaka', 'Daftar 3-5 rujukan yang lazim dan nyata (buku teks mata pelajaran Kemendikdasmen/Kemendikbudristek, panduan resmi). JANGAN mengarang judul, penulis, atau tautan; bila tidak yakin, tulis rujukan umum seperti "Buku Teks [mata pelajaran] Kelas [..], Kemendikdasmen" dan sarankan pendidik memeriksa edisi terbaru.', 70),
    ] },
  ];
}

function susunTahapan(format, jenis, jumlahPertemuan) {
  const fmt = FORMAT[format] ? format : 'pm';
  const jen = jenis === 'modul' ? 'modul' : 'rpp';
  const n = Math.min(Math.max(parseInt(jumlahPertemuan, 10) || 1, 1), 6);
  const dasar = ({ pm: tahapPM, merdeka: tahapMerdeka, satu_lembar: tahapSatuLembar })[fmt](n, jen);
  const semua = jen === 'modul' ? [...dasar, ...tahapTindakLanjut(fmt), ...tahapLampiran(fmt)] : dasar;
  return semua.map((t, i) => ({ ...t, urut: i }));
}

// ---------------------------------------------------------------------------------------------
// Konteks & prompt
// ---------------------------------------------------------------------------------------------
const bersih = (v, maks = 400) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, maks);

function normalisasiKonteks(k = {}) {
  const jpPer = Math.min(Math.max(parseInt(k.jp_per_pertemuan, 10) || 2, 1), 10);
  const menitJp = Math.min(Math.max(parseInt(k.menit_jp, 10) || 40, 20), 60);
  const n = Math.min(Math.max(parseInt(k.jumlah_pertemuan, 10) || 1, 1), 6);
  const cp = k.cp && typeof k.cp === 'object' ? {
    kode: bersih(k.cp.kode, 30), elemen: bersih(k.cp.elemen, 120), deskripsi: bersih(k.cp.deskripsi, 1500),
  } : null;
  const tp = (Array.isArray(k.tp) ? k.tp : []).filter((t) => t && bersih(t.deskripsi)).slice(0, 20)
    .map((t) => ({ kode: bersih(t.kode, 30), deskripsi: bersih(t.deskripsi, 500) }));
  return {
    mapel: bersih(k.mapel, 120), program: bersih(k.program, 20), kelas: bersih(k.kelas, 10), fase: bersih(k.fase, 5),
    semester: bersih(k.semester, 10), topik: bersih(k.topik, 300),
    cp, tp, jp_per_pertemuan: jpPer, menit_jp: menitJp, jumlah_pertemuan: n,
    menit_pertemuan: jpPer * menitJp,
    model: bersih(k.model, 120), karakter: bersih(k.karakter, 600), catatan: bersih(k.catatan, 800),
  };
}

function teksTetap(jenisTetap, k) {
  if (jenisTetap === 'cp') {
    if (!k.cp || !k.cp.deskripsi) return '(Isi Capaian Pembelajaran sesuai mata pelajaran dan fase.)';
    return (k.cp.elemen ? `**Elemen:** ${k.cp.elemen}\n\n` : '') + k.cp.deskripsi;
  }
  if (jenisTetap === 'tp') {
    if (!k.tp.length) return '(Isi Tujuan Pembelajaran.)';
    return k.tp.map((t, i) => `${i + 1}. ${t.kode ? `[${t.kode}] ` : ''}${t.deskripsi}`).join('\n');
  }
  if (jenisTetap === 'topik') return k.topik || '-';
  return '';
}

// Bagi TP secara berurutan ke tiap pertemuan.
function tpPertemuan(k, ke) {
  if (!k.tp.length) return [];
  const n = k.jumlah_pertemuan;
  if (n <= 1) return k.tp;
  const per = Math.ceil(k.tp.length / n);
  const potong = k.tp.slice((ke - 1) * per, ke * per);
  return potong.length ? potong : [k.tp[k.tp.length - 1]];
}

function blokKonteks(k, tahap) {
  const b = [];
  b.push(`Mata pelajaran: ${k.mapel}`);
  b.push(`Program/jenjang: ${k.program || 'Paket B/C'}${k.kelas ? `, Kelas ${k.kelas}` : ''}${k.fase ? `, Fase ${k.fase}` : ''}${k.semester ? `, Semester ${k.semester}` : ''} (pendidikan kesetaraan di PKBM, Kurikulum Merdeka)`);
  b.push(`Topik/materi: ${k.topik}`);
  if (k.cp && k.cp.deskripsi) b.push(`Capaian Pembelajaran${k.cp.elemen ? ` (elemen ${k.cp.elemen})` : ''}: ${k.cp.deskripsi}`);
  const tpDipakai = tahap && tahap.pertemuan ? tpPertemuan(k, tahap.pertemuan) : k.tp;
  if (tpDipakai.length) b.push(`Tujuan Pembelajaran${tahap && tahap.pertemuan ? ` yang menjadi fokus pertemuan ini` : ''}:\n${tpDipakai.map((t, i) => `${i + 1}. ${t.deskripsi}`).join('\n')}`);
  b.push(`Waktu: ${k.jumlah_pertemuan} pertemuan, tiap pertemuan ${k.jp_per_pertemuan} JP x ${k.menit_jp} menit = ${k.menit_pertemuan} menit.`);
  if (k.model) b.push(`Model/pendekatan pembelajaran yang ditentukan: ${k.model}`);
  if (k.karakter) b.push(`Karakteristik peserta didik: ${k.karakter}`);
  if (k.catatan) b.push(`Catatan khusus dari pendidik: ${k.catatan}`);
  return b.join('\n');
}

const ATURAN = `Aturan penulisan:
- Bahasa Indonesia baku, konkret, kontekstual untuk peserta didik PKBM, dan siap dipakai langsung oleh pendidik (bukan kerangka kosong).
- JANGAN memakai placeholder seperti [isi di sini] atau "dst". JANGAN mengarang data, tautan, atau kutipan.
- Setiap nilai berupa teks dengan format markdown ringan SAJA: subjudul diawali "### ", daftar berpoin diawali "- ", daftar bernomor "1. ", tabel dengan tanda "|" (baris pemisah |---|---| setelah baris judul kolom), dan **tebal**. Jangan memakai format lain (tanpa judul #, ##, kode, atau HTML).
- Patuhi perkiraan jumlah kata per bagian; ringkas tetapi bernas.`;

// Mengembalikan { sectionsAI: [...], prompt, promptOpenAI, skema, tokens } untuk satu tahap.
function bangunPrompt(format, jenis, tahap, kon) {
  const aiSecs = tahap.sections.filter((s) => !s.tetap);
  if (!aiSecs.length) return null;
  const judulDok = (FORMAT[format] || FORMAT.pm).judul[jenis === 'modul' ? 'modul' : 'rpp'];
  const daftar = aiSecs.map((s) => `- "${s.kunci}" (${s.judul}, sekitar ${s.kata} kata): ${s.petunjuk}`).join('\n');
  const dasar = `Kamu adalah pakar kurikulum dan perancang pembelajaran pendidikan kesetaraan (PKBM) di Indonesia yang menguasai Kurikulum Merdeka dan pendekatan Pembelajaran Mendalam. Kamu sedang menyusun dokumen "${judulDok}" (format: ${(FORMAT[format] || FORMAT.pm).label}).

${blokKonteks(kon, tahap)}

Tulis bagian-bagian berikut. Kunci JSON harus persis seperti yang tertulis:
${daftar}

${ATURAN}`;
  const keys = aiSecs.map((s) => s.kunci);
  const totalKata = aiSecs.reduce((a, s) => a + s.kata, 0);
  return {
    sectionsAI: aiSecs,
    keys,
    prompt: `${dasar}\nBalas HANYA dengan satu JSON object sesuai skema, tanpa teks tambahan.`,
    promptOpenAI: `${dasar}\nBalas HANYA dengan satu JSON object berbentuk {${keys.map((x) => `"${x}":"..."`).join(',')}} tanpa teks tambahan dan tanpa code fence. Isi tiap nilai dengan teks markdown ringan (gunakan \\n untuk baris baru).`,
    skema: { type: 'OBJECT', properties: Object.fromEntries(keys.map((x) => [x, { type: 'STRING' }])), required: keys },
    tokens: Math.min(7500, Math.max(1200, Math.round(900 + totalKata * 2.6))),
  };
}

module.exports = { FORMAT, susunTahapan, normalisasiKonteks, teksTetap, bangunPrompt };
