// Netlify/Vercel Function: perangkat-docx
// POST { perangkat:{ jenis, format, judul, mapel_nama, penyusun, nip_penyusun, isi:{identitas, bagian} },
//        sekolah:{...}, ttd:{ kepala_nama, kepala_nip, tampil_ttd_kepala, tanggal } }
// -> { nama_berkas, base64 }   (klien mengubahnya menjadi unduhan .docx)
const { adaKonfigurasi, wajibLogin } = require('../lib/ujian-core');
const { buatDokumen } = require('../lib/perangkat-docx');

const res = (statusCode, obj) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
const aman = (s) => String(s || 'perangkat-ajar').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'perangkat-ajar';
const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!adaKonfigurasi()) return res(500, { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Environment Variables.' });
  const guard = await wajibLogin(event);
  if (guard.error) return guard.error;

  let body;
  try { body = JSON.parse(event.body); } catch (e) { return res(400, { error: 'Body tidak valid' }); }
  const p = body.perangkat;
  if (!p || !p.isi || !Array.isArray(p.isi.bagian) || !p.isi.bagian.length) return res(400, { error: 'Isi dokumen kosong.' });
  if (p.isi.bagian.length > 80) return res(400, { error: 'Dokumen terlalu panjang.' });

  const sk = body.sekolah || {}, tt = body.ttd || {};
  try {
    const buf = await buatDokumen({
      perangkat: {
        jenis: p.jenis === 'modul' ? 'modul' : 'rpp', format: str(p.format, 20), judul: str(p.judul), mapel_nama: str(p.mapel_nama, 120),
        penyusun: str(p.penyusun, 120), nip_penyusun: str(p.nip_penyusun, 40),
        isi: {
          identitas: (Array.isArray(p.isi.identitas) ? p.isi.identitas : []).slice(0, 30).map((r) => [str(r[0], 80), str(r[1], 500)]),
          bagian: p.isi.bagian.map((b) => ({ grup: str(b.grup, 120), judul: str(b.judul, 200), teks: str(b.teks, 20000) })),
        },
      },
      sekolah: { nama_yayasan: str(sk.nama_yayasan), nama_lembaga: str(sk.nama_lembaga), nama_singkat: str(sk.nama_singkat), alamat: str(sk.alamat, 400), kota_ttd: str(sk.kota_ttd, 80), jabatan_kepala: str(sk.jabatan_kepala, 120) },
      ttd: { kepala_nama: str(tt.kepala_nama, 120), kepala_nip: str(tt.kepala_nip, 40), tampil_ttd_kepala: tt.tampil_ttd_kepala !== false, tanggal: str(tt.tanggal, 40) },
    });
    return res(200, { nama_berkas: `${aman(p.jenis === 'modul' ? 'Modul-Ajar' : 'RPP')}-${aman(p.mapel_nama)}-${aman(p.judul)}.docx`, base64: buf.toString('base64') });
  } catch (e) {
    console.error('[perangkat-docx]', e);
    return res(500, { error: 'Gagal membuat berkas Word: ' + (e.message || e) });
  }
};
