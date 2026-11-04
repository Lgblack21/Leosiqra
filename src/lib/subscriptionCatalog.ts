// Katalog layanan berlangganan populer di Indonesia (Langgananku).
// - domain: logo diambil Worker /api/logo?d=<domain> — WAJIB ada di
//   LOGO_DOMAINS Worker (cloudflare/src/index.ts, blok "Langgananku").
// - price: PERKIRAAN harga paket umum per siklus (Rupiah), bisa diubah user.
//   Harga resmi sering berubah — UI selalu menyebutnya "perkiraan".
// - match: pola di catatan/kategori transaksi untuk Radar.

export const SUB_CATEGORIES = ['Streaming', 'Musik', 'Cloud', 'AI', 'Produktivitas', 'Game', 'Internet & TV', 'Pulsa & data', 'Tagihan rumah', 'Belanja & antar', 'Belajar', 'Lainnya'] as const;
export type SubCategory = (typeof SUB_CATEGORIES)[number];
export type SubCycle = 'mingguan' | 'bulanan' | '3bulan' | 'tahunan';

export type CatalogEntry = { key: string; name: string; domain?: string; category: SubCategory; price: number; cycle: SubCycle; color: string; match: RegExp };

export const SUB_CATALOG: CatalogEntry[] = [
  { key: 'netflix', name: 'Netflix', domain: 'netflix.com', category: 'Streaming', price: 65000, cycle: 'bulanan', color: '#e50914', match: /\bnetflix\b/i },
  { key: 'disney', name: 'Disney+ Hotstar', domain: 'disneyplus.com', category: 'Streaming', price: 39000, cycle: 'bulanan', color: '#113ccf', match: /\bdisney\b|hotstar/i },
  { key: 'prime-video', name: 'Prime Video', domain: 'primevideo.com', category: 'Streaming', price: 41000, cycle: 'bulanan', color: '#00a8e1', match: /prime ?video|amazon prime/i },
  { key: 'hbo', name: 'HBO Max', domain: 'max.com', category: 'Streaming', price: 59000, cycle: 'bulanan', color: '#002be7', match: /\bhbo\b|\bhbo max\b/i },
  { key: 'vidio', name: 'Vidio', domain: 'vidio.com', category: 'Streaming', price: 39000, cycle: 'bulanan', color: '#e9112b', match: /\bvidio\b/i },
  { key: 'viu', name: 'Viu', domain: 'viu.com', category: 'Streaming', price: 30000, cycle: 'bulanan', color: '#f5b800', match: /\bviu\b/i },
  { key: 'wetv', name: 'WeTV', domain: 'wetv.vip', category: 'Streaming', price: 39000, cycle: 'bulanan', color: '#ff6b00', match: /\bwe ?tv\b/i },
  { key: 'iqiyi', name: 'iQIYI', domain: 'iq.com', category: 'Streaming', price: 39000, cycle: 'bulanan', color: '#00cc36', match: /iqiyi/i },
  { key: 'youtube', name: 'YouTube Premium', domain: 'youtube.com', category: 'Streaming', price: 59000, cycle: 'bulanan', color: '#ff0000', match: /youtube|yt premium/i },
  { key: 'spotify', name: 'Spotify', domain: 'spotify.com', category: 'Musik', price: 54990, cycle: 'bulanan', color: '#1db954', match: /spotify/i },
  { key: 'apple-music', name: 'Apple Music', domain: 'music.apple.com', category: 'Musik', price: 49900, cycle: 'bulanan', color: '#fa243c', match: /apple music/i },
  { key: 'joox', name: 'JOOX', domain: 'joox.com', category: 'Musik', price: 29000, cycle: 'bulanan', color: '#00d65b', match: /\bjoox\b/i },
  { key: 'icloud', name: 'iCloud+', domain: 'icloud.com', category: 'Cloud', price: 15000, cycle: 'bulanan', color: '#3693f3', match: /icloud/i },
  { key: 'google-one', name: 'Google One', domain: 'one.google.com', category: 'Cloud', price: 26900, cycle: 'bulanan', color: '#1a73e8', match: /google ?one|google storage/i },
  { key: 'dropbox', name: 'Dropbox', domain: 'dropbox.com', category: 'Cloud', price: 180000, cycle: 'bulanan', color: '#0061ff', match: /dropbox/i },
  { key: 'chatgpt', name: 'ChatGPT Plus', domain: 'openai.com', category: 'AI', price: 330000, cycle: 'bulanan', color: '#10a37f', match: /chat ?gpt|openai/i },
  { key: 'claude', name: 'Claude Pro', domain: 'claude.ai', category: 'AI', price: 330000, cycle: 'bulanan', color: '#d97757', match: /\bclaude\b|anthropic/i },
  { key: 'gemini', name: 'Google AI Pro', domain: 'gemini.google.com', category: 'AI', price: 309000, cycle: 'bulanan', color: '#8e75ff', match: /gemini|google ai pro/i },
  { key: 'canva', name: 'Canva Pro', domain: 'canva.com', category: 'Produktivitas', price: 95000, cycle: 'bulanan', color: '#00c4cc', match: /\bcanva\b/i },
  { key: 'm365', name: 'Microsoft 365', domain: 'microsoft.com', category: 'Produktivitas', price: 899000, cycle: 'tahunan', color: '#ea3e23', match: /microsoft 365|office 365|\bm365\b/i },
  { key: 'adobe', name: 'Adobe Creative Cloud', domain: 'adobe.com', category: 'Produktivitas', price: 300000, cycle: 'bulanan', color: '#fa0f00', match: /\badobe\b|lightroom|photoshop/i },
  { key: 'notion', name: 'Notion', domain: 'notion.so', category: 'Produktivitas', price: 160000, cycle: 'bulanan', color: '#111111', match: /\bnotion\b/i },
  { key: 'zoom', name: 'Zoom Pro', domain: 'zoom.us', category: 'Produktivitas', price: 220000, cycle: 'bulanan', color: '#0b5cff', match: /\bzoom\b/i },
  { key: 'psplus', name: 'PlayStation Plus', domain: 'playstation.com', category: 'Game', price: 129000, cycle: 'bulanan', color: '#003791', match: /playstation|ps ?plus|\bpsn\b/i },
  { key: 'gamepass', name: 'Xbox Game Pass', domain: 'xbox.com', category: 'Game', price: 150000, cycle: 'bulanan', color: '#107c10', match: /game ?pass|\bxbox\b/i },
  { key: 'nintendo', name: 'Nintendo Switch Online', domain: 'nintendo.com', category: 'Game', price: 300000, cycle: 'tahunan', color: '#e60012', match: /nintendo/i },
  { key: 'indihome', name: 'IndiHome', domain: 'indihome.co.id', category: 'Internet & TV', price: 350000, cycle: 'bulanan', color: '#e42313', match: /indihome|telkom ?indonesia/i },
  { key: 'biznet', name: 'Biznet Home', domain: 'biznethome.net', category: 'Internet & TV', price: 375000, cycle: 'bulanan', color: '#1f3a93', match: /biznet/i },
  { key: 'firstmedia', name: 'First Media', domain: 'firstmedia.com', category: 'Internet & TV', price: 350000, cycle: 'bulanan', color: '#e4002b', match: /first ?media/i },
  { key: 'myrepublic', name: 'MyRepublic', domain: 'myrepublic.co.id', category: 'Internet & TV', price: 300000, cycle: 'bulanan', color: '#6b2c91', match: /my ?republic/i },
  { key: 'iconnet', name: 'ICONNET', domain: 'iconnet.id', category: 'Internet & TV', price: 250000, cycle: 'bulanan', color: '#00a0e3', match: /iconnet|icon\+/i },
  { key: 'telkomsel', name: 'Telkomsel', domain: 'telkomsel.com', category: 'Pulsa & data', price: 100000, cycle: 'bulanan', color: '#ec1c24', match: /telkomsel|\btsel\b|kartu halo|simpati/i },
  { key: 'xl', name: 'XL / AXIS', domain: 'xl.co.id', category: 'Pulsa & data', price: 100000, cycle: 'bulanan', color: '#0f4c9a', match: /\bxl\b|axis|xlsmart/i },
  { key: 'indosat', name: 'IM3 / Indosat', domain: 'im3.id', category: 'Pulsa & data', price: 100000, cycle: 'bulanan', color: '#ffc20e', match: /indosat|\bim3\b|ooredoo/i },
  { key: 'smartfren', name: 'Smartfren', domain: 'smartfren.com', category: 'Pulsa & data', price: 100000, cycle: 'bulanan', color: '#e4007f', match: /smartfren/i },
  { key: 'tri', name: '3 (Tri)', domain: 'tri.co.id', category: 'Pulsa & data', price: 100000, cycle: 'bulanan', color: '#8b2a8a', match: /\b(kartu|pulsa|paket) tri\b|bima\+/i },
  { key: 'byu', name: 'by.U', domain: 'byu.id', category: 'Pulsa & data', price: 60000, cycle: 'bulanan', color: '#00b0f0', match: /\bby\.?u\b/i },
  { key: 'pln', name: 'PLN', domain: 'pln.co.id', category: 'Tagihan rumah', price: 300000, cycle: 'bulanan', color: '#0090d4', match: /\bpln\b|listrik|token listrik/i },
  { key: 'pdam', name: 'PDAM', category: 'Tagihan rumah', price: 150000, cycle: 'bulanan', color: '#0284c7', match: /\bpdam\b|air minum/i },
  { key: 'bpjs', name: 'BPJS Kesehatan', domain: 'bpjs-kesehatan.go.id', category: 'Tagihan rumah', price: 150000, cycle: 'bulanan', color: '#0b9444', match: /bpjs/i },
  { key: 'grab', name: 'GrabUnlimited', domain: 'grab.com', category: 'Belanja & antar', price: 25000, cycle: 'bulanan', color: '#00b14f', match: /grab ?unlimited/i },
  { key: 'gojek', name: 'GoClub / GoFood Plus', domain: 'gojek.com', category: 'Belanja & antar', price: 25000, cycle: 'bulanan', color: '#00aa13', match: /go ?club|gofood plus|go ?plus/i },
  { key: 'shopee', name: 'Shopee VIP', domain: 'shopee.co.id', category: 'Belanja & antar', price: 10000, cycle: 'bulanan', color: '#ee4d2d', match: /shopee ?vip/i },
  { key: 'tokopedia', name: 'Tokopedia PLUS', domain: 'tokopedia.com', category: 'Belanja & antar', price: 20000, cycle: 'bulanan', color: '#03ac0e', match: /tokopedia ?plus|toko ?plus/i },
  { key: 'duolingo', name: 'Duolingo Super', domain: 'duolingo.com', category: 'Belajar', price: 90000, cycle: 'bulanan', color: '#58cc02', match: /duolingo/i },
  { key: 'gramedia', name: 'Gramedia Digital', domain: 'gramedia.com', category: 'Belajar', price: 89000, cycle: 'bulanan', color: '#0b3d91', match: /gramedia digital/i },
  { key: 'ruangguru', name: 'Ruangguru', domain: 'ruangguru.com', category: 'Belajar', price: 150000, cycle: 'bulanan', color: '#00a1e4', match: /ruang ?guru/i },
];

export const SUB_CATALOG_BY_KEY = new Map(SUB_CATALOG.map((c) => [c.key, c]));

/** Cocokkan teks transaksi ke layanan katalog (null kalau tidak ada). */
export const matchCatalog = (text: string): CatalogEntry | null => SUB_CATALOG.find((c) => c.match.test(text)) ?? null;
