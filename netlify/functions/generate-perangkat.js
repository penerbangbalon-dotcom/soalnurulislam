// Netlify/Vercel Function: generate-perangkat
// Menyusun RPP & Modul Ajar secara BERTAHAP (satu tahap = satu panggilan AI singkat) supaya muat dalam batas waktu
// dan kalau satu tahap gagal, guru cukup mengulang tahap itu saja.
//
//   POST { aksi:'rencana', format, jenis, jumlah_pertemuan }
//        -> { tahapan:[{ id, label, grup, bagian:[judul...] }] }       (tanpa AI)
//   POST { aksi:'bagian', format, jenis, tahap, konteks:{...} }
//        -> { bagian:[{ kunci, judul, grup, tahap, teks }], provider, model }
//
// Memakai rantai provider AI yang sama dengan generate-soal (Gemini -> Groq -> Cerebras -> Mistral -> OpenRouter).
// Env opsional: PERANGKAT_BUDGET_MS (batas total waktu satu tahap, default 45000 ms; di Vercel maxDuration = 60 s).

const { adaKonfigurasi, wajibLogin } = require('../lib/ujian-core');
const { ai } = require('./generate-soal');
const FMT = require('../lib/perangkat-format');

const BUDGET_MS = parseInt(process.env.PERANGKAT_BUDGET_MS, 10) || 45000;
const SISTEM = 'Kamu pakar kurikulum dan perancang pembelajaran pendidikan kesetaraan di Indonesia. Balas HANYA dengan satu JSON object yang valid, tanpa teks lain.';
const FORMAT_VALID = ['pm', 'merdeka', 'satu_lembar'];

const res = (statusCode, obj) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

function ekstrakObjek(raw) {
  let t = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let p;
  try { p = JSON.parse(t); } catch (e) {
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a === -1 || b <= a) throw new Error('Bukan JSON');
    p = JSON.parse(t.slice(a, b + 1));
  }
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('Struktur JSON tidak dikenali');
  return p;
}

