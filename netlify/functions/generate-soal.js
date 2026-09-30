// Netlify Function: generate-soal
// Menerima { mapel, program, topik, tingkat_kesulitan, komposisi, hindari?, bagian? }
// komposisi = [{ jenis: 'pilihan_ganda', jumlah: 15 }, { jenis:'isian_singkat', jumlah:5 }, { jenis:'essay', jumlah:5 }]
// Mengembalikan array soal draft (belum masuk bank soal, guru harus review dulu).
//
// MULTI-PROVIDER DENGAN CADANGAN OTOMATIS
// Urutan default: Gemini (beberapa model) -> Groq -> Cerebras -> Mistral -> OpenRouter.
// Provider yang API key-nya tidak diisi otomatis dilewati, jadi cukup isi key yang kamu punya
// (minimal GEMINI_API_KEY ATAU salah satu key lain). Kalau satu provider/model gagal
// (overload 503, limit 429, model tidak ada, dsb), function langsung pindah ke berikutnya.
//
// Environment variables (Netlify -> Site configuration -> Environment variables):
//   GEMINI_API_KEY       Google AI Studio  (https://aistudio.google.com/apikey)
//   GROQ_API_KEY         Groq              (https://console.groq.com/keys)        - gratis, sangat cepat
//   CEREBRAS_API_KEY     Cerebras          (https://cloud.cerebras.ai)            - gratis, sangat cepat
//   MISTRAL_API_KEY      Mistral           (https://console.mistral.ai)            - tier gratis "Experiment"
//   OPENROUTER_API_KEY   OpenRouter        (https://openrouter.ai/keys)            - model ":free"
// Opsional:
//   AI_PROVIDER_ORDER    mis. "groq,gemini,openrouter" (ubah urutan / matikan provider tertentu)
//   GEMINI_MODEL         model utama Gemini (default gemini-3.6-flash)
//   GEMINI_FALLBACK_MODELS  model Gemini cadangan, dipisah koma (default gemini-3.5-flash-lite,gemini-2.5-flash)
//   GROQ_MODEL / CEREBRAS_MODEL / MISTRAL_MODEL / OPENROUTER_MODEL   override nama model
//   AI_BUDGET_MS         batas total waktu satu request (default 24000 ms)
// Nama model provider gratis sering berganti — kalau ada yang 404, cukup ganti lewat env var di atas.

const JENIS_VALID = ['pilihan_ganda', 'essay', 'isian_singkat'];
const URUT_JENIS = { pilihan_ganda: 0, isian_singkat: 1, essay: 2 };

const BUDGET_MS = parseInt(process.env.AI_BUDGET_MS, 10) || 24000;
const daftarKoma = (v, def) => String(v || def || '').split(',').map((x) => x.trim()).filter(Boolean);

// ---------- Definisi provider ----------
// Tiap kandidat = { provider, model, jenis: 'gemini' | 'openai', ... }
function bangunKandidat() {
  const env = process.env;
  const peta = {
    gemini: () => {
      if (!env.GEMINI_API_KEY) return [];
      const models = [env.GEMINI_MODEL || 'gemini-3.6-flash', ...daftarKoma(env.GEMINI_FALLBACK_MODELS, 'gemini-3.5-flash-lite,gemini-2.5-flash')];
      return [...new Set(models)].map((m) => ({ provider: 'gemini', model: m, jenis: 'gemini', apiKey: env.GEMINI_API_KEY }));
    },
    groq: () => (env.GROQ_API_KEY || env.GROOQ_API_KEY)
      ? [{ provider: 'groq', model: env.GROQ_MODEL || 'openai/gpt-oss-120b', jenis: 'openai', url: 'https://api.groq.com/openai/v1/chat/completions', apiKey: env.GROQ_API_KEY || env.GROOQ_API_KEY }]
      : [],
    cerebras: () => env.CEREBRAS_API_KEY
      ? [{ provider: 'cerebras', model: env.CEREBRAS_MODEL || 'gpt-oss-120b', jenis: 'openai', url: 'https://api.cerebras.ai/v1/chat/completions', apiKey: env.CEREBRAS_API_KEY, konteksKecil: true }]
      : [],
    mistral: () => env.MISTRAL_API_KEY
      ? [{ provider: 'mistral', model: env.MISTRAL_MODEL || 'mistral-small-latest', jenis: 'openai', url: 'https://api.mistral.ai/v1/chat/completions', apiKey: env.MISTRAL_API_KEY }]
      : [],
    openrouter: () => env.OPENROUTER_API_KEY
      ? [{ provider: 'openrouter', model: env.OPENROUTER_MODEL || 'openrouter/free', jenis: 'openai', url: 'https://openrouter.ai/api/v1/chat/completions', apiKey: env.OPENROUTER_API_KEY, headerTambahan: { 'X-Title': 'Aplikasi Ujian PKBM' } }]
      : [],
  };
  const urutan = daftarKoma(env.AI_PROVIDER_ORDER, 'gemini,groq,cerebras,mistral,openrouter');
  return urutan.flatMap((p) => (peta[p] ? peta[p]() : []));
}

