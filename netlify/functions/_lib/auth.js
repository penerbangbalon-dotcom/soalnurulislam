const jwt = require('jsonwebtoken');

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET belum diatur di environment variables Netlify.');
  return s;
}

function signSiswaToken(student) {
  return jwt.sign(
    { sub: student.id, role: 'SISWA', nisn: student.nisn },
    secret(),
    { expiresIn: '12h' }
  );
}

function signAdminToken(admin) {
  return jwt.sign(
    { sub: admin.id, role: admin.role, email: admin.email },
    secret(),
    { expiresIn: '8h' }
  );
}

/**
 * Ambil & verifikasi identitas dari header Authorization: Bearer <token>.
 * Ini SATU-SATUNYA sumber identitas yang dipercaya server — client tidak pernah
 * boleh mengirim student_id / admin_id sendiri di body request.
 */
function getAuth(event) {
  const header = event.headers.authorization || event.headers.Authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  try {
    return jwt.verify(token, secret());
  } catch (e) {
    return null;
  }
}

function requireSiswa(event) {
  const auth = getAuth(event);
  if (!auth || auth.role !== 'SISWA') return null;
  return auth;
}

function requireAdmin(event, { superAdminOnly = false } = {}) {
  const auth = getAuth(event);
  if (!auth || (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN')) return null;
  if (superAdminOnly && auth.role !== 'SUPER_ADMIN') return null;
  return auth;
}

module.exports = { signSiswaToken, signAdminToken, getAuth, requireSiswa, requireAdmin };
