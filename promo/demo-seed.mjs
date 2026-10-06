// Akun demo untuk rekaman video promo: daftar + isi ±3 bulan data contoh yang
// realistis (karyawan muda di kota besar) lewat API member yang sama dengan
// aplikasi — saldo dihitung oleh Worker, bukan ditulis langsung ke DB.
//
//   node demo-seed.mjs                       → daftar (kalau belum) + isi data
//   node demo-seed.mjs --base https://…      → target lain (mis. wrangler dev lokal)
//
// Kredensial disimpan di promo/.demo.env (gitignore) — password dibuat acak di
// mesin ini dan tidak pernah dicetak. Pindahkan ke secret routine sebagai
// DEMO_EMAIL / DEMO_PASSWORD. Nama rekening sengaja generik (tanpa merek bank
// / e-wallet) karena akan tampil di video.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeRng } from "./plan.mjs";

const DIR = import.meta.dirname;
const ENV_FILE = join(DIR, ".demo.env");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const BASE = arg("--base") || process.env.DEMO_API_URL || "https://www.leosiqra.com";
const EMAIL = process.env.DEMO_EMAIL || "leowendry+demo@gmail.com";

const readEnv = () =>
  existsSync(ENV_FILE)
    ? Object.fromEntries(readFileSync(ENV_FILE, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]))
    : {};

