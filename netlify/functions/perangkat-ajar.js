// Function: perangkat-ajar  (POST /api/perangkat-ajar)
// Membuat isi RPP atau Modul Ajar (JSON terstruktur) dengan AI. Dokumen dirakit di browser.
// Memakai env AI yang sama dengan generate-soal (GEMINI_API_KEY / GROQ_API_KEY / dst).
// Opsional: PERANGKAT_BUDGET_MS (default 52000), AI_PROVIDER_ORDER, GEMINI_MODEL, dll.
const { wajibLogin } = require('../lib/ujian-core');
const { json, preflight } = require('./_lib/utils');

const BUDGET_MS = parseInt(process.env.PERANGKAT_BUDGET_MS, 10) || 52000;
const daftar = (v, d) => String(v || d || '').split(',').map((x) => x.trim()).filter(Boolean);

function kandidat() {
  const e = process.env;
  const peta = {
    gemini: () => e.GEMINI_API_KEY
      ? [...new Set([e.GEMINI_MODEL || 'gemini-3.6-flash', ...daftar(e.GEMINI_FALLBACK_MODELS, 'gemini-3.5-flash-lite,gemini-2.5-flash')])]
        .map((m) => ({ provider: 'gemini', model: m, jenis: 'gemini', apiKey: e.GEMINI_API_KEY })) : [],
    groq: () => (e.GROQ_API_KEY || e.GROOQ_API_KEY) ? [{ provider: 'groq', model: e.GROQ_MODEL || 'openai/gpt-oss-120b', jenis: 'openai', url: 'https://api.groq.com/openai/v1/chat/completions', apiKey: e.GROQ_API_KEY || e.GROOQ_API_KEY }] : [],
    cerebras: () => e.CEREBRAS_API_KEY ? [{ provider: 'cerebras', model: e.CEREBRAS_MODEL || 'gpt-oss-120b', jenis: 'openai', url: 'https://api.cerebras.ai/v1/chat/completions', apiKey: e.CEREBRAS_API_KEY, kecil: true }] : [],
    mistral: () => e.MISTRAL_API_KEY ? [{ provider: 'mistral', model: e.MISTRAL_MODEL || 'mistral-small-latest', jenis: 'openai', url: 'https://api.mistral.ai/v1/chat/completions', apiKey: e.MISTRAL_API_KEY }] : [],
    openrouter: () => e.OPENROUTER_API_KEY ? [{ provider: 'openrouter', model: e.OPENROUTER_MODEL || 'openrouter/free', jenis: 'openai', url: 'https://openrouter.ai/api/v1/chat/completions', apiKey: e.OPENROUTER_API_KEY }] : [],
  };
  return daftar(e.AI_PROVIDER_ORDER, 'gemini,groq,cerebras,mistral,openrouter').flatMap((p) => (peta[p] ? peta[p]() : []));
}

class ErrAI extends Error { constructor(s, m) { super(m); this.status = s; } }

async function ft(url, opts, ms) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); }
  catch (er) { throw new ErrAI(er.name === 'AbortError' ? 408 : 0, er.name === 'AbortError' ? 'Waktu tunggu habis' : (er.message || 'Gagal terhubung')); }
  finally { clearTimeout(t); }
}

async function panggil(k, prompt, ms, tokens) {
  if (k.jenis === 'gemini') {
    const gc = { temperature: 0.6, maxOutputTokens: tokens, responseMimeType: 'application/json' };
    if (/gemini-3/i.test(k.model)) gc.thinkingConfig = { thinkingLevel: 'low' };
    else if (/gemini-2\.5-flash/i.test(k.model)) gc.thinkingConfig = { thinkingBudget: 0 };
    const r = await ft(`https://generativelanguage.googleapis.com/v1beta/models/${k.model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k.apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: gc }),
    }, ms);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new ErrAI(r.status, d?.error?.message || `Gemini error (${r.status})`);
    return d?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  }
  const body = {
    model: k.model, temperature: 0.6, max_tokens: Math.min(k.kecil ? 6000 : 9000, tokens),
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: 'Kamu asisten penyusun perangkat ajar sekolah di Indonesia. Balas HANYA JSON valid, tanpa teks lain.' }, { role: 'user', content: prompt }],
  };
  if (/gpt-oss/i.test(k.model)) body.reasoning_effort = 'low';
  const r = await ft(k.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k.apiKey}` }, body: JSON.stringify(body) }, ms);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrAI(r.status, d?.error?.message || d?.message || `${k.provider} error (${r.status})`);
  return d?.choices?.[0]?.message?.content || '';
}

