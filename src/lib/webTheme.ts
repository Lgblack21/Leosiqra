// Mode gelap web (bertahap). Kerangka (sidebar, header, tab bar, panel
// Pengaturan) selalu ikut tema; isi halaman hanya untuk rute yang sudah dicek
// tampilannya. Tambah prefix di sini setiap kali satu halaman selesai dirapikan.
export const WEB_DARK_READY = ['/membership/dashboard'];

export const isWebDarkReady = (pathname: string | null) =>
  !!pathname && WEB_DARK_READY.some((p) => pathname === p || pathname.startsWith(`${p}/`));
