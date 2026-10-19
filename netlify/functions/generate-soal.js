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
async function panggilGemini(k, promptText, totalSoal, ms, ekstra) {
  const generationConfig = {
    temperature: 0.7,
    maxOutputTokens: (ekstra && ekstra.tokens) || Math.min(32768, Math.max(2048, totalSoal * 380 + 1000)),
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
          tp_kode: { type: 'STRING' },
        },
        required: ['pertanyaan', 'jenis', 'kunci_jawaban'],
      },
    },
  };
  if (ekstra && ekstra.schema) generationConfig.responseSchema = ekstra.schema;
  if (ekstra && ekstra.tanpaSkema) delete generationConfig.responseSchema;
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

async function panggilOpenAICompat(k, promptText, totalSoal, ms, ekstra) {
  const body = {
    model: k.model,
    messages: [
      { role: 'system', content: (ekstra && ekstra.sistem) || 'Kamu asisten pembuat soal ujian. Balas HANYA dengan JSON valid, tanpa teks lain.' },
      { role: 'user', content: promptText },
    ],
    temperature: 0.7,
    max_tokens: (ekstra && ekstra.tokens)
      ? Math.min(k.konteksKecil ? 6000 : 8000, ekstra.tokens)
      : Math.min(k.konteksKecil ? 6000 : 8000, Math.max(1500, totalSoal * 380 + 800)),
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
        tp_kode: s.tp_kode ? String(s.tp_kode).trim().slice(0, 40) : null,
      };
    })
    // Pilihan ganda tanpa minimal 2 opsi tidak berguna
    .filter((s) => s.jenis !== 'pilihan_ganda' || (s.opsi_a && s.opsi_b));
}

// =====================================================================
// MODE CP/TP: membuat Capaian Pembelajaran (CP) & Tujuan Pembelajaran (TP)
//   mode 'cp_tp' -> { mapel, program, kelas, fase, jumlah_cp, tp_per_cp, semester?, catatan? }  => { cp:[{kode,elemen,deskripsi,tp:[{kode,deskripsi,semester}]}] }
//   mode 'tp'    -> { mapel, program, kelas, fase, cp:{kode,elemen,deskripsi}, tp_per_cp, semester?, catatan?, hindari? } => { tp:[{kode,deskripsi,semester}] }
// =====================================================================
const SKEMA_TP = {
  type: 'OBJECT',
  properties: { kode: { type: 'STRING' }, deskripsi: { type: 'STRING' }, semester: { type: 'STRING' } },
  required: ['deskripsi'],
};
const SKEMA_CP_TP = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      kode: { type: 'STRING' }, elemen: { type: 'STRING' }, deskripsi: { type: 'STRING' },
      tp: { type: 'ARRAY', items: SKEMA_TP },
    },
    required: ['deskripsi', 'tp'],
  },
};
const SKEMA_TP_SAJA = { type: 'ARRAY', items: SKEMA_TP };

function bersihkanTp(arr) {
  return (arr || [])
    .filter((t) => t && String(t.deskripsi || '').trim())
    .map((t) => ({
      kode: String(t.kode || '').trim().slice(0, 30),
      deskripsi: String(t.deskripsi).trim(),
      semester: /genap/i.test(t.semester || '') ? 'Genap' : (/ganjil/i.test(t.semester || '') ? 'Ganjil' : null),
    }));
}
function bersihkanCp(arr) {
  return (arr || [])
    .filter((c) => c && String(c.deskripsi || '').trim())
    .map((c) => ({
      kode: String(c.kode || '').trim().slice(0, 30),
      elemen: String(c.elemen || '').trim().slice(0, 120),
      deskripsi: String(c.deskripsi).trim(),
      tp: bersihkanTp(c.tp),
    }))
    .filter((c) => c.tp.length);
}

