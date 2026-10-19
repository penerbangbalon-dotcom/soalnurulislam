/**
 * Membaca data/students_import.csv dan menghasilkan supabase/seed_students.sql
 * Password awal siswa = tanggal lahir format DDMMYYYY (di-hash dengan bcrypt).
 * Siswa tanpa NISN / tanpa tanggal lahir TIDAK diberi password otomatis;
 * admin harus melengkapi datanya dulu di menu Data Siswa (butuh_konfirmasi_admin = true).
 *
 * Jalankan setelah `npm install` di root proyek:
 *   node scripts/generate_seed_sql.js
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { parse } = require('csv-parse/sync');

const csvPath = path.join(__dirname, '..', 'data', 'students_import.csv');
const outPath = path.join(__dirname, '..', 'supabase', 'seed_students.sql');

const raw = fs.readFileSync(csvPath, 'utf-8');
const records = parse(raw, { columns: true, skip_empty_lines: true });

function esc(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function initialPasswordPlain(tanggalLahir) {
  if (!tanggalLahir) return null;
  const [y, m, d] = tanggalLahir.split('-');
  if (!y || !m || !d) return null;
  return `${d}${m}${y}`; // DDMMYYYY
}

const lines = [];
lines.push('-- File ini dibuat otomatis oleh scripts/generate_seed_sql.js — JANGAN edit manual.');
lines.push('-- Jalankan sekali di Supabase SQL editor setelah schema.sql.');
lines.push('begin;');

let withPassword = 0;
let flagged = 0;

for (const r of records) {
  const plain = initialPasswordPlain(r.tanggal_lahir);
  const hash = plain ? bcrypt.hashSync(plain, 10) : null;
  if (hash) withPassword++;
  if (r.butuh_konfirmasi_admin === 'True') flagged++;

  lines.push(
    `insert into students (nisn, nipd, nama, jk, jenjang, program, kelas, tempat_lahir, tanggal_lahir, alamat, hp, status, password_hash, must_change_password, butuh_konfirmasi_admin, catatan_konfirmasi) values (` +
      [
        esc(r.nisn),
        esc(r.nipd),
        esc(r.nama),
        esc(r.jk),
        esc(r.jenjang === 'TIDAK_DIKETAHUI' ? 'SMP' : r.jenjang), // fallback aman, tetap ditandai butuh_konfirmasi
        esc(r.program),
        esc(r.kelas),
        esc(r.tempat_lahir),
        esc(r.tanggal_lahir),
        esc(r.alamat),
        esc(r.hp),
        esc(r.status),
        esc(hash),
        'true',
        r.butuh_konfirmasi_admin === 'True' ? 'true' : 'false',
        esc(r.catatan_konfirmasi),
      ].join(', ') +
      `) on conflict (nisn) do nothing;`
  );
}

lines.push('commit;');
fs.writeFileSync(outPath, lines.join('\n'));
console.log(`Selesai. ${records.length} baris siswa -> ${outPath}`);
console.log(`  - ${withPassword} siswa mendapat password awal (tanggal lahir, format DDMMYYYY)`);
console.log(`  - ${flagged} siswa ditandai butuh_konfirmasi_admin (NISN kosong / rombel tak dikenali)`);
