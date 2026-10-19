// Modul bersama untuk Netlify Functions ujian (submit-ujian, heartbeat, sudahi-ujian, mulai-ujian).
// Tidak memakai library npm apa pun (langsung fetch ke Supabase REST API).
// Di-bundle otomatis oleh esbuild (lihat netlify.toml), jadi cukup `require('../lib/ujian-core')`.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Anon key tidak rahasia (sudah ada di index.html); dipakai hanya untuk memvalidasi token login guru.
const ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ld2VpdmR2b3ZwY2dvbGF4enVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjY3MDgsImV4cCI6MjEwNTM0MjcwOH0.bJyrKD7pnCcVizWbsBD5e0LrFl_8LdwU_5JRmyqkfV0';

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

module.exports = { UUID, adaKonfigurasi, sb, pastikanLogin, hitungNilai, nilaiDanSimpanSesi };
