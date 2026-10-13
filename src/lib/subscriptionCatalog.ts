// Katalog layanan langganan populer di Indonesia untuk form "Tambah langganan".
// Harga = perkiraan paket umum per periode (user selalu bisa mengubahnya) —
// bukan data resmi penyedia. `domain` dipakai untuk logo (logo.dev / favicon).

export type ServiceCategory =
  | 'Streaming'
  | 'Musik'
  | 'Game'
  | 'AI'
  | 'Produktivitas'
  | 'Penyimpanan cloud'
  | 'Pendidikan'
  | 'Pulsa & internet'
  | 'Tagihan rumah'
  | 'Kesehatan'
  | 'Kebugaran'
  | 'Berita'
  | 'Lainnya';

export const SERVICE_CATEGORIES: { id: ServiceCategory; emoji: string; expense: string }[] = [
  { id: 'Streaming', emoji: '📺', expense: 'Hiburan' },
  { id: 'Musik', emoji: '🎧', expense: 'Hiburan' },
  { id: 'Game', emoji: '🎮', expense: 'Hiburan' },
  { id: 'AI', emoji: '✨', expense: 'Langganan' },
  { id: 'Produktivitas', emoji: '🗂️', expense: 'Langganan' },
  { id: 'Penyimpanan cloud', emoji: '☁️', expense: 'Langganan' },
  { id: 'Pendidikan', emoji: '🎓', expense: 'Pendidikan' },
  { id: 'Pulsa & internet', emoji: '📶', expense: 'Tagihan' },
  { id: 'Tagihan rumah', emoji: '🏠', expense: 'Tagihan' },
  { id: 'Kesehatan', emoji: '🩺', expense: 'Kesehatan' },
  { id: 'Kebugaran', emoji: '🏋️', expense: 'Kesehatan' },
  { id: 'Berita', emoji: '📰', expense: 'Langganan' },
  { id: 'Lainnya', emoji: '🔁', expense: 'Langganan' },
];

export type BillingInterval = 'Mingguan' | 'Bulanan' | '3 Bulanan' | 'Tahunan';

export interface CatalogService {
  id: string;
  name: string;
  category: ServiceCategory;
  price: number;
  interval?: BillingInterval;
  domain?: string;
  color: string;
}

