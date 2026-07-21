interface InstitutionEntry {
  domain: string;
  // Dicocokkan ke awal nama rekening (bukan substring bebas) supaya kata umum
  // Bahasa Indonesia (mis. "Dana Darurat", "Bank Mega Depan") tidak salah
  // ke-trigger jadi logo bank/e-wallet.
  aliases: string[];
}

const BANK_ENTRIES: InstitutionEntry[] = [
  { domain: 'bca.co.id', aliases: ['bca'] },
  { domain: 'bankmandiri.co.id', aliases: ['bank mandiri', 'mandiri'] },
  { domain: 'bri.co.id', aliases: ['bri'] },
  { domain: 'bni.co.id', aliases: ['bni'] },
  { domain: 'cimbniaga.co.id', aliases: ['cimb niaga', 'cimb'] },
  { domain: 'danamon.co.id', aliases: ['danamon'] },
  { domain: 'permatabank.com', aliases: ['permata'] },
  { domain: 'btpn.com', aliases: ['btpn'] },
  { domain: 'jenius.com', aliases: ['jenius'] },
  { domain: 'ocbcnisp.com', aliases: ['ocbc nisp', 'ocbc'] },
  { domain: 'maybank.co.id', aliases: ['maybank'] },
  { domain: 'bankmega.com', aliases: ['bank mega', 'mega'] },
  { domain: 'sinarmas.co.id', aliases: ['sinarmas'] },
  { domain: 'btn.co.id', aliases: ['btn'] },
  { domain: 'kbbukopin.co.id', aliases: ['bukopin', 'kb bank'] },
  { domain: 'panin.co.id', aliases: ['panin'] },
  { domain: 'bankbjb.co.id', aliases: ['bjb', 'bank jabar'] },
  { domain: 'jago.com', aliases: ['bank jago', 'jago'] },
  { domain: 'seabank.co.id', aliases: ['seabank', 'sea bank'] },
  { domain: 'allobank.com', aliases: ['allo bank', 'allobank'] },
  { domain: 'dbs.com', aliases: ['dbs', 'digibank'] },
  { domain: 'hsbc.co.id', aliases: ['hsbc'] },
  { domain: 'uob.co.id', aliases: ['uob'] },
  { domain: 'sc.com', aliases: ['standard chartered', 'stanchart'] },
  { domain: 'citibank.co.id', aliases: ['citibank', 'citi'] },
];

const EWALLET_ENTRIES: InstitutionEntry[] = [
  { domain: 'gojek.com', aliases: ['gopay'] },
  { domain: 'ovo.id', aliases: ['ovo'] },
  { domain: 'dana.id', aliases: ['dana'] },
  { domain: 'shopeepay.co.id', aliases: ['shopeepay', 'shopee pay'] },
  { domain: 'linkaja.id', aliases: ['linkaja', 'link aja'] },
  { domain: 'flip.id', aliases: ['flip'] },
];

const matchDomain = (accountName: string, entries: InstitutionEntry[]): string | null => {
  const q = accountName.trim().toLowerCase();
  if (!q) return null;
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      if (q === alias || q.startsWith(`${alias} `)) return entry.domain;
    }
  }
  return null;
};

// Bank/e-wallet luar Indonesia (mis. "ABA Khmer") sengaja tidak ada di daftar
// ini — tetap jatuh ke upload logo manual seperti biasa.
export function matchIndonesianInstitutionLogo(accountName: string, accountType: string): string | null {
  const entries = accountType === 'E-Wallet'
    ? EWALLET_ENTRIES
    : accountType === 'Bank Account' || accountType === 'Credit Card'
      ? BANK_ENTRIES
      : null;
  if (!entries) return null;

  const domain = matchDomain(accountName, entries);
  if (!domain) return null;

  // Token publishable logo.dev — aman tampil di bundle browser (memang dibuat
  // untuk dipasang langsung di <img src>). Tanpa token, Google favicon jadi
  // fallback (resolusi rendah/pecah kalau di-zoom, tapi tetap jalan).
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  if (token) {
    return `https://img.logo.dev/${domain}?token=${token}&size=128&format=png`;
  }
  return `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
}
