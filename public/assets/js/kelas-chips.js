// ===== Tombol Kelas: filter cepat per kelas untuk halaman admin yang punya pencarian siswa =====
// Pemakaian:
//   const kc = KelasChips.pasang(document.getElementById('kelas-chips'), {
//     onChange: (kelas) => { ... },          // kelas = '' (Semua) atau nama kelas persis seperti di data siswa
//     program: '', jenjang: '',              // opsional: batasi tombol yang tampil
//     tampilJumlah: true,                    // tampilkan jumlah siswa aktif di tiap tombol
//   });
//   kc.get();  kc.set('10 IPA');  kc.setFilter({ program: 'PAKET_C', jenjang: '' });
// Daftar kelas diambil dari /api/admin-kelas-list (dibaca sekali per halaman).
const KelasChips = (() => {
  const LABEL_PROGRAM = { UMUM: 'SD / Umum', PAKET_B: 'Paket B', PAKET_C: 'Paket C' };
  const URUT_PROGRAM = ['UMUM', 'PAKET_B', 'PAKET_C'];
  let daftarPromise = null;

  function muatDaftar(paksa = false) {
    if (!daftarPromise || paksa) {
      daftarPromise = apiCall('/admin-kelas-list').then((r) => r.data || []).catch((err) => {
        daftarPromise = null; // izinkan coba lagi
        throw err;
      });
    }
    return daftarPromise;
  }

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function pasang(container, opsi = {}) {
    const state = {
      nilai: opsi.nilai || '',
      program: opsi.program || '',
      jenjang: opsi.jenjang || '',
      daftar: [],
      siap: false,
      gagal: false,
    };
    const onChange = typeof opsi.onChange === 'function' ? opsi.onChange : () => {};
    const tampilJumlah = opsi.tampilJumlah !== false;
    container.classList.add('kelas-chips');

    function terlihat() {
      return state.daftar.filter((k) =>
        (!state.program || k.program === state.program) && (!state.jenjang || k.jenjang === state.jenjang));
    }

    function gambar() {
      if (!state.siap) {
        container.innerHTML = `<span class="kelas-chips-label">Kelas</span><span class="kelas-chips-info">${state.gagal ? 'Daftar kelas gagal dimuat.' : 'Memuat kelas…'}</span>`;
        return;
      }
      const list = terlihat();
      // Jika kelas yang sedang dipilih tidak ada lagi di daftar (mis. program diganti), kembali ke "Semua".
      // Halaman selalu membaca nilai terbaru lewat get(), jadi tidak perlu memanggil onChange di sini.
      if (state.nilai && !list.some((k) => k.kelas === state.nilai)) state.nilai = '';
      const grup = new Map();
      list.forEach((k) => {
        if (!grup.has(k.program)) grup.set(k.program, new Map());
        const m = grup.get(k.program);
        // kelas yang sama bisa muncul di beberapa jenjang: satukan jumlahnya
        if (!m.has(k.kelas)) m.set(k.kelas, { ...k });
        else { m.get(k.kelas).jumlah_aktif += k.jumlah_aktif; m.get(k.kelas).jumlah += k.jumlah; }
      });
      const idx = (p) => { const i = URUT_PROGRAM.indexOf(p); return i < 0 ? 99 : i; };
      const programUrut = [...grup.keys()].sort((a, b) => idx(a) - idx(b));
      const adaBanyakGrup = programUrut.length > 1;

      let html = `<span class="kelas-chips-label">Kelas</span>
        <button type="button" class="kelas-chip ${state.nilai === '' ? 'aktif' : ''}" data-kelas="">Semua</button>`;
      programUrut.forEach((prog) => {
        if (adaBanyakGrup) html += `<span class="kelas-chips-grup">${esc(LABEL_PROGRAM[prog] || prog)}</span>`;
        [...grup.get(prog).values()].forEach((k) => {
          const jml = tampilJumlah ? `<span class="jml">${k.jumlah_aktif}</span>` : '';
          html += `<button type="button" class="kelas-chip ${state.nilai === k.kelas ? 'aktif' : ''}" data-kelas="${esc(k.kelas)}" title="${esc(k.kelas)} — ${k.jumlah_aktif} siswa aktif">${esc(k.kelas)}${jml}</button>`;
        });
      });
      if (!list.length) html += '<span class="kelas-chips-info">Belum ada data kelas.</span>';
      container.innerHTML = html;
    }

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.kelas-chip');
      if (!btn || !container.contains(btn)) return;
      const baru = btn.dataset.kelas || '';
      // Klik tombol yang sedang aktif = batalkan pilihan (kembali ke Semua)
      state.nilai = (baru === state.nilai) ? '' : baru;
      gambar();
      onChange(state.nilai);
    });

    gambar();
    muatDaftar().then((d) => { state.daftar = d; state.siap = true; gambar(); })
      .catch((err) => { state.gagal = true; gambar(); if (err && err.status === 401) logoutAdmin(); });

    return {
      get: () => state.nilai,
      set: (v) => { state.nilai = v || ''; gambar(); },
      setFilter: ({ program, jenjang } = {}) => {
        if (program !== undefined) state.program = program || '';
        if (jenjang !== undefined) state.jenjang = jenjang || '';
        gambar();
      },
      muatUlang: () => muatDaftar(true).then((d) => { state.daftar = d; state.siap = true; gambar(); }),
    };
  }

  return { pasang, muatDaftar };
})();