// Urutan = urutan tampil; 12 pertama jadi daftar "Populer".
export const SERVICES: CatalogService[] = [
  { id: 'netflix', name: 'Netflix', category: 'Streaming', price: 120000, domain: 'netflix.com', color: '#E50914' },
  { id: 'spotify', name: 'Spotify', category: 'Musik', price: 59990, domain: 'spotify.com', color: '#1DB954' },
  { id: 'youtube-premium', name: 'YouTube Premium', category: 'Streaming', price: 69000, domain: 'youtube.com', color: '#FF0000' },
  { id: 'disney-plus', name: 'Disney+ Hotstar', category: 'Streaming', price: 65000, domain: 'hotstar.com', color: '#0E3C8C' },
  { id: 'vidio', name: 'Vidio', category: 'Streaming', price: 49000, domain: 'vidio.com', color: '#E4202E' },
  { id: 'chatgpt', name: 'ChatGPT Plus', category: 'AI', price: 340000, domain: 'chatgpt.com', color: '#10A37F' },
  { id: 'google-one', name: 'Google One', category: 'Penyimpanan cloud', price: 32000, domain: 'one.google.com', color: '#4285F4' },
  { id: 'icloud', name: 'iCloud+', category: 'Penyimpanan cloud', price: 15000, domain: 'icloud.com', color: '#3693F3' },
  { id: 'canva', name: 'Canva Pro', category: 'Produktivitas', price: 95000, domain: 'canva.com', color: '#00C4CC' },
  { id: 'indihome', name: 'IndiHome', category: 'Pulsa & internet', price: 350000, domain: 'indihome.co.id', color: '#E2001A' },
  { id: 'telkomsel', name: 'Telkomsel', category: 'Pulsa & internet', price: 100000, domain: 'telkomsel.com', color: '#EC1C24' },
  { id: 'pln', name: 'PLN (listrik)', category: 'Tagihan rumah', price: 300000, domain: 'pln.co.id', color: '#0072BC' },
  { id: 'viu', name: 'Viu', category: 'Streaming', price: 30000, domain: 'viu.com', color: '#F5B400' },
  { id: 'prime-video', name: 'Prime Video', category: 'Streaming', price: 59000, domain: 'primevideo.com', color: '#00A8E1' },
  { id: 'hbo-max', name: 'HBO Max', category: 'Streaming', price: 59000, domain: 'max.com', color: '#5822B4' },
  { id: 'wetv', name: 'WeTV', category: 'Streaming', price: 39000, domain: 'wetv.vip', color: '#FF6A00' },
  { id: 'apple-music', name: 'Apple Music', category: 'Musik', price: 69000, domain: 'music.apple.com', color: '#FA2D48' },
  { id: 'youtube-music', name: 'YouTube Music', category: 'Musik', price: 59000, domain: 'music.youtube.com', color: '#FF0000' },
  { id: 'joox', name: 'JOOX VIP', category: 'Musik', price: 49000, domain: 'joox.com', color: '#3CD070' },
  { id: 'claude', name: 'Claude Pro', category: 'AI', price: 340000, domain: 'claude.ai', color: '#D97757' },
  { id: 'gemini', name: 'Google AI Pro', category: 'AI', price: 309000, domain: 'gemini.google.com', color: '#1A73E8' },
  { id: 'microsoft-365', name: 'Microsoft 365', category: 'Produktivitas', price: 135000, domain: 'microsoft.com', color: '#D83B01' },
  { id: 'notion', name: 'Notion Plus', category: 'Produktivitas', price: 160000, domain: 'notion.so', color: '#111111' },
  { id: 'adobe', name: 'Adobe Creative Cloud', category: 'Produktivitas', price: 300000, domain: 'adobe.com', color: '#FA0F00' },
  { id: 'capcut', name: 'CapCut Pro', category: 'Produktivitas', price: 140000, domain: 'capcut.com', color: '#111111' },
  { id: 'dropbox', name: 'Dropbox', category: 'Penyimpanan cloud', price: 180000, domain: 'dropbox.com', color: '#0061FF' },
  { id: 'duolingo', name: 'Duolingo Super', category: 'Pendidikan', price: 90000, domain: 'duolingo.com', color: '#58CC02' },
  { id: 'ruangguru', name: 'Ruangguru', category: 'Pendidikan', price: 150000, domain: 'ruangguru.com', color: '#13A1DC' },
  { id: 'xbox', name: 'Xbox Game Pass', category: 'Game', price: 119000, domain: 'xbox.com', color: '#107C10' },
  { id: 'playstation', name: 'PlayStation Plus', category: 'Game', price: 129000, domain: 'playstation.com', color: '#003791' },
  { id: 'xl', name: 'XL', category: 'Pulsa & internet', price: 100000, domain: 'xl.co.id', color: '#0057A8' },
  { id: 'indosat', name: 'IM3 / Indosat', category: 'Pulsa & internet', price: 100000, domain: 'ioh.co.id', color: '#FFCC00' },
  { id: 'smartfren', name: 'Smartfren', category: 'Pulsa & internet', price: 100000, domain: 'smartfren.com', color: '#E4007F' },
  { id: 'biznet', name: 'Biznet', category: 'Pulsa & internet', price: 375000, domain: 'biznetnetworks.com', color: '#283C8C' },
  { id: 'first-media', name: 'First Media', category: 'Pulsa & internet', price: 400000, domain: 'firstmedia.com', color: '#E31E24' },
  { id: 'myrepublic', name: 'MyRepublic', category: 'Pulsa & internet', price: 300000, domain: 'myrepublic.co.id', color: '#6B2C91' },
  { id: 'pdam', name: 'Air PDAM', category: 'Tagihan rumah', price: 100000, color: '#1E88E5' },
  { id: 'bpjs', name: 'BPJS Kesehatan', category: 'Kesehatan', price: 150000, domain: 'bpjs-kesehatan.go.id', color: '#00A651' },
  { id: 'gym', name: 'Gym / fitness', category: 'Kebugaran', price: 300000, color: '#F97316' },
  { id: 'kompas', name: 'Kompas.id', category: 'Berita', price: 50000, domain: 'kompas.id', color: '#0B4EA2' },
];

