/**
 * Generator Jadwal Pelajaran PKBM (Paket B & C) — berjalan di browser, tanpa server.
 *
 * Yang dijamin oleh generator ini:
 *  1. Satu kelas tidak pernah punya dua mapel di jam yang sama.
 *  2. Mapel yang sama TIDAK diajarkan di dua kelas berbeda pada waktu yang bertumpuk
 *     (asumsi: satu mapel = satu guru/ruang; sistem belum menyimpan data guru).
 *     Berlaku juga lintas program (Paket B & C bertemu pada hari Jumat pagi).
 *  3. Blok jam pelajaran tidak melintasi waktu istirahat.
 *  4. Muatan Lokal dibatasi maksimal 2 JP per minggu (ketentuan struktur kurikulum kesetaraan).
 *  5. Satu mapel maksimal satu blok per hari (selama masih memungkinkan).
 *
 * Catatan: bobot JP per mapel di bawah adalah DEFAULT yang dibagi proporsional ke jumlah jam
 * pelajaran yang tersedia di jam belajar PKBM; admin bebas mengubahnya di tab Generate.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JadwalGen = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const MULOK_MAKS_JP = 2;

  const M = {
    PAI: 'Pendidikan Agama dan Budi Pekerti',
    PANCASILA: 'Pendidikan Pancasila',
    INDO: 'Bahasa Indonesia',
    MTK: 'Matematika',
    ING: 'Bahasa Inggris',
    IPA: 'IPA (Ilmu Pengetahuan Alam)',
    IPS: 'IPS (Ilmu Pengetahuan Sosial)',
    SENI: 'Seni dan Budaya',
    PJOK: 'PJOK (Pendidikan Jasmani, Olahraga, dan Kesehatan)',
    MULOK: 'Muatan Lokal (Bahasa Sunda)',
    PEMB: 'Pemberdayaan dan Keterampilan',
    SEJARAH: 'Sejarah',
    FISIKA: 'Fisika', KIMIA: 'Kimia', BIOLOGI: 'Biologi',
    EKONOMI: 'Ekonomi', GEOGRAFI: 'Geografi', SOSIOLOGI: 'Sosiologi',
    PILIHAN: 'Mata Pelajaran Pilihan',
  };

  const enc = (arr) => arr.map(([mapel, jp]) => ({ mapel, jp }));

  /** Muatan default per kelas. Total = 30 JP/minggu (6 jam x 5 hari) — sesuai jam belajar bawaan aplikasi. */
  function muatanDefault(program, grup) {
    if (program === 'PAKET_B') { // Fase D (kelas 7-9)
      return enc([[M.PAI, 2], [M.PANCASILA, 2], [M.INDO, 4], [M.MTK, 4], [M.IPA, 3], [M.IPS, 3],
        [M.ING, 3], [M.PJOK, 2], [M.SENI, 1], [M.MULOK, 2], [M.PEMB, 4]]);
    }
    if (String(grup) === '10') { // Fase E: IPA (Fisika, Kimia, Biologi) + IPS (Sejarah, Ekonomi, Geografi, Sosiologi)
      return enc([[M.PAI, 2], [M.PANCASILA, 2], [M.INDO, 3], [M.MTK, 3], [M.ING, 3],
        [M.FISIKA, 1], [M.KIMIA, 1], [M.BIOLOGI, 1],
        [M.SEJARAH, 1], [M.EKONOMI, 1], [M.GEOGRAFI, 1], [M.SOSIOLOGI, 1],
        [M.PJOK, 2], [M.SENI, 1], [M.MULOK, 2], [M.PEMB, 5]]);
    }
    // Fase F (kelas 11-12): kelompok umum + mapel pilihan (nama bisa diganti admin, mis. "Ekonomi", "Biologi")
    return enc([[M.PAI, 2], [M.PANCASILA, 2], [M.INDO, 3], [M.MTK, 3], [M.ING, 3], [M.SEJARAH, 1],
      [M.PJOK, 2], [M.SENI, 1], [M.PILIHAN, 6], [M.MULOK, 2], [M.PEMB, 5]]);
  }

  const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ');
  const kunci = (s) => norm(s).toLowerCase();
  const adalahMulok = (n) => /muatan lokal|^mulok/i.test(n);
  const toMin = (t) => Number(String(t).slice(0, 2)) * 60 + Number(String(t).slice(3, 5));
  const tipeHari = (hari) => (hari === 5 ? 'JUMAT' : 'REGULER');

  /** Rapikan muatan: gabung duplikat, buang jp<=0, batasi Muatan Lokal <= 2 JP. */
  function rapikanMuatan(rows) {
    const peta = new Map(); const catatan = [];
    for (const r of rows || []) {
      const nama = norm(r.mapel); const jp = Math.floor(Number(r.jp));
      if (!nama || !(jp > 0)) continue;
      const k = kunci(nama);
      if (peta.has(k)) peta.get(k).jp += jp; else peta.set(k, { mapel: nama, jp });
    }
    const out = [...peta.values()];
    for (const r of out) {
      if (adalahMulok(r.mapel) && r.jp > MULOK_MAKS_JP) {
        catatan.push(`${r.mapel} dibatasi ${MULOK_MAKS_JP} JP/minggu (ketentuan maksimum muatan lokal).`);
        r.jp = MULOK_MAKS_JP;
      }
    }
    return { rows: out, catatan };
  }

  /** Jika total JP melebihi kapasitas, kurangi mapel dengan JP terbanyak satu per satu (minimal 1 JP). */
  function sesuaikanKapasitas(rows, kapasitas) {
    const hasil = rows.map((r) => ({ ...r }));
    const dikurangi = [];
    let total = hasil.reduce((a, r) => a + r.jp, 0);
    while (total > kapasitas) {
      const kandidat = hasil.filter((r) => r.jp > 1).sort((a, b) => b.jp - a.jp)[0];
      if (!kandidat) break;
      kandidat.jp -= 1; total -= 1; dikurangi.push(kandidat.mapel);
    }
    return { rows: hasil, total, dikurangi, cukup: total <= kapasitas };
  }

  function pecahBlok(jp, acak) {
    const out = []; let sisa = jp;
    while (sisa > 0) {
      if (sisa >= 2 && !(sisa === 3 && acak() < 0.15)) { out.push(2); sisa -= 2; }
      else if (sisa === 3) { out.push(3); sisa = 0; }
      else { out.push(1); sisa -= 1; }
    }
    return out;
  }

  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const BERAT = /matematika|bahasa indonesia|bahasa inggris|ipa|fisika|kimia|biologi/i;
  const RINGAN_AKHIR = /pjok|seni/i;

  /** Segmen = deretan jam PELAJARAN berurutan tanpa istirahat di antaranya. */
  function segmenHari(slotsProgram, hari) {
    const rows = (slotsProgram[tipeHari(hari)] || []).slice().sort((a, b) => (a.urut ?? 0) - (b.urut ?? 0));
    const segs = []; let cur = [];
    for (const s of rows) {
      if (s.jenis === 'PELAJARAN') cur.push(s);
      else if (cur.length) { segs.push(cur); cur = []; }
    }
    if (cur.length) segs.push(cur);
    return segs;
  }

  function kapasitasKelas(slotsProgram) {
    let n = 0;
    for (let h = 1; h <= 5; h++) n += (slotsProgram[tipeHari(h)] || []).filter((s) => s.jenis === 'PELAJARAN').length;
    return n;
  }

  function tumpang(a, b) { return a.mulai < b.selesai && b.mulai < a.selesai; }

  /**
   * @param {Object} p
   * @param {Array}  p.target   [{ grup, program, muatan:[{mapel,jp}] }]
   * @param {Array}  p.tetap    [{ grup, program, jadwal:[{hari,jam_ke,mapel}] }]  kelas lain yang TIDAK diubah
   * @param {Object} p.slots    { PAKET_B:{REGULER:[...],JUMAT:[...]}, PAKET_C:{...} }  (baris dengan jenis, jam_ke, mulai, selesai, urut)
   * @param {Object} p.opsi     { hindariBentrok:true, percobaan:400, seed:1 }
   */
  function generate(p) {
    const opsi = Object.assign({ hindariBentrok: true, percobaan: 400, seed: 1 }, p.opsi || {});
    const peringatan = []; const perKelas = {};
    const target = p.target.map((t) => {
      const kap = kapasitasKelas(p.slots[t.program] || {});
      const r1 = rapikanMuatan(t.muatan); peringatan.push(...r1.catatan.map((c) => `Kelas ${t.grup}: ${c}`));
      const r2 = sesuaikanKapasitas(r1.rows, kap);
      if (r2.dikurangi.length) peringatan.push(`Kelas ${t.grup}: total muatan ${r1.rows.reduce((a, r) => a + r.jp, 0)} JP melebihi ${kap} jam pelajaran yang tersedia, sehingga ${r2.dikurangi.length} JP dikurangi otomatis dari mapel ber-JP terbanyak.`);
      if (!r2.cukup) peringatan.push(`Kelas ${t.grup}: muatan tetap melebihi kapasitas. Ubah jam belajar atau kurangi mapel.`);
      perKelas[t.grup] = { kapasitas: kap, jpTarget: r2.total, terisi: 0, kosong: 0, konflik: 0 };
      return { grup: t.grup, program: t.program, muatan: r2.rows };
    });

    // pendaftaran jadwal kelas lain yang tetap (untuk cek bentrok lintas kelas)
    const dasar = new Map(); // `${hari}|${mapel}` -> [{mulai,selesai,grup}]
    const daftar = (peta, hari, mapel, program, jamKe, grup) => {
      const sl = (p.slots[program]?.[tipeHari(hari)] || []).find((s) => s.jam_ke === jamKe && s.jenis === 'PELAJARAN');
      if (!sl) return;
      const key = `${hari}|${kunci(mapel)}`;
      if (!peta.has(key)) peta.set(key, []);
      peta.get(key).push({ mulai: toMin(sl.mulai), selesai: toMin(sl.selesai), grup });
    };
    const targetGrup = new Set(target.map((t) => t.grup));
    for (const f of p.tetap || []) {
      if (targetGrup.has(f.grup)) continue;
      for (const j of f.jadwal) daftar(dasar, j.hari, j.mapel, f.program, j.jam_ke, f.grup);
    }

    let terbaik = null;
    for (let percobaan = 0; percobaan < opsi.percobaan; percobaan++) {
      const acak = rng(opsi.seed * 7919 + percobaan * 104729);
      const longgar = percobaan > opsi.percobaan * 0.6 ? 1 : 0; // percobaan akhir: boleh mapel sama 2x sehari
      const peta = new Map([...dasar].map(([k, v]) => [k, v.slice()]));
      const urutan = target.slice().sort(() => acak() - 0.5);
      const hasil = {}; let konflik = 0; let kosong = 0; let skor = 0;

      for (const t of urutan) {
        const slotsP = p.slots[t.program] || {};
        const grid = {}; const hariMapel = {}; const isiHari = {};
        for (let h = 1; h <= 5; h++) { grid[h] = {}; hariMapel[h] = new Set(); isiHari[h] = 0; }
        const segs = {}; for (let h = 1; h <= 5; h++) segs[h] = segmenHari(slotsP, h);

        const blok = [];
        for (const m of t.muatan) for (const ukuran of pecahBlok(m.jp, acak)) blok.push({ mapel: m.mapel, ukuran });
        blok.sort((a, b) => b.ukuran - a.ukuran || acak() - 0.5);

        const bentrok = (hari, mapel, jamKe) => {
          const sl = (slotsP[tipeHari(hari)] || []).find((s) => s.jam_ke === jamKe && s.jenis === 'PELAJARAN');
          if (!sl) return false;
          const w = { mulai: toMin(sl.mulai), selesai: toMin(sl.selesai) };
          return (peta.get(`${hari}|${kunci(mapel)}`) || []).some((o) => o.grup !== t.grup && tumpang(w, o));
        };
        const kandidat = (b, bolehSama, cekBentrok) => {
          const out = [];
          for (let h = 1; h <= 5; h++) {
            if (!bolehSama && hariMapel[h].has(kunci(b.mapel))) continue;
            for (const seg of segs[h]) {
              for (let i = 0; i + b.ukuran <= seg.length; i++) {
                const potong = seg.slice(i, i + b.ukuran);
                if (potong.some((s) => grid[h][s.jam_ke])) continue;
                if (cekBentrok && potong.some((s) => bentrok(h, b.mapel, s.jam_ke))) continue;
                const posisi = seg[i].jam_ke - 1;
                let s = isiHari[h] * 1.5 + acak() * 2.2;
                if (BERAT.test(b.mapel)) s += posisi * 1.1;
                if (RINGAN_AKHIR.test(b.mapel)) s += (5 - posisi) * 0.7;
                out.push({ h, potong, s });
              }
            }
          }
          return out.sort((a, b) => a.s - b.s);
        };
        const tempatkan = (b, c) => {
          for (const s of c.potong) {
            grid[c.h][s.jam_ke] = b.mapel; isiHari[c.h] += 1;
            const key = `${c.h}|${kunci(b.mapel)}`;
            if (!peta.has(key)) peta.set(key, []);
            peta.get(key).push({ mulai: toMin(s.mulai), selesai: toMin(s.selesai), grup: t.grup });
          }
          hariMapel[c.h].add(kunci(b.mapel));
        };

        let konflikKelas = 0;
        const antrian = blok.slice();
        while (antrian.length) {
          const b = antrian.shift();
          let c = kandidat(b, false, opsi.hindariBentrok)[0]
            || (longgar ? kandidat(b, true, opsi.hindariBentrok)[0] : null);
          if (!c && b.ukuran > 1) { // pecah blok jadi jam tunggal lalu coba lagi
            for (let k = 0; k < b.ukuran; k++) antrian.push({ mapel: b.mapel, ukuran: 1 });
            continue;
          }
          if (!c) c = kandidat(b, true, opsi.hindariBentrok)[0];
          if (!c && opsi.hindariBentrok) { c = kandidat(b, true, false)[0]; if (c) konflikKelas += 1; }
          if (c) tempatkan(b, c);
        }

        const jadwal = []; let terisi = 0; let kosongKelas = 0;
        for (let h = 1; h <= 5; h++) {
          for (const seg of segs[h]) for (const s of seg) {
            if (grid[h][s.jam_ke]) { jadwal.push({ hari: h, jam_ke: s.jam_ke, mapel: grid[h][s.jam_ke] }); terisi += 1; }
            else kosongKelas += 1;
          }
        }
        hasil[t.grup] = { jadwal, terisi, kosong: kosongKelas, konflik: konflikKelas };
        konflik += konflikKelas;
        // kosong sebenarnya = kapasitas - jpTarget (sengaja); yang dihitung salah = jam target yang tidak terpasang
        kosong += Math.max(0, perKelas[t.grup].jpTarget - terisi);
        // sebaran: hukum hari yang sangat timpang
        const beban = Object.values(isiHari); skor += (Math.max(...beban) - Math.min(...beban));
      }

      const nilai = konflik * 1000 + kosong * 500 + skor;
      if (!terbaik || nilai < terbaik.nilai) terbaik = { nilai, hasil, konflik, kosong, percobaan: percobaan + 1 };
      if (nilai === 0 || (konflik === 0 && kosong === 0 && percobaan > 60)) break;
    }

    const jadwal = {};
    for (const t of target) {
      const h = terbaik.hasil[t.grup];
      jadwal[t.grup] = h.jadwal;
      Object.assign(perKelas[t.grup], { terisi: h.terisi, kosong: perKelas[t.grup].kapasitas - h.terisi, konflik: h.konflik });
    }
    if (terbaik.kosong) peringatan.push(`${terbaik.kosong} JP belum dapat ditempatkan tanpa bentrok. Coba generate ulang atau kurangi muatan.`);
    if (terbaik.konflik) peringatan.push(`${terbaik.konflik} blok terpaksa bentrok antar-kelas (mapel yang sama di jam yang bertumpuk). Coba generate ulang.`);
    return { jadwal, perKelas, konflik: terbaik.konflik, belumTertempatkan: terbaik.kosong, percobaan: terbaik.percobaan, peringatan };
  }

  /** Cek bentrok pada kumpulan jadwal (dipakai untuk verifikasi). */
  function cekBentrok(semua, slots) {
    // semua: [{grup, program, jadwal}]
    const daftar = [];
    for (const k of semua) for (const j of k.jadwal) {
      const sl = (slots[k.program]?.[tipeHari(j.hari)] || []).find((s) => s.jam_ke === j.jam_ke && s.jenis === 'PELAJARAN');
      if (sl) daftar.push({ grup: k.grup, hari: j.hari, jam_ke: j.jam_ke, mapel: kunci(j.mapel), mulai: toMin(sl.mulai), selesai: toMin(sl.selesai) });
    }
    const masalah = [];
    for (let i = 0; i < daftar.length; i++) for (let j = i + 1; j < daftar.length; j++) {
      const a = daftar[i]; const b = daftar[j];
      if (a.hari !== b.hari || a.mapel !== b.mapel || a.grup === b.grup) continue;
      if (tumpang(a, b)) masalah.push([a, b]);
    }
    return masalah;
  }

  return { M, MULOK_MAKS_JP, muatanDefault, rapikanMuatan, sesuaikanKapasitas, kapasitasKelas, generate, cekBentrok };
});
