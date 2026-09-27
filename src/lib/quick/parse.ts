// Parser lokal "ketik pintar" untuk Input Cepat — instan, tanpa AI/jaringan.
// Mengubah teks bebas seperti "25rb kopi bca kemarin" atau transkrip suara
// "gajian lima juta ke BCA" menjadi draf transaksi. Semua field opsional:
// yang tidak dikenali dibiarkan kosong, form yang melengkapi.

export type QuickType = 'pengeluaran' | 'pemasukan';

export interface QuickDraft {
  type?: QuickType;
  amount?: number;
  accountId?: string;
  category?: string;
  subCategory?: string;
  note?: string;
  /** YYYY-MM-DD; undefined = hari ini. */
  date?: string;
}

export interface ParseContext {
  accounts: Array<{ id?: string; name: string }>;
  /** Pasangan kategori/sub-kategori milik user. */
  categories: Array<{ category: string; subCategory: string }>;
  /** Riwayat untuk menebak kategori dari kata kunci (paling baru dulu). */
  history: Array<{ type: string; category?: string; subCategory?: string; note?: string }>;
  today: string; // YYYY-MM-DD
}

const MULTIPLIERS: Record<string, number> = {
  rb: 1e3, ribu: 1e3, k: 1e3, rbu: 1e3,
  jt: 1e6, juta: 1e6, jta: 1e6,
  m: 1e9, miliar: 1e9, milyar: 1e9, M: 1e9,
};

// ---- Angka dalam kata ("lima puluh ribu", "seratus dua puluh lima ribu") ----
const UNITS: Record<string, number> = {
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9,
};
const FIXED: Record<string, number> = { sepuluh: 10, sebelas: 11, seratus: 100 };

/** Ganti deret kata bilangan Indonesia jadi angka, mis. "lima puluh ribu" → "50000". */
export const wordsToDigits = (text: string) => {
  const out: string[] = [];
  let total = 0; // bagian yang sudah dikali ribu/juta
  let current = 0; // bagian < 1000 yang sedang dibangun
  let lastUnit = 0; // satuan terakhir (1–9), dikali oleh puluh/ratus/belas
  let active = false;
  const flush = () => {
    if (active) out.push(String(total + current));
    total = 0; current = 0; lastUnit = 0; active = false;
  };
  for (const raw of text.split(/\s+/)) {
    const t = raw.toLowerCase().replace(/[.,!?]$/, '');
    if (t in UNITS) { lastUnit = UNITS[t]; current += lastUnit; active = true; }
    else if (t in FIXED) { current += FIXED[t]; lastUnit = 0; active = true; }
    else if (t === 'seribu') { total += 1000; lastUnit = 0; active = true; }
    else if (active && t === 'belas') { current += 10; lastUnit = 0; }
    else if (active && t === 'puluh') { current += lastUnit * 9; lastUnit = 0; }
    else if (active && t === 'ratus') { current += lastUnit * 99; lastUnit = 0; }
    else if (active && (t === 'ribu' || t === 'rb')) { total += (current || 1) * 1e3; current = 0; lastUnit = 0; }
    else if (active && t === 'juta') { total += (current || 1) * 1e6; current = 0; lastUnit = 0; }
    else { flush(); out.push(raw); }
  }
  flush();
  return out.join(' ');
};

/** Nominal dari teks: "25rb", "1,5jt", "25.000", "Rp 25000", "4.5" (desimal USD). */
export const parseAmount = (text: string): { value: number; match: string } | null => {
  const re = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(rb|rbu|ribu|k|jt|jta|juta|miliar|milyar|m)?\b/gi;
  let best: { value: number; match: string; suffixed: boolean } | null = null;
  for (const m of text.matchAll(re)) {
    const num = m[1];
    const suffix = m[2]?.toLowerCase();
    let value: number;
    if (suffix) {
      value = Number(num.replace(',', '.').replace(/\.(?=.*\.)/g, '')) * (MULTIPLIERS[suffix] ?? 1);
    } else if (/^\d{1,3}([.,]\d{3})+$/.test(num)) {
      value = Number(num.replace(/[.,]/g, '')); // 25.000 / 1,250,000 = pemisah ribuan
    } else {
      value = Number(num.replace(',', '.')); // 4.5 / 4,5 = desimal
    }
    if (!Number.isFinite(value) || value <= 0) continue;
    const suffixed = Boolean(suffix);
    // Utamakan angka bersatuan (rb/jt); kalau sama-sama tanpa satuan, ambil terbesar
    // (hindari "2" dari "2 hari lalu" mengalahkan "25000").
    if (!best || (suffixed && !best.suffixed) || (suffixed === best.suffixed && value > best.value)) {
      best = { value: Math.round(value * 100) / 100, match: m[0], suffixed };
    }
  }
  return best ? { value: best.value, match: best.match } : null;
};

const shiftDate = (today: string, days: number) => {
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - days));
  return dt.toISOString().slice(0, 10);
};