async function handleCpTp(body, kandidat) {
  const mode = body.mode;
  const mapel = String(body.mapel || '').trim();
  if (!mapel) return { statusCode: 400, body: JSON.stringify({ error: 'Mapel wajib diisi' }) };
  const program = String(body.program || '').trim();
  const kelas = String(body.kelas || '').trim();
  const fase = String(body.fase || '').trim();
  const tpPerCp = Math.min(Math.max(parseInt(body.tp_per_cp, 10) || 4, 1), 8);
  const jumlahCp = Math.min(Math.max(parseInt(body.jumlah_cp, 10) || 3, 1), 6);
  const semester = /^(ganjil|genap)$/i.test(body.semester || '') ? (/genap/i.test(body.semester) ? 'Genap' : 'Ganjil') : '';
  const catatan = String(body.catatan || '').slice(0, 1500);

  const identitas = `Mata pelajaran: ${mapel}\nJenjang: ${program || 'Paket B/C'}${kelas ? `, Kelas ${kelas}` : ''}${fase ? `, Fase ${fase}` : ''} (pendidikan kesetaraan/PKBM, Kurikulum Merdeka)`;
  const aturanTp = `Aturan TP (Tujuan Pembelajaran):
- Satu kalimat operasional, diawali kata kerja ("Peserta didik dapat/mampu ..."), terukur, dan cukup spesifik sehingga bisa dibuatkan soal.
- Urutkan dari yang paling dasar ke yang lebih kompleks.
- ${semester ? `Isi field "semester" dengan "${semester}" untuk semua TP.` : 'Isi field "semester" dengan "Ganjil" untuk materi paruh awal dan "Genap" untuk materi paruh akhir.'}`;

  let teksTugas, skema, tokens, pembungkus;
  if (mode === 'cp_tp') {
    teksTugas = `Susun ${jumlahCp} Capaian Pembelajaran (CP), masing-masing mewakili satu elemen/ruang lingkup mata pelajaran, dan untuk tiap CP susun ${tpPerCp} Tujuan Pembelajaran (TP).
Aturan CP: rumuskan kompetensi akhir fase seperti yang tercantum pada Capaian Pembelajaran Kurikulum Merdeka untuk mata pelajaran dan fase ini sejauh yang kamu ketahui, dengan kata-katamu sendiri, 1-3 kalimat. Isi "elemen" dengan nama elemen/ruang lingkupnya. Jangan menyebut nomor dokumen/regulasi.
${aturanTp}
Beri "kode" CP berformat CP-1, CP-2, ... dan "kode" TP berformat 1.1, 1.2, 2.1, ... (nomor CP.nomor TP).${catatan ? `\nCakupan/materi yang harus diperhatikan:\n${catatan}` : ''}`;
    skema = SKEMA_CP_TP;
    tokens = Math.min(8000, Math.max(2048, 900 + jumlahCp * (tpPerCp * 120 + 160)));
    pembungkus = '{"cp":[{"kode":"CP-1","elemen":"","deskripsi":"","tp":[{"kode":"1.1","deskripsi":"","semester":"Ganjil"}]}]}';
  } else {
    const cp = body.cp && typeof body.cp === 'object' ? body.cp : null;
    if (!cp || !String(cp.deskripsi || '').trim()) return { statusCode: 400, body: JSON.stringify({ error: 'CP wajib diisi untuk membuat TP' }) };
    const hindari = (Array.isArray(body.hindari) ? body.hindari : []).map((x) => String(x || '').slice(0, 160)).filter(Boolean).slice(0, 30);
    teksTugas = `Susun ${tpPerCp} Tujuan Pembelajaran (TP) yang menjabarkan Capaian Pembelajaran (CP) berikut:
CP${cp.kode ? ` (${cp.kode})` : ''}${cp.elemen ? ` — elemen ${cp.elemen}` : ''}: ${String(cp.deskripsi).slice(0, 1500)}
${aturanTp}
Beri "kode" TP berformat nomor urut (mis. 1.1, 1.2).${catatan ? `\nCakupan/materi yang harus diperhatikan:\n${catatan}` : ''}${hindari.length ? `\nJANGAN mengulang TP yang sudah ada berikut:\n${hindari.map((h) => `- ${h}`).join('\n')}` : ''}`;
    skema = SKEMA_TP_SAJA;
    tokens = Math.min(6000, Math.max(1500, 700 + tpPerCp * 130));
    pembungkus = '{"tp":[{"kode":"1.1","deskripsi":"","semester":"Ganjil"}]}';
  }

  const dasar = `Kamu adalah pakar kurikulum pendidikan kesetaraan di Indonesia. Gunakan bahasa Indonesia baku.\n${identitas}\n\n${teksTugas}`;
  const promptGemini = `${dasar}\nBalas HANYA dengan JSON array sesuai skema yang diberikan, tanpa teks tambahan.`;
  const promptOpenAI = `${dasar}\nBalas HANYA dengan satu JSON object berbentuk:\n${pembungkus}\nTanpa teks tambahan, tanpa markdown/code fence.`;

  const mulai = Date.now();
  const sisaWaktu = () => BUDGET_MS - (Date.now() - mulai);
  const log = [];
  const providerKeyBermasalah = new Set();

  for (const k of kandidat) {
    if (providerKeyBermasalah.has(k.provider)) { log.push({ provider: k.provider, model: k.model, hasil: 'dilewati (API key ditolak)' }); continue; }
    let percobaan = 0;
    while (percobaan < 2) {
      percobaan++;
      const sisa = sisaWaktu();
      if (sisa < 3000) { log.push({ provider: k.provider, model: k.model, hasil: 'dilewati (waktu habis)' }); break; }
      try {
        const ekstra = { schema: skema, tokens };
        const raw = k.jenis === 'gemini'
          ? await panggilGemini(k, promptGemini, 0, Math.min(sisa - 500, 22000), ekstra)
          : await panggilOpenAICompat(k, promptOpenAI, 0, Math.min(sisa - 500, 22000), ekstra);
        const arr = ekstrakArray(raw);
        const hasil = mode === 'cp_tp' ? bersihkanCp(arr) : bersihkanTp(arr);
        if (!hasil.length) throw new ErrorAI(422, 'AI tidak menghasilkan CP/TP yang valid');
        log.push({ provider: k.provider, model: k.model, hasil: 'berhasil' });
        return {
          statusCode: 200,
          body: JSON.stringify({ [mode === 'cp_tp' ? 'cp' : 'tp']: hasil, provider: k.provider, model: k.model, percobaan: log }),
        };
      } catch (err) {
        const status = err.status || 0;
        const kat = err instanceof SyntaxError || /JSON|Struktur/.test(err.message) ? 'lainnya' : kategoriError(status, err.message);
        log.push({ provider: k.provider, model: k.model, hasil: `gagal (${status || 'error'}): ${String(err.message).slice(0, 120)}` });
        if (status === 401 || status === 403 || /api.?key|unauthori[sz]ed|permission.?denied|invalid.?key|authentication/i.test(err.message || '')) providerKeyBermasalah.add(k.provider);
        if (kat === 'sementara' && percobaan < 2 && sisaWaktu() > 5000) { await new Promise((r) => setTimeout(r, 800)); continue; }
        break;
      }
    }
  }
  const detail = log.filter((l) => !/^dilewati/.test(l.hasil)).map((l) => `• ${l.provider}/${l.model}: ${l.hasil}`).join('\n');
  return { statusCode: 503, body: JSON.stringify({ error: `Semua penyedia AI gagal/sibuk. Tunggu sebentar lalu coba lagi.${detail ? `\n\nDetail:\n${detail}` : ''}`, percobaan: log }) };
}

