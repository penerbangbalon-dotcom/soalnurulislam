// Modul bersama untuk Netlify Functions ujian (submit-ujian, heartbeat, sudahi-ujian, mulai-ujian).
// Tidak memakai library npm apa pun (langsung fetch ke Supabase REST API).
// Di-bundle otomatis oleh esbuild (lihat netlify.toml), jadi cukup `require('../lib/ujian-core')`.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Anon key tidak rahasia (sudah ada di index.html); dipakai hanya untuk memvalidasi token login guru.
const ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ld2VpdmR2b3ZwY2dvbGF4enVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjY3MDgsImV4cCI6MjEwNTM0MjcwOH0.bJyrKD7pnCcVizWbsBD5e0LrFl_8LdwU_5JRmyqkfV0';

// Batas pelanggaran (pindah tab/aplikasi, paste, dsb). Mencapai angka ini = ujian otomatis diakhiri dan dinilai.
// 0 = fitur dimatikan. Samakan dengan ANTI_CURANG.batasPelanggaran di ujian.html.
const BATAS_PELANGGARAN = Number.isFinite(parseInt(process.env.BATAS_PELANGGARAN, 10)) ? parseInt(process.env.BATAS_PELANGGARAN, 10) : 3;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function adaKonfigurasi() {
  return !!(SUPABASE_URL && SERVICE_KEY);
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Supabase error (${res.status})`);
  return data;
}

// Pastikan pemanggil adalah guru/admin yang sudah login (token sesi Supabase Auth).
async function pastikanLogin(event) {
  const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// Nilai akhir skala 0-100, dibagi menurut bobot jenis soal. Bobot kosong = proporsional poin soal.
function hitungNilai(items, p) {
  const g = { pilihan_ganda: { maks: 0, skor: 0, pending: false }, isian_singkat: { maks: 0, skor: 0, pending: false }, essay: { maks: 0, skor: 0, pending: false } };
  items.forEach((i) => { const x = g[i.jenis]; if (!x) return; x.maks += Number(i.poin) || 0; x.skor += Number(i.skor) || 0; if (i.pending) x.pending = true; });
  const b = { pilihan_ganda: p.bobot_pg, isian_singkat: p.bobot_isian, essay: p.bobot_essay };
  const adaBobot = Object.values(b).some((v) => v != null);
  let sumW = 0, nilai = 0, maksSem = 0;
  for (const k in g) {
    const x = g[k]; if (!x.maks) continue;
    const w = adaBobot ? (Number(b[k]) || 0) : x.maks;
    sumW += w; nilai += w * Math.min(1, x.skor / x.maks); if (!x.pending) maksSem += w;
  }
  if (!sumW) return { nilai: 0, maks: 100 };
  return { nilai: Math.round(nilai / sumW * 10000) / 100, maks: Math.round(maksSem / sumW * 10000) / 100 };
}

const norm = (s) => (s == null ? '' : String(s)).trim().toLowerCase().replace(/\s+/g, ' ');

// Menilai jawaban & menutup sesi. Dipakai oleh submit-ujian (siswa mengumpulkan sendiri)
// dan sudahi-ujian (guru mengakhiri paksa memakai jawaban_sementara).
//  - jawabanRaw: [{ soal_id, jawaban }]  ATAU  null (kalau null, dibangun dari jawabanTersimpan)
//  - jawabanTersimpan: { [soal_id]: jawaban }  (dipakai bila jawabanRaw == null)
// Mengembalikan { status, body } siap dikirim sebagai respons HTTP.
async function nilaiDanSimpanSesi({ sesi, paketInfo, jawabanRaw, jawabanTersimpan, pelanggaran }) {
  const sesiId = sesi.id;
  const paketSoal = await sb(`paket_soal?paket_ujian_id=eq.${sesi.paket_ujian_id}&select=soal_id,poin`);
  const valid = new Set((paketSoal || []).map((p) => p.soal_id));

  if (!jawabanRaw) {
    const t = jawabanTersimpan && typeof jawabanTersimpan === 'object' ? jawabanTersimpan : {};
    jawabanRaw = (paketSoal || []).map((p) => ({ soal_id: p.soal_id, jawaban: t[p.soal_id] == null ? '' : String(t[p.soal_id]) }));
  }

  // Hanya terima soal yang benar-benar bagian dari paket ini (tanpa duplikat)
  const seen = new Set();
  const jawaban = jawabanRaw.filter((j) => j && valid.has(j.soal_id) && !seen.has(j.soal_id) && seen.add(j.soal_id));
  if (!jawaban.length) return { status: 400, body: { error: 'Tidak ada jawaban yang valid' } };

  // "Klaim" sesi secara atomik: hanya satu proses (siswa ATAU guru) yang boleh menutup sesi.
  // Mencegah nilai ganda kalau siswa klik Kumpulkan tepat saat guru menekan Sudahi.
  const klaim = await sb(`sesi_ujian?id=eq.${sesiId}&status=eq.berlangsung`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'selesai', waktu_selesai: new Date().toISOString() }),
  });
  if (!klaim || !klaim.length) return { status: 403, body: { error: 'Sesi ujian sudah selesai' } };

  try {
    const soalIds = [...valid];
    const soalData = await sb(`bank_soal?id=in.(${soalIds.join(',')})&select=id,jenis,kunci_jawaban,poin`);
    const soalMap = Object.fromEntries(soalData.map((s) => [s.id, s]));
    const poinMap = Object.fromEntries((paketSoal || []).map((p) => [p.soal_id, p.poin]));

    let adaYangPerluNilaiManual = false;
    let maksOtomatis = 0, maksTotal = 0, benar = 0, jumlahOtomatis = 0;
    const detailRows = jawaban.map((j) => {
      const soal = soalMap[j.soal_id];
      const poin = poinMap[j.soal_id] ?? soal?.poin ?? 1;
      maksTotal += Number(poin) || 0;
      let skor = null;
      let perluManual = false;

      if (!soal) {
        return { sesi_ujian_id: sesiId, soal_id: j.soal_id, jawaban: j.jawaban, skor: 0, perlu_nilai_manual: false };
      }

      // Essay yang dikosongkan siswa langsung bernilai 0 (tidak perlu dinilai manual)
      if (soal.jenis === 'essay' && (j.jawaban || '').trim()) {
        perluManual = true;
        adaYangPerluNilaiManual = true;
      } else {
        // Kunci alternatif dipisah tanda | (mis. "Jakarta|DKI Jakarta")
        const kunciList = (soal.kunci_jawaban || '').split('|').map(norm).filter(Boolean);
        skor = kunciList.includes(norm(j.jawaban)) ? poin : 0;
        maksOtomatis += Number(poin) || 0; jumlahOtomatis++; if (skor > 0) benar++;
      }
      return { sesi_ujian_id: sesiId, soal_id: j.soal_id, jawaban: j.jawaban, skor, perlu_nilai_manual: perluManual };
    });

    // Nilai akhir berbobot (0-100); essay yang belum dinilai ditandai pending
    const perSoal = Object.fromEntries(detailRows.map((d) => [d.soal_id, d]));
    const hasil = hitungNilai(
      (paketSoal || []).filter((p) => soalMap[p.soal_id]).map((p) => {
        const s = soalMap[p.soal_id], d = perSoal[p.soal_id];
        return { jenis: s.jenis, poin: p.poin ?? s.poin ?? 1, skor: d?.skor ?? 0, pending: !!d?.perlu_nilai_manual };
      }),
      paketInfo || {}
    );

    await sb('detail_jawaban', { method: 'POST', body: JSON.stringify(detailRows) });

    await sb(`sesi_ujian?id=eq.${sesiId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        pelanggaran: Math.min(parseInt(pelanggaran) || 0, 999),
        status: adaYangPerluNilaiManual ? 'selesai' : 'dinilai',
        waktu_selesai: new Date().toISOString(),
        total_skor: hasil.nilai,
        jawaban_sementara: null,
        dikunci: false,
      }),
    });

    return {
      status: 200,
      body: {
        ok: true,
        selesai: true,
        perlu_nilai_manual: adaYangPerluNilaiManual,
        nilai: hasil.nilai, maks_sementara: hasil.maks,
        maks_otomatis: maksOtomatis, maks_total: maksTotal, benar, jumlah_otomatis: jumlahOtomatis,
        total_skor: hasil.nilai,
      },
    };
  } catch (err) {
    // Gagal di tengah jalan: buka lagi sesinya supaya bisa dicoba ulang (tidak menggantung "selesai" tanpa nilai).
    try {
      await sb(`sesi_ujian?id=eq.${sesiId}`, { method: 'PATCH', body: JSON.stringify({ status: 'berlangsung', waktu_selesai: null }) });
    } catch (e2) { /* abaikan */ }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// PERAN PENGGUNA (admin / guru)
// Peran disimpan di app_metadata.role pada Supabase Auth. app_metadata HANYA bisa diubah dengan
// service_role key (lewat fungsi kelola-user), jadi pengguna tidak bisa menaikkan perannya sendiri.
// Seorang admin dikenali bila: (1) app_metadata.role === 'admin' atau 'superadmin', atau (2) emailnya ada di env ADMIN_EMAILS
// (dipisah koma), atau (3) BELUM ADA admin sama sekali dan pemanggil adalah akun tertua (bootstrap otomatis
// supaya instalasi lama tidak terkunci). Akun lain = guru.
// ---------------------------------------------------------------------------
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

async function authAdmin(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    ...opts,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && (data.msg || data.message || data.error_description || data.error)) || `Supabase error (${res.status})`);
  return data;
}

