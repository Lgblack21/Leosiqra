// Versi Leosiqra yang ditampilkan ke user (Pengaturan web, Profil app HP).
// Sumbernya "version" di package.json (lewat next.config.ts) — jangan ditulis manual di sini.
// Cara menaikkan versi: lihat CHANGELOG.md (npm run versi -- patch|minor|major).
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0';
export const APP_BUILD = process.env.NEXT_PUBLIC_APP_BUILD || '';
export const APP_VERSION_LABEL = `v${APP_VERSION}${APP_BUILD ? ` · build ${APP_BUILD}` : ''}`;
