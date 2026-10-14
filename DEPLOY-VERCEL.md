# DEPLOY VERCEL — APLIKASI UJIAN

## 1. Environment Variables

Di Vercel → Project → Settings → Environment Variables, isi:

- `SUPABASE_URL` = URL project Supabase
- `SUPABASE_SERVICE_ROLE_KEY` = service_role key Supabase
- `SUPABASE_ANON_KEY` = anon/public key Supabase
- `GEMINI_API_KEY` = API key Google AI Studio

Opsional AI cadangan:
- `GROQ_API_KEY`
- `CEREBRAS_API_KEY`
- `MISTRAL_API_KEY`
- `OPENROUTER_API_KEY`

Opsional konfigurasi AI:
- `GEMINI_MODEL=gemini-3.6-flash`
- `GEMINI_FALLBACK_MODELS=gemini-3.5-flash-lite,gemini-2.5-flash`
- `AI_PROVIDER_ORDER=gemini,groq,cerebras,mistral,openrouter`
- `AI_BUDGET_MS=24000`

## 2. Supabase

Pastikan schema/migrasi SQL dari proyek asli sudah dijalankan dan tabel yang dipakai aplikasi tersedia.

## 3. Deploy

Upload folder ini ke GitHub, lalu import repository tersebut ke Vercel.

Framework Preset: Other.

Build Command: kosongkan.

Output Directory: kosongkan.

Vercel otomatis mengenali folder `api/`.

## 4. Setelah deploy

Tes:
- `https://DOMAIN-VERCEL/api/generate-soal`
  - membuka URL langsung dengan GET boleh menghasilkan `Method Not Allowed`; itu normal.
  - pengujian sebenarnya dilakukan dari tombol Generate dengan AI.
- Login guru.
- Bank Soal → Generate dengan AI.
- Coba 5 soal terlebih dahulu.

## 5. Jika AI gagal

Buka Vercel → Deployments → deployment terbaru → Functions/Logs.

Kesalahan umum:
- `401/403`: API key AI salah/tidak aktif.
- `404 model`: nama model tidak tersedia; gunakan:
  `gemini-3.6-flash`
  atau `gemini-3.5-flash-lite`.
- `429`: kuota/rate limit; tambahkan provider cadangan.
- `SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY`: environment variable Supabase belum diisi.

## Penting

Jangan pernah memasukkan `SUPABASE_SERVICE_ROLE_KEY` ke `index.html`, `ujian.html`, atau JavaScript frontend.

## 5b. Remedial online
- Jalankan `migrasi-v14-remedial.sql` lalu `migrasi-v15-paket-remedial.sql` di Supabase SQL Editor.
- Fungsi server baru: `api/remedial-siswa.js` (otomatis dikenali Vercel).

## 6. Super Admin (opsional)
- `SUPER_ADMIN_EMAILS` = email Super Admin, pisahkan koma (mis. `kepala@contoh.com`). Tanpa ini, akun admin tertua otomatis jadi Super Admin saat login pertama.
- Jalankan `migrasi-v12-superadmin.sql` di Supabase SQL Editor.
- Setelah menambah/mengubah variabel di Vercel, lakukan Redeploy agar berlaku.

## 7. Urutan migrasi SQL (Supabase -> SQL Editor)
Instalasi baru: jalankan berurutan. Instalasi lama: jalankan hanya yang belum pernah dijalankan (semuanya aman diulang).
1. `supabase-schema.sql`
2. `migrasi-lengkap.sql`
3. `migrasi-v7.sql`
4. `migrasi-v8-absensi-nilai.sql` (butuh fungsi `rekap_kehadiran()` dari aplikasi absensi)
5. `migrasi-arsip-nilai.sql`
6. `migrasi-v10-pengecualian.sql`
7. `migrasi-v11-keamanan.sql`
8. `migrasi-v12-superadmin.sql`
9. `migrasi-v13-tambah-siswa.sql`
10. `migrasi-v14-remedial.sql`
11. `migrasi-v15-paket-remedial.sql`
12. `migrasi-v16-tugas-syarat-rapor.sql`
13. `migrasi-v17-cp-tp.sql`
14. `migrasi-v18-ekskul-nip.sql`
15. `migrasi-v19-pelanggaran.sql`
16. `migrasi-v20-kenaikan-kelas.sql` (bila `students.status` bertipe teks dengan CHECK, pastikan LULUS, PINDAH, KELUAR diizinkan)
17. `migrasi-v21-mapel-jurusan.sql`
18. `migrasi-v22-rapor-mapel-sembunyi.sql`

Catatan: jumlah fungsi di folder `api/` saat ini 11 (batas paket gratis Vercel 12). Tambahkan aksi baru ke fungsi yang ada, jangan membuat file baru di `api/`.
