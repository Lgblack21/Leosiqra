// Unduh ikon aplikasi resmi bank/e-wallet (HD) ke public/logos/<domain>.png saat
// deploy (dijalankan GitHub Actions sebelum `npm run build` — runner punya
// internet bebas; Worker Cloudflare ternyata gagal memanggil API Apple).
// Sumber: 1) API App Store (iTunes lookup/search, country=id), 2) halaman
// Google Play (og:image). Nama penerbit WAJIB cocok `seller` supaya tidak
// mengambil aplikasi orang lain. Tidak pernah menggagalkan build: domain yang
// gagal dilewati (LogoImage lalu jatuh ke /api/logo / huruf).
// Daftar domain = src/lib/indonesianBanks.ts (LOGO_DOMAINS) + src/lib/subscriptionCatalog.ts (Langgananku).
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'public', 'logos');
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36', 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8' };

// id = App Store ID (terverifikasi), term = nama aplikasi (boleh array) untuk pencarian,
// play = package Google Play (cadangan), seller = pola nama penerbit, app (opsional) =
// pola nama aplikasi — wajib cocok juga (penerbit sama bisa punya banyak aplikasi).
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
  { d: 'uob.co.id', term: ['UOB TMRW', 'TMRW by UOB', 'UOB Indonesia', 'UOB'], play: ['com.uob.tmrw.id', 'com.uob.id.tmrw', 'com.uob.mightyid'], seller: /uob|united overseas/i },
  { d: 'hsbc.co.id', term: 'HSBC Indonesia', play: ['com.hsbc.hsbcindonesia'], seller: /hsbc/i },
  { d: 'citibank.co.id', term: ['Citi Mobile', 'Citibank'], play: ['com.citibank.mobile.id'], seller: /citigroup|citibank/i },
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
  // Langgananku — WAJIB sama dengan domain di src/lib/subscriptionCatalog.ts
  { d: 'netflix.com', term: 'Netflix', play: ['com.netflix.mediaclient'], seller: /netflix/i },
  { d: 'disneyplus.com', term: ['Disney+ Hotstar', 'Disney+'], play: ['in.startv.hotstar.dplus'], seller: /disney|novi digital|star/i },
  { d: 'primevideo.com', term: 'Amazon Prime Video', play: ['com.amazon.avod.thirdpartyclient'], seller: /amazon/i },
  { d: 'max.com', term: ['HBO Max', 'Max: Stream HBO'], play: ['com.wbd.stream'], seller: /warner|wbd|hbo/i },
  { d: 'vidio.com', term: 'Vidio', play: ['com.vidio.android'], seller: /vidio|kmk|emtek/i },
  { d: 'viu.com', term: 'Viu', play: ['com.vuclip.viu'], seller: /viu|vuclip|pccw/i },
  { d: 'wetv.vip', term: 'WeTV', play: ['com.tencent.qqlivei18n'], seller: /tencent|image future/i },
  { d: 'iq.com', term: 'iQIYI', play: ['com.iqiyi.i18n'], seller: /iqiyi/i },
  { d: 'youtube.com', term: 'YouTube', play: ['com.google.android.youtube'], seller: /google/i },
  { d: 'spotify.com', term: 'Spotify', play: ['com.spotify.music'], seller: /spotify/i },
  { d: 'music.apple.com', term: 'Apple Music', play: ['com.apple.android.music'], seller: /apple/i },
  { d: 'joox.com', term: 'JOOX', play: ['com.tencent.ibg.joox'], seller: /tencent|joox/i },
  { d: 'one.google.com', term: 'Google One', play: ['com.google.android.apps.subscriptions.red'], seller: /google/i },
  { d: 'dropbox.com', term: 'Dropbox', play: ['com.dropbox.android'], seller: /dropbox/i },
  { d: 'openai.com', term: 'ChatGPT', play: ['com.openai.chatgpt'], seller: /openai/i },
  { d: 'claude.ai', term: 'Claude by Anthropic', play: ['com.anthropic.claude'], seller: /anthropic/i },
  { d: 'gemini.google.com', term: 'Google Gemini', play: ['com.google.android.apps.bard'], seller: /google/i },
  { d: 'canva.com', term: 'Canva', play: ['com.canva.editor'], seller: /canva/i },
  { d: 'microsoft.com', term: ['Microsoft 365 Copilot', 'Microsoft 365', 'Microsoft Office'], play: ['com.microsoft.office.officehubrow'], seller: /microsoft/i, app: /365|office/i },
  { d: 'adobe.com', term: ['Adobe Creative Cloud', 'Adobe Express'], play: ['com.adobe.creativeapps.gallery'], seller: /adobe/i, app: /creative cloud|express/i },
  { d: 'notion.so', term: 'Notion', play: ['notion.id'], seller: /notion/i },
  { d: 'zoom.us', term: 'Zoom Workplace', play: ['us.zoom.videomeetings'], seller: /zoom/i },
  { d: 'playstation.com', term: 'PlayStation App', play: ['com.scee.psxandroid'], seller: /sony|playstation/i },
  { d: 'xbox.com', term: 'Xbox', play: ['com.microsoft.xboxone.smartglass'], seller: /microsoft/i },
  { d: 'nintendo.com', term: 'Nintendo Switch Online', play: ['com.nintendo.znca'], seller: /nintendo/i, app: /switch online/i },
  { d: 'indihome.co.id', term: ['IndiHome', 'myIndiHome'], play: ['com.telkom.indihome.external'], seller: /telkom/i, app: /indihome/i },
  { d: 'biznethome.net', term: ['Biznet Home', 'MyBiznet'], play: [], seller: /biznet|supra/i },
  { d: 'firstmedia.com', term: ['MyFirstMedia', 'First Media'], play: [], seller: /link net|first media|linknet/i },
  { d: 'myrepublic.co.id', term: ['MyRepublic Indonesia', 'MyRepublic'], play: [], seller: /myrepublic|eka mas/i },
  { d: 'iconnet.id', term: ['ICONNET', 'iconnet PLN'], play: [], seller: /icon|pln/i, app: /iconnet/i },
  { d: 'telkomsel.com', term: 'MyTelkomsel', play: ['com.telkomsel.telkomselcm'], seller: /telkomsel/i },
  { d: 'xl.co.id', term: 'myXL', play: ['com.apps.MyXL'], seller: /xl/i },
  { d: 'im3.id', term: 'myIM3', play: ['com.pure.indosat.care'], seller: /indosat/i },
  { d: 'smartfren.com', term: ['MySF', 'mySmartfren'], play: [], seller: /smartfren/i },
  { d: 'tri.co.id', term: 'bima+', play: ['com.hutchison3g.bima'], seller: /hutchison|indosat|tri/i },
  { d: 'byu.id', term: ['by.U Telkomsel', 'byU', 'by.U'], play: ['com.telkomsel.byu', 'id.byu.android'], seller: /telkomsel/i, app: /by\.?u/i },
  { d: 'pln.co.id', term: 'PLN Mobile', play: ['com.icon.pln123'], seller: /pln|perusahaan listrik|icon/i },
  { d: 'bpjs-kesehatan.go.id', term: 'Mobile JKN', play: ['app.bpjs.mobile'], seller: /bpjs/i },
  { d: 'grab.com', term: 'Grab', play: ['com.grabtaxi.passenger'], seller: /grab/i },
  { d: 'shopee.co.id', term: 'Shopee', play: ['com.shopee.id'], seller: /shopee/i },
  { d: 'tokopedia.com', term: 'Tokopedia', play: ['com.tokopedia.tkpd'], seller: /tokopedia/i },
  { d: 'duolingo.com', term: 'Duolingo', play: ['com.duolingo'], seller: /duolingo/i },
  { d: 'gramedia.com', term: ['Gramedia Digital', 'Gramedia'], play: [], seller: /gramedia/i, app: /gramedia digital/i },
  { d: 'ruangguru.com', term: 'Ruangguru', play: ['com.ruangguru.livestudents'], seller: /ruang ?guru/i },
];

const get = async (url, as = 'json') => {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return as === 'json' ? res.json() : as === 'text' ? res.text() : Buffer.from(await res.arrayBuffer());
};

async function fromAppStore(s) {
  const urls = [
    ...(s.id ? [`https://itunes.apple.com/lookup?id=${s.id}&country=id`] : []),
    ...[s.term].flat().map((t) => `https://itunes.apple.com/search?term=${encodeURIComponent(t)}&country=id&entity=software&limit=10`),
  ];
  for (const u of urls) {
    try {
      const data = await get(u);
      const app = (data.results ?? []).find((a) => s.seller.test(`${a.sellerName ?? ''} ${a.artistName ?? ''}`) && (!s.app || s.app.test(a.trackName ?? '')));
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
console.log(`Logo bank & langganan: ${report.filter((r) => r.startsWith('OK')).length}/${SOURCES.length} berhasil`);
console.log(report.join('\n'));