const SUPER_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const peranDari = (u) => (u && u.app_metadata && u.app_metadata.role) || null;
const emailAdmin = (u) => !!(u && u.email && ADMIN_EMAILS.includes(String(u.email).toLowerCase()));
const emailSuper = (u) => !!(u && u.email && SUPER_EMAILS.includes(String(u.email).toLowerCase()));
// Super admin otomatis juga admin (boleh semua fitur admin).
const superLangsung = (u) => peranDari(u) === 'superadmin' || emailSuper(u);
const adminLangsung = (u) => superLangsung(u) || peranDari(u) === 'admin' || emailAdmin(u);

// Mengembalikan { admin, superadmin, dipromosikan }.
// Super admin = app_metadata.role 'superadmin' ATAU email ada di env SUPER_ADMIN_EMAILS.
// Bootstrap: bila BELUM ada super admin sama sekali, akun admin tertua (atau akun tertua bila belum ada admin)
// otomatis menjadi super admin saat pertama kali membuka aplikasi, supaya instalasi lama tidak terkunci.
async function tentukanPeran(pemanggil) {
  const tidak = { admin: false, superadmin: false, dipromosikan: false };
  if (!pemanggil) return tidak;
  if (peranDari(pemanggil) === 'superadmin') return { admin: true, superadmin: true, dipromosikan: false };
  let jadiSuper = emailSuper(pemanggil);
  if (!jadiSuper) {
    const data = await authAdmin('/users?per_page=200');
    const users = (data && data.users) || [];
    if (!users.some(superLangsung)) {
      const urut = (a) => a.slice().sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)));
      const admins = users.filter(adminLangsung);
      const calon = urut(admins.length ? admins : users)[0];
      jadiSuper = !!(calon && calon.id === pemanggil.id);
    }
  }
  if (!jadiSuper) {
    const admin = adminLangsung(pemanggil);
    return { admin, superadmin: false, dipromosikan: false };
  }
  await authAdmin(`/users/${pemanggil.id}`, { method: 'PUT', body: JSON.stringify({ app_metadata: { ...(pemanggil.app_metadata || {}), role: 'superadmin' } }) });
  return { admin: true, superadmin: true, dipromosikan: true };
}