function ambilJson(raw) {
  let t = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(t); } catch (e) {
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a !== -1 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error('Bukan JSON');
  }
}

const KEGIATAN = '"kegiatan":[{"pertemuan":1,"pendahuluan":[{"aktivitas":"...","menit":10}],"inti":[{"aktivitas":"...","menit":60}],"penutup":[{"aktivitas":"...","menit":20}]}]';

function bentukRpp(p) {
  const lengkap = p.format_rpp !== 'ringkas';
  const f = ['"materi_pokok":"..."', '"tujuan":["... (format ABCD, diawali kata kerja operasional)"]'];
  if (lengkap) f.push('"materi":["poin materi (fakta/konsep/prosedur)"]', '"model":"..."', '"metode":"..."', '"media":["..."]', '"sumber":["..."]');
  if (p.profil_pancasila) f.push('"profil":["dimensi Profil Pelajar Pancasila yang relevan"]');
  f.push(KEGIATAN);
  f.push('"penilaian":{"sikap":"teknik+instrumen","pengetahuan":"teknik+instrumen+contoh butir","keterampilan":"teknik+instrumen+kriteria"}');
  if (lengkap && p.sertakan_remedial) f.push('"remedial":"...","pengayaan":"..."');
  return `{${f.join(',')}}`;
}

function bentukModul(p) {
  const f = [
    '"kompetensi_awal":"..."', '"profil":["..."]', '"sarpras":["..."]', '"target_peserta":"..."', '"model":"..."',
    '"tujuan":["... (ABCD)"]', '"pemahaman_bermakna":["..."]', '"pertanyaan_pemantik":["..."]', '"persiapan":["..."]',
    KEGIATAN,
    '"asesmen":{"diagnostik":"...","formatif":"...","sumatif":"..."}',
  ];
  if (p.sertakan_rubrik) f.push('"rubrik":[{"aspek":"...","sangat_baik":"...","baik":"...","cukup":"...","perlu_bimbingan":"..."}]');
  if (p.sertakan_remedial) f.push('"pengayaan":"...","remedial":"..."');
  f.push('"refleksi_guru":["..."]', '"refleksi_siswa":["..."]',
    '"lkpd":{"judul":"...","petunjuk":"...","langkah":["..."],"soal":["..."]}',
    '"bahan_bacaan":"2-4 paragraf, dipisah \\n\\n"', '"glosarium":[{"istilah":"...","arti":"..."}]', '"pustaka":["..."]');
  return `{${f.join(',')}}`;
}

