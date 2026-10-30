// Unduh ikon aplikasi resmi bank/e-wallet (HD) ke public/logos/<domain>.png saat
// deploy (dijalankan GitHub Actions sebelum `npm run build` — runner punya
// internet bebas; Worker Cloudflare ternyata gagal memanggil API Apple).
// Sumber: 1) API App Store (iTunes lookup/search, country=id), 2) halaman
// Google Play (og:image). Nama penerbit WAJIB cocok `seller` supaya tidak
// mengambil aplikasi orang lain. Tidak pernah menggagalkan build: domain yang
// gagal dilewati (LogoImage lalu jatuh ke /api/logo / huruf).
// Daftar domain = src/lib/indonesianBanks.ts (LOGO_DOMAINS).
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'public', 'logos');
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36', 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8' };

// id = App Store ID (terverifikasi), term = nama aplikasi untuk pencarian,
// play = package Google Play (cadangan), seller = pola nama penerbit.
const SOURCES = [
  { d: 'bca.co.id', term: 'BCA mobile', play: ['com.bca'], seller: /central asia/i },
  { d: 'bankmandiri.co.id', id: 1555414743, term: "Livin' by Mandiri", play: ['id.bmri.livin'], seller: /mandiri/i },
  { d: 'bri.co.id', id: 1439730817, term: 'BRImo BRI', play: ['id.co.bri.brimo'], seller: /rakyat indonesia/i },
  { d: 'bni.co.id', id: 6499518320, term: 'wondr by BNI', play: ['id.bni.wondr'], seller: /negara indonesia/i },
  { d: 'bankbsi.co.id', id: 1410072458, term: 'BYOND by BSI', play: ['co.id.bankbsi.superapp', 'com.bsm.activity2'], seller: /syariah indonesia/i },
  { d: 'btn.co.id', id: 6443466424, term: 'bale by BTN', play: ['id.co.btn.mobilebanking.android'], seller: /tabungan negara/i },
  { d: 'cimbniaga.co.id', id: 505917174, term: 'OCTO by CIMB Niaga', play: ['id.co.cimbniaga.mobile.android'], seller: /cimb/i },
  { d: 'permatabank.com', term: 'PermataMobile X', play: ['net.myinfosys.PermataMobileX'], seller: /permata/i },
  { d: 'danamon.co.id', term: 'D-Bank PRO', play: ['com.danamon.dbank', 'id.co.danamon.dbankpro'], seller: /danamon/i },
  { d: 'ocbc.id', term: 'OCBC mobile', play: ['com.ocbcnisp.onemobileapp'], seller: /ocbc/i },
  { d: 'jago.com', term: 'Jago', play: ['com.jago.digitalBanking'], seller: /jago/i },
  { d: 'jenius.com', term: 'Jenius', play: ['com.btpn.dc'], seller: /btpn|smbc/i },
  { d: 'btpn.com', term: 'Jenius', play: ['com.btpn.dc'], seller: /btpn|smbc/i },
  { d: 'seabank.co.id', term: 'SeaBank', play: ['id.co.bankbkemobile.digitalbank'], seller: /seabank|bke|sea /i },
  { d: 'blubybcadigital.id', term: 'blu by BCA Digital', play: ['com.bcadigital.blu'], seller: /bca digital/i },
  { d: 'allobank.com', term: 'Allo Bank', play: ['com.alloapp.yump'], seller: /allo/i },
  { d: 'krom.id', term: 'Krom', play: ['id.krom.app'], seller: /krom|bisnis internasional/i },
  { d: 'maybank.co.id', term: 'M2U ID', play: ['com.maybank2u.m2umobile.id'], seller: /maybank/i },
  { d: 'dbs.com', term: 'digibank by DBS', play: ['com.dbs.id.digibank'], seller: /dbs/i },
  { d: 'uob.co.id', term: 'TMRW Indonesia', play: ['com.uob.tmrw.id'], seller: /uob/i },
  { d: 'hsbc.co.id', term: 'HSBC Indonesia', play: ['com.hsbc.hsbcindonesia'], seller: /hsbc/i },
  { d: 'citibank.co.id', term: 'Citi Mobile Indonesia', play: [], seller: /citi/i },
  { d: 'sc.com', term: 'SC Mobile Indonesia', play: ['com.scb.breezebanking.id'], seller: /standard chartered/i },
  { d: 'bankmega.com', term: 'M-Smile', play: ['id.co.bankmega.msmile'], seller: /mega/i },
  { d: 'sinarmas.co.id', term: 'SimobiPlus', play: ['com.simas.mobile.SimobiPlus'], seller: /sinarmas/i },
  { d: 'panin.co.id', term: 'Panin Mobile', play: [], seller: /panin/i },
  { d: 'bankbjb.co.id', term: 'DIGI by bjb', play: ['com.bjb.digi'], seller: /bjb|jawa barat/i },
  { d: 'kbbukopin.co.id', term: 'KBstar', play: [], seller: /kb |bukopin/i },
  { d: 'gojek.com', term: 'GoPay', play: ['com.gojek.gopay'], seller: /gojek|gopay|goto/i },
  { d: 'ovo.id', term: 'OVO', play: ['ovo.id'], seller: /ovo|visionet/i },
  { d: 'dana.id', term: 'DANA', play: ['id.dana'], seller: /dana|espay/i },
  { d: 'shopeepay.co.id', term: 'Shopee', play: ['com.shopee.id'], seller: /shopee/i },
  { d: 'linkaja.id', term: 'LinkAja', play: ['com.telkom.mwallet'], seller: /linkaja|fintek karya/i },
  { d: 'flip.id', term: 'Flip', play: ['id.flip'], seller: /flip/i },
  { d: 'paypal.com', term: 'PayPal', play: ['com.paypal.android.p2pmobile'], seller: /paypal/i },
  { d: 'wise.com', term: 'Wise', play: ['com.transferwise.android'], seller: /wise/i },
  { d: 'revolut.com', term: 'Revolut', play: ['com.revolut.revolut'], seller: /revolut/i },
];