// ---------- Kategori error ----------
// 'sementara' = server sibuk (503/5xx/timeout) -> boleh coba ulang 1x pada kandidat yang sama.
// 'limit'     = kuota/rate limit (429)         -> jangan diulang, langsung pindah.
// 'lainnya'   = key salah, model tidak ada, format ditolak, dsb -> langsung pindah.
const PESAN_SIBUK = /overloaded|high demand|unavailable|try again later|temporarily/i;
const PESAN_LIMIT = /quota|rate.?limit|resource_exhausted|too many requests/i;
function kategoriError(status, message) {
  if (status === 429 || PESAN_LIMIT.test(message || '')) return 'limit';
  if (status === 503 || status === 502 || status === 504 || status === 500 || status === 408 || status === 0 || PESAN_SIBUK.test(message || '')) return 'sementara';
  return 'lainnya';
}

class ErrorAI extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function fetchDenganTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new ErrorAI(408, 'Waktu tunggu habis');
    throw new ErrorAI(0, e.message || 'Gagal terhubung');
  } finally {
    clearTimeout(t);
  }
}

// ---------- Panggilan per jenis provider ----------
async function panggilGemini(k, promptText, totalSoal, ms) {
  const generationConfig = {
    temperature: 0.7,
    maxOutputTokens: Math.min(32768, Math.max(2048, totalSoal * 380 + 1000)),
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          pertanyaan: { type: 'STRING' },
          jenis: { type: 'STRING', enum: JENIS_VALID },
          tingkat_kesulitan: { type: 'STRING' },
          opsi_a: { type: 'STRING' }, opsi_b: { type: 'STRING' }, opsi_c: { type: 'STRING' },
          opsi_d: { type: 'STRING' }, opsi_e: { type: 'STRING' },
          kunci_jawaban: { type: 'STRING' },
        },
        required: ['pertanyaan', 'jenis', 'kunci_jawaban'],
      },
    },
  };
  // Pengaturan "thinking" berbeda antar generasi model Gemini
  if (/gemini-3/i.test(k.model)) generationConfig.thinkingConfig = { thinkingLevel: 'low' };
  else if (/gemini-2\.5-flash/i.test(k.model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const res = await fetchDenganTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${k.model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k.apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: promptText }] }], generationConfig }),
    },
    ms
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErrorAI(res.status, data?.error?.message || `Gemini error (${res.status})`);
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
}