function susunPrompt(b) {
  const p = b.pengaturan || {};
  const jenis = b.jenis === 'modul' ? 'MODUL AJAR (Kurikulum Merdeka)' : 'RPP (Rencana Pelaksanaan Pembelajaran)';
  const pert = Math.min(Math.max(parseInt(b.pertemuan, 10) || 1, 1), 4);
  const jp = Math.min(Math.max(parseInt(b.jp, 10) || 2, 1), 6);
  const mjp = Math.min(Math.max(parseInt(p.menit_per_jp, 10) || 45, 30), 60);
  const menit = jp * mjp;
  const cp = b.cp && b.cp.deskripsi ? `\nCapaian Pembelajaran${b.fase ? ` Fase ${b.fase}` : ''}${b.cp.elemen ? ` (elemen ${b.cp.elemen})` : ''}: ${String(b.cp.deskripsi).slice(0, 1200)}` : '';
  const tp = (b.tp || []).filter((t) => t && t.deskripsi).slice(0, 10).map((t) => `- [${t.kode || 'TP'}] ${String(t.deskripsi).slice(0, 300)}`).join('\n');
  return `Susun ${jenis} untuk sekolah kesetaraan PKBM di Indonesia, sesuai ketentuan Kementerian Pendidikan (Kurikulum Merdeka). Bahasa Indonesia baku, praktis, bisa langsung dipakai guru.
Mata pelajaran: ${b.mapel}
Program/Kelas: ${b.program || ''} Kelas ${b.kelas || ''}${b.fase ? ` (Fase ${b.fase})` : ''}, Semester ${b.semester || ''}
Topik/materi pokok: ${b.topik}${cp}${tp ? `\nTujuan Pembelajaran (TP) yang dijadikan acuan, gunakan/rumuskan ulang sebagai tujuan:\n${tp}` : ''}
Jumlah pertemuan: ${pert}; tiap pertemuan ${jp} JP x ${mjp} menit = ${menit} menit. Pada "kegiatan" buat tepat ${pert} objek pertemuan, dan jumlah "menit" pendahuluan+inti+penutup tiap pertemuan HARUS = ${menit}.
Model pembelajaran: ${p.model_default || 'pilih yang paling sesuai'}. Peserta didik PKBM umumnya beragam usia dan latar belakang; kaitkan dengan konteks nyata/dunia kerja bila relevan.
${p.catatan_ai ? `Catatan khusus dari sekolah: ${String(p.catatan_ai).slice(0, 600)}\n` : ''}Langkah kegiatan harus konkret (apa yang dilakukan guru dan peserta didik), 3-6 langkah per fase, ringkas.
Balas HANYA satu JSON object dengan bentuk persis berikut (isi "..." dengan konten nyata, jangan salin tanda titik-titik):
${b.jenis === 'modul' ? bentukModul(p) : bentukRpp(p)}`;
}

function valid(d, jenis) {
  return d && Array.isArray(d.tujuan) && d.tujuan.length && Array.isArray(d.kegiatan) && d.kegiatan.length
    && (jenis !== 'modul' || d.asesmen);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  const g = await wajibLogin(event);
  if (g.error) return { ...g.error, headers: { 'Content-Type': 'application/json' } };

  let b; try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Body tidak valid' }); }
  if (!['rpp', 'modul'].includes(b.jenis)) return json(400, { error: 'Jenis harus rpp atau modul.' });
  if (!String(b.mapel || '').trim() || !String(b.topik || '').trim()) return json(400, { error: 'Mapel dan topik wajib diisi.' });

  const kand = kandidat();
  if (!kand.length) return json(500, { error: 'Belum ada API key AI di Environment Variables (GEMINI_API_KEY / GROQ_API_KEY / dst).' });

  const prompt = susunPrompt(b);
  const tokens = b.jenis === 'modul' ? 9000 : 6000;
  const mulai = Date.now(); const log = []; const bermasalah = new Set();

  for (const k of kand) {
    if (bermasalah.has(k.provider)) continue;
    for (let coba = 1; coba <= 2; coba++) {
      const sisa = BUDGET_MS - (Date.now() - mulai);
      if (sisa < 6000) { log.push(`${k.provider}/${k.model}: waktu habis`); break; }
      try {
        const raw = await panggil(k, prompt, Math.min(sisa - 500, 32000), tokens);
        const d = ambilJson(raw);
        if (!valid(d, b.jenis)) throw new Error('Struktur hasil AI tidak lengkap');
        return json(200, { data: d, provider: k.provider, model: k.model });
      } catch (er) {
        const s = er.status || 0; const m = String(er.message || '');
        log.push(`${k.provider}/${k.model}: ${s || 'error'} ${m.slice(0, 100)}`);
        if (s === 401 || s === 403 || /api.?key|unauthori|permission/i.test(m)) { bermasalah.add(k.provider); break; }
        if ([500, 502, 503, 504, 408, 0].includes(s) && coba < 2 && BUDGET_MS - (Date.now() - mulai) > 12000) { await new Promise((r) => setTimeout(r, 700)); continue; }
        break;
      }
    }
  }
  return json(503, { error: `Semua penyedia AI gagal/sibuk. Coba lagi sebentar.\n\n${log.join('\n')}` });
};