const get = async (url, as = 'json') => {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return as === 'json' ? res.json() : as === 'text' ? res.text() : Buffer.from(await res.arrayBuffer());
};

async function fromAppStore(s) {
  const urls = [
    ...(s.id ? [`https://itunes.apple.com/lookup?id=${s.id}&country=id`] : []),
    `https://itunes.apple.com/search?term=${encodeURIComponent(s.term)}&country=id&entity=software&limit=10`,
  ];
  for (const u of urls) {
    try {
      const data = await get(u);
      const app = (data.results ?? []).find((a) => s.seller.test(`${a.sellerName ?? ''} ${a.artistName ?? ''}`));
      const art = app?.artworkUrl512 ?? app?.artworkUrl100;
      if (art) return { url: art.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/256x256bb.png'), via: `appstore ${app.trackName}` };
    } catch { /* coba berikutnya */ }
  }
  return null;
}

async function fromPlay(s) {
  for (const pkg of s.play ?? []) {
    try {
      const html = await get(`https://play.google.com/store/apps/details?id=${pkg}&hl=id&gl=ID`, 'text');
      const img = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
      if (img && s.seller.test(html)) return { url: `${img.replace(/=[^/]*$/, '')}=s256`, via: `play ${pkg}` };
    } catch { /* coba berikutnya */ }
  }
  return null;
}

await mkdir(OUT, { recursive: true });
const report = [];
await Promise.all(SOURCES.map(async (s) => {
  try {
    const src = (await fromAppStore(s)) ?? (await fromPlay(s));
    if (!src) { report.push(`GAGAL  ${s.d}`); return; }
    const buf = await get(src.url, 'buffer');
    if (buf.length < 1500) { report.push(`GAGAL  ${s.d} (gambar terlalu kecil)`); return; }
    await writeFile(path.join(OUT, `${s.d}.png`), buf);
    report.push(`OK     ${s.d} ← ${src.via} (${Math.round(buf.length / 1024)} KB)`);
  } catch (e) {
    report.push(`GAGAL  ${s.d} (${e instanceof Error ? e.message : e})`);
  }
}));
report.sort();
console.log(`Logo bank: ${report.filter((r) => r.startsWith('OK')).length}/${SOURCES.length} berhasil`);
console.log(report.join('\n'));
