// Bukan modul client: dipakai juga oleh app/layout.tsx (server).
export const THEME_KEY = 'leo-theme:v1';
export const THEME_BOOT_JS = `try{if(location.pathname.indexOf('/membership')===0){var t=localStorage.getItem('${THEME_KEY}');if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.setAttribute('data-theme','dark')}}catch(e){}`;
