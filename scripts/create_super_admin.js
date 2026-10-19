/**
 * Membuat SQL untuk akun Super Admin pertama (dijalankan sekali di Supabase SQL editor).
 * Pemakaian: node scripts/create_super_admin.js "nama@sekolah.id" "NamaAdmin" "PasswordKuat123"
 */
const bcrypt = require('bcryptjs');

const [,, email, nama, password] = process.argv;
if (!email || !nama || !password) {
  console.error('Pemakaian: node scripts/create_super_admin.js <email> <nama> <password>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password minimal 8 karakter.');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
const sql = `insert into admins (email, nama, role, password_hash) values ('${email.toLowerCase()}', '${nama.replace(/'/g, "''")}', 'SUPER_ADMIN', '${hash}') on conflict (email) do nothing;`;

console.log('\nJalankan SQL berikut di Supabase SQL Editor:\n');
console.log(sql);
console.log('');
