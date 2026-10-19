// ===== API client & helper kecil dipakai di semua halaman =====
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('siswa_token') || localStorage.getItem('admin_token');
}
function siswaToken() { return localStorage.getItem('siswa_token'); }
function adminToken() { return localStorage.getItem('admin_token'); }

async function apiCall(path, { method = 'GET', body, token, isSiswa } = {}) {
  const t = token || (isSiswa ? siswaToken() : adminToken());
  const headers = { 'Content-Type': 'application/json' };
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) throw new Error('Terjadi kesalahan pada server.');
    return res; // biarkan caller (export) menangani response mentah
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Terjadi kesalahan.');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function toast(message, type = '') {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function requireSiswaAuth() {
  if (!siswaToken()) window.location.href = '/siswa/login.html';
}
function requireAdminAuth() {
  if (!adminToken()) window.location.href = '/admin/login.html';
}
function logoutSiswa() { localStorage.removeItem('siswa_token'); window.location.href = '/siswa/login.html'; }
function logoutAdmin() { localStorage.removeItem('admin_token'); localStorage.removeItem('admin_info'); window.location.href = '/admin/login.html'; }

function fmtJam(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) + ' WIB';
}
function fmtTanggal(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function statusLabel(s) {
  const map = {
    BELUM_ABSEN: 'Belum Absen', HADIR: 'Hadir', TERLAMBAT: 'Terlambat',
    SUDAH_PULANG: 'Sudah Pulang', TIDAK_HADIR: 'Tidak Hadir', IZIN: 'Izin', SAKIT: 'Sakit',
    PERLU_VERIFIKASI: 'Perlu Verifikasi',
  };
  return map[s] || s || '-';
}
function statusBadgeClass(s) {
  const map = {
    HADIR: 'hadir', TERLAMBAT: 'terlambat', BELUM_ABSEN: 'belum', SUDAH_PULANG: 'pulang',
    IZIN: 'izin', SAKIT: 'sakit', TIDAK_HADIR: 'tidak_hadir', PERLU_VERIFIKASI: 'verifikasi',
  };
  return `badge badge-${map[s] || 'belum'}`;
}

/** Ambil lokasi GPS dengan akurasi tinggi. Menolak dengan pesan Bahasa Indonesia. */
function ambilLokasi() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Perangkat/browser ini tidak mendukung layanan lokasi.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        is_mock_location: pos.mocked === true, // hanya terisi di platform yang mendukung flag ini
      }),
      () => reject(new Error('Lokasi/GPS Anda belum aktif. Aktifkan lokasi kemudian coba kembali.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function deviceInfo() {
  return {
    ua: navigator.userAgent,
    platform: navigator.platform,
    bahasa: navigator.language,
    layar: `${screen.width}x${screen.height}`,
  };
}