/** "kemarin", "kemarin lusa", "3 hari lalu", "tadi", "hari ini". */
export const parseDate = (text: string, today: string): { date?: string; match?: string } => {
  const t = text.toLowerCase();
  const nAgo = /(\d+)\s*hari\s*(?:yang\s*)?(?:lalu|kemarin)/.exec(t);
  if (nAgo) return { date: shiftDate(today, Math.min(60, Number(nAgo[1]))), match: nAgo[0] };
  const lusa = /kemarin\s*lusa|kmrn\s*lusa/.exec(t);
  if (lusa) return { date: shiftDate(today, 2), match: lusa[0] };
  const kemarin = /\b(kemarin|kemaren|kmrn|kmarin)\b/.exec(t);
  if (kemarin) return { date: shiftDate(today, 1), match: kemarin[0] };
  const hariIni = /\b(hari ini|tadi pagi|tadi siang|tadi malam|tadi)\b/.exec(t);
  if (hariIni) return { match: hariIni[0] };
  return {};
};

const INCOME_WORDS = /\b(gaji|gajian|terima|diterima|nerima|dapat|dapet|masuk|pemasukan|bonus|thr|refund|cashback|dibayar|dibayarin|jual|jualan|untung|transferan|kiriman|dikasih|hadiah|bunga|dividen)\b/i;
const EXPENSE_WORDS = /\b(beli|bayar|belanja|jajan|keluar|pengeluaran|makan|isi|top ?up|langganan|sewa|cicil)\b/i;
const FILLER = /\b(pakai|pake|pk|via|lewat|dari|ke|di|untuk|buat|sama|dengan|dgn|yang|yg|dan|rp\.?)\b/gi;
const GENERIC_ACCOUNT_TOKENS = new Set(['bank', 'card', 'kartu', 'kredit', 'debit', 'akun', 'rekening', 'tabungan', 'wallet', 'usd', 'idr']);

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const hasWord = (haystack: string, needle: string) => ` ${haystack} `.includes(` ${needle} `);
// Cocok utuh, atau kata di teks berawalan nama itu ("gajian" → "Gaji"), min. 4 huruf.
const mentions = (haystack: string, name: string) =>
  hasWord(haystack, name) || (name.length >= 4 && !name.includes(' ') && haystack.split(' ').some((w) => w.startsWith(name)));

/** Rekening yang disebut: nama lengkap paling panjang, atau satu token khas yang hanya dimiliki satu rekening. */
export const matchAccount = (text: string, accounts: ParseContext['accounts']): { id: string; match: string } | null => {
  const t = norm(text);
  const full = accounts
    .filter((a) => a.id && norm(a.name) && hasWord(t, norm(a.name)))
    .sort((a, b) => norm(b.name).length - norm(a.name).length)[0];
  if (full?.id) return { id: full.id, match: full.name };
  for (const word of t.split(' ')) {
    if (word.length < 3 || GENERIC_ACCOUNT_TOKENS.has(word)) continue;
    const owners = accounts.filter((a) => a.id && norm(a.name).split(' ').includes(word));
    if (owners.length === 1) return { id: owners[0].id!, match: word };
  }
  return null;
};

/** Kategori dari kata di teks: nama sub-kategori/kategori milik user, lalu riwayat catatan. */
const matchCategory = (text: string, ctx: ParseContext, type?: QuickType) => {
  const t = norm(text);
  if (!t) return null;
  const subs = ctx.categories.flatMap((c) =>
    c.subCategory.split(',').map((s) => ({ category: c.category, subCategory: s.trim() })).filter((x) => x.subCategory)
  );
  const bySub = subs
    .filter((x) => norm(x.subCategory).length >= 3 && mentions(t, norm(x.subCategory)))
    .sort((a, b) => b.subCategory.length - a.subCategory.length)[0];
  if (bySub) return bySub;
  const byCat = ctx.categories
    .filter((c) => norm(c.category).length >= 3 && mentions(t, norm(c.category)))
    .sort((a, b) => b.category.length - a.category.length)[0];
  if (byCat) {
    const options = subs.filter((x) => x.category === byCat.category);
    return { category: byCat.category, subCategory: options.length === 1 ? options[0].subCategory : '' };
  }
  // Riwayat: transaksi terbaru yang catatannya memuat salah satu kata di teks.
  const words = t.split(' ').filter((w) => w.length >= 3);
  for (const h of ctx.history) {
    if (!h.category || (type && h.type !== type)) continue;
    const hay = norm(`${h.note ?? ''} ${h.subCategory ?? ''}`);
    if (words.some((w) => hasWord(hay, w))) return { category: h.category, subCategory: h.subCategory ?? '', type: h.type };
  }
  return null;
};

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const parseQuickText = (input: string, ctx: ParseContext): QuickDraft => {
  const draft: QuickDraft = {};
  let rest = wordsToDigits(input.trim());

  const amount = parseAmount(rest);
  if (amount) {
    draft.amount = amount.value;
    rest = rest.replace(amount.match, ' ');
  }
  const date = parseDate(rest, ctx.today);
  if (date.match) {
    if (date.date) draft.date = date.date;
    rest = rest.replace(new RegExp(date.match, 'i'), ' ');
  }
  const account = matchAccount(rest, ctx.accounts);
  if (account) {
    draft.accountId = account.id;
    rest = rest.replace(new RegExp(account.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
  }
  if (INCOME_WORDS.test(rest)) draft.type = 'pemasukan';
  else if (EXPENSE_WORDS.test(rest)) draft.type = 'pengeluaran';

  const cat = matchCategory(rest, ctx, draft.type);
  if (cat) {
    draft.category = cat.category;
    draft.subCategory = cat.subCategory || undefined;
    if (!draft.type && 'type' in cat && (cat.type === 'pemasukan' || cat.type === 'pengeluaran')) draft.type = cat.type;
  }

  const note = rest.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  if (note) draft.note = capitalize(note);
  return draft;
};