async function panggilOpenAICompat(k, promptText, totalSoal, ms) {
  const body = {
    model: k.model,
    messages: [
      { role: 'system', content: 'Kamu asisten pembuat soal ujian. Balas HANYA dengan JSON valid, tanpa teks lain.' },
      { role: 'user', content: promptText },
    ],
    temperature: 0.7,
    max_tokens: Math.min(k.konteksKecil ? 6000 : 8000, Math.max(1500, totalSoal * 380 + 800)),
    response_format: { type: 'json_object' },
  };
  if (/gpt-oss/i.test(k.model)) body.reasoning_effort = 'low';

  const res = await fetchDenganTimeout(
    k.url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k.apiKey}`, ...(k.headerTambahan || {}) },
      body: JSON.stringify(body),
    },
    ms
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErrorAI(res.status, data?.error?.message || data?.message || `${k.provider} error (${res.status})`);
  return data?.choices?.[0]?.message?.content || '';
}

// ---------- Parsing & pembersihan hasil ----------
function ekstrakArray(raw) {
  let t = String(raw || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(t);
  } catch (e) {
    const a = t.indexOf('['), b = t.lastIndexOf(']');
    const c = t.indexOf('{'), d = t.lastIndexOf('}');
    if (a !== -1 && b > a && (c === -1 || a < c)) parsed = JSON.parse(t.slice(a, b + 1));
    else if (c !== -1 && d > c) parsed = JSON.parse(t.slice(c, d + 1));
    else throw new Error('Bukan JSON');
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.soal)) return parsed.soal;
    const arr = Object.values(parsed).find((v) => Array.isArray(v));
    if (arr) return arr;
  }
  throw new Error('Struktur JSON tidak dikenali');
}

function bersihkanSoal(arr, tingkatDefault) {
  return (arr || [])
    .filter((s) => s && s.pertanyaan && JENIS_VALID.includes(s.jenis))
    .map((s) => {
      const pg = s.jenis === 'pilihan_ganda';
      let kunci = String(s.kunci_jawaban == null ? '' : s.kunci_jawaban).trim();
      if (pg) { const m = kunci.match(/^[A-Ea-e]/); kunci = m ? m[0].toUpperCase() : kunci; }
      return {
        pertanyaan: String(s.pertanyaan).trim(),
        jenis: s.jenis,
        tingkat_kesulitan: s.tingkat_kesulitan || tingkatDefault,
        opsi_a: pg ? s.opsi_a || null : null,
        opsi_b: pg ? s.opsi_b || null : null,
        opsi_c: pg ? s.opsi_c || null : null,
        opsi_d: pg ? s.opsi_d || null : null,
        opsi_e: pg ? s.opsi_e || null : null,
        kunci_jawaban: kunci,
      };
    })
    // Pilihan ganda tanpa minimal 2 opsi tidak berguna
    .filter((s) => s.jenis !== 'pilihan_ganda' || (s.opsi_a && s.opsi_b));
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const kandidat = bangunKandidat();
  if (!kandidat.length) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Belum ada API key AI yang diset di Vercel Environment Variables. Isi minimal salah satu: GEMINI_API_KEY, GROQ_API_KEY, CEREBRAS_API_KEY, MISTRAL_API_KEY, atau OPENROUTER_API_KEY.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body tidak valid' }) };
  }

  const {
    mapel = '',
    program = '',
    topik = '',
    tingkat_kesulitan = 'sedang',
  } = body;

  if (!mapel || !topik) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Mapel dan topik wajib diisi' }) };
  }

  // Terima format baru (komposisi: [{jenis, jumlah}]) maupun format lama
  // (jenis tunggal + jumlah) supaya tetap kompatibel.
  let komposisi = Array.isArray(body.komposisi) ? body.komposisi : null;
  if (!komposisi) {
    komposisi = [{ jenis: body.jenis || 'pilihan_ganda', jumlah: body.jumlah || 5 }];
  }

  komposisi = komposisi
    .filter((k) => k && JENIS_VALID.includes(k.jenis) && parseInt(k.jumlah, 10) > 0)
    .map((k) => ({ jenis: k.jenis, jumlah: Math.min(Math.max(parseInt(k.jumlah, 10) || 0, 1), 100) }));

  if (!komposisi.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Pilih minimal satu jenis soal dengan jumlah > 0' }) };
  }

  const totalSoal = komposisi.reduce((a, k) => a + k.jumlah, 0);
  if (totalSoal > 100) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Total soal maksimal 100 per generate' }) };
  }

  const instruksiJenis = {
    pilihan_ganda:
      'pilihan ganda dengan 5 opsi (A-E). Isi field "opsi_a".."opsi_e" dengan teks opsi, dan "kunci_jawaban" dengan salah satu huruf A/B/C/D/E',
    essay:
      'essay (uraian panjang). Field "opsi_a" s/d "opsi_e" diisi string kosong "". Field "kunci_jawaban" diisi kunci/pedoman jawaban singkat untuk membantu guru menilai',
    isian_singkat:
      'isian singkat (jawaban satu kata/frasa pendek/angka). Field "opsi_a" s/d "opsi_e" diisi string kosong "". Field "kunci_jawaban" diisi jawaban yang benar',
  };
  const labelJenis = { pilihan_ganda: 'Pilihan Ganda', essay: 'Essay', isian_singkat: 'Isian Singkat' };

  const rincianKomposisi = komposisi
    .map((k) => `- ${k.jumlah} soal ${labelJenis[k.jenis]}: buat soal berjenis ${instruksiJenis[k.jenis]}. Field "jenis" untuk soal jenis ini HARUS diisi persis "${k.jenis}".`)
    .join('\n');

  // Untuk generate bertahap (batch): daftar soal yang sudah ada supaya tidak dobel + info bagian ke-berapa.
  const hindari = (Array.isArray(body.hindari) ? body.hindari : [])
    .map((x) => String(x || '').slice(0, 110)).filter(Boolean).slice(0, 40);
  const bagian = body.bagian && body.bagian.ke && body.bagian.dari ? body.bagian : null;
  const catatanBatch =
    (bagian && bagian.dari > 1
      ? `\nIni adalah bagian ke-${bagian.ke} dari ${bagian.dari} bagian pembuatan soal untuk topik yang sama. Variasikan sub-topik/sudut pandang soal.`
      : '') +
    (hindari.length
      ? `\nJANGAN membuat soal yang sama atau mirip dengan soal-soal yang sudah ada berikut:\n${hindari.map((h) => `- ${h}`).join('\n')}`
      : '');

  const promptDasar = `Kamu adalah asisten pembuat soal ujian untuk sekolah kesetaraan (PKBM) di Indonesia, jenjang ${program || 'Paket B/C'}.
Buat soal ujian berkualitas, sesuai kurikulum, dalam bahasa Indonesia yang baik dan jelas, dengan tingkat kesulitan "${tingkat_kesulitan}".

Mata pelajaran: ${mapel}
Topik/materi: ${topik}
Total soal yang harus dibuat: ${totalSoal}, dengan rincian jenis sebagai berikut:
${rincianKomposisi}
${catatanBatch}

Susun urutan soal dalam satu lembar: kelompokkan per jenis (semua pilihan ganda dulu, lalu isian singkat, lalu essay), agar rapi seperti lembar soal ujian sungguhan.`;

  const promptGemini = `${promptDasar}\nBalas HANYA dengan JSON array sesuai skema yang diberikan, tanpa teks tambahan apa pun.`;
  const promptOpenAI = `${promptDasar}
Balas HANYA dengan satu JSON object berbentuk:
{"soal":[{"pertanyaan":"...","jenis":"pilihan_ganda|isian_singkat|essay","tingkat_kesulitan":"${tingkat_kesulitan}","opsi_a":"","opsi_b":"","opsi_c":"","opsi_d":"","opsi_e":"","kunci_jawaban":""}]}
Tanpa teks tambahan, tanpa markdown/code fence.`;

  // ---------- Jalankan rantai cadangan ----------
  const mulai = Date.now();
  const sisaWaktu = () => BUDGET_MS - (Date.now() - mulai);
  const log = []; // ringkasan percobaan (untuk info di layar guru)
  let terbaik = null; // hasil parsial terbaik kalau tidak ada yang penuh

  const providerKeyBermasalah = new Set();
  for (const k of kandidat) {
    if (providerKeyBermasalah.has(k.provider)) { log.push({ provider: k.provider, model: k.model, hasil: 'dilewati (API key ditolak)' }); continue; }
    let percobaan = 0;
    while (percobaan < 2) {
      percobaan++;
      const sisa = sisaWaktu();
      if (sisa < 3000) { log.push({ provider: k.provider, model: k.model, hasil: 'dilewati (waktu habis)' }); break; }
      try {
        const raw = k.jenis === 'gemini'
          ? await panggilGemini(k, promptGemini, totalSoal, Math.min(sisa - 500, 22000))
          : await panggilOpenAICompat(k, promptOpenAI, totalSoal, Math.min(sisa - 500, 22000));

        const soal = bersihkanSoal(ekstrakArray(raw), tingkat_kesulitan)
          .sort((a, b) => URUT_JENIS[a.jenis] - URUT_JENIS[b.jenis]);

        if (!soal.length) throw new ErrorAI(422, 'AI tidak menghasilkan soal yang valid');

        // Kalau jumlahnya jauh kurang dari yang diminta, simpan sebagai cadangan lalu coba provider lain.
        if (soal.length < Math.ceil(totalSoal * 0.7)) {
          if (!terbaik || soal.length > terbaik.soal.length) terbaik = { soal, provider: k.provider, model: k.model };
          log.push({ provider: k.provider, model: k.model, hasil: `hanya ${soal.length}/${totalSoal} soal` });
          break;
        }

        log.push({ provider: k.provider, model: k.model, hasil: 'berhasil' });
        return {
          statusCode: 200,
          body: JSON.stringify({ soal, provider: k.provider, model: k.model, percobaan: log }),
        };
      } catch (err) {
        const status = err.status || 0;
        const kat = err instanceof SyntaxError || /JSON|Struktur/.test(err.message) ? 'lainnya' : kategoriError(status, err.message);
        log.push({ provider: k.provider, model: k.model, hasil: `gagal (${status || 'error'}): ${String(err.message).slice(0, 120)}` });
        if (status === 401 || status === 403 || /api.?key|unauthori[sz]ed|permission.?denied|invalid.?key|authentication/i.test(err.message || '')) providerKeyBermasalah.add(k.provider);
        if (kat === 'sementara' && percobaan < 2 && sisaWaktu() > 5000) {
          await new Promise((r) => setTimeout(r, 800)); // server sibuk: coba sekali lagi sebentar lagi
          continue;
        }
        break; // pindah ke kandidat berikutnya
      }
    }
  }

  // Tidak ada yang berhasil penuh, tapi ada hasil parsial -> kembalikan (guru tetap bisa pakai / generate sisanya)
  if (terbaik) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        soal: terbaik.soal, provider: terbaik.provider, model: terbaik.model, percobaan: log,
        peringatan: `AI hanya menghasilkan ${terbaik.soal.length} dari ${totalSoal} soal yang diminta.`,
      }),
    };
  }

  const semuaSementara = log.length && log.every((l) => /\((?:429|500|502|503|504|408|0)\)|waktu habis|overload|sibuk/i.test(l.hasil));
  const pesan = semuaSementara
    ? `Semua penyedia AI yang aktif (${[...new Set(kandidat.map((k) => k.provider))].join(', ')}) sedang sibuk atau kena limit. Tunggu 1-2 menit lalu coba lagi, atau tambahkan API key provider lain di Netlify (Groq/Cerebras/OpenRouter gratis).`
    : 'Semua penyedia AI gagal menghasilkan soal. Periksa API key & nama model di Vercel Environment Variables.';
  const detail = log.filter((l) => !/^dilewati/.test(l.hasil)).map((l) => `• ${l.provider}/${l.model}: ${l.hasil}`).join('\n');
  return { statusCode: 503, body: JSON.stringify({ error: detail ? `${pesan}\n\nDetail:\n${detail}` : pesan, percobaan: log }) };
};