let cookie = "";
const api = async (path, body, method = body ? "POST" : "GET") => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", origin: new URL(BASE).origin, cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};
const must = async (path, body, method) => {
  const r = await api(path, body, method);
  if (r.status >= 300) throw new Error(`${path} ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
  return r.data;
};

const ymd = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date(Date.now() + 7 * 3600e3); // tanggal WIB
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

const main = async () => {
  const env = readEnv();
  let password = process.env.DEMO_PASSWORD || env.DEMO_PASSWORD;
  if (!password) {
    password = randomBytes(18).toString("base64url");
    writeFileSync(ENV_FILE, `DEMO_EMAIL=${EMAIL}\nDEMO_PASSWORD=${password}\n`, { mode: 0o600 });
    console.log(`Password baru dibuat → ${ENV_FILE}`);
  }

  const reg = await api("/api/auth/register", { name: "Raka Pratama", email: EMAIL, password });
  if (reg.status === 201) console.log("Akun demo dibuat.");
  else if (reg.status === 409) {
    await must("/api/auth/login", { email: EMAIL, password });
    console.log("Akun demo sudah ada — login.");
  } else throw new Error(`register ${reg.status}: ${JSON.stringify(reg.data)}`);
  if (!cookie) throw new Error("tidak dapat cookie sesi");

  const existing = (await must("/api/member/accounts")).items ?? [];
  if (existing.length && !process.argv.includes("--force")) {
    console.log(`Sudah ada ${existing.length} rekening — data tidak diisi ulang (pakai --force kalau perlu).`);
    return;
  }

  // 1) Onboarding: profil + kategori bawaan + rekening pertama.
  const groups = [
    ["Makanan & Minuman", ["Makan", "Jajan & Kopi", "Belanja Dapur"]],
    ["Transportasi", ["Bensin", "Parkir & Tol", "Transportasi Online"]],
    ["Tagihan & Utilitas", ["Listrik", "Air", "Internet & Pulsa"]],
    ["Belanja", ["Pakaian", "Elektronik", "Rumah Tangga"]],
    ["Hiburan", ["Langganan", "Nonton & Musik", "Jalan-jalan"]],
    ["Kesehatan", ["Obat", "Dokter", "Olahraga"]],
    ["Pemasukan", ["Gaji", "Bonus", "Pendapatan Lain"]],
  ];
  await must("/api/member/onboarding", {
    name: "Raka Pratama",
    currency: { code: "IDR", name: "Rupiah", symbol: "Rp" },
    categories: groups.flatMap(([category, subs]) => subs.map((subCategory) => ({ category, subCategory }))),
    account: { name: "Dompet", type: "Cash", balance: 400000, logoLabel: "Dompet" },
  });
  for (const [name, type, balance] of [["Rekening Gaji", "Bank Account", 6000000], ["Dompet Digital", "E-Wallet", 300000]]) {
    await must("/api/member/accounts", { name, type, currency: "IDR", balance, initial_balance: balance });
  }
  const accounts = (await must("/api/member/accounts")).items;
  const acc = Object.fromEntries(accounts.map((a) => [a.name, a.id]));

  // 2) Transaksi 90 hari terakhir (RNG ber-seed → data sama tiap kali diisi).
  const rng = makeRng(20261006);
  const tx = [];
  const transfers = [];
  const add = (n, type, amount, category, sub, account, note) =>
    tx.push({ date: ymd(daysAgo(n)), type, amount: Math.round(amount / 500) * 500, category, sub_category: sub, account_id: acc[account], note });
  for (let n = 90; n >= 0; n--) {
    const d = daysAgo(n);
    const dom = d.getUTCDate();
    const weekend = [0, 6].includes(d.getUTCDay());
    if (dom === 25) add(n, "pemasukan", 6500000, "Pemasukan", "Gaji", "Rekening Gaji", "Gaji bulanan");
    if (dom === 1) add(n, "pengeluaran", 1500000, "Tagihan & Utilitas", "Listrik", "Rekening Gaji", "Kos + listrik");
    if (dom === 3) add(n, "pengeluaran", 350000, "Tagihan & Utilitas", "Internet & Pulsa", "Rekening Gaji", "Internet rumah");
    if (dom === 5) add(n, "pengeluaran", 54990, "Hiburan", "Langganan", "Dompet Digital", "Langganan streaming");
    if (dom === 26) add(n, "pengeluaran", 500000, "Transportasi", "Bensin", "Rekening Gaji", "Isi saldo e-money & bensin");
    // makan siang + kopi di hari kerja, makan di luar saat akhir pekan
    if (!weekend) add(n, "pengeluaran", rng.int(22, 38) * 1000, "Makanan & Minuman", "Makan", rng.next() < 0.6 ? "Dompet" : "Dompet Digital", rng.pick(["Makan siang", "Nasi padang", "Warteg", "Bakso"]));
    if (!weekend && rng.next() < 0.45) add(n, "pengeluaran", rng.pick([18, 22, 25, 28]) * 1000, "Makanan & Minuman", "Jajan & Kopi", "Dompet Digital", rng.pick(["Kopi susu", "Es kopi", "Teh susu"]));
    if (weekend && rng.next() < 0.7) add(n, "pengeluaran", rng.int(60, 180) * 1000, "Makanan & Minuman", "Makan", "Dompet Digital", rng.pick(["Makan malam bareng teman", "Pesan antar", "Sate & martabak"]));
    if (rng.next() < 0.3) add(n, "pengeluaran", rng.int(12, 35) * 1000, "Transportasi", "Transportasi Online", "Dompet Digital", "Ojek online");
    if (rng.next() < 0.12) add(n, "pengeluaran", rng.int(2, 10) * 1000, "Transportasi", "Parkir & Tol", "Dompet", "Parkir");
    if (dom % 7 === 2) add(n, "pengeluaran", rng.int(120, 260) * 1000, "Makanan & Minuman", "Belanja Dapur", "Rekening Gaji", "Belanja mingguan");
    if (rng.next() < 0.05) add(n, "pengeluaran", rng.int(150, 450) * 1000, "Belanja", rng.pick(["Pakaian", "Rumah Tangga"]), "Rekening Gaji", rng.pick(["Kaos & celana", "Perlengkapan kamar"]));
    if (rng.next() < 0.04) add(n, "pengeluaran", rng.int(50, 120) * 1000, "Hiburan", "Nonton & Musik", "Dompet Digital", "Nonton bioskop");
    if (dom === 12 || dom === 28) add(n, "pengeluaran", 75000, "Kesehatan", "Olahraga", "Dompet Digital", "Futsal");
    if (dom === 10 && n < 40) add(n, "pemasukan", 750000, "Pemasukan", "Pendapatan Lain", "Rekening Gaji", "Freelance desain");
    // tarik tunai & isi saldo dompet digital dari rekening gaji (transfer)
    if (dom === 2 || dom === 16) transfers.push({ date: ymd(d), amount: 300000, from_account_id: acc["Rekening Gaji"], to_account_id: acc["Dompet"], note: "Tarik tunai" });
    if (d.getUTCDay() === 1) transfers.push({ date: ymd(d), amount: 400000, from_account_id: acc["Rekening Gaji"], to_account_id: acc["Dompet Digital"], note: "Isi saldo dompet digital", kind: "topup" });
  }
  let done = 0;
  for (const t of tx) {
    await must("/api/member/quick-transaction", t);
    if (++done % 25 === 0) console.log(`transaksi ${done}/${tx.length}`);
  }

  for (const t of transfers) await must("/api/member/transfer", t);

  // 3) Budget bulanan per kategori.
  for (const [category, amount] of [["Makanan & Minuman", 2500000], ["Transportasi", 900000], ["Belanja", 600000], ["Hiburan", 400000]]) {
    await must("/api/member/budgets", { type: "pengeluaran", category, amount, period: "monthly" });
  }

  // 4) Target tabungan (recurring bertipe Tabungan) + setoran yang sudah jalan.
  // Tanggal jatuh tempo berikutnya untuk tanggal-bulan `dom`.
  const nextOn = (dom) => {
    const d = daysAgo(0);
    if (d.getUTCDate() >= dom) d.setUTCMonth(d.getUTCMonth() + 1, 1);
    d.setUTCDate(dom);
    return ymd(d);
  };
  const next25 = nextOn(25);
  await must("/api/member/recurring", { name: "Nabung Dana Darurat", type: "Tabungan", category: "Dana Darurat", account_id: acc["Rekening Gaji"], amount: 1000000, interval: "Bulanan", next_date: next25, target_amount: 15000000 });
  await must("/api/member/recurring", { name: "Liburan ke Bali", type: "Tabungan", category: "Liburan", account_id: acc["Rekening Gaji"], amount: 500000, interval: "Bulanan", next_date: next25, target_amount: 6000000 });
  for (const n of [85, 55, 25]) {
    await must("/api/member/savings", { amount: 1000000, category: "Dana Darurat", transaction_type: "Setoran", from_account: acc["Rekening Gaji"], apply_balance: true, date: ymd(daysAgo(n)), description: "Setor Dana Darurat" });
    await must("/api/member/savings", { amount: 500000, category: "Liburan", transaction_type: "Setoran", from_account: acc["Rekening Gaji"], apply_balance: true, date: ymd(daysAgo(n)), description: "Setor Liburan" });
  }

  // 5) Tagihan berulang.
  for (const [name, type, category, amount, account, dom] of [
    ["Gaji", "Pemasukan", "Pemasukan", 6500000, "Rekening Gaji", 25],
    ["Kos + listrik", "Pengeluaran", "Tagihan & Utilitas", 1500000, "Rekening Gaji", 1],
    ["Internet rumah", "Pengeluaran", "Tagihan & Utilitas", 350000, "Rekening Gaji", 3],
    ["Langganan streaming", "Pengeluaran", "Hiburan", 54990, "Dompet Digital", 5],
  ]) {
    await must("/api/member/recurring", { name, type, category, account_id: acc[account], amount, interval: "Bulanan", next_date: nextOn(dom) });
  }

  const final = (await must("/api/member/accounts")).items;
  console.log(`Selesai: ${tx.length} transaksi. Saldo akhir: ${final.map((a) => `${a.name} ${Math.round(a.balance).toLocaleString("id-ID")}`).join(", ")}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