export const POPULAR_COUNT = 12;
export const serviceById = (id?: string | null) => (id ? SERVICES.find((s) => s.id === id) : undefined);
export const serviceCategoryOf = (id?: string | null) => SERVICE_CATEGORIES.find((c) => c.id === id) ?? SERVICE_CATEGORIES[SERVICE_CATEGORIES.length - 1];

// Lewat Worker (/api/logo) supaya memakai token logo.dev server.
export const serviceLogoUrl = (domain?: string) => (domain ? `/api/logo/${domain}` : null);

export const INTERVAL_LABEL: Record<string, string> = {
  Harian: 'per hari',
  Mingguan: 'per minggu',
  Bulanan: 'per bulan',
  '3 Bulanan': 'per 3 bulan',
  Tahunan: 'per tahun',
};

// Kata kunci yang biasa muncul di catatan/mutasi untuk tiap layanan (huruf
// kecil). Dipakai "Cek langganan" untuk mengenali pembayaran ke platform.
const SERVICE_ALIASES: Record<string, string[]> = {
  netflix: ['netflix'],
  spotify: ['spotify'],
  'youtube-premium': ['youtube premium', 'yt premium', 'youtube'],
  'disney-plus': ['disney', 'hotstar'],
  vidio: ['vidio'],
  chatgpt: ['chatgpt', 'openai'],
  'google-one': ['google one', 'google storage'],
  icloud: ['icloud'],
  canva: ['canva'],
  indihome: ['indihome'],
  telkomsel: ['telkomsel', 'simpati', 'kartu halo'],
  pln: ['pln', 'token listrik', 'listrik'],
  viu: ['viu'],
  'prime-video': ['prime video', 'amazon prime'],
  'hbo-max': ['hbo'],
  wetv: ['wetv'],
  'apple-music': ['apple music'],
  'youtube-music': ['youtube music'],
  joox: ['joox'],
  claude: ['claude', 'anthropic'],
  gemini: ['gemini', 'google ai'],
  'microsoft-365': ['microsoft 365', 'office 365'],
  notion: ['notion'],
  adobe: ['adobe'],
  capcut: ['capcut'],
  dropbox: ['dropbox'],
  duolingo: ['duolingo'],
  ruangguru: ['ruangguru'],
  xbox: ['xbox', 'game pass'],
  playstation: ['playstation', 'psn', 'ps plus'],
  xl: ['xl axiata', 'paket xl', 'pulsa xl'],
  indosat: ['indosat', 'im3'],
  smartfren: ['smartfren'],
  biznet: ['biznet'],
  'first-media': ['first media', 'firstmedia'],
  myrepublic: ['myrepublic'],
  pdam: ['pdam'],
  bpjs: ['bpjs'],
  gym: ['gym', 'fitness'],
  kompas: ['kompas'],
};
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Semua (layanan, alias), alias terpanjang dulu: "youtube music" harus jadi
// YouTube Music, bukan YouTube Premium (alias "youtube").
const ALIASES = SERVICES.flatMap((s) => (SERVICE_ALIASES[s.id] ?? [s.name.toLowerCase()]).map((a) => ({ s, re: new RegExp(`(^|[^a-z0-9])${escapeRe(a)}([^a-z0-9]|$)`), len: a.length })))
  .sort((a, b) => b.len - a.len);

export const matchService = (text: string): CatalogService | undefined => {
  const t = text.toLowerCase();
  return ALIASES.find(({ re }) => re.test(t))?.s;
};
