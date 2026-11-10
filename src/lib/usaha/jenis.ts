import type { ShopChannels } from '@/lib/services/shopService';

// Jenis toko Usahaku (= SHOP_KINDS di Worker). Daftar ini TERBUKA: jenis baru cukup tambah satu entri
// (nama, emoji, contoh, jalur jualan bawaan, dipakai stok?) — alur kasir tidak berubah.
// Keputusan Bos 2026-11-10: docs/rancangan/usahaku-pembukuan.md bagian 2.
export type ShopKind = {
  id: string;
  label: string;
  emoji: string;
  contoh: string;
  /** Jalur jualan yang dinyalakan saat jenis ini dipilih (bisa diubah di Pengaturan). */
  channels: ShopChannels;
  /** Tampilkan tab Stok bahan/barang. */
  stok: boolean;
  /** Petunjuk singkat di Beranda. */
  tip: string;
};

export const SHOP_KINDS: ShopKind[] = [
  {
    id: 'kuliner',
    label: 'Kuliner',
    emoji: '🍜',
    contoh: 'Warung makan, kafe, kedai minuman, katering',
    channels: { langsung: ['Offline', 'WhatsApp', 'Instagram'], marketplace: ['GoFood', 'GrabFood', 'ShopeeFood'] },
    stok: true,
    tip: 'Isi resep di Stok supaya bahan berkurang otomatis tiap ada penjualan.',
  },
  {
    id: 'online',
    label: 'Online shop',
    emoji: '🛍️',
    contoh: 'Fashion, skincare, aksesoris, gadget',
    channels: { langsung: ['Instagram', 'WhatsApp', 'TikTok', 'Offline'], marketplace: ['Shopee', 'Tokopedia', 'TikTok Shop', 'Lazada'] },
    stok: true,
    tip: 'Jualan marketplace: isi biaya admin di kasir, lalu tandai "sudah cair" saat dananya masuk.',
  },
  {
    id: 'kelontong',
    label: 'Kelontong / sembako',
    emoji: '🏪',
    contoh: 'Warung sembako, toko grosir',
    channels: { langsung: ['Offline', 'WhatsApp'], marketplace: [] },
    stok: true,
    tip: 'Pakai harga reseller untuk pembeli grosir.',
  },
  {
    id: 'jasa',
    label: 'Jasa',
    emoji: '✂️',
    contoh: 'Laundry, salon/barber, bengkel, servis HP',
    channels: { langsung: ['Offline', 'WhatsApp'], marketplace: [] },
    stok: false,
    tip: 'Isi katalog dengan tarif jasa, mis. "Cuci kiloan" per kg.',
  },
  {
    id: 'kue',
    label: 'Kue & pesanan rumahan',
    emoji: '🎂',
    contoh: 'Kue, frozen food, hampers, catering rumahan',
    channels: { langsung: ['WhatsApp', 'Instagram', 'Offline'], marketplace: ['Shopee', 'GoFood'] },
    stok: true,
    tip: 'Catat pembelian bahan sebagai biaya — stok bahan ikut bertambah.',
  },
  {
    id: 'topup',
    label: 'Top up game & produk digital',
    emoji: '🎮',
    contoh: 'Top up game, pulsa/kuota, token listrik, voucher, PPOB',
    channels: { langsung: ['WhatsApp', 'Website', 'Offline'], marketplace: ['Shopee', 'Tokopedia', 'itemku'] },
    stok: false,
    tip: 'Buat kas "Deposit supplier" — isi saldo deposit lewat Pindah kas, belanja ke supplier sebagai biaya.',
  },
  {
    id: 'dropship',
    label: 'Dropship / reseller',
    emoji: '🔁',
    contoh: 'Jual produk orang lain tanpa stok',
    channels: { langsung: ['Instagram', 'WhatsApp', 'TikTok'], marketplace: ['Shopee', 'Tokopedia', 'TikTok Shop'] },
    stok: false,
    tip: 'Bayar ke supplier dicatat sebagai biaya "Bahan & Stok".',
  },
  {
    id: 'fotokopi',
    label: 'Fotokopi & ATK',
    emoji: '🖨️',
    contoh: 'Fotokopi, print, alat tulis',
    channels: { langsung: ['Offline', 'WhatsApp'], marketplace: [] },
    stok: true,
    tip: 'Kertas & tinta bisa dicatat di Stok.',
  },
  {
    id: 'sewa',
    label: 'Sewa & rental',
    emoji: '🏠',
    contoh: 'Kos-kosan, rental motor/mobil, sewa kamera/alat',
    channels: { langsung: ['Offline', 'WhatsApp', 'Instagram'], marketplace: [] },
    stok: false,
    tip: 'Isi katalog dengan tarif per hari/bulan; nama penyewa di kolom pembeli.',
  },
  {
    id: 'tani',
    label: 'Pertanian & peternakan',
    emoji: '🌾',
    contoh: 'Kebun, ternak ayam/ikan',
    channels: { langsung: ['Offline', 'WhatsApp'], marketplace: [] },
    stok: true,
    tip: 'Pakan & pupuk dicatat sebagai biaya; hasil panen sebagai penjualan.',
  },
  {
    id: 'freelance',
    label: 'Freelance & jasa online',
    emoji: '💻',
    contoh: 'Desain, editing, jasa digital',
    channels: { langsung: ['Transfer klien', 'WhatsApp'], marketplace: ['Fiverr', 'Upwork', 'Fastwork'] },
    stok: false,
    tip: 'Nama klien di kolom pembeli; potongan platform di biaya marketplace.',
  },
  {
    id: 'lainnya',
    label: 'Lainnya / umum',
    emoji: '📦',
    contoh: 'Usaha campuran',
    channels: { langsung: ['Offline', 'WhatsApp', 'Instagram'], marketplace: ['Shopee', 'Tokopedia'] },
    stok: true,
    tip: 'Atur jalur jualan & kas usaha di ⚙️ Pengaturan.',
  },
];
export const kindOf = (id?: string | null) => SHOP_KINDS.find((k) => k.id === id) ?? null;

