// Netlify Function: kelola-user
// Mengelola akun login guru/admin (Supabase Auth) dari menu "Manajemen User"
// di index.html. Tidak pakai library npm apapun (langsung fetch ke Supabase
// REST/Auth API), supaya deploy drag-and-drop tidak perlu proses build.
//
// Semua aksi di sini butuh service_role key (JANGAN taruh di frontend!),
// makanya harus lewat function ini. Yang boleh pakai function ini hanya
// pengguna yang sudah login (guru/admin) — dicek dengan memvalidasi token
// sesi yang dikirim dari browser ke Supabase Auth.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Anon key tidak rahasia (sudah ada di index.html), dipakai di sini hanya untuk
// memvalidasi token sesi pemanggil. Boleh di-override lewat env var kalau perlu.
const ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ld2VpdmR2b3ZwY2dvbGF4enVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjY3MDgsImV4cCI6MjEwNTM0MjcwOH0.bJyrKD7pnCcVizWbsBD5e0LrFl_8LdwU_5JRmyqkfV0';

async function pastikanLogin(event) {
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json(); // { id, email, ... }
}

async function adminFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
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
  if (!res.ok) throw new Error((data && (data.msg || data.message || data.error_description || data.error)) || `Supabase error (${res.status})`);
  return data;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel Environment Variables.' }) };
  }

  const pemanggil = await pastikanLogin(event);
  if (!pemanggil) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Sesi login tidak valid. Silakan login ulang.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body tidak valid' }) };
  }
  const { action } = body;

  try {
    if (action === 'list') {
      const data = await adminFetch('/users?per_page=200');
      const users = (data.users || []).map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      })).sort((a, b) => (a.email || '').localeCompare(b.email || ''));
      return { statusCode: 200, body: JSON.stringify({ users }) };
    }

    if (action === 'create') {
      const email = (body.email || '').trim();
      const password = body.password || '';
      if (!email || !password) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Email dan kata sandi wajib diisi' }) };
      }
      if (password.length < 6) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Kata sandi minimal 6 karakter' }) };
      }
      const user = await adminFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      return { statusCode: 200, body: JSON.stringify({ ok: true, user }) };
    }

    if (action === 'reset-password') {
      const { user_id, password } = body;
      if (!user_id || !password) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Data tidak lengkap' }) };
      }
      if (password.length < 6) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Kata sandi minimal 6 karakter' }) };
      }
      await adminFetch(`/users/${user_id}`, { method: 'PUT', body: JSON.stringify({ password }) });
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'delete') {
      const { user_id } = body;
      if (!user_id) return { statusCode: 400, body: JSON.stringify({ error: 'Data tidak lengkap' }) };
      if (user_id === pemanggil.id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Tidak bisa menghapus akun yang sedang login.' }) };
      }
      await adminFetch(`/users/${user_id}`, { method: 'DELETE' });
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Aksi tidak dikenali' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