// Guard siap pakai: { pemanggil } bila login, atau { error:response }.
async function wajibLogin(event) {
  const pemanggil = await pastikanLogin(event);
  if (!pemanggil) return { error: { statusCode: 401, body: JSON.stringify({ error: 'Sesi login tidak valid. Silakan login ulang.' }) } };
  return { pemanggil };
}
async function wajibAdmin(event) {
  const g = await wajibLogin(event);
  if (g.error) return g;
  const peran = await tentukanPeran(g.pemanggil);
  if (!peran.admin) return { error: { statusCode: 403, body: JSON.stringify({ error: 'Fitur ini hanya untuk admin.' }) } };
  return { pemanggil: g.pemanggil, peran };
}
async function wajibSuperAdmin(event) {
  const g = await wajibLogin(event);
  if (g.error) return g;
  const peran = await tentukanPeran(g.pemanggil);
  if (!peran.superadmin) return { error: { statusCode: 403, body: JSON.stringify({ error: 'Fitur ini hanya untuk Super Admin.' }) } };
  return { pemanggil: g.pemanggil, peran };
}

// ---------------------------------------------------------------------------
// PEMBATAS PERCOBAAN MASUK SISWA (anti tebak NISN/PIN/kode)
// Memakai tabel percobaan_masuk_siswa (lihat migrasi-v11-keamanan.sql). Kalau tabel belum dibuat,
// pembatas dilewati diam-diam supaya ujian tidak ikut gagal.
// ---------------------------------------------------------------------------
function ipDari(event) {
  const h = (event && event.headers) || {};
  const x = h['x-forwarded-for'] || h['X-Forwarded-For'] || h['x-real-ip'] || '';
  return String(x).split(',')[0].trim() || 'tak-dikenal';
}
async function hitungGagal(kunci, menit) {
  try {
    const sejak = new Date(Date.now() - menit * 60000).toISOString();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/percobaan_masuk_siswa?kunci=eq.${encodeURIComponent(kunci)}&waktu=gte.${encodeURIComponent(sejak)}&select=id`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'count=exact', Range: '0-0' },
    });
    if (!res.ok) return 0;
    const m = String(res.headers.get('content-range') || '').match(/\/(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  } catch (e) { return 0; }
}
async function catatGagal(...daftarKunci) {
  try {
    await sb('percobaan_masuk_siswa', { method: 'POST', body: JSON.stringify(daftarKunci.filter(Boolean).map((kunci) => ({ kunci }))) });
    if (Math.random() < 0.02) await sb(`percobaan_masuk_siswa?waktu=lt.${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}`, { method: 'DELETE' });
  } catch (e) { /* tabel belum ada: abaikan */ }
}

// ---------------------------------------------------------------------------
// REMEDIAL ONLINE
// Siswa berhak remedial untuk satu komponen (UH / UTS / UAS) bila nilai komponen itu di bawah KKM
// dan ia belum lulus remedial (nilai remedial terbaik, online ATAU input manual guru, belum mencapai KKM).
// Paket Remedial (paket_ujian.jenis_ujian = 'Remedial') yang dibuka diberikan OTOMATIS sesuai mapel, kelas,
// semester, dan komponen. Bila ada beberapa paket, siswa mendapat paket yang BELUM pernah ia kerjakan,
// sehingga soal remedial selalu berbeda dari ujian asli (aturan 1 soal = 1 paket) dan dari percobaan sebelumnya.
// ---------------------------------------------------------------------------
const NAMA_KOMP_REM = { uh: 'Ulangan Harian', uts: 'UTS', uas: 'UAS' };
function komponenDariJenis(jenis) {
  const j = String(jenis || '').trim().toLowerCase();
  if (j === 'uts') return 'uts';
  if (j === 'uas') return 'uas';
  if (j === 'uh' || j.includes('harian')) return 'uh';
  return null;
}
function pisahSmtTa(semester, ta) {
  let smt = semester || null, t = ta || null;
  if (!t) {
    const m = String(smt || '').trim().match(/^(Ganjil|Genap)\s+(\d{4}\/\d{4})$/i);
    if (m) { smt = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(); t = m[2]; }
  }
  return { smt, ta: t };
}
function kunciPeriode(r) {
  const n = pisahSmtTa(r.semester, r.tahun_ajaran);
  return [n.ta || '-', n.smt || '-', r.kelas || '-', r.program || '-', r.mapel_nama || '-'].join('||');
}

async function daftarRemedialSiswa(nisn) {
  const n = encodeURIComponent(String(nisn).trim());
  let arsip;
  try {
    arsip = await sb(`arsip_nilai?siswa_nisn=eq.${n}&status=eq.dinilai&total_skor=not.is.null&select=jenis_ujian,mapel_nama,program,kelas,semester,tahun_ajaran,total_skor,waktu_selesai,remedial_komponen`);
  } catch (e) {
    throw new Error('Fitur remedial belum aktif di database. Admin perlu menjalankan migrasi-v15-paket-remedial.sql di Supabase. (' + e.message + ')');
  }
  const [pengRows, manualRows, paketRows] = await Promise.all([
    sb('pengaturan_nilai?id=eq.umum&select=kkm,kkm_mapel,remedial').catch(() => []),
    sb(`nilai_manual_komponen?siswa_nisn=eq.${n}&komponen=in.(rem_uh,rem_uts,rem_uas)&select=program,kelas,tahun_ajaran,semester,mapel_nama,komponen,nilai`).catch(() => []),
    sb(`paket_ujian?jenis_ujian=eq.Remedial&status=eq.siap&diarsipkan=eq.false&select=id,judul,kode_akses,durasi_menit,kelas,program,semester,tahun_ajaran,remedial_komponen,remedial_batas,created_at,mata_pelajaran(nama)&order=created_at.asc`),
  ]);
  const peng = (pengRows && pengRows[0]) || {};
  const kkmUmum = peng.kkm != null ? Number(peng.kkm) : 70;
  const kkmMapel = peng.kkm_mapel || {};
  const modeRem = (peng.remedial && peng.remedial.mode) || 'kkm';
  const kkmUntuk = (program, kelas, mapel) => {
    const v = kkmMapel[[program || '', kelas || '', mapel || ''].join('|')];
    return v != null && v !== '' && !isNaN(v) ? Number(v) : kkmUmum;
  };

  // Kelompokkan nilai asli per (TA, semester, kelas, program, mapel)
  const grup = new Map();
  const ambil = (k) => { if (!grup.has(k)) grup.set(k, { uh: [], uts: [], uas: [], rem: {} }); return grup.get(k); };
  (arsip || []).forEach((r) => {
    const sk = Number(r.total_skor); if (!Number.isFinite(sk)) return;
    const g = ambil(kunciPeriode(r));
    if (r.jenis_ujian === 'Remedial') {
      const k = r.remedial_komponen;
      if (k && (g.rem[k] == null || sk > g.rem[k])) g.rem[k] = sk;   // remedial online terbaik
      return;
    }
    const komp = komponenDariJenis(r.jenis_ujian); if (!komp) return;
    g[komp].push({ sk, t: r.waktu_selesai ? new Date(r.waktu_selesai).getTime() : 0 });
  });
  const manualRem = new Map();
  (manualRows || []).forEach((r) => {
    manualRem.set([r.tahun_ajaran, r.semester, r.kelas, r.program, r.mapel_nama].join('||') + '##' + r.komponen, Number(r.nilai));
  });

  // Paket remedial terbuka (belum lewat batas), lalu sesi siswa pada paket-paket itu
  const sekarang = Date.now();
  const paketBuka = (paketRows || []).filter((p) => !p.remedial_batas || new Date(p.remedial_batas).getTime() >= sekarang);
  let sesiPerPaket = new Map();
  if (paketBuka.length) {
    const ids = paketBuka.map((p) => p.id).join(',');
    const sesi = await sb(`sesi_ujian?siswa_nisn=eq.${n}&paket_ujian_id=in.(${ids})&select=paket_ujian_id,status,total_skor`);
    (sesi || []).forEach((x) => sesiPerPaket.set(x.paket_ujian_id, x));
  }

  const hasil = [];
  for (const [kunci, g] of grup.entries()) {
    const [ta, smt, kelas, program, mapel] = kunci.split('||');
    const kkm = kkmUntuk(program, kelas, mapel);
    const nilaiAsli = {
      uh: g.uh.length ? g.uh.reduce((a, c) => a + c.sk, 0) / g.uh.length : null,
      uts: g.uts.length ? g.uts.sort((a, b) => b.t - a.t)[0].sk : null,
      uas: g.uas.length ? g.uas.sort((a, b) => b.t - a.t)[0].sk : null,
    };
    for (const komp of ['uh', 'uts', 'uas']) {
      const asli = nilaiAsli[komp];
      if (asli == null || asli >= kkm) continue;                      // belum ada nilai / sudah tuntas
      const manual = manualRem.get(kunci + '##rem_' + komp);
      const remTerbaik = manual != null ? manual : (g.rem[komp] != null ? g.rem[komp] : null);
      const item = {
        mapel, program, kelas, tahun_ajaran: ta, semester: smt, komponen: komp, label: NAMA_KOMP_REM[komp],
        nilai_asli: Math.round(asli * 100) / 100, kkm, remedial_terbaik: remTerbaik, status: '', paket: null,
      };
      if (modeRem === 'nonaktif') { item.status = 'nonaktif'; hasil.push(item); continue; }
      // Nilai efektif setelah remedial memakai aturan yang sama dengan index.html (terapkanRemedial).
      if (remTerbaik != null) {
        let eff = modeRem === 'tertinggi' ? remTerbaik : modeRem === 'rata' ? (asli + remTerbaik) / 2 : Math.min(remTerbaik, kkm);
        if (eff <= asli) eff = asli;
        if (eff >= kkm) { item.status = 'lulus'; hasil.push(item); continue; }
      }
      const cocok = paketBuka.filter((p) => {
        if (p.remedial_komponen !== komp) return false;
        if ((p.mata_pelajaran && p.mata_pelajaran.nama) !== mapel) return false;
        if (p.program !== program || p.kelas !== kelas) return false;
        const pn = pisahSmtTa(p.semester, p.tahun_ajaran);
        return (pn.ta || '-') === ta && (pn.smt || '-') === smt;
      });
      const berlangsung = cocok.find((p) => sesiPerPaket.get(p.id) && sesiPerPaket.get(p.id).status === 'berlangsung');
      const menunggu = cocok.find((p) => sesiPerPaket.get(p.id) && sesiPerPaket.get(p.id).status === 'selesai');
      const belumDikerjakan = cocok.find((p) => !sesiPerPaket.get(p.id));
      const pilih = berlangsung || (menunggu ? null : belumDikerjakan);
      if (berlangsung) item.status = 'berlangsung';
      else if (menunggu) item.status = 'menunggu_nilai';             // essay remedial belum dinilai guru
      else if (belumDikerjakan) item.status = 'tersedia';
      else if (cocok.length) item.status = 'semua_sudah';            // semua paket sudah dikerjakan, masih di bawah KKM
      else item.status = 'belum_ada_paket';
      if (pilih) item.paket = { id: pilih.id, judul: pilih.judul, durasi_menit: pilih.durasi_menit, kode_akses: pilih.kode_akses, batas: pilih.remedial_batas || null };
      hasil.push(item);
    }
  }
  const urutan = { berlangsung: 0, tersedia: 1, menunggu_nilai: 2, semua_sudah: 3, belum_ada_paket: 4, lulus: 5, nonaktif: 6 };
  hasil.sort((a, b) => (urutan[a.status] - urutan[b.status]) || a.mapel.localeCompare(b.mapel, 'id'));
  return hasil;
}

// Apakah siswa ini peserta sah untuk paket remedial tertentu? (dipakai mulai-ujian)
async function cekPesertaRemedial(nisn, paket) {
  if (paket.remedial_batas && new Date(paket.remedial_batas).getTime() < Date.now()) {
    return { ok: false, pesan: 'Pendaftaran remedial ini sudah ditutup.' };
  }
  const daftar = await daftarRemedialSiswa(nisn);
  const ok = daftar.some((d) => d.paket && d.paket.id === paket.id && (d.status === 'tersedia' || d.status === 'berlangsung'));
  return ok ? { ok: true } : { ok: false, pesan: 'Paket remedial ini bukan untukmu: nilaimu sudah tuntas, mata pelajarannya berbeda, atau kamu sudah mengerjakan paket ini.' };
}

// Verifikasi NISN (+PIN) siswa, sama aturannya dengan mulai-ujian.
async function verifikasiSiswa(nisn, pin, kolomTambahan) {
  const TABEL = process.env.TABEL_SISWA || 'students';
  const K_NISN = process.env.KOLOM_NISN || 'nisn';
  const K_NAMA = process.env.KOLOM_NAMA_SISWA || 'nama';
  const K_PIN = process.env.KOLOM_PIN || '';
  if (String(process.env.WAJIB_PIN || '').toLowerCase() === 'true' && !K_PIN) return { status: 500, error: 'Server diatur WAJIB_PIN=true tetapi KOLOM_PIN belum diisi. Hubungi admin.' };
  const list = await sb(`${TABEL}?${K_NISN}=eq.${encodeURIComponent(String(nisn).trim())}&select=${K_NISN},${K_NAMA}${K_PIN ? ',' + K_PIN : ''}${(kolomTambahan || []).map((k) => ',' + k).join('')}${TABEL === 'students' ? '&status=eq.AKTIF' : ''}`);
  const siswa = list && list[0];
  if (!siswa) return { status: 404, error: 'NISN tidak ditemukan di data siswa' };
  if (K_PIN) {
    const nn = (v) => String(v == null ? '' : v).trim().toLowerCase();
    if (!nn(pin) || nn(pin) !== nn(siswa[K_PIN])) return { status: 401, error: 'PIN salah. Tanyakan ke guru.' };
  }
  return { siswa, nama: siswa[K_NAMA] };
}

// ---------------------------------------------------------------------------
// IKUTI UTS / IKUTI UAS (jendela siswa)
// Siswa memasukkan NISN (+PIN) lalu melihat paket UTS atau UAS yang SUDAH DIBUKA dan sesuai dengan
// kelas + program (Paket B / Paket C) + jurusan (IPA / IPS bila paketnya khusus jurusan) miliknya,
// satu baris per mata pelajaran. Kode akses hanya dikirim untuk paket yang masih boleh dikerjakan siswa itu,
// sehingga siswa tidak perlu mengetik kode: cukup memilih mata pelajaran, lalu langsung masuk ke paketnya.
// ---------------------------------------------------------------------------
const KELAS_ANGKA_KE_ROMAWI = { '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X', '11': 'XI', '12': 'XII' };
const JENIS_IKUTI = { UTS: 'UTS', UAS: 'UAS' };
function profilKelasSiswa(siswa) {
  const kelasAsli = String((siswa && siswa.kelas) || '').trim();
  const m = kelasAsli.match(/^(\d+)/);
  const j = kelasAsli.match(/\b(IPA|IPS)\b/i);
  return {
    kelasAsli,
    kelas: m ? (KELAS_ANGKA_KE_ROMAWI[m[1]] || null) : null,
    program: siswa && siswa.program === 'PAKET_B' ? 'Paket B' : siswa && siswa.program === 'PAKET_C' ? 'Paket C' : null,
    jurusan: j ? j[1].toUpperCase() : null,
  };
}
async function daftarUjianSiswa(nisn, siswa, jenis) {
  const jns = JENIS_IKUTI[String(jenis || '').toUpperCase()];
  if (!jns) throw new Error('Jenis ujian tidak dikenali.');
  const prof = profilKelasSiswa(siswa);
  if (!prof.kelas || !prof.program) {
    return { profil: prof, ujian: [], pesan: 'Kelas atau program kamu belum terdata untuk ujian online. Hubungi guru, atau gunakan tab Ujian dengan kode akses dari guru.' };
  }
  const n = encodeURIComponent(String(nisn).trim());
  const paketRows = await sb(`paket_ujian?jenis_ujian=eq.${jns}&status=eq.siap&diarsipkan=eq.false&kelas=eq.${encodeURIComponent(prof.kelas)}&program=eq.${encodeURIComponent(prof.program)}&select=id,judul,kode_akses,durasi_menit,semester,tahun_ajaran,created_at,mata_pelajaran(nama)&order=created_at.asc`);
  const paket = paketRows || [];
  if (!paket.length) return { profil: prof, ujian: [] };
  const ids = paket.map((p) => p.id).join(',');
  // Tabel jurusan & pengecualian bersifat opsional (migrasi v10); bila belum ada, abaikan.
  const [jurRows, pengRows, sesiRows] = await Promise.all([
    sb(`paket_jurusan?paket_ujian_id=in.(${ids})&select=paket_ujian_id,jurusan`).catch(() => []),
    sb(`ujian_pengecualian?siswa_nisn=eq.${n}&paket_ujian_id=in.(${ids})&select=paket_ujian_id,status`).catch(() => []),
    sb(`sesi_ujian?siswa_nisn=eq.${n}&paket_ujian_id=in.(${ids})&select=paket_ujian_id,status,total_skor`),
  ]);
  const jurPaket = new Map((jurRows || []).map((x) => [x.paket_ujian_id, x.jurusan]));
  const tidakWajib = new Set((pengRows || []).filter((x) => x.status === 'tidak_wajib').map((x) => x.paket_ujian_id));
  const sesiPaket = new Map((sesiRows || []).map((x) => [x.paket_ujian_id, x]));

  const hasil = [];
  for (const p of paket) {
    const jur = jurPaket.get(p.id);
    if (jur && prof.jurusan && jur !== prof.jurusan) continue;   // paket khusus jurusan lain
    if (tidakWajib.has(p.id)) continue;                          // guru menandai siswa ini tidak wajib
    const sesi = sesiPaket.get(p.id);
    const nt = pisahSmtTa(p.semester, p.tahun_ajaran);
    const item = {
      paket_id: p.id, judul: p.judul, mapel: (p.mata_pelajaran && p.mata_pelajaran.nama) || p.judul,
      jenis: jns, durasi_menit: p.durasi_menit || 90, semester: nt.smt, tahun_ajaran: nt.ta,
      status: 'tersedia', nilai: null, kode_akses: null,
    };
    if (!sesi) { item.status = 'tersedia'; item.kode_akses = p.kode_akses; }
    else if (sesi.status === 'berlangsung') { item.status = 'berlangsung'; item.kode_akses = p.kode_akses; }
    else if (sesi.status === 'selesai') item.status = 'menunggu_nilai';
    else { item.status = 'selesai'; item.nilai = sesi.total_skor != null ? Number(sesi.total_skor) : null; }
    hasil.push(item);
  }
  const urutan = { berlangsung: 0, tersedia: 1, menunggu_nilai: 2, selesai: 3 };
  hasil.sort((a, b) => (urutan[a.status] - urutan[b.status]) || a.mapel.localeCompare(b.mapel, 'id'));
  return { profil: prof, ujian: hasil };
}

module.exports = {
  daftarUjianSiswa,daftarRemedialSiswa, cekPesertaRemedial, verifikasiSiswa,
  UUID, BATAS_PELANGGARAN, adaKonfigurasi, sb, pastikanLogin, hitungNilai, nilaiDanSimpanSesi,
  authAdmin, tentukanPeran, wajibLogin, wajibAdmin, wajibSuperAdmin, peranDari, adminLangsung, superLangsung, ipDari, hitungGagal, catatGagal,
};
