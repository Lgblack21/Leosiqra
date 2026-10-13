interface InstitutionEntry {
  domain: string;
  // Dicocokkan ke awal nama rekening (bukan substring bebas) supaya kata umum
  // Bahasa Indonesia (mis. "Dana Darurat", "Bank Mega Depan") tidak salah
  // ke-trigger jadi logo bank/e-wallet.
  aliases: string[];
}

const BANK_ENTRIES: InstitutionEntry[] = [
  // Alias yang lebih spesifik harus di atas ("bca syariah" sebelum "bca").
  { domain: 'bcasyariah.co.id', aliases: ['bca syariah'] },
  { domain: 'blubybcadigital.id', aliases: ['blu by bca', 'blu'] },
  { domain: 'megasyariah.co.id', aliases: ['bank mega syariah', 'mega syariah'] },
  { domain: 'bankmuamalat.co.id', aliases: ['bank muamalat', 'muamalat'] },
  { domain: 'bankraya.co.id', aliases: ['bank raya', 'raya'] },
  { domain: 'bankneocommerce.co.id', aliases: ['bank neo commerce', 'neo commerce', 'bank neo', 'bnc'] },
  { domain: 'superbank.id', aliases: ['superbank'] },
  { domain: 'krom.id', aliases: ['krom'] },
  { domain: 'hibank.co.id', aliases: ['hibank'] },
  { domain: 'linebank.co.id', aliases: ['line bank', 'linebank'] },
  { domain: 'bankdki.co.id', aliases: ['bank dki', 'dki'] },
  { domain: 'bankjatim.co.id', aliases: ['bank jatim', 'jatim'] },
  { domain: 'bankjateng.co.id', aliases: ['bank jateng', 'jateng'] },
  { domain: 'banksumut.co.id', aliases: ['bank sumut', 'sumut'] },
  { domain: 'banknagari.co.id', aliases: ['bank nagari', 'nagari'] },
  { domain: 'bpdbali.co.id', aliases: ['bpd bali', 'bank bpd bali'] },
  { domain: 'bankaceh.co.id', aliases: ['bank aceh'] },
  { domain: 'bankkalbar.co.id', aliases: ['bank kalbar'] },
  { domain: 'banksulselbar.co.id', aliases: ['bank sulselbar'] },
  { domain: 'mncbank.co.id', aliases: ['mnc bank', 'mnc'] },
  { domain: 'bankmayapada.com', aliases: ['bank mayapada', 'mayapada'] },
  { domain: 'victoriabank.co.id', aliases: ['bank victoria', 'victoria'] },
  { domain: 'arthagraha.com', aliases: ['bank artha graha', 'artha graha'] },
  { domain: 'qnb.co.id', aliases: ['qnb'] },
  { domain: 'icbc.co.id', aliases: ['icbc'] },
  { domain: 'commbank.co.id', aliases: ['commonwealth', 'commbank'] },
  { domain: 'nobubank.com', aliases: ['nobu'] },
  { domain: 'banksampoerna.com', aliases: ['bank sampoerna', 'sahabat sampoerna'] },
  { domain: 'amarbank.co.id', aliases: ['amar bank', 'tunaiku'] },
  { domain: 'bankmantap.co.id', aliases: ['bank mantap', 'mandiri taspen'] },
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
  { domain: 'bankbsi.co.id', aliases: ['bsi', 'bank syariah indonesia'] },
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
  { domain: 'gopay.co.id', aliases: ['gopay'] },
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

  return institutionLogoUrl(domain);
}

// Semua domain yang logonya boleh diambil lewat /api/logo (allowlist Worker).
export const INSTITUTION_DOMAINS = [...BANK_ENTRIES, ...EWALLET_ENTRIES].map((e) => e.domain);

// Logo HD lewat Worker: /api/logo/<domain> → logo.dev memakai token server
// (LOGO_DEV_TOKEN), atau favicon Google kalau token belum dipasang. Token
// tidak perlu ikut build frontend.
export const institutionLogoUrl = (domain: string) => `/api/logo/${domain}`;

// Logo lama yang tersimpan sebagai favicon Google (resolusi rendah) di-upgrade
// ke /api/logo saat ditampilkan — data di database tidak diubah.
export const upgradeLogoUrl = (url?: string | null) => {
  if (!url) return url ?? undefined;
  const m = /^https:\/\/www\.google\.com\/s2\/favicons\?.*domain=([a-z0-9.-]+)/i.exec(url);
  return m ? institutionLogoUrl(m[1].toLowerCase()) : url;
};
