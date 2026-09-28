# Deploy Aplikasi Ujian PKBM ke Vercel

## Perbaikan penting
Versi ini tidak menetapkan `runtime: nodejs22.x` di `vercel.json`. Pada Vercel, folder `/api/*.js` otomatis menggunakan Node.js Runtime bawaan. Pengaturan Node.js major version dilakukan melalui `package.json` (`24.x`) atau Project Settings.

## GitHub
Upload **isi folder proyek** ke root repository. Struktur harus seperti:

- `api/generate-soal.js`
- `api/kelola-user.js`
- `api/mulai-ujian.js`
- `api/submit-ujian.js`
- `api/heartbeat.js`
- `api/sudahi-ujian.js`
- `netlify/functions/...`
- `netlify/lib/...`
- `index.html`
- `ujian.html`
- `vercel.json`
- `package.json`

Jangan letakkan proyek di dalam folder bertingkat seperti `repo/aplikasi-ujian-v7-fixed/api`.

## Vercel
Import repository GitHub dan gunakan Root Directory `./`.
Framework Preset boleh `Other`.
Tidak perlu Build Command khusus.

## Environment Variables
Tambahkan di Vercel Project Settings > Environment Variables:

- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Opsional:

- `GEMINI_MODEL`
- `GEMINI_FALLBACK_MODELS`
- `GROQ_API_KEY`
- `CEREBRAS_API_KEY`
- `MISTRAL_API_KEY`
- `OPENROUTER_API_KEY`
- `AI_PROVIDER_ORDER`
- `AI_BUDGET_MS`

Set variable untuk Production, Preview, dan Development sesuai kebutuhan.

Setelah mengubah Environment Variables, lakukan Redeploy.

## Jika masih mendapat error runtime
Pastikan repository tidak memiliki `now.json` lama atau `vercel.json` lain di subfolder yang dipilih sebagai Root Directory. File konfigurasi yang digunakan harus `vercel.json` di root deployment.
