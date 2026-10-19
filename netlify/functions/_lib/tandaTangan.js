/**
 * Validasi gambar tanda tangan yang diunggah admin (Kepala PKBM / Wali Kelas).
 * Disimpan sebagai data URL PNG base64 langsung di kolom teks database.
 * Ukuran dibatasi supaya tidak membengkakkan tabel & payload halaman cetak.
 */
const MAX_TTD_BASE64_CHARS = 900_000; // ~650KB file, cukup lega untuk tanda tangan hasil scan/tulis di kanvas

function validasiTtd(dataUrl) {
  if (dataUrl === null || dataUrl === undefined) return { ok: true };
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
    return { ok: false, error: 'Tanda tangan harus berupa gambar format PNG.' };
  }
  if (dataUrl.length > MAX_TTD_BASE64_CHARS) {
    return { ok: false, error: 'Ukuran gambar tanda tangan terlalu besar. Gunakan gambar yang lebih kecil.' };
  }
  return { ok: true };
}

function validasiLebar(lebar) {
  if (lebar === null || lebar === undefined) return { ok: true };
  const n = Number(lebar);
  if (!Number.isFinite(n) || n < 60 || n > 320) {
    return { ok: false, error: 'Ukuran tanda tangan harus antara 60 dan 320 piksel.' };
  }
  return { ok: true };
}

module.exports = { validasiTtd, validasiLebar };