// =====================================================================
// MODE PERANGKAT AJAR: RPP dan Modul Ajar
//   mode 'rpp'   -> { format: 'merdeka'|'ringkas'|'mendalam', ...konteks }                => { konten }
//   mode 'modul' -> { bagian: 'a'|'b'|'c', ...konteks, ringkasan?:{tujuan,topik,...} }    => { konten }
// Konteks: mapel, program, kelas, fase, semester, tahun_ajaran, cp:{kode,elemen,deskripsi}, tp:[{kode,deskripsi}],
//          topik, jumlah_pertemuan, jp_per_pertemuan, menit_jp, model, catatan, pengaturan:{profil,detail,catatan_sekolah,...}
// Hasilnya berupa OBJEK JSON; bentuknya dipaksa (dinormalisasi) mengikuti contoh bentuk di bawah, jadi tampilan
// di index.html tidak pernah menerima tipe data yang salah.
// =====================================================================
const BUDGET_PERANGKAT_MS = parseInt(process.env.AI_BUDGET_PERANGKAT_MS, 10) || 50000;

const RUBRIK_CONTOH = [{ aspek: '', sangat_baik: '', baik: '', cukup: '', perlu_bimbingan: '' }];
const PERTEMUAN_CONTOH = [{ ke: 1, judul: '', jp: 2, pendahuluan: [''], inti: [''], penutup: [''] }];
const ASESMEN_CONTOH = { diagnostik: [''], formatif: [''], sumatif: [''] };

const BENTUK_RPP = {
  merdeka: {
    capaian: '', tujuan: [''], profil: [''], pemahaman_bermakna: [''], pertanyaan_pemantik: [''], sarana: [''], model: '',
    pertemuan: PERTEMUAN_CONTOH, asesmen: ASESMEN_CONTOH, rubrik: RUBRIK_CONTOH,
    pengayaan: [''], remedial: [''], refleksi_guru: [''], refleksi_peserta: [''],
  },
  ringkas: {
    capaian: '', tujuan: [''], sarana: [''], model: '',
    pertemuan: PERTEMUAN_CONTOH, asesmen: { diagnostik: [''], formatif: [''], sumatif: [''] }, rubrik: RUBRIK_CONTOH,
  },
  mendalam: {
    identifikasi: { peserta_didik: '', materi: '', dimensi_profil: [''] },
    desain: { capaian: '', lintas_disiplin: [''], tujuan: [''], topik: '', praktik_pedagogis: '', kemitraan: '', lingkungan: '', digital: '' },
    pertemuan: [{
      ke: 1, judul: '', jp: 2, awal: [''], memahami: [''], mengaplikasi: [''], merefleksi: [''], penutup: [''],
      prinsip: { berkesadaran: '', bermakna: '', menggembirakan: '' },
    }],
    asesmen: { awal: [''], proses: [''], akhir: [''] }, rubrik: RUBRIK_CONTOH,
  },
};
const BENTUK_MODUL = {
  a: {
    kompetensi_awal: '', capaian: '', profil: [''], sarana: [''], target_peserta: '', model: '',
    tujuan: [''], pemahaman_bermakna: [''], pertanyaan_pemantik: [''], persiapan: [''],
  },
  b: {
    pertemuan: PERTEMUAN_CONTOH, pengayaan: [''], remedial: [''], refleksi_guru: [''], refleksi_peserta: [''],
  },
  c: {
    asesmen: ASESMEN_CONTOH, rubrik: RUBRIK_CONTOH,
    lkpd: [{ judul: '', petunjuk: '', tugas: [''] }],
    bahan_bacaan: [{ judul: '', isi: '' }],
    soal: [{ soal: '', kunci: '' }],
    glosarium: [{ istilah: '', arti: '' }],
    pustaka: [''],
  },
};

