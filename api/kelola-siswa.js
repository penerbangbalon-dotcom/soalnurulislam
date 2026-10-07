// Vercel adapter — menggunakan handler lama agar logika aplikasi tetap sama.
const { handler } = require('../netlify/functions/kelola-siswa');

module.exports = async function (req, res) {
  const event = {
    httpMethod: req.method,
    headers: req.headers || {},
    body: req.body == null
      ? ''
      : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)),
    queryStringParameters: req.query || {},
    path: req.url || '',
  };

  try {
    const result = await handler(event);
    const status = result?.statusCode || 200;
    res.status(status);

    const headers = result?.headers || {};
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }

    if (result?.isBase64Encoded) {
      return res.end(Buffer.from(result.body || '', 'base64'));
    }

    const body = result?.body;
    if (body == null) return res.end();
    if (typeof body === 'object') return res.json(body);
    return res.send(body);
  } catch (error) {
    console.error('[Vercel API kelola-siswa]', error);
    return res.status(500).json({
      error: error?.message || 'Terjadi kesalahan pada server.'
    });
  }
};
