const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { requireAdmin } = require('./_lib/auth');
const { json, preflight } = require('./_lib/utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Sesi admin tidak valid.' });

  const supabase = supabaseAdmin();
  const q = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(q.page || '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(q.per_page || '30', 10)));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const table = q.type === 'security' ? 'attendance_security_events' : 'audit_logs';
  const { data, error, count } = await supabase
    .from(table)
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return json(500, { error: 'Gagal mengambil log.' });
  return json(200, { data, total: count, page, per_page: perPage });
};