// Paksa nilai mengikuti bentuk contoh (string / angka / daftar string / daftar objek / objek).
function paksaBentuk(val, contoh) {
  if (typeof contoh === 'number') { const n = parseInt(val, 10); return Number.isFinite(n) ? n : contoh; }
  if (typeof contoh === 'string') {
    if (Array.isArray(val)) val = val.join('; ');
    return val == null ? '' : String(val).trim();
  }
  if (Array.isArray(contoh)) {
    let arr = Array.isArray(val) ? val : (val == null || val === '' ? [] : [val]);
    if (typeof contoh[0] === 'string') {
      if (arr.length === 1 && typeof arr[0] === 'string' && /\n/.test(arr[0])) arr = arr[0].split(/\n+/);
      return arr.map((x) => (x && typeof x === 'object' ? Object.values(x).join(' ') : String(x == null ? '' : x))
        .replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').trim()).filter(Boolean);
    }
    return arr.filter((x) => x && typeof x === 'object').map((x) => paksaBentuk(x, contoh[0]));
  }
  if (contoh && typeof contoh === 'object') {
    const src = val && typeof val === 'object' && !Array.isArray(val) ? val : {};
    return Object.fromEntries(Object.keys(contoh).map((k) => [k, paksaBentuk(src[k], contoh[k])]));
  }
  return val;
}
function ekstrakObjek(raw) {
  let t = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let parsed;
  try { parsed = JSON.parse(t); } catch (e) {
    const c = t.indexOf('{'), d = t.lastIndexOf('}');
    if (c !== -1 && d > c) parsed = JSON.parse(t.slice(c, d + 1)); else throw new Error('Bukan JSON');
  }
  if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object') parsed = parsed[0];
  if (!parsed || typeof parsed !== 'object') throw new Error('Struktur JSON tidak dikenali');
  return parsed;
}
// Hitung isi bermakna (string tak kosong) supaya hasil kosong ditolak dan pindah ke AI cadangan.
function hitungIsi(v) {
  if (typeof v === 'string') return v.trim() ? 1 : 0;
  if (Array.isArray(v)) return v.reduce((a, x) => a + hitungIsi(x), 0);
  if (v && typeof v === 'object') return Object.values(v).reduce((a, x) => a + hitungIsi(x), 0);
  return 0;
}

const MODEL_DEFAULT = 'Discovery Learning';
const DIMENSI = {
  profil_lulusan: 'Delapan Dimensi Profil Lulusan: Keimanan dan Ketakwaan terhadap Tuhan YME; Kewargaan; Penalaran Kritis; Kreativitas; Kolaborasi; Kemandirian; Kesehatan; Komunikasi',
  pelajar_pancasila: 'Enam Dimensi Profil Pelajar Pancasila: Beriman, Bertakwa kepada Tuhan YME, dan Berakhlak Mulia; Berkebinekaan Global; Bergotong Royong; Mandiri; Bernalar Kritis; Kreatif',
};

async function handlePerangkat(body, kandidat) {
  const mode = body.mode;
  const err = (c, m) => ({ statusCode: c, body: JSON.stringify({ error: m }) });
  const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const mapel = str(body.mapel, 160);
  if (!mapel) return err(400, 'Mapel wajib diisi');
  const program = str(body.program, 20), kelas = str(body.kelas, 10), fase = str(body.fase, 4);
  const semester = /^genap$/i.test(body.semester || '') ? 'Genap' : (/^ganjil$/i.test(body.semester || '') ? 'Ganjil' : '');
  const tahun = str(body.tahun_ajaran, 12);
  const cp = body.cp && typeof body.cp === 'object' && str(body.cp.deskripsi, 3000)
    ? { kode: str(body.cp.kode, 30), elemen: str(body.cp.elemen, 120), deskripsi: str(body.cp.deskripsi, 1800) } : null;
  const tp = (Array.isArray(body.tp) ? body.tp : []).filter((t) => t && str(t.deskripsi, 600)).slice(0, 12)
    .map((t) => ({ kode: str(t.kode, 30), deskripsi: str(t.deskripsi, 500) }));
  const topik = str(body.topik, 300) || (tp.length ? '' : (cp ? (cp.elemen || cp.deskripsi.slice(0, 120)) : ''));
  if (!cp && !tp.length && !topik) return err(400, 'Isi minimal salah satu: CP, TP, atau topik/materi.');

  const jmlPertemuan = Math.min(Math.max(parseInt(body.jumlah_pertemuan, 10) || 1, 1), 4);
  const jp = Math.min(Math.max(parseInt(body.jp_per_pertemuan, 10) || 2, 1), 8);
  const menitJp = Math.min(Math.max(parseInt(body.menit_jp, 10) || 40, 20), 60);
  const model = str(body.model, 120) || MODEL_DEFAULT;
  const catatan = str(body.catatan, 1200);
  const pg = body.pengaturan && typeof body.pengaturan === 'object' ? body.pengaturan : {};
  const detail = ['ringkas', 'standar', 'lengkap'].includes(pg.detail) ? pg.detail : 'standar';
  const profil = ['profil_lulusan', 'pelajar_pancasila', 'tidak'].includes(pg.profil) ? pg.profil : 'profil_lulusan';
  const catatanSekolah = str(pg.catatan_sekolah, 900);
  const aktif = (k, def = true) => (pg[k] === undefined ? def : !!pg[k]);

  let bentuk, judulTugas, aturanKhusus, tokens;
  const format = ['merdeka', 'ringkas', 'mendalam'].includes(body.format) ? body.format : 'merdeka';
  const bagian = ['a', 'b', 'c'].includes(body.bagian) ? body.bagian : 'a';
  const butirDetail = { ringkas: '2-3', standar: '3-5', lengkap: '5-7' }[detail];
  const totalMenit = jp * menitJp;
  const sisihkan = (nama, hidup) => (hidup ? '' : `\n- Bagian "${nama}" TIDAK diperlukan: isi dengan array kosong [] atau string kosong "".`);
  const aturanKegiatan = `Aturan kegiatan pembelajaran:
- Tiap pertemuan = ${jp} JP x ${menitJp} menit = ${totalMenit} menit. Bagi waktunya ke tahap-tahap dan tulis alokasi menit di awal butir, mis. "(10 menit) Guru membuka ...". Jumlah menit semua tahap dalam satu pertemuan harus sama dengan ${totalMenit}.
- Setiap butir berupa kalimat kegiatan konkret (siapa melakukan apa), bukan sekadar judul. Tiap tahap berisi ${butirDetail} butir.
- Kegiatan harus realistis untuk kelas PKBM dengan sarana sederhana; bila peserta didik mandiri/bekerja, sertakan tugas yang dapat dikerjakan di rumah/tempat kerja.
- Sintaks model "${model}" harus tampak jelas pada kegiatan inti.`;

  if (mode === 'rpp') {
    bentuk = BENTUK_RPP[format];
    tokens = Math.min(8000, 1800 + jmlPertemuan * (detail === 'lengkap' ? 1500 : detail === 'ringkas' ? 700 : 1000));
    judulTugas = {
      merdeka: 'RPP (Rencana Pelaksanaan Pembelajaran) format Kurikulum Merdeka',
      ringkas: 'RPP RINGKAS satu halaman (komponen inti: tujuan pembelajaran, langkah-langkah kegiatan, dan penilaian)',
      mendalam: 'RPP berbasis PEMBELAJARAN MENDALAM (Deep Learning) sesuai panduan Kemendikdasmen: pengalaman belajar Memahami, Mengaplikasi, Merefleksi dengan prinsip berkesadaran (mindful), bermakna (meaningful), dan menggembirakan (joyful)',
    }[format];
    aturanKhusus = `Susun ${judulTugas} untuk ${jmlPertemuan} pertemuan.
Aturan umum:
- "pertemuan" berisi tepat ${jmlPertemuan} objek dengan "ke" berurutan dan "jp" = ${jp}.
- Tujuan pembelajaran: kalimat operasional diawali kata kerja terukur ("Peserta didik dapat/mampu ..."), selaras dengan TP yang diberikan (jika ada), diurutkan dari dasar ke kompleks.
- Penilaian harus selaras dengan tujuan: sebutkan teknik (tes tertulis/lisan, observasi, unjuk kerja, penugasan/portofolio) DAN contoh instrumennya (mis. contoh soal/pertanyaan atau daftar cek).${format === 'ringkas' ? '\n- Karena RPP ringkas, tulis padat dan hemat kata; tidak perlu bagian di luar skema.' : ''}
${aturanKegiatan}${format === 'mendalam' ? `
- Pada "pertemuan": "awal" = pembuka & apersepsi; "memahami" = kegiatan membangun pemahaman (eksplorasi konsep, pertanyaan pemantik); "mengaplikasi" = kegiatan menerapkan dalam masalah/proyek nyata (kolaboratif); "merefleksi" = kegiatan merefleksikan pembelajaran; "penutup" = kesimpulan, umpan balik, tindak lanjut. Isi "prinsip" dengan 1 kalimat tentang bagaimana prinsip berkesadaran, bermakna, dan menggembirakan diwujudkan.
- "identifikasi.dimensi_profil": pilih dimensi yang relevan dan jelaskan singkat pengembangannya. "desain.lintas_disiplin": kaitan dengan mapel lain. "desain.praktik_pedagogis": model/strategi (${model}). "desain.kemitraan" (mitra belajar: keluarga, tempat kerja, tokoh masyarakat), "desain.lingkungan" (ruang fisik/virtual/budaya belajar), "desain.digital" (pemanfaatan teknologi bila memungkinkan).
- "asesmen": awal (diagnostik), proses (formatif selama kegiatan), akhir (sumatif).` : `
- "profil": ${profil === 'tidak' ? 'kosongkan' : 'pilih dimensi yang relevan dan jelaskan singkat bagaimana dikembangkan'}.${format === 'merdeka' ? `
- "pemahaman_bermakna", "pertanyaan_pemantik", "sarana" (alat/bahan/media/sumber), "pengayaan", "remedial", "refleksi_guru", "refleksi_peserta" diisi singkat dan spesifik pada materi ini.${sisihkan('pertanyaan_pemantik', aktif('pertanyaan_pemantik'))}${sisihkan('pengayaan dan remedial', aktif('pengayaan_remedial'))}${sisihkan('refleksi_guru dan refleksi_peserta', aktif('refleksi'))}` : ''}`}
- "rubrik": ${aktif('rubrik') ? '3-4 aspek penilaian, masing-masing dengan deskripsi 4 level capaian yang jelas dan terukur.' : 'kosongkan (array kosong).'}`;
  } else {
    bentuk = BENTUK_MODUL[bagian];
    const rg = body.ringkasan && typeof body.ringkasan === 'object' ? body.ringkasan : {};
    const tujuanRg = (Array.isArray(rg.tujuan) ? rg.tujuan : []).map((x) => str(x, 300)).filter(Boolean).slice(0, 10);
    const modelRg = str(rg.model, 160) || model;
    const konteksLanjut = `${tujuanRg.length ? `\nTujuan pembelajaran modul (sudah ditetapkan, ikuti persis):\n${tujuanRg.map((t) => `- ${t}`).join('\n')}` : ''}\nModel pembelajaran: ${modelRg}`;
    if (bagian === 'a') {
      tokens = detail === 'lengkap' ? 4500 : 3200;
      judulTugas = 'MODUL AJAR Kurikulum Merdeka — BAGIAN 1: Informasi Umum dan Komponen Inti (bagian awal)';
      aturanKhusus = `Susun ${judulTugas}.
- "kompetensi_awal": kemampuan/pengetahuan prasyarat yang perlu dimiliki peserta didik (1-3 kalimat).
- "capaian": ringkasan CP yang dituju (1-3 kalimat, kata-katamu sendiri).
- "profil": ${profil === 'tidak' ? 'kosongkan' : 'dimensi yang relevan beserta penjelasan singkat pengembangannya'}.
- "sarana": sarana dan prasarana (alat, bahan, media, sumber belajar). "target_peserta": karakteristik peserta didik (reguler, kesulitan belajar, mandiri/bekerja) dan cara mengakomodasinya (differensiasi). "model": "${model}" beserta sintaks singkatnya.
- "tujuan": ${tp.length || cp ? 'jabarkan dari TP/CP yang diberikan' : 'rumuskan dari topik'}; kalimat operasional diawali kata kerja terukur.
- "pemahaman_bermakna": 2-4 butir manfaat/pemahaman yang akan diperoleh. "pertanyaan_pemantik": 3-5 pertanyaan. "persiapan": langkah persiapan guru sebelum mengajar.${sisihkan('pertanyaan_pemantik', aktif('pertanyaan_pemantik'))}`;
    } else if (bagian === 'b') {
      tokens = Math.min(8000, 1500 + jmlPertemuan * (detail === 'lengkap' ? 1500 : detail === 'ringkas' ? 700 : 1000));
      judulTugas = 'MODUL AJAR Kurikulum Merdeka — BAGIAN 2: Kegiatan Pembelajaran';
      aturanKhusus = `Susun ${judulTugas} untuk ${jmlPertemuan} pertemuan.${konteksLanjut}
- "pertemuan" berisi tepat ${jmlPertemuan} objek dengan "ke" berurutan dan "jp" = ${jp}; "judul" berupa sub-topik tiap pertemuan.
${aturanKegiatan}
- "pengayaan", "remedial", "refleksi_guru", "refleksi_peserta": butir singkat dan spesifik.${sisihkan('pengayaan dan remedial', aktif('pengayaan_remedial'))}${sisihkan('refleksi_guru dan refleksi_peserta', aktif('refleksi'))}`;
    } else {
      const nLkpd = aktif('lkpd') ? 1 : 0;
      tokens = Math.min(8000, 1800 + (aktif('lkpd') ? 900 : 0) + (aktif('bahan_bacaan') ? 1600 : 0) + (aktif('soal') ? 1400 : 0) + (aktif('glosarium') ? 300 : 0));
      judulTugas = 'MODUL AJAR Kurikulum Merdeka — BAGIAN 3: Asesmen dan Lampiran';
      aturanKhusus = `Susun ${judulTugas}.${konteksLanjut}
- "asesmen": diagnostik (awal), formatif (proses), sumatif (akhir); tiap butir menyebut teknik DAN instrumennya, selaras dengan tujuan pembelajaran.
- "rubrik": ${aktif('rubrik') ? '3-4 aspek, masing-masing 4 level capaian yang terukur.' : 'kosongkan.'}
- "lkpd": ${nLkpd ? 'satu LKPD (Lembar Kerja Peserta Didik) siap pakai: judul, petunjuk, dan 4-6 tugas/pertanyaan/aktivitas konkret yang sesuai materi.' : 'kosongkan.'}
- "bahan_bacaan": ${aktif('bahan_bacaan') ? 'ringkasan materi untuk peserta didik, 2-4 bagian (judul + isi 1-2 paragraf, bahasa mudah dipahami, akurat secara keilmuan).' : 'kosongkan.'}
- "soal": ${aktif('soal') ? '5 soal latihan/asesmen (campuran pilihan ganda dan uraian). Untuk pilihan ganda tulis opsi A-D di dalam teks soal; "kunci" berisi jawaban/pedoman penskoran.' : 'kosongkan.'}
- "glosarium": ${aktif('glosarium') ? '5-8 istilah penting dan artinya.' : 'kosongkan.'}
- "pustaka": ${aktif('pustaka') ? '2-4 sumber belajar umum (buku teks Kemendikdasmen/Kemendikbudristek untuk mapel ini, sumber daring resmi). Jangan mengarang judul, penulis, atau tautan yang tidak kamu yakini ada; tulis sumber generik bila ragu.' : 'kosongkan.'}`;
    }
  }

  const identitas = `Mata pelajaran: ${mapel}
Jenjang: ${program || 'Paket B/C'}${kelas ? `, Kelas ${kelas}` : ''}${fase ? `, Fase ${fase}` : ''} (pendidikan kesetaraan / PKBM, Kurikulum Merdeka)${semester ? `\nSemester: ${semester}${tahun ? ` Tahun Ajaran ${tahun}` : ''}` : ''}
Jumlah pertemuan: ${jmlPertemuan} x ${jp} JP (1 JP = ${menitJp} menit)
Model pembelajaran: ${model}`;
  const blokCp = cp ? `\nCapaian Pembelajaran (CP)${cp.kode ? ` [${cp.kode}]` : ''}${cp.elemen ? ` — elemen ${cp.elemen}` : ''}: ${cp.deskripsi}` : '';
  const blokTp = tp.length ? `\nTujuan Pembelajaran (TP) yang harus dicapai:\n${tp.map((t) => `- ${t.kode ? `[${t.kode}] ` : ''}${t.deskripsi}`).join('\n')}` : '';
  const blokTopik = topik ? `\nTopik/materi: ${topik}` : '';
  const blokProfil = profil !== 'tidak' ? `\nProfil yang dikembangkan: ${DIMENSI[profil]}.` : '';
  const blokKonteks = (catatanSekolah ? `\nKonteks khusus satuan pendidikan (wajib diperhatikan): ${catatanSekolah}` : '') + (catatan ? `\nCatatan guru untuk dokumen ini: ${catatan}` : '');
  const tingkat = { ringkas: 'ringkas dan padat', standar: 'standar (cukup rinci)', lengkap: 'lengkap dan rinci' }[detail];

  const dasar = `Kamu adalah guru profesional sekaligus pakar kurikulum pendidikan kesetaraan di Indonesia. Gunakan bahasa Indonesia baku. Tingkat kerincian dokumen: ${tingkat}.
${identitas}${blokCp}${blokTp}${blokTopik}${blokProfil}${blokKonteks}

${aturanKhusus}

Aturan format keluaran: balas HANYA dengan SATU objek JSON dengan kunci persis seperti contoh bentuk berikut. Nilai pada contoh hanya penanda tipe: "" = teks, [""] = daftar teks, [{...}] = daftar objek, angka = bilangan. Ganti dengan isi nyata; jangan menambah atau mengubah nama kunci; tanpa teks lain, tanpa markdown/code fence.
${JSON.stringify(bentuk)}`;

  const mulai = Date.now();
  const sisaWaktu = () => BUDGET_PERANGKAT_MS - (Date.now() - mulai);
  const log = [];
  const providerKeyBermasalah = new Set();
  const sistem = 'Kamu asisten penyusun perangkat ajar guru Indonesia. Balas HANYA dengan JSON object valid sesuai bentuk yang diminta, tanpa teks lain.';

  for (const k of kandidat) {
    if (providerKeyBermasalah.has(k.provider)) { log.push({ provider: k.provider, model: k.model, hasil: 'dilewati (API key ditolak)' }); continue; }
    let percobaan = 0;
    while (percobaan < 2) {
      percobaan++;
      const sisa = sisaWaktu();
      if (sisa < 4000) { log.push({ provider: k.provider, model: k.model, hasil: 'dilewati (waktu habis)' }); break; }
      try {
        const ekstra = { tanpaSkema: true, tokens, sistem };
        const batasPanggil = Math.min(sisa - 500, 48000);
        const raw = k.jenis === 'gemini'
          ? await panggilGemini(k, dasar, 0, batasPanggil, ekstra)
          : await panggilOpenAICompat(k, dasar, 0, batasPanggil, ekstra);
        const konten = paksaBentuk(ekstrakObjek(raw), bentuk);
        if (hitungIsi(konten) < 8) throw new ErrorAI(422, 'AI tidak menghasilkan isi yang cukup');
        log.push({ provider: k.provider, model: k.model, hasil: 'berhasil' });
        return { statusCode: 200, body: JSON.stringify({ konten, format, bagian: mode === 'modul' ? bagian : undefined, provider: k.provider, model: k.model, percobaan: log }) };
      } catch (e) {
        const status = e.status || 0;
        const kat = e instanceof SyntaxError || /JSON|Struktur|isi yang cukup/.test(e.message) ? 'lainnya' : kategoriError(status, e.message);
        log.push({ provider: k.provider, model: k.model, hasil: `gagal (${status || 'error'}): ${String(e.message).slice(0, 120)}` });
        if (status === 401 || status === 403 || /api.?key|unauthori[sz]ed|permission.?denied|invalid.?key|authentication/i.test(e.message || '')) providerKeyBermasalah.add(k.provider);
        if (kat === 'sementara' && percobaan < 2 && sisaWaktu() > 8000) { await new Promise((r) => setTimeout(r, 800)); continue; }
        break;
      }
    }
  }
  const detailLog = log.filter((l) => !/^dilewati/.test(l.hasil)).map((l) => `• ${l.provider}/${l.model}: ${l.hasil}`).join('\n');
  return { statusCode: 503, body: JSON.stringify({ error: `Semua penyedia AI gagal/sibuk. Tunggu sebentar lalu coba lagi.${detailLog ? `\n\nDetail:\n${detailLog}` : ''}`, percobaan: log }) };
}

const { adaKonfigurasi, wajibLogin } = require('../lib/ujian-core');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  // Hanya guru/admin yang sudah login yang boleh memakai kuota AI.
  if (!adaKonfigurasi()) {
    return { statusCode: 500, body: JSON.stringify({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel Environment Variables.' }) };
  }
  const guard = await wajibLogin(event);
  if (guard.error) return guard.error;

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

  if (body.mode === 'cp_tp' || body.mode === 'tp') {
    return await handleCpTp(body, kandidat);
  }
  if (body.mode === 'rpp' || body.mode === 'modul') {
    return await handlePerangkat(body, kandidat);
  }

  const {
    mapel = '',
    program = '',
    topik: topikInput = '',
    tingkat_kesulitan = 'sedang',
  } = body;

  // Soal berbasis Capaian Pembelajaran: cp = {kode, elemen, deskripsi, fase}, tp = [{kode, deskripsi}]
  const cp = body.cp && typeof body.cp === 'object' && String(body.cp.deskripsi || '').trim() ? body.cp : null;
  const tpDipilih = cp && Array.isArray(body.tp)
    ? body.tp.filter((t) => t && String(t.deskripsi || '').trim()).slice(0, 15)
    : [];
  const topik = String(topikInput || '').trim() || (cp ? (cp.elemen || String(cp.deskripsi).slice(0, 120)) : '');

  if (!mapel || !topik) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Mapel dan topik (atau CP) wajib diisi' }) };
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

  // Blok tambahan bila soal dibuat berdasarkan CP/TP yang dipilih guru
  let blokCp = '';
  if (cp) {
    blokCp = `\nCapaian Pembelajaran (CP)${cp.fase ? ` Fase ${cp.fase}` : ''}${cp.elemen ? ` — elemen ${cp.elemen}` : ''}: ${String(cp.deskripsi).slice(0, 1200)}`;
    if (tpDipilih.length) {
      blokCp += `\nTujuan Pembelajaran (TP) yang harus diukur:\n${tpDipilih.map((t) => `- [${t.kode || 'TP'}] ${String(t.deskripsi).slice(0, 400)}`).join('\n')}`;
      blokCp += `\nSetiap soal HARUS mengukur tepat satu TP di atas. Isi field "tp_kode" dengan kode TP persis seperti tertulis di dalam kurung siku (tanpa kurung). Bagi rata jumlah soal ke seluruh TP dan sesuaikan kata kerja operasional TP dengan bentuk soalnya.`;
    } else {
      blokCp += `\nSemua soal HARUS mengukur CP di atas. Kosongkan field "tp_kode".`;
    }
  }

  const promptDasar = `Kamu adalah asisten pembuat soal ujian untuk sekolah kesetaraan (PKBM) di Indonesia, jenjang ${program || 'Paket B/C'}.
Buat soal ujian berkualitas, sesuai kurikulum, dalam bahasa Indonesia yang baik dan jelas, dengan tingkat kesulitan "${tingkat_kesulitan}".

Mata pelajaran: ${mapel}
Topik/materi: ${topik}${blokCp}
Total soal yang harus dibuat: ${totalSoal}, dengan rincian jenis sebagai berikut:
${rincianKomposisi}
${catatanBatch}

Susun urutan soal dalam satu lembar: kelompokkan per jenis (semua pilihan ganda dulu, lalu isian singkat, lalu essay), agar rapi seperti lembar soal ujian sungguhan.`;

  const promptGemini = `${promptDasar}\nBalas HANYA dengan JSON array sesuai skema yang diberikan, tanpa teks tambahan apa pun.`;
  const promptOpenAI = `${promptDasar}
Balas HANYA dengan satu JSON object berbentuk:
{"soal":[{"pertanyaan":"...","jenis":"pilihan_ganda|isian_singkat|essay","tingkat_kesulitan":"${tingkat_kesulitan}","opsi_a":"","opsi_b":"","opsi_c":"","opsi_d":"","opsi_e":"","kunci_jawaban":"","tp_kode":""}]}
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
