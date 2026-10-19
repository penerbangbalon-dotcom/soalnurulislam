// ===== Pop-up "Absen Berhasil" + suara + konfeti =====
// Dipakai di siswa/dashboard.html. Panggil siapkanSuaraAbsen() saat siswa menekan
// tombol (agar browser mengizinkan suara), lalu tampilkanAbsenBerhasil({...}) saat sukses.
(function () {
  let audioCtx = null;

  // Panggil di dalam handler klik (gesture pengguna) supaya suara tidak diblokir browser,
  // terutama di iPhone/Safari karena ada jeda mengambil GPS sebelum absen sukses.
  window.siapkanSuaraAbsen = function () {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
  };

  function bunyiBerhasil() {
    try {
      siapkanSuaraAbsen();
      if (!audioCtx) return;
      // tiga nada naik: "ting-ting-ting!"
      [[523, 0], [659, 0.13], [988, 0.26]].forEach(([f, t]) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        const t0 = audioCtx.currentTime + t;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t0); o.stop(t0 + 0.55);
      });
    } catch (e) {}
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function konfeti() {
    if (!window.confetti) return;
    const warna = ['#1F8A5F', '#0E5C4A', '#D97B29', '#FFD166', '#2A6F97'];
    const tembak = (x, sudut) => confetti({ particleCount: 80, spread: 70, angle: sudut, origin: { x, y: 0.7 }, colors: warna, zIndex: 10001 });
    tembak(0.1, 60); tembak(0.9, 120);
    setTimeout(() => confetti({ particleCount: 120, spread: 100, origin: { x: 0.5, y: 0.6 }, colors: warna, zIndex: 10001 }), 250);
  }

  // opsi: { mode: 'datang'|'pulang', nama, jam, status ('HADIR'|'TERLAMBAT'), jarak }
  window.tampilkanAbsenBerhasil = function (opsi) {
    opsi = opsi || {};
    const terlambat = opsi.status === 'TERLAMBAT';
    const judul = opsi.mode === 'pulang' ? 'Absen Pulang Berhasil!' : 'Absen Datang Berhasil!';
    const warna = terlambat ? '#D97B29' : '#1F8A5F';

    if (!document.getElementById('absen-ok-style')) {
      const st = document.createElement('style');
      st.id = 'absen-ok-style';
      st.textContent = `
        .absen-ok-bg{position:fixed;inset:0;background:rgba(9,63,50,.6);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px;animation:aoFade .2s ease;}
        .absen-ok{background:#fff;border-radius:28px;padding:36px 28px 28px;text-align:center;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:aoPop .5s cubic-bezier(.2,1.4,.4,1);}
        .absen-ok svg{width:150px;height:150px;display:block;margin:0 auto;}
        .absen-ok .ao-ring{fill:var(--ao-warna);}
        .absen-ok .ao-check{fill:none;stroke:#fff;stroke-width:9;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:70;stroke-dashoffset:70;animation:aoDraw .5s .3s ease forwards;}
        .absen-ok h2{margin:18px 0 6px;font-size:1.6rem;font-weight:800;color:#1C2420;}
        .absen-ok .ao-nama{font-size:1.15rem;font-weight:600;color:#1C2420;}
        .absen-ok .ao-info{margin-top:6px;font-size:.95rem;color:#5B665F;}
        .absen-ok .ao-status{display:inline-block;margin-top:10px;padding:4px 14px;border-radius:999px;font-weight:700;font-size:.9rem;color:#fff;background:var(--ao-warna);}
        .absen-ok button{margin-top:22px;width:100%;padding:14px;border:0;border-radius:12px;font-size:1rem;font-weight:700;color:#fff;background:var(--ao-warna);cursor:pointer;}
        @keyframes aoPop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes aoFade{from{opacity:0}to{opacity:1}}
        @keyframes aoDraw{to{stroke-dashoffset:0}}`;
      document.head.appendChild(st);
    }

    const bg = document.createElement('div');
    bg.className = 'absen-ok-bg';
    bg.style.setProperty('--ao-warna', warna);
    bg.innerHTML = `
      <div class="absen-ok" role="alertdialog" aria-live="assertive">
        <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="ao-ring" cx="50" cy="50" r="48"/><path class="ao-check" d="M28 52 L44 68 L73 36"/></svg>
        <h2>${esc(judul)}</h2>
        ${opsi.nama ? `<div class="ao-nama">${esc(opsi.nama)}</div>` : ''}
        <div class="ao-info">${opsi.jam ? 'Pukul ' + esc(opsi.jam) + ' WIB' : ''}${opsi.jarak != null ? ' • ' + esc(opsi.jarak) + ' m dari sekolah' : ''}</div>
        ${terlambat ? '<span class="ao-status">Terlambat</span>' : ''}
        <button type="button">OK</button>
      </div>`;
    document.body.appendChild(bg);

    bunyiBerhasil();
    konfeti();

    const tutup = () => { clearTimeout(timer); bg.remove(); };
    const timer = setTimeout(tutup, 4500);
    bg.querySelector('button').onclick = tutup;
    bg.addEventListener('click', e => { if (e.target === bg) tutup(); });
  };
})();
