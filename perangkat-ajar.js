// Perangkat Ajar: Generate RPP, Modul Ajar, dan Pengaturannya. Dimuat dari index.html.
// Memakai global index.html: supa, SEKOLAH, currentMapelList, labelMapel, faseMapel, cpUntukMapel, tpUntukCp.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const L = (x) => (Array.isArray(x) ? x : (x ? [x] : [])).map(String).filter(Boolean);
  const NAMA = { rpp: 'RPP', modul: 'Modul Ajar', lkpd: 'LKPD' };
  const MODEL = ['Problem Based Learning (PBL)', 'Project Based Learning (PjBL)', 'Discovery Learning', 'Inquiry Learning', 'Cooperative Learning', 'Pembelajaran Kontekstual', 'Direct Instruction (ceramah interaktif)'];
  const DEF = {
    tahun_ajaran: '', menit_per_jp: 45, model_default: MODEL[0], format_rpp: 'lengkap', profil_pancasila: true,
    sertakan_rubrik: true, sertakan_remedial: true, tampilkan_kop: true, nama_kepala: '', nip_kepala: '', kota_ttd: '', catatan_ai: '',
  };
  let PENG = { ...DEF }; let pengOk = false;
  let LOGO = ''; let logoSumber = null;
  const terakhir = {}; // jenis -> { html, judul, meta }

  function tahunAjaranOtomatis() { const d = new Date(); const y = d.getFullYear(); return d.getMonth() >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`; }

  async function muatPengaturan() {
    if (pengOk) return;
    try {
      const { data } = await supa.from('pengaturan_perangkat').select('data').eq('id', 1).maybeSingle();
      PENG = { ...DEF, ...((data && data.data) || {}) };
    } catch (e) { /* tabel belum ada: pakai bawaan */ }
    if (!PENG.tahun_ajaran) PENG.tahun_ajaran = tahunAjaranOtomatis();
    if (!PENG.kota_ttd && typeof SEKOLAH !== 'undefined') PENG.kota_ttd = SEKOLAH.kota_ttd || '';
    if (!PENG.nama_kepala) {
      try {
        const { data } = await supa.from('pengaturan_ttd').select('nama').eq('jenis', 'kepala_pkbm').limit(1);
        if (data && data[0] && data[0].nama) PENG.nama_kepala = data[0].nama;
      } catch (e) { /* abaikan */ }
    }
    pengOk = true;
  }

  // Logo sekolah -> data URI kecil, supaya ikut tersimpan di dokumen dan terunduh ke Word
  async function muatLogo() {
    const src = ((typeof SEKOLAH !== 'undefined' && SEKOLAH && SEKOLAH.logo_url) || 'logo-pkbm.png');
    if (logoSumber === src && LOGO) return;
    logoSumber = src;
    try {
      LOGO = await new Promise((res, rej) => {
        const im = new Image(); if (!/^data:/.test(src)) im.crossOrigin = 'anonymous';
        im.onload = () => {
          const k = Math.min(1, 180 / Math.max(im.naturalWidth, im.naturalHeight));
          const cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
          cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          try { res(cv.toDataURL('image/png')); } catch (e) { rej(e); }
        };
        im.onerror = () => rej(new Error('logo tidak terbaca')); im.src = src;
      });
    } catch (e) { LOGO = ''; }
  }

  // ---------------- Halaman Generate (RPP / Modul) ----------------
  function halaman(jenis) {
    const j = jenis;
    const mapel = (currentMapelList || []).map((m) => `<option value="${m.id}">${esc(labelMapel(m))}</option>`).join('');
    return `
      <h2>Generate ${NAMA[j]} dengan AI</h2>
      <p class="muted">${j === 'lkpd'
        ? 'LKPD mengikuti format Permendikdasmen 1/2026: tujuan, petunjuk, Kegiatan 1 Memahami, Kegiatan 2 Mengaplikasi, Kegiatan 3 Merefleksi, penilaian guru, dan <b>gambar hasil AI</b>. Gambar dibuat satu per satu setelah teks selesai.'
        : j === 'rpp'
        ? 'RPP disusun otomatis mengikuti format & pengaturan di menu <b>Pengaturan RPP &amp; Modul</b>.'
        : 'Modul Ajar lengkap mengikuti template: informasi umum, kesiapan peserta didik, desain pembelajaran, materi, langkah pembelajaran, LKPD, asesmen, diferensiasi, tindak lanjut, refleksi, dan sumber rujukan.'}
        Hasil bisa Anda <b>edit langsung</b> di layar, lalu simpan atau unduh ke Word.</p>
      <div class="card">
        <div class="grid3">
          <div class="field"><label>Mata Pelajaran</label><select id="pa-${j}-mapel" onchange="PA.mapelBerubah('${j}')">${mapel}</select></div>
          <div class="field"><label>Semester</label><select id="pa-${j}-sem"><option>Ganjil</option><option>Genap</option></select></div>
          <div class="field"><label>Capaian Pembelajaran (opsional)</label><select id="pa-${j}-cp" onchange="PA.cpBerubah('${j}')"></select></div>
        </div>
        <div class="field"><label>Tujuan Pembelajaran (centang yang dipakai)</label><div id="pa-${j}-tp" class="muted" style="max-height:150px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:8px;"></div></div>
        <div class="field"><label>Topik / Materi Pokok</label><input type="text" id="pa-${j}-topik" placeholder="mis. Persamaan Linear Satu Variabel" /></div>
        ${j === 'lkpd' ? `<div class="grid3">
          <div class="field"><label>Jumlah Pertanyaan Pemahaman</label><select id="pa-${j}-pert"><option>2</option><option selected>3</option><option>4</option><option>5</option></select></div>
          <div class="field"><label>Jumlah Gambar</label><select id="pa-${j}-gbr"><option>0</option><option>1</option><option>2</option><option selected>3</option></select></div>
          <div class="field"><label>Gaya Gambar</label><select id="pa-${j}-gaya"><option value="otomatis">Gambar AI (otomatis ilustrasi bila gagal)</option><option value="svg">Ilustrasi diagram saja (cepat)</option></select></div>
        </div>
        <div class="grid3">
          <div class="field"><label>Nama Guru</label><input type="text" id="pa-${j}-guru" /></div>
          <div class="field"><label>Alokasi Waktu (JP)</label><select id="pa-${j}-jp"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></div>
          <div class="field" style="align-self:end;"><label><input type="checkbox" id="pa-${j}-kunci" checked> Sertakan kunci jawaban (halaman guru)</label></div>
        </div>` : `<div class="grid3">
          <div class="field"><label>Jumlah Pertemuan</label><select id="pa-${j}-pert"><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
          <div class="field"><label>JP per Pertemuan</label><select id="pa-${j}-jp"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></div>
          <div class="field"><label>Nama Guru</label><input type="text" id="pa-${j}-guru" /></div>
        </div>`}
        <div class="grid3">
          <div class="field"><label>NIP/NUPTK Guru (opsional)</label><input type="text" id="pa-${j}-nip" /></div>
          ${j === 'modul' ? `<div class="field" style="grid-column:span 2;"><label>Template Modul Ajar</label><select id="pa-modul-tpl" onchange="localStorage.setItem('pa_tpl_modul', this.value)">
            <option value="1">Template 1 — Modul Ajar Lengkap (informasi umum, desain, materi, langkah bertabel, LKPD, asesmen, diferensiasi, refleksi)</option>
            <option value="2">Template 2 — Pendidikan Kesetaraan / Pembelajaran Mendalam (Informasi Umum, Dimensi Profil Lulusan, Desain, Memahami-Mengaplikasi-Merefleksi, Asesmen, Lampiran)</option>
          </select></div>` : ''}
        </div>
        <div class="toolbar">
          <button class="btn gold" id="pa-${j}-btn" onclick="PA.generate('${j}')">✦ Generate ${NAMA[j]}</button>
          <span id="pa-${j}-status" class="muted"></span>
        </div>
      </div>
      <div id="pa-${j}-hasilbox" class="hidden">
        <div class="toolbar">
          <button class="btn" onclick="PA.simpan('${j}')">💾 Simpan ke Riwayat</button>
          <button class="btn outline" onclick="PA.unduh('${j}')">⬇ Unduh Word</button>
          <button class="btn outline" onclick="PA.cetak('${j}')">🖨 Cetak / PDF</button>
          ${j === 'lkpd' ? `<button class="btn outline" onclick="PA.ulangGambar('lkpd')">🔄 Buat ulang gambar yang gagal</button>` : ''}
          <span class="muted">Dokumen di bawah bisa diedit langsung (klik teksnya).</span>
        </div>
        <div id="pa-${j}-hasil" contenteditable="true" style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:24px;font-family:'Times New Roman',serif;font-size:12pt;line-height:1.4;overflow:auto;"></div>
      </div>
      <h3 style="margin-top:24px;">Riwayat ${NAMA[j]}</h3>
      <div id="pa-${j}-riwayat"><p class="muted">Memuat...</p></div>`;
  }

  async function buka(jenis) {
    await muatPengaturan(); await muatLogo();
    const box = $('tab-' + jenis);
    if (!box.dataset.siap) {
      box.innerHTML = halaman(jenis); box.dataset.siap = '1';
      $(`pa-${jenis}-guru`).value = localStorage.getItem('pa_guru') || '';
      $(`pa-${jenis}-nip`).value = localStorage.getItem('pa_nip') || '';
      if (jenis === 'modul') $('pa-modul-tpl').value = localStorage.getItem('pa_tpl_modul') === '2' ? '2' : '1';
    }
    // daftar mapel bisa berubah (dimuat belakangan)
    const sel = $(`pa-${jenis}-mapel`); const lama = sel.value;
    sel.innerHTML = (currentMapelList || []).map((m) => `<option value="${m.id}">${esc(labelMapel(m))}</option>`).join('');
    if (lama) sel.value = lama;
    mapelBerubah(jenis);
    muatRiwayat(jenis);
  }

  function mapelBerubah(j) {
    const mid = $(`pa-${j}-mapel`).value;
    let cps = [];
    try { cps = cpUntukMapel(mid) || []; } catch (e) { /* CP/TP belum tersedia */ }
    $(`pa-${j}-cp`).innerHTML = '<option value="">— tanpa CP —</option>' +
      cps.map((c) => `<option value="${c.id}">${esc((c.kode ? c.kode + ' · ' : '') + (c.elemen || String(c.deskripsi).slice(0, 60)))}</option>`).join('');
    if (cps.length) $(`pa-${j}-cp`).value = cps[0].id;
    cpBerubah(j);
  }
  function cpBerubah(j) {
    const cid = $(`pa-${j}-cp`).value; let tps = [];
    try { tps = cid ? (tpUntukCp(cid) || []) : []; } catch (e) { /* abaikan */ }
    $(`pa-${j}-tp`).innerHTML = tps.length
      ? tps.map((t) => `<label style="display:block;margin:3px 0;"><input type="checkbox" value="${t.id}" checked> ${esc((t.kode ? t.kode + ' · ' : '') + t.deskripsi)}</label>`).join('')
      : 'Belum ada TP untuk CP ini (isi di menu CP &amp; TP per Mapel, atau cukup isi Topik di bawah).';
  }

  async function panggilAI(payload) {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('/api/perangkat-ajar', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify(payload),
    });
    const txt = await res.text(); let d;
    try { d = JSON.parse(txt); } catch (e) { d = { error: `Server tidak merespons dengan benar (HTTP ${res.status}). Kemungkinan waktu tunggu habis, coba lagi.` }; }
    if (!res.ok) throw new Error(d.error || 'Gagal generate');
    return d;
  }

  async function generate(j) {
    const m = (currentMapelList || []).find((x) => x.id === $(`pa-${j}-mapel`).value);
    if (!m) { alert('Pilih mata pelajaran dulu.'); return; }
    const cid = $(`pa-${j}-cp`).value; let cp = null; let tp = [];
    try {
      if (cid) { const c = cpDari(cid); cp = { kode: c.kode, elemen: c.elemen, deskripsi: c.deskripsi }; }
      const ids = [...document.querySelectorAll(`#pa-${j}-tp input:checked`)].map((x) => x.value);
      tp = ids.map((id) => tpDari(id)).filter(Boolean).map((t) => ({ kode: t.kode, deskripsi: t.deskripsi }));
    } catch (e) { /* abaikan */ }
    let topik = $(`pa-${j}-topik`).value.trim();
    if (!topik) topik = (cp && (cp.elemen || cp.deskripsi.slice(0, 100))) || (tp[0] && tp[0].deskripsi.slice(0, 100)) || '';
    if (!topik) { alert('Isi Topik / Materi Pokok (atau pilih CP/TP).'); return; }
    const guru = $(`pa-${j}-guru`).value.trim(); const nip = $(`pa-${j}-nip`).value.trim();
    localStorage.setItem('pa_guru', guru); localStorage.setItem('pa_nip', nip);
    const fase = typeof faseMapel === 'function' ? faseMapel(m) : '';
    const ctx = {
      mapel: m.nama, program: m.program, kelas: m.kelas, fase, semester: $(`pa-${j}-sem`).value, topik,
      pertemuan: +$(`pa-${j}-pert`).value, jp: $(`pa-${j}-jp`) ? +$(`pa-${j}-jp`).value : 2, guru, nip, cp, tp, m,
    };
    const tplModul = j === 'modul' && $('pa-modul-tpl') && $('pa-modul-tpl').value === '2' ? 2 : 1;
    const btn = $(`pa-${j}-btn`); const st = $(`pa-${j}-status`);
    await muatLogo();
    btn.disabled = true; st.style.color = ''; st.textContent = `Menyusun ${NAMA[j]}... (sekitar 15-40 detik)`;
    try {
      const r = await panggilAI({ jenis: j, mapel: m.nama, program: m.program, kelas: m.kelas, fase, semester: ctx.semester, topik, cp, tp,
        pertemuan: ctx.pertemuan, jp: ctx.jp, pengaturan: PENG, ...(j === 'modul' ? { template: tplModul } : {}),
        ...(j === 'lkpd' ? { kegiatan: ctx.pertemuan, gambar: +$(`pa-${j}-gbr`).value, kunci: $(`pa-${j}-kunci`).checked } : {}) });
      const html = j === 'rpp' ? renderRpp(r.data, ctx) : j === 'modul' ? (tplModul === 2 ? renderModul2(r.data, ctx) : renderModul(r.data, ctx)) : renderLkpd(r.data, ctx);
      $(`pa-${j}-hasil`).innerHTML = html; $(`pa-${j}-hasilbox`).classList.remove('hidden');
      terakhir[j] = { judul: `${NAMA[j]} ${m.nama} Kelas ${m.kelas || ''} - ${topik}`.slice(0, 160), meta: { mapel: m.nama, kelas: m.kelas, semester: ctx.semester, topik, provider: r.provider, ...(j === 'modul' ? { template: tplModul } : {}) }, mapel_id: m.id, semester: ctx.semester, kelas: m.kelas };
      st.textContent = `Selesai (${r.provider}). Periksa & edit bila perlu, lalu simpan/unduh.`;
      $(`pa-${j}-hasilbox`).scrollIntoView({ behavior: 'smooth' });
      if (j === 'lkpd') { terakhir[j].gambar = (Array.isArray(r.data.gambar) ? r.data.gambar : []).slice(0, 3).map((g) => (g && g.deskripsi) || null); pasangTombol(j); await buatGambar(j); }
    } catch (e) { st.style.color = '#B42318'; st.textContent = e.message; } finally { btn.disabled = false; }
  }

  // ---------------- Perakit dokumen ----------------
  const TB = 'border-collapse:collapse;width:100%;';
  const TD = 'border:1px solid #000;padding:4px 6px;vertical-align:top;';
  const H = (t) => `<p style="margin:12px 0 4px;"><b>${t}</b></p>`;
  const OL = (a) => (L(a).length ? `<ol style="margin:0 0 0 18px;padding-left:12px;">${L(a).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : '');
  const UL = (a) => (L(a).length ? `<ul style="margin:0 0 0 18px;padding-left:12px;">${L(a).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  const PARA = (t) => String(t || '').split(/\n{2,}|\n/).filter((x) => x.trim()).map((x) => `<p style="margin:0 0 6px;text-align:justify;">${esc(x)}</p>`).join('');

  function kop() {
    if (!PENG.tampilkan_kop) return '';
    const S = (typeof SEKOLAH !== 'undefined' && SEKOLAH) || {};
    const logo = LOGO ? `<img src="${LOGO}" width="72" height="72" style="width:72px;height:72px;">` : '';
    return `<table style="${TB}border-bottom:3px double #000;margin-bottom:12px;"><tr>
      <td style="width:80px;vertical-align:middle;padding-bottom:6px;">${logo}</td>
      <td style="text-align:center;vertical-align:middle;padding-bottom:6px;">
        ${S.nama_yayasan ? `<div style="font-size:11pt;">${esc(S.nama_yayasan)}</div>` : ''}
        <div style="font-size:14pt;font-weight:bold;">${esc(S.nama_lembaga || 'PKBM')}</div>
        <div style="font-size:9pt;">${esc(S.alamat || '')}</div></td>
      <td style="width:80px;"></td></tr></table>`;
  }
  function baris(rows) { return `<table style="${TB}">${rows.filter((r) => r[1]).map((r) => `<tr><td style="width:28%;padding:2px 4px;vertical-align:top;">${r[0]}</td><td style="width:2%;vertical-align:top;">:</td><td style="padding:2px 4px;">${r[1]}</td></tr>`).join('')}</table>`; }

  function tabelKegiatan(kegiatan, mjp, jp) {
    return (kegiatan || []).map((p, i) => {
      let tot = 0; const fase = [['Pendahuluan', p.pendahuluan], ['Kegiatan Inti', p.inti], ['Penutup', p.penutup]];
      const rows = fase.map(([nm, arr]) => {
        const items = (Array.isArray(arr) ? arr : []).map((a) => (typeof a === 'string' ? { aktivitas: a, menit: '' } : a));
        if (!items.length) return '';
        return items.map((a, k) => { tot += Number(a.menit) || 0; return `<tr>${k === 0 ? `<td rowspan="${items.length}" style="${TD}width:16%;"><b>${nm}</b></td>` : ''}<td style="${TD}">${esc(a.aktivitas)}</td><td style="${TD}width:10%;text-align:center;">${a.menit ? esc(a.menit) + ' mnt' : ''}</td></tr>`; }).join('');
      }).join('');
      return `<p style="margin:10px 0 4px;"><b>Pertemuan ke-${p.pertemuan || i + 1}</b> (${jp} JP × ${mjp} menit = ${jp * mjp} menit)</p>
        <table style="${TB}"><tr style="background:#e8e8e8;"><td style="${TD}text-align:center;"><b>Tahap</b></td><td style="${TD}text-align:center;"><b>Langkah Kegiatan</b></td><td style="${TD}text-align:center;"><b>Waktu</b></td></tr>${rows}</table>`;
    }).join('');
  }

  function ttd(c) {
    const tgl = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const S = (typeof SEKOLAH !== 'undefined' && SEKOLAH) || {};
    return `<table style="${TB}margin-top:22px;"><tr>
      <td style="width:50%;vertical-align:top;">Mengetahui,<br>${esc(S.jabatan_kepala || 'Kepala PKBM')}<br><br><br><br><u><b>${esc(PENG.nama_kepala || '..............................')}</b></u><br>${PENG.nip_kepala ? 'NIP. ' + esc(PENG.nip_kepala) : ''}</td>
      <td style="width:50%;vertical-align:top;">${esc(PENG.kota_ttd || '')}${PENG.kota_ttd ? ', ' : ''}${tgl}<br>Guru Mata Pelajaran<br><br><br><br><u><b>${esc(c.guru || '..............................')}</b></u><br>${c.nip ? 'NIP/NUPTK. ' + esc(c.nip) : ''}</td></tr></table>`;
  }

  function renderRpp(d, c) {
    const mjp = +PENG.menit_per_jp || 45; const lengkap = PENG.format_rpp !== 'ringkas';
    const ids = baris([
      ['Satuan Pendidikan', esc(((typeof SEKOLAH !== 'undefined' && SEKOLAH.nama_lembaga) || 'PKBM'))],
      ['Mata Pelajaran', esc(c.mapel)], ['Program / Kelas / Semester', esc(`${c.program || ''} / ${c.kelas || ''} / ${c.semester}${c.fase ? ' (Fase ' + c.fase + ')' : ''}`)],
      ['Tahun Pelajaran', esc(PENG.tahun_ajaran)], ['Materi Pokok', esc(d.materi_pokok || c.topik)],
      ['Alokasi Waktu', `${c.pertemuan} pertemuan × ${c.jp} JP (${c.jp * mjp} menit/pertemuan)`],
    ]);
    const pn = d.penilaian || {};
    const nilai = `<table style="${TB}"><tr style="background:#e8e8e8;"><td style="${TD}width:22%;"><b>Aspek</b></td><td style="${TD}"><b>Teknik, Bentuk &amp; Instrumen</b></td></tr>
      ${[['Sikap', pn.sikap], ['Pengetahuan', pn.pengetahuan], ['Keterampilan', pn.keterampilan]].filter((r) => r[1]).map((r) => `<tr><td style="${TD}">${r[0]}</td><td style="${TD}">${esc(r[1])}</td></tr>`).join('')}</table>`;
    let n = 0; const K = (t) => H(`${String.fromCharCode(65 + n++)}. ${t}`);
    return `${kop()}<p style="text-align:center;font-size:14pt;margin:0 0 10px;"><b>RENCANA PELAKSANAAN PEMBELAJARAN (RPP)</b></p>${ids}
      ${c.cp ? K('Capaian Pembelajaran') + `<p style="margin:0;text-align:justify;">${esc(c.cp.deskripsi)}</p>` : ''}
      ${K('Tujuan Pembelajaran')}${OL(d.tujuan)}
      ${L(d.profil).length ? K('Profil Pelajar Pancasila') + UL(d.profil) : ''}
      ${lengkap && L(d.materi).length ? K('Materi Pembelajaran') + UL(d.materi) : ''}
      ${lengkap && (d.model || d.metode) ? K('Model & Metode Pembelajaran') + `<p style="margin:0;">Model: ${esc(d.model || '')}<br>Metode: ${esc(d.metode || '')}</p>` : ''}
      ${lengkap && L(d.media).length ? K('Media, Alat & Bahan') + UL(d.media) : ''}
      ${lengkap && L(d.sumber).length ? K('Sumber Belajar') + UL(d.sumber) : ''}
      ${K('Langkah-langkah Pembelajaran')}${tabelKegiatan(d.kegiatan, mjp, c.jp)}
      ${K('Penilaian')}${nilai}
      ${lengkap && (d.remedial || d.pengayaan) ? K('Remedial & Pengayaan') + `<p style="margin:0;">${d.remedial ? '<b>Remedial:</b> ' + esc(d.remedial) + '<br>' : ''}${d.pengayaan ? '<b>Pengayaan:</b> ' + esc(d.pengayaan) : ''}</p>` : ''}
      ${ttd(c)}`;
  }

  // ---------------- Modul Ajar: mengikuti template "Modul Ajar ... (Contoh Lengkap)" ----------------
  // Susunan: sampul + identitas, catatan, A Informasi Umum, B Kesiapan Peserta Didik, C Desain Pembelajaran,
  // D Materi, E Langkah Pembelajaran, F LKPD, G Asesmen, H Diferensiasi, I Tindak Lanjut, J Refleksi, K Sumber Rujukan.
  const M_FONT = 'Arial,Helvetica,sans-serif';
  const M_HIJAU = '#548235', M_MUDA = '#F4F8F1';
  const S_ = (x) => String(x == null ? '' : x);
  const mh1 = (t, css = '') => `<h1 style="font-family:${M_FONT};font-size:16pt;font-weight:bold;color:${M_HIJAU};margin:14pt 0 4pt;${css}">${esc(t)}</h1>`;
  const mh2 = (t) => `<h2 style="font-family:${M_FONT};font-size:13pt;font-weight:bold;color:${M_HIJAU};margin:12pt 0 4pt;">${esc(t)}</h2>`;
  const mp = (t, css = '') => (S_(t).trim() ? S_(t).split(/\n+/).filter((x) => x.trim()).map((x) => `<p style="font-family:${M_FONT};font-size:10pt;margin:0 0 4pt;text-align:justify;${css}">${esc(x)}</p>`).join('') : '');
  const mcatatan = (t) => `<p style="font-family:${M_FONT};font-size:10pt;margin:2pt 0 6pt 7pt;font-style:italic;color:#646464;">${esc(t)}</p>`;
  const mul = (a) => (L(a).length ? `<ul style="font-family:${M_FONT};font-size:10pt;margin:0 0 6pt 18pt;padding-left:0;">${L(a).map((x) => `<li style="margin:0 0 2pt;">${esc(x)}</li>`).join('')}</ul>` : '');
  const mol = (a) => (L(a).length ? `<ol style="font-family:${M_FONT};font-size:10pt;margin:0 0 6pt 18pt;padding-left:0;">${L(a).map((x) => `<li style="margin:0 0 2pt;">${esc(x)}</li>`).join('')}</ol>` : '');
  const mcell = (x, o = {}) => {
    let isi = x && typeof x === 'object' && x.h != null ? x.h : esc(S_(x)).replace(/\n/g, '<br>');
    if (o.tebal && isi) isi = `<b>${isi}</b>`;
    return `<td${o.bg ? ` bgcolor="${o.bg}"` : ''} style="border:0.5pt solid #7f7f7f;padding:3pt 5pt;vertical-align:${o.va || 'top'};font-family:${M_FONT};font-size:9pt;${o.bg ? `background:${o.bg};` : ''}${o.w ? `width:${o.w};` : ''}${o.css || ''}">${isi || '&nbsp;'}</td>`;
  };
  // tabel bergaya template: baris judul hijau berhuruf putih tebal, baris isi berselang-seling putih / hijau muda
  function mtabel(kolom, baris, lebar, opsi = {}) {
    const tgh = (i) => (opsi.tengah && opsi.tengah.includes(i) ? 'text-align:center;' : '');
    const head = opsi.tanpaHeader ? '' : `<tr>${kolom.map((k, i) => mcell(k, { bg: M_HIJAU, w: lebar && lebar[i], tebal: true, css: `color:#FFFFFF;font-weight:bold;${tgh(i)}` })).join('')}</tr>`;
    const isi = baris.map((r, ri) => `<tr style="page-break-inside:avoid;${opsi.minTinggi ? `height:${opsi.minTinggi};` : ''}">${r.map((x, i) => mcell(x, { bg: ri % 2 === 1 ? M_MUDA : '', w: lebar && lebar[i], va: opsi.va, tebal: opsi.tebalKolom1 && i === 0, css: `${i === 0 && opsi.tebalKolom1 ? 'font-weight:bold;' : (opsi.minTinggi ? `height:${opsi.minTinggi};` : '')}${tgh(i)}` })).join('')}</tr>`).join('');
    return `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:2pt 0 8pt;">${head}${isi}</table>`;
  }
  const mjudulKolom = (k) => (Array.isArray(k) ? k : []).map(S_).filter(Boolean);

  function mLangkah(kegiatan, jp, mjp) {
    const arr = (Array.isArray(kegiatan) ? kegiatan : []).filter((p) => p && Array.isArray(p.langkah));
    return arr.map((p, i) => {
      const rows = p.langkah.map((l) => [{ h: `${esc(l.tahap)}${l.menit ? `<br>${esc(l.menit)} menit` : ''}` }, S_(l.guru), S_(l.siswa), S_(l.asesmen)]);
      return (arr.length > 1 ? mh2(`Pertemuan ke-${p.pertemuan || i + 1}`) : '')
        + mtabel(['Tahap / waktu', 'Aktivitas guru', 'Aktivitas peserta didik', 'Asesmen'], rows, ['17%', '33%', '33%', '17%'], { va: 'middle' })
        + mp(`Total waktu${arr.length > 1 ? ' pertemuan ini' : ''}: ${jp * mjp} menit (${jp} JP × ${mjp} menit). Guru dapat menyesuaikan durasi dengan kondisi kelas.`, 'margin-top:4pt;');
    }).join('');
  }

  function renderModul(d, c) {
    const mjp = +PENG.menit_per_jp || 45; const jp = +c.jp || 2; const pert = +c.pertemuan || 1;
    const S = (typeof SEKOLAH !== 'undefined' && SEKOLAH) || {};
    const lembaga = S.nama_lembaga || 'PKBM';
    const lk = d.lkpd || {}; const a = d.asesmen || {};
    const waktu = `${pert} pertemuan × ${jp} JP × ${mjp} menit (${jp * mjp} menit per pertemuan)`;
    const jenjang = [c.program, c.kelas ? `Kelas ${c.kelas}` : '', c.fase ? `Fase ${c.fase}` : ''].filter(Boolean).join(' / ');
    const sub = [c.fase ? `Fase ${c.fase}` : '', c.kelas ? `Kelas ${c.kelas}` : '', c.program || '', c.semester ? `Semester ${c.semester}` : ''].filter(Boolean).join(' • ');
    const hdr = `MODUL AJAR ${S_(c.mapel).toUpperCase()} | ${S_(c.topik)}`.slice(0, 120);
    const ftr = `${lembaga} — Tahun Pelajaran ${PENG.tahun_ajaran || ''}`.trim();
    let n = 0; const H1 = (t, css = '') => mh1(`${String.fromCharCode(65 + n++)}. ${t}`, css);
    const out = [];

    // --- sampul + identitas ---
    out.push(kop().replace('<table style="', `<table style="font-family:${M_FONT};`));
    out.push(`<p style="font-family:${M_FONT};text-align:center;font-size:26pt;font-weight:bold;color:${M_HIJAU};margin:50pt 0 6pt;">MODUL AJAR ${esc(S_(c.mapel).toUpperCase())}</p>
      <p style="font-family:${M_FONT};text-align:center;font-size:17pt;font-weight:bold;margin:0 0 14pt;">${esc(S_(c.topik).toUpperCase())}</p>
      <p style="font-family:${M_FONT};text-align:center;font-size:10pt;font-style:italic;margin:0 0 16pt;">${esc(sub)}</p>`);
    out.push(mtabel(['IDENTITAS', 'KETERANGAN'], [
      ['Satuan pendidikan', lembaga], ['Penyusun', c.guru || '..............................'], ['Tahun pelajaran', PENG.tahun_ajaran || ''],
      ['Mata pelajaran', c.mapel], ['Alokasi waktu', waktu],
    ], ['31%', '69%'], { va: 'middle' }));
    out.push(`<p style="font-family:${M_FONT};text-align:center;font-size:9pt;font-style:italic;margin:6pt 0 0;">Dokumen Word ini dapat diedit dan dikembangkan sesuai kebutuhan kelas.</p>`);

    // --- A. Informasi umum ---
    out.push(H1('INFORMASI UMUM', 'page-break-before:always;'));
    out.push(mtabel(['Komponen', 'Deskripsi'], [
      ['Satuan pendidikan', lembaga], ['Penyusun', c.guru || '..............................'], ['Jenjang / kelas / fase', jenjang],
      ['Mata pelajaran', c.mapel], ['Topik', c.topik], ['Alokasi waktu', waktu], ['Model pembelajaran', S_(d.model)],
      ['Karakteristik peserta didik', S_(d.karakteristik)], ['Sarana dan prasarana', S_(d.sarpras)],
    ].filter((r) => S_(r[1]).trim()), ['31%', '69%'], { va: 'middle' }));

    // --- B. Kesiapan peserta didik ---
    out.push(H1('KESIAPAN DAN KARAKTERISTIK PESERTA DIDIK'));
    out.push(mh2('1. Kompetensi awal') + mp(d.kompetensi_awal));
    const dg = d.diagnostik || {};
    out.push(mh2('2. Asesmen diagnostik awal') + mp('Guru mengajukan pertanyaan lisan atau tertulis berikut untuk mengetahui pemahaman awal.') + mul(dg.pertanyaan)
      + (S_(dg.pemanfaatan).trim() ? mp(`Pemanfaatan hasil: ${S_(dg.pemanfaatan)}`) : ''));

    // --- C. Desain pembelajaran ---
    out.push(H1('DESAIN PEMBELAJARAN'));
    out.push(mh2('1. Capaian Pembelajaran (CP)') + (c.cp && c.cp.deskripsi
      ? (c.cp.elemen ? mp(`Elemen: ${c.cp.elemen}`) : '') + mp(c.cp.deskripsi)
      : mcatatan('Isikan kutipan CP resmi yang relevan dari dokumen CP terbaru untuk fase dan mata pelajaran yang digunakan satuan pendidikan.') + mp('[Tempelkan CP resmi di sini.]')));
    out.push(mh2('2. Tujuan pembelajaran') + mp('Setelah mengikuti pembelajaran, peserta didik diharapkan mampu:') + mol(d.tujuan));
    const kr = (Array.isArray(d.kriteria) ? d.kriteria : []).filter((k) => k && (k.bukti || k.kriteria));
    if (kr.length) out.push(mh2('3. Kriteria ketercapaian tujuan pembelajaran')
      + mtabel(['Tujuan', 'Bukti yang diharapkan', 'Kriteria ketercapaian'], kr.map((k, i) => [`TP ${i + 1}`, S_(k.bukti), S_(k.kriteria)]), ['14%', '36%', '50%'], { va: 'middle' })
      + mcatatan('Kriteria di atas adalah contoh operasional. Guru dapat menyesuaikan tingkat kesulitan dan batas ketercapaian dengan CP, ATP, kebutuhan peserta didik, dan kebijakan satuan pendidikan.'));
    let k = kr.length ? 4 : 3;
    if (S_(d.pemahaman_bermakna).trim()) out.push(mh2(`${k++}. Pemahaman bermakna`) + mp(d.pemahaman_bermakna));
    if (L(d.pertanyaan_pemantik).length) out.push(mh2(`${k++}. Pertanyaan pemantik`) + mul(d.pertanyaan_pemantik));
    if (L(d.materi_esensial).length) out.push(mh2(`${k++}. Materi esensial`) + mul(d.materi_esensial));
    if (L(d.dimensi).length) out.push(mh2(`${k++}. Dimensi/kompetensi yang dikembangkan`) + mul(d.dimensi));
    if (L(d.media).length) out.push(mh2(`${k++}. Media dan sumber belajar`) + mul(d.media));

    // --- D. Materi pembelajaran ---
    const materi = (Array.isArray(d.materi) ? d.materi : []).filter((m) => m && (m.judul || m.uraian));
    if (materi.length) {
      out.push(H1('MATERI PEMBELAJARAN'));
      materi.forEach((m, i) => {
        const t = m.tabel && Array.isArray(m.tabel.kolom) && Array.isArray(m.tabel.baris) && m.tabel.baris.length ? m.tabel : null;
        out.push(mh2(`${i + 1}. ${S_(m.judul)}`) + mp(m.uraian)
          + (t ? mtabel(mjudulKolom(t.kolom), t.baris.map((r) => (Array.isArray(r) ? r : [r]).map(S_)), null, { va: 'middle' }) : ''));
      });
    }

    // --- E. Langkah-langkah pembelajaran ---
    out.push(H1('LANGKAH-LANGKAH PEMBELAJARAN') + mLangkah(d.kegiatan, jp, mjp));

    // --- F. LKPD ---
    if (lk.judul || L(lk.tugas).length) {
      out.push(mh1(`${String.fromCharCode(65 + n++)}. LKPD — ${S_(lk.judul || c.topik).toUpperCase()}`));
      if (S_(lk.kasus).trim()) out.push(mh2('Kasus') + mp(lk.kasus));
      if (L(lk.tugas).length) out.push(mh2('Tugas kelompok') + mol(lk.tugas));
      const kol = mjudulKolom(lk.kolom); const kolom = kol.length >= 2 ? kol.slice(0, 5) : ['Temuan / fakta', 'Dugaan / penjelasan', 'Dampak yang mungkin', 'Bukti tambahan yang diperlukan'];
      out.push(mh2('Tabel kerja peserta didik') + mtabel(kolom, [0, 1, 2].map(() => kolom.map(() => '')), null, { minTinggi: '26pt' }));
      if (L(lk.panduan_guru).length) out.push(mh2('Contoh jawaban/panduan guru') + mul(lk.panduan_guru));
    }

    // --- G. Asesmen ---
    out.push(H1('ASESMEN PEMBELAJARAN'));
    let g = 1;
    const fm = (Array.isArray(a.formatif) ? a.formatif : []).filter((x) => x && typeof x === 'object');
    if (fm.length) out.push(mh2(`${g++}. Asesmen formatif`) + mtabel(['Aspek', 'Indikator', 'Teknik', 'Tindak lanjut'], fm.map((x) => [S_(x.aspek), S_(x.indikator), S_(x.teknik), S_(x.tindak_lanjut)]), ['18%', '34%', '16%', '32%'], { va: 'middle' }));
    else if (S_(a.formatif).trim()) out.push(mh2(`${g++}. Asesmen formatif`) + mp(a.formatif));
    const sm = (Array.isArray(a.sumatif) ? a.sumatif : []).filter((x) => x && typeof x === 'object');
    if (sm.length) out.push(mh2(`${g++}. Asesmen sumatif: pertanyaan evaluasi`) + mtabel(['No.', 'Soal', 'Kunci jawaban / unsur penting'], sm.map((x, i) => [String(i + 1), S_(x.soal), S_(x.kunci)]), ['7%', '48%', '45%'], { va: 'middle' }));
    else if (S_(a.sumatif).trim()) out.push(mh2(`${g++}. Asesmen sumatif`) + mp(a.sumatif));
    if (S_(a.penskoran).trim()) out.push(mh2(`${g++}. Pedoman penskoran evaluasi`) + mp(a.penskoran));
    const rub = (Array.isArray(d.rubrik) ? d.rubrik : []).filter((x) => x && typeof x === 'object');
    if (rub.length) out.push(mh2(`${g++}. Rubrik produk/presentasi kelompok`) + mtabel(['Aspek', '4 — Sangat baik', '3 — Baik', '2 — Berkembang', '1 — Perlu bimbingan'],
      rub.map((x) => [S_(x.aspek), S_(x.sangat_baik), S_(x.baik), S_(x.berkembang || x.cukup), S_(x.perlu_bimbingan)]), ['16%', '21%', '21%', '21%', '21%'], { va: 'middle' }));

    // --- H. Diferensiasi, I. Tindak lanjut ---
    const df = (Array.isArray(d.diferensiasi) ? d.diferensiasi : []).filter((x) => x && typeof x === 'object');
    if (df.length) out.push(H1('DIFERENSIASI DAN AKSESIBILITAS') + mtabel(['Kebutuhan peserta didik', 'Strategi yang dapat digunakan'], df.map((x) => [S_(x.kebutuhan), S_(x.strategi)]), ['30%', '70%'], { va: 'middle' }));
    const tl = (Array.isArray(d.tindak_lanjut) ? d.tindak_lanjut : []).filter((x) => x && typeof x === 'object');
    if (tl.length) out.push(H1('TINDAK LANJUT') + mtabel(['Hasil belajar', 'Tindak lanjut', 'Contoh aktivitas'], tl.map((x) => [S_(x.hasil), S_(x.tindak_lanjut), S_(x.contoh)]), ['24%', '34%', '42%'], { va: 'middle' }));

    // --- J. Refleksi, K. Sumber rujukan ---
    if (L(d.refleksi_siswa).length || L(d.refleksi_guru).length) {
      out.push(H1('REFLEKSI'));
      if (L(d.refleksi_siswa).length) out.push(mh2('1. Refleksi peserta didik') + mul(d.refleksi_siswa));
      if (L(d.refleksi_guru).length) out.push(mh2('2. Refleksi guru') + mul(d.refleksi_guru));
    }
    out.push(H1('SUMBER RUJUKAN DAN PEMERIKSAAN REGULASI')
      + mp('Gunakan sumber resmi dan tepercaya yang relevan dengan topik. Cantumkan penulis/lembaga, tahun, judul, dan tautan atau tanggal akses.')
      + mul([...L(d.pustaka), 'Dokumen Capaian Pembelajaran (CP) resmi yang berlaku untuk fase dan mata pelajaran terkait.']));

    out.push(ttd(c).replace('<table style="', `<table style="font-family:${M_FONT};font-size:10pt;`));
    return `<div data-tpl="modul" data-tpl-hdr="${esc(hdr)}" data-tpl-ftr="${esc(ftr)}" style="font-family:${M_FONT};font-size:10pt;line-height:1.3;">${out.join('')}</div>`;
  }

  // ---------------- Modul Ajar TEMPLATE 2: "Template Modul Ajar - Pendidikan Kesetaraan (Paket A/B/C)" ----------------
  // Susunan: judul, A Informasi Umum, B Identifikasi Dimensi Profil Lulusan, C Desain Pembelajaran,
  // D Pengalaman Belajar (Pendahuluan, Memahami, Mengaplikasi, Merefleksi, Penutup), E Asesmen, F Lampiran.
  // Gaya: Times New Roman 11 pt, judul bagian bergaris bawah biru tua, sel label berlatar #D9E2F3, kotak centang.
  const T2F = "'Times New Roman',Times,serif", T2_BIRU = '#1F3864', T2_LABEL = '#D9E2F3';
  const t2h1 = (t, css = '') => `<h1 style="font-family:${T2F};font-size:13pt;font-weight:bold;color:#000000;margin:16pt 0 5pt;padding:0 0 1pt;border-bottom:1pt solid ${T2_BIRU};page-break-after:avoid;${css}">${esc(t)}</h1>`;
  const t2h2 = (t) => `<p style="font-family:${T2F};font-size:11pt;font-weight:bold;margin:9pt 0 3pt;page-break-after:avoid;">${esc(t)}</p>`;
  const t2note = (t) => `<p style="font-family:${T2F};font-size:9pt;font-style:italic;color:#555555;margin:0 0 4pt;">${esc(t)}</p>`;
  const t2p = (t, css = '') => (S_(t).trim() ? S_(t).split(/\n+/).filter((x) => x.trim()).map((x) => `<p style="font-family:${T2F};font-size:11pt;margin:0 0 4pt;text-align:justify;${css}">${esc(x)}</p>`).join('') : '');
  const t2ul = (a) => (L(a).length ? `<ul style="font-family:${T2F};font-size:11pt;margin:0 0 5pt 18pt;padding-left:0;">${L(a).map((x) => `<li style="margin:0 0 2pt;">${esc(x)}</li>`).join('')}</ul>` : '');
  const t2ol = (a) => (L(a).length ? `<ol style="font-family:${T2F};font-size:11pt;margin:0 0 5pt 18pt;padding-left:0;">${L(a).map((x) => `<li style="margin:0 0 2pt;">${esc(x)}</li>`).join('')}</ol>` : '');
  const t2cell = (isi, o = {}) => `<td${o.bg ? ` bgcolor="${o.bg}"` : ''} style="border:0.5pt solid #808080;padding:3pt 6pt;vertical-align:${o.va || 'top'};font-family:${T2F};font-size:10.5pt;${o.bg ? `background:${o.bg};` : ''}${o.w ? `width:${o.w};` : ''}${o.tebal ? 'font-weight:bold;' : ''}${o.css || ''}">${isi || '&nbsp;'}</td>`;
  const t2teks = (x) => (x && typeof x === 'object' && x.h != null ? x.h : esc(S_(x)).replace(/\n/g, '<br>'));
  // tabel 2 kolom: kolom kiri berlatar biru muda dan tebal
  const t2info = (rows, lebar = '28%') => `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:2pt 0 4pt;">${rows.map((r) => `<tr style="page-break-inside:avoid;">${t2cell(esc(r[0]), { bg: T2_LABEL, tebal: true, w: lebar, va: 'middle' })}${t2cell(t2teks(r[1]), { va: 'middle' })}</tr>`).join('')}</table>`;
  const t2tabel = (kolom, baris, lebar) => `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:2pt 0 6pt;"><tr>${kolom.map((k, i) => t2cell(esc(k), { bg: T2_LABEL, tebal: true, w: lebar && lebar[i] })).join('')}</tr>${baris.map((r) => `<tr style="page-break-inside:avoid;">${r.map((x, i) => t2cell(t2teks(x), { w: lebar && lebar[i] })).join('')}</tr>`).join('')}</table>`;
  const t2cb = (teks, on) => `${on ? '&#9746;' : '&#9744;'} ${esc(teks)}`;
  const T2_DIM = [
    ['Keimanan dan Ketakwaan terhadap Tuhan YME', /iman|takwa/i], ['Kewargaan', /warga/i],
    ['Penalaran Kritis', /nalar|kritis/i], ['Kreativitas', /kreativ/i],
    ['Kolaborasi', /kolabor/i], ['Kemandirian', /mandiri/i],
    ['Kesehatan (jiwa & raga)', /sehat/i], ['Komunikasi', /komunik/i],
  ];
  const T2_INSTR = [['Tes tulis', /tes|tulis/i], ['Lisan', /lisan/i], ['Produk', /produk/i], ['Portofolio', /portofolio/i], ['Praktik', /praktik|unjuk/i], ['Observasi', /observasi|pengamatan/i]];
  const T2_MODA = [['Tatap Muka', /tatap/i], ['Tutorial', /tutorial/i], ['Mandiri', /mandiri/i], ['Kombinasi', /kombinasi|campur|blended/i]];

  function t2Kegiatan(kegiatan, jp, mjp) {
    const arr = (Array.isArray(kegiatan) ? kegiatan : []).filter((p) => p && typeof p === 'object');
    const item = (a) => (typeof a === 'string' ? { aktivitas: a, menit: '' } : (a || {}));
    const daftar = (a) => `<ul style="font-family:${T2F};font-size:11pt;margin:0 0 5pt 18pt;padding-left:0;">${(Array.isArray(a) ? a : []).map(item).filter((x) => S_(x.aktivitas).trim())
      .map((x) => `<li style="margin:0 0 2pt;text-align:justify;">${esc(x.aktivitas)}${x.menit ? ` <i>(${esc(x.menit)} menit)</i>` : ''}</li>`).join('')}</ul>`;
    const total = (a) => (Array.isArray(a) ? a : []).reduce((t, x) => t + (Number(item(x).menit) || 0), 0);
    const tahap = [
      ['Kegiatan Pendahuluan', '', 'pendahuluan'],
      ['Memahami', 'Peserta didik membangun pengetahuan awal (esensial, aplikatif, nilai/karakter) dari berbagai sumber.', 'memahami'],
      ['Mengaplikasi', 'Peserta didik menerapkan pemahaman pada situasi nyata/kontekstual: memecahkan masalah, membuat produk, berlatih keterampilan.', 'mengaplikasi'],
      ['Merefleksi', 'Peserta didik meninjau kembali proses dan hasil belajarnya, mengevaluasi pemahaman, menetapkan langkah selanjutnya.', 'merefleksi'],
      ['Kegiatan Penutup', '', 'penutup'],
    ];
    return arr.map((p, i) => {
      const kepala = arr.length > 1 ? `<p style="font-family:${T2F};font-size:11.5pt;font-weight:bold;color:${T2_BIRU};margin:12pt 0 2pt;page-break-after:avoid;">Pertemuan ke-${p.pertemuan || i + 1} <span style="font-weight:normal;font-size:10pt;">(${jp} JP × ${mjp} menit = ${jp * mjp} menit)</span></p>` : '';
      return kepala + tahap.map(([nm, ket, kunci], k) => {
        const mnt = total(p[kunci]);
        return t2h2(`${k + 1}. ${nm}${mnt ? ` (${mnt} menit)` : ''}`) + (ket ? t2note(ket) : '') + daftar(p[kunci]);
      }).join('');
    }).join('');
  }

  function renderModul2(d, c) {
    const mjp = +PENG.menit_per_jp || 45; const jp = +c.jp || 2; const pert = +c.pertemuan || 1;
    const S = (typeof SEKOLAH !== 'undefined' && SEKOLAH) || {};
    const lembaga = S.nama_lembaga || 'PKBM';
    const a = d.asesmen || {}; const lamp = d.lampiran || {};
    const paket = (/\b([ABC])\b/i.exec(S_(c.program)) || [])[1];
    const modaTerpilih = (T2_MODA.find(([, re]) => re.test(S_(d.moda))) || T2_MODA[0])[0];
    const dimNama = L(d.dimensi).map((x) => S_(x).split(/\s*[:\u2013\u2014-]\s*/)[0]);
    const instr = L(a.instrumen);
    const hdr = `MODUL AJAR — PENDIDIKAN KESETARAAN (${S_(c.program || 'PAKET A/B/C').toUpperCase()})`.slice(0, 120);
    const out = [];

    // --- judul ---
    out.push(kop());
    out.push(`<p style="font-family:${T2F};text-align:center;font-size:17pt;font-weight:bold;margin:6pt 0 2pt;">MODUL AJAR</p>
      <p style="font-family:${T2F};text-align:center;font-size:11pt;margin:0 0 2pt;">Pendidikan Kesetaraan — ${esc(S_(c.program) || 'Paket A / Paket B / Paket C')}</p>
      <p style="font-family:${T2F};text-align:center;font-size:9pt;font-style:italic;margin:0 0 4pt;">Disusun mengacu pada pendekatan Pembelajaran Mendalam (Deep Learning) — Kemendikdasmen</p>`);

    // --- A. Informasi Umum ---
    out.push(t2h1('A. Informasi Umum'));
    out.push(t2info([
      ['Nama Penyusun / Tutor', c.guru || '………………………………………………………'],
      ['Nama Lembaga (PKBM)', lembaga],
      ['Tahun Ajaran', PENG.tahun_ajaran || '………………………………………………………'],
      ['Jenjang / Program', { h: ['A', 'B', 'C'].map((x) => t2cb(`Paket ${x}`, paket && paket.toUpperCase() === x)).join('&nbsp;&nbsp;&nbsp;') }],
      ['Fase / Kelas', [c.fase ? `Fase ${c.fase}` : '', c.kelas ? `Kelas ${c.kelas}` : ''].filter(Boolean).join(' / ') || '………………………………………………………'],
      ['Mata Pelajaran', c.mapel],
      ['Topik / Materi Pokok', c.topik],
      ['Alokasi Waktu', `${pert * jp} JP  x  ${mjp} menit   (${pert} pertemuan; ……… SKK)`],
      ['Model / Moda Pembelajaran', { h: T2_MODA.map(([nm]) => t2cb(nm, nm === modaTerpilih)).join('&nbsp;&nbsp;') }],
    ]));
    out.push(`<p style="font-family:${T2F};font-size:9pt;font-style:italic;margin:2pt 0 0;">SKK = Satuan Kredit Kompetensi, sesuai struktur kurikulum pendidikan kesetaraan.</p>`);

    // --- B. Dimensi Profil Lulusan ---
    out.push(t2h1('B. Identifikasi Dimensi Profil Lulusan'));
    out.push(t2note('Tanda centang menunjukkan dimensi yang paling relevan dikembangkan melalui topik ini.'));
    const cekDim = (i) => t2cb(T2_DIM[i][0], dimNama.some((x) => T2_DIM[i][1].test(x)));
    out.push(`<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:2pt 0 4pt;">${[0, 2, 4, 6].map((i) => `<tr>${t2cell(cekDim(i), { w: '50%', va: 'middle' })}${t2cell(cekDim(i + 1), { w: '50%', va: 'middle' })}</tr>`).join('')}</table>`);
    const ketDim = L(d.dimensi).filter((x) => /[:\u2013\u2014]/.test(S_(x)));
    if (ketDim.length) out.push(t2ul(ketDim));

    // --- C. Desain Pembelajaran ---
    out.push(t2h1('C. Desain Pembelajaran'));
    out.push(t2h2('1. Capaian Pembelajaran (CP) yang dirujuk') + (c.cp && c.cp.deskripsi
      ? (c.cp.elemen ? t2p(`Elemen: ${c.cp.elemen}`) : '') + t2p(c.cp.deskripsi)
      : t2note('Isikan kutipan CP resmi yang relevan untuk fase dan mata pelajaran ini.') + t2p('[Tempelkan CP resmi di sini.]')));
    out.push(t2h2('2. Tujuan Pembelajaran') + t2note('Rumusan kompetensi + lingkup materi yang ingin dicapai peserta didik pada akhir topik.') + t2ol(d.tujuan));
    if (S_(d.pemahaman_bermakna).trim()) out.push(t2h2('3. Pemahaman Bermakna') + t2p(d.pemahaman_bermakna));
    if (L(d.pertanyaan_pemantik).length) out.push(t2h2('4. Pertanyaan Pemantik') + t2ol(d.pertanyaan_pemantik));
    if (S_(d.target_peserta).trim()) out.push(t2h2('5. Target Peserta Didik & Karakteristiknya') + t2p(d.target_peserta));
    if (L(d.sarpras).length) out.push(t2h2('6. Sarana, Prasarana & Sumber Belajar') + t2ul(d.sarpras));

    // --- D. Pengalaman Belajar ---
    out.push(t2h1('D. Pengalaman Belajar'));
    out.push(t2note('Kegiatan mengikuti tiga tahap Pembelajaran Mendalam: Memahami → Mengaplikasi → Merefleksi, dengan prinsip berkesadaran, bermakna, dan menggembirakan.'));
    out.push(t2Kegiatan(d.kegiatan, jp, mjp));

    // --- E. Asesmen ---
    out.push(t2h1('E. Asesmen'));
    out.push(t2info([
      ['Asesmen Awal (diagnostik)', a.awal || ''],
      ['Asesmen Formatif (proses)', a.formatif || ''],
      ['Asesmen Sumatif (hasil)', a.sumatif || ''],
      ['Bentuk / Instrumen', { h: T2_INSTR.map(([nm, re]) => t2cb(nm, instr.some((x) => re.test(x)))).join('&nbsp;&nbsp;') }],
    ], '26%'));

    // --- F. Lampiran ---
    out.push(t2h1('F. Lampiran'));
    const lk = lamp.lkpd || {};
    let ln = 1;
    if (lk.judul || L(lk.tugas).length) {
      out.push(t2h2(`${ln++}. Lembar Kerja Peserta Didik (LKPD)${lk.judul ? ' — ' + S_(lk.judul) : ''}`)
        + t2p('Nama / Kelompok : ……………………………………   Hari / Tanggal : ……………………………', 'text-align:left;')
        + (S_(lk.petunjuk).trim() ? t2p(`Petunjuk: ${S_(lk.petunjuk)}`) : '') + t2ol(lk.tugas));
    }
    if (S_(lamp.bahan_bacaan).trim()) out.push(t2h2(`${ln++}. Bahan Bacaan / Media Pembelajaran`) + t2p(lamp.bahan_bacaan));
    const rub = (Array.isArray(lamp.rubrik) ? lamp.rubrik : []).filter((x) => x && typeof x === 'object');
    if (rub.length) out.push(t2h2(`${ln++}. Rubrik Penilaian`) + t2tabel(['Aspek', '4 — Sangat baik', '3 — Baik', '2 — Berkembang', '1 — Perlu bimbingan'],
      rub.map((x) => [S_(x.aspek), S_(x.sangat_baik), S_(x.baik), S_(x.berkembang || x.cukup), S_(x.perlu_bimbingan)]), ['16%', '21%', '21%', '21%', '21%']));
    const glo = (Array.isArray(lamp.glosarium) ? lamp.glosarium : []).filter((x) => x && typeof x === 'object' && S_(x.istilah).trim());
    if (glo.length) out.push(t2h2(`${ln++}. Glosarium`) + `<ul style="font-family:${T2F};font-size:11pt;margin:0 0 5pt 18pt;padding-left:0;">${glo.map((x) => `<li style="margin:0 0 2pt;"><b>${esc(x.istilah)}</b>: ${esc(x.arti)}</li>`).join('')}</ul>`);

    out.push(ttd(c).replace('<table style="', `<table style="font-family:${T2F};font-size:11pt;`));
    return `<div data-tpl="modul2" data-tpl-hdr="${esc(hdr)}" data-tpl-ftr="" data-tpl-hal="1" style="font-family:${T2F};font-size:11pt;line-height:1.3;">${out.join('')}</div>`;
  }

  // ---------------- LKPD: mengikuti "Format LKPD Permendikdasmen 1/2026" ----------------
  // A Tujuan, B Petunjuk, C Kegiatan 1 Memahami, D Kegiatan 2 Mengaplikasi, E Kegiatan 3 Merefleksi, F Penilaian oleh guru, G Dasar acuan (guru)
  function renderLkpd(d, c) {
    const mjp = +PENG.menit_per_jp || 45; const jp = +c.jp || 2;
    const S = (typeof SEKOLAH !== 'undefined' && SEKOLAH) || {};
    const lembaga = S.nama_lembaga || 'PKBM';
    const st = d.stimulus && typeof d.stimulus === 'object' ? d.stimulus : {};
    const judul = S_(d.judul || c.topik);
    const sub = [c.mapel, c.program, c.kelas ? `Kelas ${c.kelas}` : '', c.fase ? `Fase ${c.fase}` : ''].filter(Boolean).join(' • ');
    const hdr = `LKPD • ${S_(c.mapel)} • ${S_(c.topik)}`.slice(0, 120);
    const ftr = `${lembaga} — Tahun Pelajaran ${PENG.tahun_ajaran || ''}`.trim();
    const ki = (t) => `<p style="font-family:${M_FONT};font-size:9pt;margin:0 0 5pt;font-style:italic;color:#646464;">${esc(t)}</p>`;
    const lbl = (t) => `<p style="font-family:${M_FONT};font-size:10pt;font-weight:bold;margin:6pt 0 3pt;"><b>${esc(t)}</b></p>`;
    const kotakKosong = (tinggi) => `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:2pt 0 8pt;"><tr>${mcell('', { css: `height:${tinggi};` })}</tr></table>`;
    // gambar AI: indeks data-gambar = urutan pada d.gambar (dipakai buatGambar/pasangTombol)
    const gbr = (Array.isArray(d.gambar) ? d.gambar : []).slice(0, 3);
    const figur = (letak) => gbr.map((g, i) => {
      if (!g || !g.deskripsi || (g.letak === 'tugas' ? 'tugas' : 'stimulus') !== letak) return '';
      return `<div data-gambar="${i}" style="text-align:center;margin:8px 0;"><div data-isi="1"><span style="color:#888;">⏳ Gambar sedang dibuat...</span></div><i data-ket="1" style="font-family:${M_FONT};font-size:9pt;">${esc(g.keterangan || '')}</i></div>`;
    }).join('');
    const out = [];

    // --- sampul + identitas ---
    out.push(kop().replace('<table style="', `<table style="font-family:${M_FONT};`));
    out.push(`<p style="font-family:${M_FONT};text-align:center;font-size:22pt;font-weight:bold;color:${M_HIJAU};margin:14pt 0 4pt;">LEMBAR KERJA PESERTA DIDIK (LKPD)</p>
      <p style="font-family:${M_FONT};text-align:center;font-size:14pt;font-weight:bold;margin:0 0 4pt;">${esc(judul.toUpperCase())}</p>
      <p style="font-family:${M_FONT};text-align:center;font-size:10pt;font-style:italic;margin:0 0 10pt;">${esc(sub)}</p>`);
    out.push(mtabel(['IDENTITAS', 'KETERANGAN'], [
      ['Satuan pendidikan', lembaga], ['Mata pelajaran', c.mapel],
      ['Program / kelas / fase', [c.program, c.kelas, c.fase].filter(Boolean).join(' / ')], ['Topik', c.topik],
      ['Alokasi waktu', `${jp} JP × ${mjp} menit`],
      ['Nama murid / kelompok', '...............................................................'], ['Hari / tanggal', '...............................................................'],
    ], ['31%', '69%'], { va: 'middle', tebalKolom1: true }));

    // --- A. Tujuan, B. Petunjuk ---
    out.push(mh1('A. TUJUAN PEMBELAJARAN'));
    out.push(ki('Bacakan bersama murid agar murid tahu apa yang akan dicapai.'));
    out.push(mp('Setelah mengerjakan LKPD ini, saya diharapkan mampu:') + mol(d.tujuan));
    out.push(mh1('B. PETUNJUK BELAJAR'));
    out.push(mul([
      'Baca tujuan pembelajaran dan seluruh kegiatan sebelum mulai mengerjakan.',
      'Kerjakan kegiatan secara berurutan: Memahami, Mengaplikasi, lalu Merefleksi.',
      'Gunakan berbagai sumber belajar (buku, lingkungan sekitar, data, atau media digital/nondigital) dan tuliskan sumbernya.',
      'Berdiskusilah dengan sopan, saling menghargai pendapat, dan bertanya kepada guru bila belum paham.',
    ]));

    // --- C. Kegiatan 1 - Memahami ---
    out.push(mh1('C. KEGIATAN 1 — MEMAHAMI', 'page-break-before:always;'));
    out.push(ki('Murid membangun pengetahuan dari berbagai sumber dan konteks.'));
    out.push(mh2('Stimulus / bahan belajar'));
    out.push(`<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:2pt 0 8pt;"><tr><td bgcolor="${M_MUDA}" style="border:0.5pt solid #7f7f7f;background:${M_MUDA};padding:5pt 7pt;font-family:${M_FONT};font-size:10pt;">`
      + (S_(st.judul).trim() ? `<p style="margin:0 0 3pt;font-family:${M_FONT};font-size:10pt;font-weight:bold;"><b>${esc(st.judul)}</b></p>` : '')
      + mp(st.uraian)
      + (S_(st.catatan).trim() ? `<p style="margin:2pt 0 0;font-family:${M_FONT};font-size:9pt;font-style:italic;color:#646464;">${esc(st.catatan)}</p>` : '')
      + '</td></tr></table>');
    const dt = st.data && Array.isArray(st.data.kolom) && Array.isArray(st.data.baris) && st.data.baris.length ? st.data : null;
    if (dt) out.push(lbl(dt.judul || 'Data pengamatan:') + mtabel(mjudulKolom(dt.kolom), dt.baris.map((r) => (Array.isArray(r) ? r : [r]).map(S_)), null, { va: 'middle' }));
    out.push(figur('stimulus'));
    out.push(mh2('Pertanyaan pemahaman'));
    out.push(mtabel(['No.', 'Pertanyaan', 'Jawaban saya'], L(d.pertanyaan).map((q, i) => [String(i + 1), q, '']), ['8%', '46%', '46%'], { va: 'middle', minTinggi: '38pt', tengah: [0] }));
    out.push(mp('Sumber yang saya gunakan: ..............................................................................................'));

    // --- D. Kegiatan 2 - Mengaplikasi ---
    out.push(mh1('D. KEGIATAN 2 — MENGAPLIKASI'));
    out.push(ki('Murid menggunakan pengetahuan dalam situasi kehidupan nyata dan kontekstual.'));
    out.push(mh2('Tugas') + (L(d.tugas).length > 1 ? mol(d.tugas) : mp(L(d.tugas)[0] || '')));
    out.push(figur('tugas'));
    const kol = mjudulKolom(d.kolom); const kolom = kol.length >= 2 ? kol.slice(0, 5) : ['Temuan / fakta', 'Dugaan / penjelasan', 'Dampak yang mungkin', 'Bukti tambahan'];
    out.push(mh2('Tabel kerja') + mtabel(kolom, [0, 1, 2].map(() => kolom.map(() => '')), null, { minTinggi: '34pt' }));
    out.push(lbl('Kesimpulan kelompok:') + kotakKosong('48pt'));

    // --- E. Kegiatan 3 - Merefleksi ---
    out.push(mh1('E. KEGIATAN 3 — MEREFLEKSI'));
    out.push(ki('Murid mengevaluasi dan memaknai proses serta hasil belajarnya, lalu mengatur diri agar dapat belajar mandiri.'));
    const rf = L(d.refleksi).length >= 2 ? L(d.refleksi) : [
      'Hal baru yang saya pahami hari ini adalah ...', 'Bagian yang paling mudah / paling sulit bagi saya adalah ...',
      'Cara belajar yang paling membantu saya adalah ...', 'Satu hal yang akan saya lakukan agar belajar saya lebih baik adalah ...'];
    out.push(mtabel(['Pertanyaan refleksi', 'Jawaban saya'], rf.map((x) => [x, '']), ['50%', '50%'], { va: 'middle', minTinggi: '30pt' }));
    out.push(mh2('Penilaian diri'));
    out.push(mtabel(['Pernyataan', 'Ya', 'Sebagian', 'Belum'], [
      'Saya memahami tujuan pembelajaran hari ini.', 'Saya dapat menjelaskan materi dengan kata-kata sendiri.',
      'Saya dapat menerapkan materi pada contoh kehidupan nyata.', 'Saya bekerja sama dan menghargai pendapat teman.',
    ].map((x) => [x, '☐', '☐', '☐']), ['58%', '14%', '14%', '14%'], { va: 'middle', tengah: [1, 2, 3] }));

    // --- F. Penilaian oleh guru ---
    out.push(mh1('F. PENILAIAN OLEH GURU', 'page-break-before:always;'));
    out.push(ki('Gunakan teknik/instrumen yang sesuai tujuan pembelajaran. Rubrik di bawah adalah contoh; sesuaikan aspek dan deskriptornya.'));
    const aspekDef = ['Pemahaman konsep', 'Penerapan pada konteks nyata', 'Refleksi diri', 'Kolaborasi dan komunikasi'];
    const rb = (Array.isArray(d.rubrik) ? d.rubrik : []).filter((x) => x && typeof x === 'object');
    const rubrik = aspekDef.map((a, i) => { const x = rb[i] || {}; return [S_(x.aspek || a), S_(x.sangat_baik), S_(x.baik), S_(x.berkembang || x.cukup), S_(x.perlu_bimbingan)]; });
    out.push(mtabel(['Aspek', '4 — Sangat baik', '3 — Baik', '2 — Berkembang', '1 — Perlu bimbingan'], rubrik, ['20%', '20%', '20%', '20%', '20%'], { va: 'middle', tebalKolom1: true }));
    out.push(mtabel(['', ''], [
      ['Capaian / nilai', '..............................'], ['Umpan balik guru', ''],
      ['Tindak lanjut', '☐ Pengayaan     ☐ Latihan terarah     ☐ Pendampingan dan asesmen ulang'],
    ], ['28%', '72%'], { va: 'middle', tebalKolom1: true, tanpaHeader: true, minTinggi: '40pt' }));

    // --- halaman guru: kunci jawaban + G. Dasar acuan ---
    let pb = 'page-break-before:always;';
    if (L(d.kunci).length) {
      out.push(mh1('KUNCI JAWABAN (KHUSUS GURU)', pb)); pb = '';
      out.push(mol(d.kunci));
    }
    out.push(mh1('G. DASAR ACUAN (UNTUK GURU)', pb));
    out.push(ki('Bagian ini catatan penyusun; boleh dihapus sebelum dibagikan kepada murid.'));
    out.push(mtabel(['Ketentuan', 'Penerapan dalam LKPD ini'], [
      ['Permendikdasmen No. 1 Tahun 2026 tentang Standar Proses (Pasal 5): perencanaan pembelajaran paling sedikit memuat tujuan, langkah, dan penilaian/asesmen pembelajaran.', 'Bagian A (tujuan), C–E (langkah pembelajaran), dan E–F (asesmen).'],
      ['Pasal 10 ayat (1): pengalaman belajar memahami, mengaplikasi, dan merefleksi.', 'Kegiatan 1, 2, dan 3.'],
      ['Pasal 3 ayat (1): prinsip berkesadaran, bermakna, dan menggembirakan.', 'Tujuan dibacakan di awal (berkesadaran); tugas kontekstual (bermakna); kegiatan bervariasi dan menantang (menggembirakan).'],
      ['Pasal 20: mencabut Permendiknas No. 3 Tahun 2008 (Standar Proses Kesetaraan) dan Permendikbudristek No. 16 Tahun 2022.', 'Format LKPD tidak lagi mengacu pada dua peraturan tersebut.'],
    ], ['50%', '50%'], { va: 'middle' }));
    out.push(ki('Catatan: peraturan tersebut tidak menetapkan format baku LKPD. Dokumen ini adalah rancangan yang selaras dengan isi Permendikdasmen 1/2026; satuan pendidikan boleh menyesuaikannya. Periksa naskah resmi di peraturan.go.id dan ketentuan terbaru dari satuan pendidikan atau dinas sebelum digunakan.'));

    return `<div data-tpl="lkpd" data-tpl-hdr="${esc(hdr)}" data-tpl-ftr="${esc(ftr)}" data-tpl-hal="1" style="font-family:${M_FONT};font-size:10pt;line-height:1.3;">${out.join('')}</div>`;
  }

  // ----- gambar AI untuk LKPD -----
  function jadikanJpeg(src, lebarMax) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => {
        const w0 = im.naturalWidth || 800, h0 = im.naturalHeight || 500, k = Math.min(1, lebarMax / w0);
        const w = Math.round(w0 * k), h = Math.round(h0 * k);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
        res({ uri: cv.toDataURL('image/jpeg', 0.86), w, h });
      };
      im.onerror = () => rej(new Error('Gambar tidak dapat dibaca'));
      im.src = src;
    });
  }
  async function satuGambar(deskripsi, gaya) {
    const r = await panggilAI({ aksi: 'gambar', deskripsi, gaya });
    let src;
    if (r.tipe === 'svg') {
      let svg = r.svg; if (!/<svg[^>]*\swidth=/i.test(svg)) svg = svg.replace(/<svg/i, '<svg width="800" height="500"');
      src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    } else src = `data:${r.mime || 'image/png'};base64,${r.data}`;
    const j = await jadikanJpeg(src, 720);
    return { ...j, asli: r.asli, alasan: r.alasan || '' };
  }
  function isiGambar(el, g) {
    rapikanFigure(el);
    const lebar = Math.min(g.w, 420);
    el.querySelector('[data-isi]').innerHTML = `<img src="${g.uri}" width="${lebar}" height="${Math.round(lebar * g.h / g.w)}" style="max-width:100%;border:1px solid #ccc;">`;
  }
  // pastikan figure punya struktur [data-isi] + keterangan (juga untuk dokumen lama di riwayat)
  function rapikanFigure(el) {
    if (el.querySelector('[data-isi]')) return;
    const img = el.querySelector('img'); const ket = (el.querySelector('i') || {}).textContent || '';
    el.innerHTML = `<div data-isi="1">${img ? img.outerHTML : ''}</div><i data-ket="1">${esc(ket)}</i>`;
  }
  function pasangTombol(j) {
    $(`pa-${j}-hasil`).querySelectorAll('[data-gambar]').forEach((el) => {
      rapikanFigure(el);
      if (el.querySelector('[data-ui]')) return;
      const i = el.getAttribute('data-gambar');
      const ui = document.createElement('div'); ui.setAttribute('data-ui', '1'); ui.setAttribute('contenteditable', 'false'); ui.style.cssText = 'margin:4px 0 0;font-family:sans-serif;font-size:12px;';
      ui.innerHTML = `<button class="btn outline" style="padding:3px 10px;font-size:12px;" onclick="PA.gantiGambar('${j}','${i}')">🖼 Ganti gambar</button> <button class="btn outline" style="padding:3px 10px;font-size:12px;" onclick="PA.hapusGambar('${j}','${i}')">🗑 Hapus</button>`;
      el.appendChild(ui);
    });
  }
  function gantiGambar(j, i) {
    const el = $(`pa-${j}-hasil`).querySelector(`[data-gambar="${i}"]`); if (!el) return;
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp';
    inp.onchange = () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      if (f.size > 15 * 1024 * 1024) { alert('Ukuran gambar maksimal 15 MB.'); return; }
      const fr = new FileReader();
      fr.onload = async () => {
        try { isiGambar(el, await jadikanJpeg(fr.result, 720)); $(`pa-${j}-status`).textContent = 'Gambar diganti. Jangan lupa Simpan ke Riwayat.'; $(`pa-${j}-status`).style.color = ''; }
        catch (e) { alert('Gambar tidak dapat dibaca. Gunakan file JPG, PNG, atau WEBP.'); }
      };
      fr.readAsDataURL(f);
    };
    inp.click();
  }
  function hapusGambar(j, i) {
    const el = $(`pa-${j}-hasil`).querySelector(`[data-gambar="${i}"]`);
    if (el && confirm('Hapus gambar ini dari dokumen?')) el.remove();
  }
  async function buatGambar(j) {
    const daftar = (terakhir[j] && terakhir[j].gambar) || []; const st = $(`pa-${j}-status`);
    const gaya = $(`pa-${j}-gaya`) ? $(`pa-${j}-gaya`).value : 'otomatis';
    const total = daftar.filter(Boolean).length; let ok = 0, n = 0, salin = 0, alasanGambar = '';
    for (let i = 0; i < daftar.length; i++) {
      if (!daftar[i]) continue;
      const el = $(`pa-${j}-hasil`).querySelector(`[data-gambar="${i}"]`);
      if (el) rapikanFigure(el);
      if (!el || el.querySelector('img')) { ok++; continue; }
      n++; st.style.color = ''; st.textContent = `Membuat gambar ${n} dari ${total}... (10-40 detik per gambar)`;
      try {
        const g = await satuGambar(daftar[i], gaya);
        isiGambar(el, g);
        ok++; if (!g.asli) { salin++; if (!alasanGambar) alasanGambar = g.alasan; }
      } catch (e) {
        el.querySelector('[data-isi]').innerHTML = `<span style="color:#B42318;">[Gambar gagal dibuat: ${esc(e.message).slice(0, 120)}]</span>`;
      }
    }
    st.style.color = ok < total ? '#B42318' : '';
    st.textContent = ok < total ? `${ok} dari ${total} gambar berhasil. Klik "Buat ulang gambar yang gagal".` : `Selesai. ${total} gambar siap${salin ? ` (${salin} berupa ilustrasi diagram karena gambar AI tidak tersedia${alasanGambar ? ': ' + alasanGambar : ''})` : ''}. Periksa & edit, lalu simpan/unduh.`;
  }
  async function ulangGambar(j) {
    $(`pa-${j}-hasil`).querySelectorAll('[data-gambar]').forEach((el) => {
      rapikanFigure(el);
      if (!el.querySelector('img')) el.querySelector('[data-isi]').innerHTML = '<span style="color:#888;">⏳ Gambar sedang dibuat...</span>';
    });
    await buatGambar(j);
  }

  // ---------------- Unduh / Cetak / Simpan ----------------
  // Modul Ajar bertemplate menandai dokumennya dengan data-tpl="modul" (+ teks header/footer) -> Word memakai Arial, margin template, header & footer
  function opsiTemplate(html) {
    const m = /data-tpl="(modul2|modul|lkpd)"\s+data-tpl-hdr="([^"]*)"\s+data-tpl-ftr="([^"]*)"(\s+data-tpl-hal="1")?/.exec(html || '');
    return m ? { v2: m[1] === 'modul2', hdr: m[2], ftr: m[3], hal: !!m[4] } : null;
  }
  function bungkusWord(html, judul, tpl) {
    const v2 = !!(tpl && tpl.v2); // Template 2: Times New Roman, margin & header/footer mengikuti template Pendidikan Kesetaraan
    const fHF = v2 ? "'Times New Roman',serif" : 'Arial,sans-serif';
    const hal = tpl && tpl.hal ? `${tpl.ftr ? ' • ' : ''}Halaman <span style='mso-field-code:" PAGE "'><span style='mso-no-proof:yes'>1</span></span>` : '';
    const hf = tpl ? `<div style='mso-element:header' id="h1"><p style="text-align:right;font-family:${fHF};font-size:8pt;color:${v2 ? '#808080' : '#6E6E6E'};margin:0;">${tpl.hdr}</p></div>
      <div style='mso-element:footer' id="f1"><p style="text-align:center;font-family:${fHF};font-size:8pt;${v2 ? '' : 'font-style:italic;'}color:${v2 ? '#808080' : '#6E6E6E'};margin:0;">${tpl.ftr}${hal}</p></div>` : '';
    const halaman = tpl
      ? (v2 ? '@page Section1{size:595.3pt 841.9pt;margin:50pt 55pt 50pt 55pt;mso-header-margin:35.4pt;mso-footer-margin:35.4pt;mso-header:h1;mso-footer:f1;}'
        : '@page Section1{size:595.3pt 841.9pt;margin:65.2pt 65.2pt 65.2pt 76.6pt;mso-header-margin:36pt;mso-footer-margin:36pt;mso-header:h1;mso-footer:f1;}')
      : '@page Section1{size:595.3pt 841.9pt;margin:56.7pt 56.7pt 56.7pt 70.9pt;}';
    const huruf = tpl ? (v2 ? "font-family:'Times New Roman',Times,serif;font-size:11pt;" : "font-family:Arial,Helvetica,sans-serif;font-size:10pt;") : "font-family:'Times New Roman',serif;font-size:12pt;";
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(judul)}</title>
      <style>${halaman} div.Section1{page:Section1;} body{${huruf}} table{border-collapse:collapse;} p{margin:0 0 4px;}</style></head>
      <body><div class="Section1">${html}</div>${hf}</body></html>`;
  }
  function namaFile(t) { return String(t || 'dokumen').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'dokumen'; }
  function unduhHtml(html, judul) {
    const tpl = opsiTemplate(html);
    if (/<img[^>]+src="data:image/i.test(html)) return unduhMht(html, judul, tpl);
    const blob = new Blob(['\ufeff', bungkusWord(html, judul, tpl)], { type: 'application/msword' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = namaFile(judul) + '.doc';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function unduhMht(html, judul, tpl) {
    const bagian = []; let n = 0;
    const isi = html.replace(/src="data:(image\/[a-z+]+);base64,([^"]+)"/gi, (m, mime, b64) => {
      n++; const ext = mime.split('/')[1].replace('jpeg', 'jpg'); const lokasi = `file:///C:/gambar${n}.${ext}`;
      bagian.push({ mime, b64, lokasi }); return `src="${lokasi}"`;
    });
    const b64 = (t) => btoa(unescape(encodeURIComponent(t))).replace(/.{1,76}/g, '$&\r\n');
    const B = '----=_NextPart_' + Date.now().toString(16);
    let out = `MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="${B}"; type="text/html"\r\n\r\n--${B}\r\nContent-Type: text/html; charset="utf-8"\r\nContent-Transfer-Encoding: base64\r\nContent-Location: file:///C:/dokumen.htm\r\n\r\n${b64(bungkusWord(isi, judul, tpl))}\r\n`;
    bagian.forEach((p) => { out += `--${B}\r\nContent-Type: ${p.mime}\r\nContent-Transfer-Encoding: base64\r\nContent-Location: ${p.lokasi}\r\n\r\n${p.b64.replace(/.{1,76}/g, '$&\r\n')}\r\n`; });
    out += `--${B}--`;
    const blob = new Blob([out], { type: 'application/msword' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = namaFile(judul) + '.doc';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function cetakHtml(html, judul) {
    const w = window.open('', '_blank'); if (!w) { alert('Izinkan pop-up untuk mencetak.'); return; }
    // header/footer Word tidak ikut dicetak dari browser (tpl = null); gaya Arial tetap terbawa dari dokumennya
    w.document.write(bungkusWord(html, judul).replace('</style>', '@page{size:A4;margin:2cm}</style>')); w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
  }
  const hasilHtml = (j) => { const c = $(`pa-${j}-hasil`).cloneNode(true); c.querySelectorAll('[data-ui]').forEach((x) => x.remove()); return c.innerHTML; };
  const unduh = (j) => unduhHtml(hasilHtml(j), (terakhir[j] || {}).judul || NAMA[j]);
  const cetak = (j) => cetakHtml(hasilHtml(j), (terakhir[j] || {}).judul || NAMA[j]);

  async function simpan(j) {
    const t = terakhir[j]; if (!t) return;
    const { data: { user } } = await supa.auth.getUser();
    const { error } = await supa.from('perangkat_ajar').insert({ jenis: j, mapel_id: t.mapel_id, judul: t.judul, kelas: t.kelas, semester: t.semester, html: hasilHtml(j), meta: t.meta, dibuat_oleh: user ? user.email : null });
    if (error) { alert('Gagal menyimpan: ' + error.message + '\n(Pastikan migrasi-v23-perangkat-ajar.sql sudah dijalankan.)'); return; }
    toast_('Tersimpan di riwayat.'); muatRiwayat(j);
  }
  const toast_ = (m) => { const s = $('pa-toast'); if (typeof toast === 'function') { toast(m); } else { alert(m); } };

  async function muatRiwayat(j) {
    const box = $(`pa-${j}-riwayat`);
    const { data, error } = await supa.from('perangkat_ajar').select('id,judul,kelas,semester,created_at,dibuat_oleh').eq('jenis', j).order('created_at', { ascending: false }).limit(50);
    if (error) { box.innerHTML = `<p class="muted">Riwayat belum tersedia. Jalankan <b>migrasi-v23-perangkat-ajar.sql</b> di Supabase SQL Editor.</p>`; return; }
    if (!data.length) { box.innerHTML = '<p class="muted">Belum ada yang disimpan.</p>'; return; }
    box.innerHTML = `<table class="tbl" style="width:100%;"><thead><tr><th>Judul</th><th>Semester</th><th>Dibuat</th><th></th></tr></thead><tbody>${data.map((r) => `<tr>
      <td>${esc(r.judul)}</td><td>${esc(r.semester || '')}</td><td>${new Date(r.created_at).toLocaleDateString('id-ID')} ${esc(r.dibuat_oleh || '')}</td>
      <td style="white-space:nowrap;"><button class="btn outline" onclick="PA.bukaRiwayat('${j}','${r.id}')">Buka</button>
      <button class="btn outline" onclick="PA.unduhRiwayat('${r.id}')">⬇ Word</button>
      <button class="btn outline" onclick="PA.hapusRiwayat('${j}','${r.id}')">Hapus</button></td></tr>`).join('')}</tbody></table>`;
  }
  async function ambilRiwayat(id) { const { data, error } = await supa.from('perangkat_ajar').select('*').eq('id', id).single(); if (error) { alert(error.message); return null; } return data; }
  async function bukaRiwayat(j, id) {
    const r = await ambilRiwayat(id); if (!r) return;
    $(`pa-${j}-hasil`).innerHTML = r.html; $(`pa-${j}-hasilbox`).classList.remove('hidden'); if (j === 'lkpd') pasangTombol(j);
    terakhir[j] = { judul: r.judul, meta: r.meta, mapel_id: r.mapel_id, semester: r.semester, kelas: r.kelas };
    $(`pa-${j}-hasilbox`).scrollIntoView({ behavior: 'smooth' });
  }
  async function unduhRiwayat(id) { const r = await ambilRiwayat(id); if (r) unduhHtml(r.html, r.judul); }
  async function hapusRiwayat(j, id) {
    if (!confirm('Hapus dokumen ini dari riwayat?')) return;
    const { error } = await supa.from('perangkat_ajar').delete().eq('id', id);
    if (error) alert(error.message); else muatRiwayat(j);
  }

  // ---------------- Pengaturan ----------------
  async function bukaPengaturan() {
    pengOk = false; await muatPengaturan();
    const P = PENG; const cek = (v) => (v ? 'checked' : '');
    $('tab-pengpa').innerHTML = `
      <h2>Pengaturan RPP &amp; Modul Ajar</h2>
      <p class="muted">Pengaturan ini dipakai otomatis saat generate RPP dan Modul Ajar, serta dicetak pada kop dan tanda tangan.</p>
      <div class="card">
        <div class="grid3">
          <div class="field"><label>Tahun Pelajaran</label><input id="pp-tahun" value="${esc(P.tahun_ajaran)}" placeholder="2026/2027"></div>
          <div class="field"><label>Menit per JP</label><input id="pp-menit" type="number" min="30" max="60" value="${esc(P.menit_per_jp)}"></div>
          <div class="field"><label>Model Pembelajaran Utama</label><select id="pp-model">${MODEL.map((m) => `<option ${m === P.model_default ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
        </div>
        <div class="grid3">
          <div class="field"><label>Format RPP</label><select id="pp-format"><option value="lengkap" ${P.format_rpp !== 'ringkas' ? 'selected' : ''}>RPP Lengkap (identitas, CP, tujuan, materi, model, media, langkah, penilaian, remedial/pengayaan)</option><option value="ringkas" ${P.format_rpp === 'ringkas' ? 'selected' : ''}>RPP Ringkas / 1 Lembar (tujuan, langkah, penilaian)</option></select></div>
          <div class="field"><label>Nama Kepala PKBM</label><input id="pp-kepala" value="${esc(P.nama_kepala)}"></div>
          <div class="field"><label>NIP Kepala (opsional)</label><input id="pp-nipk" value="${esc(P.nip_kepala)}"></div>
        </div>
        <div class="grid3"><div class="field"><label>Kota (untuk tanda tangan)</label><input id="pp-kota" value="${esc(P.kota_ttd)}"></div></div>
        <div style="margin:6px 0;">
          <label style="display:block;"><input type="checkbox" id="pp-kop" ${cek(P.tampilkan_kop)}> Tampilkan kop sekolah di dokumen</label>
          <label style="display:block;"><input type="checkbox" id="pp-profil" ${cek(P.profil_pancasila)}> Sertakan Profil Pelajar Pancasila</label>
          <label style="display:block;"><input type="checkbox" id="pp-remedial" ${cek(P.sertakan_remedial)}> Sertakan Remedial &amp; Pengayaan</label>
          <label style="display:block;"><input type="checkbox" id="pp-rubrik" ${cek(P.sertakan_rubrik)}> Sertakan Rubrik Penilaian (Modul Ajar)</label>
        </div>
        <div class="field"><label>Catatan Khusus untuk AI (opsional)</label><textarea id="pp-catatan" rows="3" placeholder="mis. Peserta didik kebanyakan pekerja; utamakan contoh dari kehidupan sehari-hari dan pembelajaran singkat.">${esc(P.catatan_ai)}</textarea></div>
        <div class="toolbar"><button class="btn" onclick="PA.simpanPengaturan()">Simpan Pengaturan</button><span id="pp-status" class="muted"></span></div>
      </div>`;
  }
  async function simpanPengaturan() {
    const v = (id) => $(id).value.trim(); const c = (id) => $(id).checked; const st = $('pp-status');
    const data = { tahun_ajaran: v('pp-tahun'), menit_per_jp: +v('pp-menit') || 45, model_default: $('pp-model').value, format_rpp: $('pp-format').value,
      nama_kepala: v('pp-kepala'), nip_kepala: v('pp-nipk'), kota_ttd: v('pp-kota'), tampilkan_kop: c('pp-kop'), profil_pancasila: c('pp-profil'),
      sertakan_remedial: c('pp-remedial'), sertakan_rubrik: c('pp-rubrik'), catatan_ai: v('pp-catatan') };
    st.textContent = 'Menyimpan...';
    const { error } = await supa.from('pengaturan_perangkat').upsert({ id: 1, data, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) { st.style.color = '#B42318'; st.textContent = 'Gagal: ' + error.message + ' (jalankan migrasi-v23-perangkat-ajar.sql).'; return; }
    PENG = { ...DEF, ...data }; st.style.color = ''; st.textContent = 'Pengaturan tersimpan.';
  }

  window.PA = { buka, bukaPengaturan, mapelBerubah, cpBerubah, generate, simpan, unduh, cetak, bukaRiwayat, unduhRiwayat, hapusRiwayat, simpanPengaturan, ulangGambar, gantiGambar, hapusGambar };
})();
