// Tanpa React — aman diimpor root layout (server component).
export const TEXT_SIZE_KEY = 'leosiqra-teks';
/** Isi skrip <head>: terapkan ukuran teks tersimpan sebelum halaman digambar. */
export const TEXT_SIZE_BOOT = `try{var t=localStorage.getItem('${TEXT_SIZE_KEY}');if(t==='kecil'||t==='besar')document.documentElement.setAttribute('data-teks',t)}catch(e){}`;
