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

  // ---------------- Halaman Generate (RPP / Modul) ----------------
  function halaman(jenis) {
    const j = jenis;
    const mapel = (currentMapelList || []).map((m) => `<option value="${m.id}">${esc(labelMapel(m))}</option>`).join('');
    return `
      <h2>Generate ${NAMA[j]} dengan AI</h2>
      <p class="muted">${j === 'lkpd'
        ? 'LKPD berisi kegiatan, tugas berjenjang, kolom jawaban, dan <b>gambar hasil AI</b>. Gambar dibuat satu per satu setelah teks selesai.'
        : j === 'rpp'
        ? 'RPP disusun otomatis mengikuti format & pengaturan di menu <b>Pengaturan RPP &amp; Modul</b>.'
        : 'Modul Ajar format Kurikulum Merdeka: informasi umum, komponen inti, asesmen, dan lampiran (LKPD, bahan bacaan, glosarium).'}
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
          <div class="field"><label>Jumlah Kegiatan</label><select id="pa-${j}-pert"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option></select></div>
          <div class="field"><label>Jumlah Gambar</label><select id="pa-${j}-gbr"><option>0</option><option>1</option><option>2</option><option selected>3</option></select></div>
          <div class="field"><label>Gaya Gambar</label><select id="pa-${j}-gaya"><option value="otomatis">Gambar AI (otomatis ilustrasi bila gagal)</option><option value="svg">Ilustrasi diagram saja (cepat)</option></select></div>
        </div>
        <div class="grid3">
          <div class="field"><label>Nama Guru</label><input type="text" id="pa-${j}-guru" /></div>
          <div class="field" style="align-self:end;"><label><input type="checkbox" id="pa-${j}-kunci" checked> Sertakan kunci jawaban (halaman guru)</label></div>
        </div>` : `<div class="grid3">
          <div class="field"><label>Jumlah Pertemuan</label><select id="pa-${j}-pert"><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
          <div class="field"><label>JP per Pertemuan</label><select id="pa-${j}-jp"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></div>
          <div class="field"><label>Nama Guru</label><input type="text" id="pa-${j}-guru" /></div>
        </div>`}
        <div class="grid3">
          <div class="field"><label>NIP/NUPTK Guru (opsional)</label><input type="text" id="pa-${j}-nip" /></div>
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
    await muatPengaturan();
    const box = $('tab-' + jenis);
    if (!box.dataset.siap) {
      box.innerHTML = halaman(jenis); box.dataset.siap = '1';
      $(`pa-${jenis}-guru`).value = localStorage.getItem('pa_guru') || '';
      $(`pa-${jenis}-nip`).value = localStorage.getItem('pa_nip') || '';
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
    const btn = $(`pa-${j}-btn`); const st = $(`pa-${j}-status`);
    btn.disabled = true; st.style.color = ''; st.textContent = `Menyusun ${NAMA[j]}... (sekitar 15-40 detik)`;
    try {
      const r = await panggilAI({ jenis: j, mapel: m.nama, program: m.program, kelas: m.kelas, fase, semester: ctx.semester, topik, cp, tp,
        pertemuan: ctx.pertemuan, jp: ctx.jp, pengaturan: PENG,
        ...(j === 'lkpd' ? { kegiatan: ctx.pertemuan, gambar: +$(`pa-${j}-gbr`).value, kunci: $(`pa-${j}-kunci`).checked } : {}) });
      const html = j === 'rpp' ? renderRpp(r.data, ctx) : j === 'modul' ? renderModul(r.data, ctx) : renderLkpd(r.data, ctx);
      $(`pa-${j}-hasil`).innerHTML = html; $(`pa-${j}-hasilbox`).classList.remove('hidden');
      terakhir[j] = { judul: `${NAMA[j]} ${m.nama} Kelas ${m.kelas || ''} - ${topik}`.slice(0, 160), meta: { mapel: m.nama, kelas: m.kelas, semester: ctx.semester, topik, provider: r.provider }, mapel_id: m.id, semester: ctx.semester, kelas: m.kelas };
      st.textContent = `Selesai (${r.provider}). Periksa & edit bila perlu, lalu simpan/unduh.`;
      $(`pa-${j}-hasilbox`).scrollIntoView({ behavior: 'smooth' });
      if (j === 'lkpd') { terakhir[j].gambar = r.data.bagian.map((b) => (b && b.gambar && b.gambar.deskripsi) || null); await buatGambar(j); }
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
    return `<div style="text-align:center;border-bottom:3px double #000;padding-bottom:6px;margin-bottom:12px;">
      ${S.nama_yayasan ? `<div style="font-size:11pt;">${esc(S.nama_yayasan)}</div>` : ''}
      <div style="font-size:14pt;font-weight:bold;">${esc(S.nama_lembaga || 'PKBM')}</div>
      <div style="font-size:9pt;">${esc(S.alamat || '')}</div></div>`;
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

  function renderModul(d, c) {
    const mjp = +PENG.menit_per_jp || 45; const a = d.asesmen || {}; const lk = d.lkpd || {};
    const rub = Array.isArray(d.rubrik) && d.rubrik.length
      ? `<table style="${TB}"><tr style="background:#e8e8e8;">${['Aspek', 'Sangat Baik', 'Baik', 'Cukup', 'Perlu Bimbingan'].map((x) => `<td style="${TD}"><b>${x}</b></td>`).join('')}</tr>${d.rubrik.map((r) => `<tr>${[r.aspek, r.sangat_baik, r.baik, r.cukup, r.perlu_bimbingan].map((x) => `<td style="${TD}">${esc(x)}</td>`).join('')}</tr>`).join('')}</table>` : '';
    return `${kop()}<p style="text-align:center;font-size:14pt;margin:0 0 10px;"><b>MODUL AJAR</b><br>${esc(c.mapel)}</p>
      ${H('I. INFORMASI UMUM')}
      ${baris([['Penyusun', esc(c.guru)], ['Satuan Pendidikan', esc(((typeof SEKOLAH !== 'undefined' && SEKOLAH.nama_lembaga) || 'PKBM'))], ['Tahun Pelajaran', esc(PENG.tahun_ajaran)],
        ['Program / Kelas / Fase', esc(`${c.program || ''} / ${c.kelas || ''}${c.fase ? ' / Fase ' + c.fase : ''}`)], ['Semester', esc(c.semester)], ['Topik', esc(c.topik)],
        ['Alokasi Waktu', `${c.pertemuan} pertemuan × ${c.jp} JP (${c.jp * mjp} menit/pertemuan)`], ['Kompetensi Awal', esc(d.kompetensi_awal)],
        ['Model Pembelajaran', esc(d.model)], ['Target Peserta Didik', esc(d.target_peserta)]])}
      ${L(d.profil).length ? H('Profil Pelajar Pancasila') + UL(d.profil) : ''}
      ${L(d.sarpras).length ? H('Sarana dan Prasarana') + UL(d.sarpras) : ''}
      ${H('II. KOMPONEN INTI')}
      ${c.cp ? H('Capaian Pembelajaran') + `<p style="margin:0;text-align:justify;">${esc(c.cp.deskripsi)}</p>` : ''}
      ${H('Tujuan Pembelajaran')}${OL(d.tujuan)}
      ${L(d.pemahaman_bermakna).length ? H('Pemahaman Bermakna') + UL(d.pemahaman_bermakna) : ''}
      ${L(d.pertanyaan_pemantik).length ? H('Pertanyaan Pemantik') + UL(d.pertanyaan_pemantik) : ''}
      ${L(d.persiapan).length ? H('Persiapan Pembelajaran') + UL(d.persiapan) : ''}
      ${H('Kegiatan Pembelajaran')}${tabelKegiatan(d.kegiatan, mjp, c.jp)}
      ${H('Asesmen')}
      <p style="margin:0;">${a.diagnostik ? '<b>Diagnostik:</b> ' + esc(a.diagnostik) + '<br>' : ''}${a.formatif ? '<b>Formatif:</b> ' + esc(a.formatif) + '<br>' : ''}${a.sumatif ? '<b>Sumatif:</b> ' + esc(a.sumatif) : ''}</p>
      ${rub ? H('Rubrik Penilaian') + rub : ''}
      ${(d.pengayaan || d.remedial) ? H('Pengayaan dan Remedial') + `<p style="margin:0;">${d.pengayaan ? '<b>Pengayaan:</b> ' + esc(d.pengayaan) + '<br>' : ''}${d.remedial ? '<b>Remedial:</b> ' + esc(d.remedial) : ''}</p>` : ''}
      ${L(d.refleksi_guru).length || L(d.refleksi_siswa).length ? H('Refleksi') + (L(d.refleksi_guru).length ? '<p style="margin:0;"><i>Guru:</i></p>' + UL(d.refleksi_guru) : '') + (L(d.refleksi_siswa).length ? '<p style="margin:4px 0 0;"><i>Peserta didik:</i></p>' + UL(d.refleksi_siswa) : '') : ''}
      ${H('III. LAMPIRAN')}
      ${lk.judul ? H('A. Lembar Kerja Peserta Didik (LKPD): ' + esc(lk.judul)) + (lk.petunjuk ? `<p style="margin:0 0 4px;">${esc(lk.petunjuk)}</p>` : '') + (L(lk.langkah).length ? '<p style="margin:0;"><i>Langkah kerja:</i></p>' + OL(lk.langkah) : '') + (L(lk.soal).length ? '<p style="margin:4px 0 0;"><i>Soal/Tugas:</i></p>' + OL(lk.soal) : '') : ''}
      ${d.bahan_bacaan ? H('B. Bahan Bacaan') + PARA(d.bahan_bacaan) : ''}
      ${Array.isArray(d.glosarium) && d.glosarium.length ? H('C. Glosarium') + `<table style="${TB}">${d.glosarium.map((g) => `<tr><td style="${TD}width:28%;"><b>${esc(g.istilah)}</b></td><td style="${TD}">${esc(g.arti)}</td></tr>`).join('')}</table>` : ''}
      ${L(d.pustaka).length ? H('D. Daftar Pustaka') + OL(d.pustaka) : ''}
      ${ttd(c)}`;
  }

  function renderLkpd(d, c) {
    const garis = (n) => Array.from({ length: n }, () => '<tr><td style="border-bottom:1px solid #777;height:24px;">&nbsp;</td></tr>').join('');
    const kotak = `<table style="${TB}margin:3px 0 8px;">${garis(3)}</table>`;
    const bag = (d.bagian || []).map((b, i) => {
      const g = b.gambar && b.gambar.deskripsi ? `<p data-gambar="${i}" style="text-align:center;margin:8px 0;"><span style="color:#888;">⏳ Gambar sedang dibuat...</span><br><i>${esc(b.gambar.keterangan || '')}</i></p>` : '';
      const tugas = L(b.tugas).map((t, k) => `<tr><td style="width:4%;vertical-align:top;">${k + 1}.</td><td>${esc(t)}${kotak}</td></tr>`).join('');
      return `${H(esc(b.judul || 'Kegiatan ' + (i + 1)))}${b.uraian ? `<p style="margin:0 0 4px;text-align:justify;">${esc(b.uraian)}</p>` : ''}${g}<table style="${TB}">${tugas}</table>`;
    }).join('');
    const kunci = L(d.kunci).length ? `<div style="page-break-before:always;"></div><p style="text-align:center;"><b>KUNCI JAWABAN (KHUSUS GURU)</b></p>${OL(d.kunci)}` : '';
    return `${kop()}<p style="text-align:center;font-size:14pt;margin:0 0 8px;"><b>LEMBAR KERJA PESERTA DIDIK (LKPD)</b><br>${esc(d.judul || c.topik)}</p>
      ${baris([['Mata Pelajaran', esc(c.mapel)], ['Kelas / Semester', esc(`${c.kelas || ''} / ${c.semester}`)], ['Nama', '.......................................................'], ['Kelompok / Tanggal', '.......................................................']])}
      ${H('Tujuan Pembelajaran')}${OL(d.tujuan)}
      ${L(d.petunjuk).length ? H('Petunjuk Pengerjaan') + OL(d.petunjuk) : ''}
      ${L(d.alat_bahan).length ? H('Alat dan Bahan') + UL(d.alat_bahan) : ''}
      ${bag}
      ${L(d.refleksi).length ? H('Refleksi') + OL(d.refleksi) + kotak : ''}
      ${kunci}`;
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
    return { ...j, asli: r.asli };
  }
  async function buatGambar(j) {
    const daftar = (terakhir[j] && terakhir[j].gambar) || []; const st = $(`pa-${j}-status`);
    const gaya = $(`pa-${j}-gaya`) ? $(`pa-${j}-gaya`).value : 'otomatis';
    const total = daftar.filter(Boolean).length; let ok = 0, n = 0, salin = 0;
    for (let i = 0; i < daftar.length; i++) {
      if (!daftar[i]) continue;
      const el = $(`pa-${j}-hasil`).querySelector(`[data-gambar="${i}"]`);
      if (!el || el.querySelector('img')) { ok++; continue; }
      n++; st.style.color = ''; st.textContent = `Membuat gambar ${n} dari ${total}... (10-40 detik per gambar)`;
      try {
        const g = await satuGambar(daftar[i], gaya);
        const ket = (el.querySelector('i') || {}).textContent || '';
        const lebar = Math.min(g.w, 420);
        el.innerHTML = `<img src="${g.uri}" width="${lebar}" height="${Math.round(lebar * g.h / g.w)}" style="max-width:100%;border:1px solid #ccc;"><br><i>${esc(ket)}</i>`;
        ok++; if (!g.asli) salin++;
      } catch (e) {
        el.innerHTML = `<span style="color:#B42318;">[Gambar gagal dibuat: ${esc(e.message).slice(0, 120)}]</span><br><i>${esc((el.querySelector('i') || {}).textContent || '')}</i>`;
      }
    }
    st.style.color = ok < total ? '#B42318' : '';
    st.textContent = ok < total ? `${ok} dari ${total} gambar berhasil. Klik "Buat ulang gambar yang gagal".` : `Selesai. ${total} gambar siap${salin ? ` (${salin} berupa ilustrasi diagram karena gambar AI tidak tersedia)` : ''}. Periksa & edit, lalu simpan/unduh.`;
  }
  async function ulangGambar(j) {
    $(`pa-${j}-hasil`).querySelectorAll('[data-gambar]').forEach((el) => {
      if (!el.querySelector('img')) { const ket = (el.querySelector('i') || {}).textContent || ''; el.innerHTML = `<span style="color:#888;">⏳ Gambar sedang dibuat...</span><br><i>${esc(ket)}</i>`; }
    });
    await buatGambar(j);
  }

  // ---------------- Unduh / Cetak / Simpan ----------------
  function bungkusWord(html, judul) {
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(judul)}</title>
      <style>@page Section1{size:595.3pt 841.9pt;margin:56.7pt 56.7pt 56.7pt 70.9pt;} div.Section1{page:Section1;} body{font-family:'Times New Roman',serif;font-size:12pt;} table{border-collapse:collapse;} p{margin:0 0 4px;}</style></head>
      <body><div class="Section1">${html}</div></body></html>`;
  }
  function namaFile(t) { return String(t || 'dokumen').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'dokumen'; }
  function unduhHtml(html, judul) {
    if (/<img[^>]+src="data:image/i.test(html)) return unduhMht(html, judul);
    const blob = new Blob(['\ufeff', bungkusWord(html, judul)], { type: 'application/msword' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = namaFile(judul) + '.doc';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function unduhMht(html, judul) {
    const bagian = []; let n = 0;
    const isi = html.replace(/src="data:(image\/[a-z+]+);base64,([^"]+)"/gi, (m, mime, b64) => {
      n++; const ext = mime.split('/')[1].replace('jpeg', 'jpg'); const lokasi = `file:///C:/gambar${n}.${ext}`;
      bagian.push({ mime, b64, lokasi }); return `src="${lokasi}"`;
    });
    const b64 = (t) => btoa(unescape(encodeURIComponent(t))).replace(/.{1,76}/g, '$&\r\n');
    const B = '----=_NextPart_' + Date.now().toString(16);
    let out = `MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="${B}"; type="text/html"\r\n\r\n--${B}\r\nContent-Type: text/html; charset="utf-8"\r\nContent-Transfer-Encoding: base64\r\nContent-Location: file:///C:/dokumen.htm\r\n\r\n${b64(bungkusWord(isi, judul))}\r\n`;
    bagian.forEach((p) => { out += `--${B}\r\nContent-Type: ${p.mime}\r\nContent-Transfer-Encoding: base64\r\nContent-Location: ${p.lokasi}\r\n\r\n${p.b64.replace(/.{1,76}/g, '$&\r\n')}\r\n`; });
    out += `--${B}--`;
    const blob = new Blob([out], { type: 'application/msword' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = namaFile(judul) + '.doc';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function cetakHtml(html, judul) {
    const w = window.open('', '_blank'); if (!w) { alert('Izinkan pop-up untuk mencetak.'); return; }
    w.document.write(bungkusWord(html, judul).replace('</style>', '@page{size:A4;margin:2cm}</style>')); w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
  }
  const hasilHtml = (j) => $(`pa-${j}-hasil`).innerHTML;
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
    $(`pa-${j}-hasil`).innerHTML = r.html; $(`pa-${j}-hasilbox`).classList.remove('hidden');
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

  window.PA = { buka, bukaPengaturan, mapelBerubah, cpBerubah, generate, simpan, unduh, cetak, bukaRiwayat, unduhRiwayat, hapusRiwayat, simpanPengaturan, ulangGambar };
})();
