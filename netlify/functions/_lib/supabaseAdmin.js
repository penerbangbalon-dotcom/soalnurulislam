const { createClient } = require('@supabase/supabase-js');

let client = null;

/**
 * Client server-side memakai SUPABASE_SERVICE_ROLE_KEY.
 * Kunci ini HANYA boleh ada di environment variable Netlify, TIDAK PERNAH dikirim ke browser.
 * Semua RLS di-bypass oleh service role, jadi setiap query di sini WAJIB divalidasi manual.
 */
function supabaseAdmin() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diatur di environment variables Netlify.');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

module.exports = { supabaseAdmin };
