// Statistik pemakaian (Cloudflare Web Analytics: hitungan kunjungan tanpa
// cookie, tanpa data keuangan). Bisa dimatikan per perangkat di Pengaturan →
// Privasi & keamanan; berlaku mulai halaman dimuat berikutnya.
const KEY = 'leosiqra:analytics-off';

export const analyticsEnabled = () => {
  try {
    return localStorage.getItem(KEY) !== '1';
  } catch {
    return true;
  }
};

export const setAnalyticsEnabled = (on: boolean) => {
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, '1');
  } catch {
    /* storage diblokir — tidak bisa disimpan */
  }
};