// Nilai dari AI bisa berupa string / array / objek -> jadikan teks markdown ringan yang rapi.
function jadikanTeks(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? `- ${x}` : `- ${jadikanTeks(x)}`)).join('\n');
  if (typeof v === 'object') return Object.entries(v).map(([k, x]) => `**${k}:** ${jadikanTeks(x)}`).join('\n');
  let s = String(v).replace(/\r/g, '');
  if (!s.includes('\n') && s.includes('\\n')) s = s.replace(/\\n/g, '\n');
  s = s.replace(/^```[a-z]*\s*$/gim, '');
  s = s.replace(/^#{1,2}\s+/gm, '### ').replace(/^#{4,6}\s+/gm, '### ');
  return s.trim();
}

function cariObjekBerisiKunci(obj, keys) {
  if (keys.some((k) => k in obj)) return obj;
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && keys.some((k) => k in v)) return v;
  }
  return obj;
}

async function jalankanAI(kandidat, p) {
  const { panggilGemini, panggilOpenAICompat, kategoriError } = ai;
  const mulai = Date.now();
  const sisaWaktu = () => BUDGET_MS - (Date.now() - mulai);
  const log = [];
  const keyBermasalah = new Set();
  for (const k of kandidat) {
    if (keyBermasalah.has(k.provider)) { log.push({ provider: k.provider, model: k.model, hasil: 'dilewati (API key ditolak)' }); continue; }
    let percobaan = 0;
    while (percobaan < 2) {
      percobaan++;
      const sisa = sisaWaktu();
      if (sisa < 4000) { log.push({ provider: k.provider, model: k.model, hasil: 'dilewati (waktu habis)' }); break; }
      try {
        const ekstra = { schema: p.skema, tokens: p.tokens, system: SISTEM };
        const batas = Math.min(sisa - 500, 40000);
        const raw = k.jenis === 'gemini'
          ? await panggilGemini(k, p.prompt, 0, batas, ekstra)
          : await panggilOpenAICompat(k, p.promptOpenAI, 0, batas, ekstra);
        const obj = cariObjekBerisiKunci(ekstrakObjek(raw), p.keys);
        const hasil = {};
        const kurang = [];
        for (const key of p.keys) {
          const teks = jadikanTeks(obj[key]);
          if (teks.length < 12) kurang.push(key); else hasil[key] = teks;
        }
        if (kurang.length) throw new ai.ErrorAI(422, `AI tidak melengkapi bagian: ${kurang.join(', ')}`);
        log.push({ provider: k.provider, model: k.model, hasil: 'berhasil' });
        return { ok: true, hasil, provider: k.provider, model: k.model, percobaan: log };
      } catch (err) {
        const status = err.status || 0;
        const kat = err instanceof SyntaxError || /JSON|Struktur|melengkapi/.test(err.message) ? 'lainnya' : kategoriError(status, err.message);
        log.push({ provider: k.provider, model: k.model, hasil: `gagal (${status || 'error'}): ${String(err.message).slice(0, 120)}` });
        if (status === 401 || status === 403 || /api.?key|unauthori[sz]ed|permission.?denied|invalid.?key|authentication/i.test(err.message || '')) keyBermasalah.add(k.provider);
        if (kat === 'sementara' && percobaan < 2 && sisaWaktu() > 6000) { await new Promise((r) => setTimeout(r, 800)); continue; }
        break;
      }
    }
  }
  return { ok: false, percobaan: log };
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!adaKonfigurasi()) return res(500, { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Environment Variables.' });
  const guard = await wajibLogin(event);
  if (guard.error) return guard.error;

  let body;
  try { body = JSON.parse(event.body); } catch (e) { return res(400, { error: 'Body tidak valid' }); }

  const format = FORMAT_VALID.includes(body.format) ? body.format : 'pm';
  const jenis = body.jenis === 'modul' ? 'modul' : 'rpp';

  if (body.aksi === 'rencana') {
    const tahapan = FMT.susunTahapan(format, jenis, body.jumlah_pertemuan);
    return res(200, { tahapan: tahapan.map((t) => ({ id: t.id, label: t.label, grup: t.grup, bagian: t.sections.map((s) => s.judul) })) });
  }

  if (body.aksi !== 'bagian') return res(400, { error: 'Aksi tidak dikenal.' });

  const kon = FMT.normalisasiKonteks(body.konteks || {});
  if (!kon.mapel || !kon.topik) return res(400, { error: 'Mata pelajaran dan topik wajib diisi.' });
  const tahapan = FMT.susunTahapan(format, jenis, kon.jumlah_pertemuan);
  const tahap = tahapan.find((t) => t.id === body.tahap);
  if (!tahap) return res(400, { error: 'Tahap tidak ditemukan untuk format ini.' });

  const rakit = (hasilAI) => tahap.sections.map((s) => ({
    kunci: s.kunci, judul: s.judul, grup: tahap.grup, tahap: tahap.id,
    teks: s.tetap ? FMT.teksTetap(s.tetap, kon) : hasilAI[s.kunci],
  }));

  const p = FMT.bangunPrompt(format, jenis, tahap, kon);
  if (!p) return res(200, { bagian: rakit({}), provider: null, model: null });

  const kandidat = ai.bangunKandidat();
  if (!kandidat.length) {
    return res(500, { error: 'Belum ada API key AI yang diset. Isi minimal salah satu: GEMINI_API_KEY, GROQ_API_KEY, CEREBRAS_API_KEY, MISTRAL_API_KEY, atau OPENROUTER_API_KEY.' });
  }

  const r = await jalankanAI(kandidat, p);
  if (!r.ok) {
    const detail = r.percobaan.filter((l) => !/^dilewati/.test(l.hasil)).map((l) => `- ${l.provider}/${l.model}: ${l.hasil}`).join('\n');
    return res(503, { error: `Semua penyedia AI gagal/sibuk. Tunggu sebentar lalu coba lagi.${detail ? `\n\nDetail:\n${detail}` : ''}`, percobaan: r.percobaan });
  }
  return res(200, { bagian: rakit(r.hasil), provider: r.provider, model: r.model, percobaan: r.percobaan });
};

exports._uji = { ekstrakObjek, jadikanTeks, cariObjekBerisiKunci };
