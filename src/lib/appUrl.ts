// URL notifikasi dari Worker ditulis untuk web (/membership/*). Di aplikasi HP
// (/app) arahkan ke halaman versi app yang setara; fitur yang belum ada versi
// app-nya (mis. /membership/aplikasi) tetap dibuka versi web.
const APP_EQUIVALENT: [prefix: string, app: string][] = [
  ["/membership/dashboard?pengaturan=pengingat", "/app/notifikasi?tab=pengingat"],
  ["/membership/dashboard?pengaturan=paket", "/app/profile"],
  ["/membership/kekayaan#hutang", "/app/debts"],
  ["/membership/kekayaan#barangku", "/app/barangku"],
  ["/membership/langganan", "/app/langganan"],
  ["/membership/transactions", "/app/transactions"],
  ["/membership/laporan", "/app/statistics"],
  ["/membership/profile", "/app/profile"],
  ["/membership/rekening", "/app/cards"],
  ["/membership/recurring", "/app/recurring"],
  ["/membership/tabungan", "/app/savings"],
  ["/membership/budget", "/app/budget"],
  ["/membership/kotak-masuk", "/app/inbox"],
  ["/membership/dashboard", "/app/statistics"],
];

export function toAppUrl(url: string): string {
  for (const [prefix, app] of APP_EQUIVALENT) {
    if (url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`) || url.startsWith(`${prefix}#`)) return app;
  }
  return url;
}