/** Pilihan jalur yang bisa ditambahkan di Pengaturan. */
export const CHANNEL_SUGGEST: ShopChannels = {
  langsung: ['Offline', 'WhatsApp', 'Instagram', 'TikTok', 'Facebook', 'Website', 'Telepon', 'Transfer klien'],
  marketplace: ['Shopee', 'Tokopedia', 'TikTok Shop', 'Lazada', 'Blibli', 'GoFood', 'GrabFood', 'ShopeeFood', 'itemku'],
};

export const PAY_METHODS = [
  { id: 'tunai', label: 'Tunai' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'qris', label: 'QRIS' },
  { id: 'cod', label: 'COD' },
  { id: 'lainnya', label: 'Lainnya' },
] as const;
export const payLabel = (id?: string | null) => PAY_METHODS.find((p) => p.id === id)?.label ?? '';

/** Tombol cepat biaya marketplace — hanya mengisi NAMA biaya; nominal diketik sendiri. */
export const FEE_CHIPS = ['Biaya admin', 'Biaya layanan', 'Ongkir', 'Voucher toko', 'Komisi affiliate', 'Biaya lainnya'];

export const ACCOUNT_KINDS = [
  { id: 'kas', label: 'Kas tunai', emoji: '💵' },
  { id: 'bank', label: 'Rekening bank', emoji: '🏦' },
  { id: 'ewallet', label: 'E-wallet / QRIS', emoji: '📱' },
  { id: 'marketplace', label: 'Saldo marketplace', emoji: '🛒' },
  { id: 'deposit', label: 'Deposit supplier', emoji: '🎮' },
] as const;
export const accountEmoji = (kind: string) => ACCOUNT_KINDS.find((k) => k.id === kind)?.emoji ?? '💵';

/** Jalur aktif toko: yang tersimpan, atau bawaan jenis toko, atau umum. */
export const channelsOf = (shop: { kind?: string; channels: ShopChannels }): ShopChannels => {
  if (shop.channels.langsung.length || shop.channels.marketplace.length) return shop.channels;
  return kindOf(shop.kind)?.channels ?? { langsung: ['Offline', 'WhatsApp', 'Instagram'], marketplace: [] };
};
