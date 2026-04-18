const bootstrap = window.__BOOTSTRAP__ || {};
const app = document.querySelector("#app");

const state = {
  user: bootstrap.user || null,
  route: bootstrap.route || "/",
  turnstileSiteKey: bootstrap.turnstileSiteKey || "",
  cache: new Map()
};

const memberNav = [
  { href: "/membership/dashboard", label: "Dashboard" },
  { href: "/membership/annual", label: "Tahunan" },
  { href: "/membership/budget", label: "Budget" },
  { href: "/membership/rekening", label: "Rekening" },
  { href: "/membership/nama-akun", label: "Nama Akun" },
  { href: "/membership/transactions/daily", label: "Transaksi Harian" },
  { href: "/membership/transactions/debt", label: "Hutang & Piutang" },
  { href: "/membership/transactions/topup", label: "Top Up & Transfer" },
  { href: "/membership/tabungan", label: "Tabungan" },
  { href: "/membership/investment", label: "Ringkasan Investasi" },
  { href: "/membership/investasi/saham", label: "Portofolio Saham" },
  { href: "/membership/investasi/deposito", label: "Deposito" },
  { href: "/membership/investasi/lainnya", label: "Investasi Lainnya" },
  { href: "/membership/recurring", label: "Recurring" },
  { href: "/membership/pajak-center", label: "Pajak Center" },
  { href: "/membership/contact", label: "Konfirmasi Pro" },
  { href: "/membership/ai-leosiqra", label: "AI Leosiqra" },
  { href: "/membership/profile", label: "Profile" }
];

const adminNav = [
  { href: "/admin/dashboard", label: "Dashboard Operasional" },
  { href: "/admin/pembayaran", label: "Konfirmasi Pembayaran" },
  { href: "/admin/user", label: "Kelola User" },
  { href: "/admin/laporan", label: "Laporan Eksekutif" },
  { href: "/admin/pengaturan", label: "Pengaturan" }
];

function formatMoney(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("id-ID");
}

function setView(html) {
  app.innerHTML = html;
  bindGlobalActions();
}

function getMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
  if (!response.ok) throw new Error(payload?.error || "Request gagal.");
  return payload?.data ?? payload;
}

async function cached(path) {
  if (!state.cache.has(path)) state.cache.set(path, api(path));
  return state.cache.get(path);
}

function topbar() {
  if (!state.user) {
    return `
      <header class="topbar">
        <a class="brand" href="/">Membersite Leosiqra</a>
        <div class="topbar-actions">
          <a class="ghost-btn" href="/auth/login">Login</a>
          <a class="primary-btn" href="/auth/register">Mulai Migrasi</a>
        </div>
      </header>
    `;
  }

  return `
    <header class="topbar">
      <a class="brand" href="${state.user.role === "admin" ? "/admin/dashboard" : "/membership/dashboard"}">Membersite Leosiqra</a>
      <div class="topbar-actions">
        <span class="pill">${state.user.role === "admin" ? "Admin" : state.user.plan || "FREE"} / ${state.user.status || "-"}</span>
        <a class="ghost-btn" href="${state.user.role === "admin" ? "/admin/pengaturan" : "/membership/profile"}">Profile</a>
        <button class="ghost-btn" type="button" id="logout-btn">Logout</button>
      </div>
    </header>
  `;
}

function shell({ title, subtitle, nav, content }) {
  return `
    ${topbar()}
    <main class="workspace">
      <aside class="sidebar">
        <div class="sidebar-card">
          <span class="eyebrow">${state.user?.role === "admin" ? "Admin Area" : "Member Area"}</span>
          <h2>${state.user?.name || "Leosiqra"}</h2>
          <p>${state.user?.email || "Cloudflare migration shell"}</p>
        </div>
        <nav class="menu-list">
          ${nav.map((item) => `<a class="menu-link ${state.route === item.href ? "active" : ""}" href="${item.href}">${item.label}</a>`).join("")}
        </nav>
      </aside>
      <section class="content">
        <section class="section-head">
          <div>
            <span class="eyebrow">${state.user?.role === "admin" ? "Operational Console" : "Finance Workspace"}</span>
            <h1>${title}</h1>
            <p>${subtitle}</p>
          </div>
        </section>
        ${content}
      </section>
    </main>
  `;
}

function stats(cards) {
  return `
    <section class="stats-grid">
      ${cards.map((card) => `<article class="stat-card"><small>${card.label}</small><strong>${card.value}</strong><span>${card.note || ""}</span></article>`).join("")}
    </section>
  `;
}

function panel(title, body) {
  return `<article class="panel"><h2>${title}</h2>${body}</article>`;
}

function table(headers, rows, empty = "Belum ada data.") {
  return `
    <div class="table-scroll">
      <table>
        <thead><tr>${headers.map((item) => `<th>${item}</th>`).join("")}</tr></thead>
        <tbody>${rows.length ? rows.join("") : `<tr><td colspan="${headers.length}">${empty}</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function heroPage() {
  setView(`
    ${topbar()}
    <main class="hero-grid">
      <section class="hero-card hero-copy">
        <span class="eyebrow">Full Cloudflare Stack</span>
        <h1>Seluruh fondasi lama kini dipindah ke ekosistem edge yang lebih ringan.</h1>
        <p>Project baru ini membawa auth, database, storage, payment workflow, dan dashboard ke Worker, D1, dan R2. UI native juga sekarang punya route member/admin yang mengikuti aplikasi lama.</p>
        <div class="cta-row">
          <a class="primary-btn" href="/auth/register">Buat Akun</a>
          <a class="ghost-btn" href="/auth/login">Masuk</a>
        </div>
      </section>
      <section class="hero-card metrics-grid">
        <div class="metric-box"><small>Hosting</small><strong>Workers Assets</strong><span>Static delivery dari edge</span></div>
        <div class="metric-box"><small>Database</small><strong>D1 SQL</strong><span>Schema eksplisit dan mudah dimigrasi</span></div>
        <div class="metric-box"><small>Storage</small><strong>R2</strong><span>Upload bukti bayar dan avatar</span></div>
        <div class="metric-box"><small>Auth</small><strong>Session + TOTP</strong><span>Auth internal tanpa vendor lama</span></div>
      </section>
    </main>
  `);
}

function authPage(mode) {
  const isLogin = mode === "login";
  setView(`
    ${topbar()}
    <main class="auth-layout">
      <section class="auth-panel">
        <span class="eyebrow">${isLogin ? "Login" : "Register"}</span>
        <h1>${isLogin ? "Akses ruang kerja finansial" : "Migrasi akun ke stack Cloudflare"}</h1>
        <p>${isLogin ? "Masuk dengan email dan password. Jika 2FA aktif, masukkan OTP enam digit." : "Buat akun baru dan generate secret TOTP jika Anda ingin 2FA sejak awal."}</p>
      </section>
      <section class="auth-card">
        <form id="${mode}-form" class="stack-lg">
          ${!isLogin ? `<label class="field"><span>Nama Lengkap</span><input name="name" type="text" required /></label><label class="field"><span>WhatsApp</span><input name="whatsapp" type="text" /></label>` : ""}
          <label class="field"><span>Email</span><input name="email" type="email" required /></label>
          <label class="field"><span>Password</span><input name="password" type="password" required /></label>
          <label class="field"><span>Kode 2FA</span><input name="twoFactorCode" type="text" maxlength="6" placeholder="Opsional" /></label>
          ${!isLogin ? `<div class="field"><span>Setup TOTP</span><div class="inline-actions"><button class="ghost-btn" id="totp-setup-btn" type="button">Generate Secret</button><small id="totp-status">Belum dibuat</small></div><textarea id="totp-secret-box" rows="4" readonly></textarea></div>` : ""}
          <p class="form-error" id="${mode}-error"></p>
          <button class="primary-btn full" type="submit">${isLogin ? "Login" : "Register"}</button>
        </form>
      </section>
    </main>
  `);

  const form = document.querySelector(`#${mode}-form`);
  const errorEl = document.querySelector(`#${mode}-error`);
  let totpSecret = "";

  if (!isLogin) {
    document.querySelector("#totp-setup-btn").addEventListener("click", async () => {
      if (!form.email.value) {
        errorEl.textContent = "Isi email terlebih dahulu.";
        return;
      }
      const setup = await api("/api/auth/2fa/setup", {
        method: "POST",
        body: JSON.stringify({ email: form.email.value })
      });
      totpSecret = setup.secret;
      document.querySelector("#totp-status").textContent = "Secret siap";
      document.querySelector("#totp-secret-box").value = `SECRET: ${setup.secret}\nOTPAUTH: ${setup.otpauthUrl}`;
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.textContent = "";
    const payload = Object.fromEntries(new FormData(form).entries());
    if (!isLogin) payload.twoFactorSecret = totpSecret || "";
    try {
      const response = await fetch(`/api/auth/${isLogin ? "login" : "register"}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (response.status === 202 && result.requiresTwoFactor) throw new Error("Akun ini membutuhkan kode 2FA.");
      if (!response.ok) throw new Error(result.error || "Autentikasi gagal.");
      window.location.href = result.data.role === "admin" ? "/admin/dashboard" : "/membership/dashboard";
    } catch (error) {
      errorEl.textContent = error.message;
    }
  });
}

async function memberData() {
  const month = getMonthKey();
  const [summary, accounts, transactions, budgets, investments, recurring, savings, categories, currencies, payments] = await Promise.all([
    cached(`/api/dashboard/summary?month=${month}`),
    cached("/api/accounts"),
    cached("/api/transactions"),
    cached("/api/budgets"),
    cached("/api/investments"),
    cached("/api/recurring"),
    cached("/api/savings"),
    cached("/api/categories"),
    cached("/api/currencies"),
    cached("/api/payments")
  ]);
  return { summary, accounts, transactions, budgets, investments, recurring, savings, categories, currencies, payments };
}

async function adminData() {
  const [settings, users, payments, logs] = await Promise.all([
    cached("/api/admin/settings"),
    cached("/api/admin/users"),
    cached("/api/admin/payments"),
    cached("/api/admin/logs")
  ]);
  return { settings, users, payments, logs };
}

function filtersForInvestments(investments, type) {
  if (type === "saham") return investments.filter((item) => item.type === "Saham");
  if (type === "deposito") return investments.filter((item) => item.type === "Deposito");
  if (type === "lainnya") return investments.filter((item) => item.type === "Lainnya");
  return investments;
}

function renderMemberPage(data) {
  const { summary, accounts, transactions, budgets, investments, recurring, savings, categories, currencies, payments } = data;
  const baseCards = stats([
    { label: "Saldo Total", value: formatMoney(summary.totalBalance), note: "Semua rekening aktif" },
    { label: "Pemasukan Bulan Ini", value: formatMoney(summary.totalIncome), note: "Berdasarkan transaksi" },
    { label: "Pengeluaran Bulan Ini", value: formatMoney(summary.totalExpense), note: "Cash outflow" },
    { label: "Investasi Aktif", value: formatMoney(summary.totalInvestment), note: "Current value" }
  ]);

  if (state.route === "/membership/dashboard") {
    return shell({
      title: "Dashboard Bulanan",
      subtitle: "Ringkasan utama yang menggantikan monthly dashboard lama.",
      nav: memberNav,
      content: `
        ${baseCards}
        <section class="panel-grid">
          ${panel("Aktivitas Terbaru", table(["Tanggal", "Kategori", "Tipe", "Nominal"], transactions.slice(0, 8).map((row) => `<tr><td>${formatDate(row.date)}</td><td>${row.category}</td><td>${row.type}</td><td>${formatMoney(row.amountIdr || row.amount)}</td></tr>`)))}
          ${panel("Snapshot Modul", `<ul class="summary-list"><li><span>Rekening</span><strong>${accounts.length}</strong></li><li><span>Budget</span><strong>${budgets.length}</strong></li><li><span>Investasi</span><strong>${investments.length}</strong></li><li><span>Recurring</span><strong>${recurring.length}</strong></li></ul>`)}
        </section>
      `
    });
  }

  if (state.route === "/membership/annual") {
    const income = transactions.filter((item) => item.type === "pemasukan").reduce((sum, item) => sum + Number(item.amountIdr || item.amount || 0), 0);
    const expense = transactions.filter((item) => item.type !== "pemasukan").reduce((sum, item) => sum + Number(item.amountIdr || item.amount || 0), 0);
    return shell({
      title: "Dashboard Tahunan",
      subtitle: "Versi native dari laporan tahunan, fokus pada fiskal, budget, dan posisi aset.",
      nav: memberNav,
      content: `
        ${stats([
          { label: "Pemasukan Tahunan", value: formatMoney(income) },
          { label: "Pengeluaran Tahunan", value: formatMoney(expense) },
          { label: "Total Tabungan", value: formatMoney(savings.reduce((sum, item) => sum + Number(item.amountIdr || item.amount || 0), 0)) },
          { label: "Total Investasi", value: formatMoney(investments.reduce((sum, item) => sum + Number(item.amountIdr || item.amountInvested || 0), 0)) }
        ])}
        ${panel("Budget vs Aktual", table(["Kategori", "Period", "Budget", "Realisasi"], budgets.map((item) => {
          const actual = transactions.filter((trx) => trx.category === item.category).reduce((sum, trx) => sum + Number(trx.amountIdr || trx.amount || 0), 0);
          return `<tr><td>${item.category}</td><td>${item.period}</td><td>${formatMoney(item.amount)}</td><td>${formatMoney(actual)}</td></tr>`;
        })))}
      `
    });
  }

  if (state.route === "/membership/budget") {
    return shell({
      title: "Budget & Target",
      subtitle: "Target pemasukan, batas pengeluaran, dan baseline target tabungan/investasi.",
      nav: memberNav,
      content: `${baseCards}${panel("Daftar Budget", table(["Tipe", "Kategori", "Period", "Nominal"], budgets.map((item) => `<tr><td>${item.type}</td><td>${item.category}</td><td>${item.period}</td><td>${formatMoney(item.amount)}</td></tr>`)))}`
    });
  }

  if (state.route === "/membership/rekening") {
    return shell({
      title: "Rekening & Kartu",
      subtitle: "Pengganti halaman rekening dan kartu aktif.",
      nav: memberNav,
      content: `
        ${stats([
          { label: "Total Rekening", value: String(accounts.length) },
          { label: "Saldo Gabungan", value: formatMoney(accounts.reduce((sum, item) => sum + Number(item.balance || 0), 0)) },
          { label: "Credit Card", value: String(accounts.filter((item) => item.type === "Credit Card").length) },
          { label: "Cash / Wallet", value: String(accounts.filter((item) => ["Cash", "E-Wallet"].includes(item.type)).length) }
        ])}
        ${panel("Daftar Akun", table(["Nama", "Tipe", "Currency", "Saldo"], accounts.map((item) => `<tr><td>${item.name}</td><td>${item.type}</td><td>${item.currency}</td><td>${formatMoney(item.balance)}</td></tr>`)))}
      `
    });
  }

  if (state.route === "/membership/nama-akun") {
    return shell({
      title: "Nama Akun Transaksi",
      subtitle: "Ledger kategori/subkategori dan daftar mata uang dunia.",
      nav: memberNav,
      content: `
        <section class="panel-grid">
          ${panel("Ledger Kategori", table(["Kategori", "Subkategori", "Status"], categories.map((item) => `<tr><td>${item.category}</td><td>${item.subCategory}</td><td>${item.status}</td></tr>`)))}
          ${panel("Mata Uang", table(["Code", "Nama", "Symbol", "Default"], currencies.map((item) => `<tr><td>${item.code}</td><td>${item.name}</td><td>${item.symbol}</td><td>${item.isDefault ? "Ya" : "Tidak"}</td></tr>`)))}
        </section>
      `
    });
  }

  if (state.route === "/membership/transactions/daily") {
    return shell({
      title: "Transaksi Harian",
      subtitle: "Daftar transaksi harian lengkap beserta tenor dan bunga jika ada.",
      nav: memberNav,
      content: `${panel("Transaksi", table(["Tanggal", "Kategori", "Tipe", "Nominal", "Tenor", "Bunga/Bulan"], transactions.map((trx) => `<tr><td>${formatDate(trx.date)}</td><td>${trx.category}</td><td>${trx.type}</td><td>${formatMoney(trx.amountIdr || trx.amount)}</td><td>${trx.installmentTenor || "-"}</td><td>${trx.monthlyInterest ? formatMoney(trx.monthlyInterest) : "-"}</td></tr>`)))}`
    });
  }

  if (state.route === "/membership/transactions/debt") {
    const debtItems = transactions.filter((item) => item.type === "debt" || ["Hutang", "Piutang"].includes(item.category));
    return shell({
      title: "Hutang & Piutang",
      subtitle: "Monitoring tenor, status pembayaran, dan bunga bulanan.",
      nav: memberNav,
      content: `
        ${stats([
          { label: "Open Item", value: String(debtItems.length) },
          { label: "Total Outstanding", value: formatMoney(debtItems.reduce((sum, item) => sum + Number(item.totalDebt || item.amountIdr || item.amount || 0), 0)) },
          { label: "Belum Lunas", value: String(debtItems.filter((item) => item.paymentStatus !== "lunas").length) },
          { label: "Sudah Lunas", value: String(debtItems.filter((item) => item.paymentStatus === "lunas").length) }
        ])}
        ${panel("Daftar Hutang / Piutang", table(["Tanggal", "Pihak", "Kategori", "Status", "Tenor", "Nominal"], debtItems.map((item) => `<tr><td>${formatDate(item.date)}</td><td>${item.lenderName || "-"}</td><td>${item.category}</td><td>${item.paymentStatus || item.status}</td><td>${item.installmentTenor || "-"}</td><td>${formatMoney(item.amountIdr || item.amount)}</td></tr>`)))}
      `
    });
  }

  if (state.route === "/membership/transactions/topup") {
    const topups = transactions.filter((item) => ["topup", "transfer"].includes(item.type));
    return shell({
      title: "Top Up & Transfer",
      subtitle: "Mutasi antar akun dan transfer masuk/keluar.",
      nav: memberNav,
      content: `${panel("Riwayat Top Up / Transfer", table(["Tanggal", "Dari Akun", "Ke Akun", "Tipe", "Nominal"], topups.map((item) => `<tr><td>${formatDate(item.date)}</td><td>${item.accountId || "-"}</td><td>${item.targetAccountId || "-"}</td><td>${item.type}</td><td>${formatMoney(item.amountIdr || item.amount)}</td></tr>`)))}`
    });
  }

  if (state.route === "/membership/tabungan") {
    return shell({
      title: "Tabungan & Dana Darurat",
      subtitle: "Goal tabungan, pergerakan setoran, dan kategori tujuan.",
      nav: memberNav,
      content: `
        ${stats([
          { label: "Total Tabungan", value: formatMoney(savings.reduce((sum, item) => sum + Number(item.amountIdr || item.amount || 0), 0)) },
          { label: "Goal Aktif", value: String(new Set(savings.map((item) => item.toGoal)).size) },
          { label: "Kategori", value: String(new Set(savings.map((item) => item.category)).size) },
          { label: "Transaksi", value: String(savings.length) }
        ])}
        ${panel("Daftar Tabungan", table(["Tanggal", "Deskripsi", "Goal", "Kategori", "Nominal"], savings.map((item) => `<tr><td>${formatDate(item.date)}</td><td>${item.description}</td><td>${item.toGoal}</td><td>${item.category}</td><td>${formatMoney(item.amountIdr || item.amount)}</td></tr>`)))}
      `
    });
  }

  if (state.route === "/membership/investment" || state.route.startsWith("/membership/investasi/")) {
    const pageType = state.route.includes("/saham") ? "saham" : state.route.includes("/deposito") ? "deposito" : state.route.includes("/lainnya") ? "lainnya" : "all";
    const items = filtersForInvestments(investments, pageType);
    const pageTitle = pageType === "saham" ? "Portofolio Saham" : pageType === "deposito" ? "Deposito" : pageType === "lainnya" ? "Investasi Lainnya" : "Ringkasan Investasi";
    return shell({
      title: pageTitle,
      subtitle: "Tampilan native untuk modul investasi lama, lengkap dengan filter tipe dan status portofolio.",
      nav: memberNav,
      content: `
        ${stats([
          { label: "Jumlah Posisi", value: String(items.length) },
          { label: "Modal", value: formatMoney(items.reduce((sum, item) => sum + Number(item.amountIdr || item.amountInvested || 0), 0)) },
          { label: "Nilai Sekarang", value: formatMoney(items.reduce((sum, item) => sum + Number(item.currentValueIdr || item.currentValue || 0), 0)) },
          { label: "Aktif", value: String(items.filter((item) => item.status === "Active").length) }
        ])}
        ${panel("Daftar Portofolio", table(["Nama", "Tipe", "Platform", "Status", "Modal", "Value"], items.map((item) => `<tr><td>${item.stockCode || item.name}</td><td>${item.type}</td><td>${item.platform}</td><td>${item.status}</td><td>${formatMoney(item.amountIdr || item.amountInvested)}</td><td>${formatMoney(item.currentValueIdr || item.currentValue)}</td></tr>`)))}
      `
    });
  }

  if (state.route === "/membership/recurring") {
    return shell({
      title: "Transaksi Berulang",
      subtitle: "Daftar jadwal otomatis dan tanggal eksekusi berikutnya.",
      nav: memberNav,
      content: `${panel("Recurring Schedule", table(["Nama", "Kategori", "Interval", "Next Date", "Status", "Nominal"], recurring.map((item) => `<tr><td>${item.name}</td><td>${item.category}</td><td>${item.interval}</td><td>${formatDate(item.nextDate)}</td><td>${item.status}</td><td>${formatMoney(item.amount)}</td></tr>`)))}`
    });
  }

  if (state.route === "/membership/pajak-center") {
    const totalAssets = accounts.reduce((sum, item) => sum + Number(item.balance || 0), 0) + investments.reduce((sum, item) => sum + Number(item.currentValueIdr || item.currentValue || 0), 0);
    return shell({
      title: "Pajak Center",
      subtitle: "Draft ringkasan SPT berbasis transaksi, aset, dan investasi yang ada di D1.",
      nav: memberNav,
      content: `
        ${stats([
          { label: "Total Aset", value: formatMoney(totalAssets) },
          { label: "Jumlah Transaksi", value: String(transactions.length) },
          { label: "Pembelian Investasi", value: formatMoney(investments.reduce((sum, item) => sum + Number(item.amountIdr || item.amountInvested || 0), 0)) },
          { label: "Tabungan", value: formatMoney(savings.reduce((sum, item) => sum + Number(item.amountIdr || item.amount || 0), 0)) }
        ])}
        ${panel("Mapping Ringkas", `<ul class="summary-list"><li><span>Rekening / Kas</span><strong>${formatMoney(accounts.reduce((sum, item) => sum + Number(item.balance || 0), 0))}</strong></li><li><span>Investasi</span><strong>${formatMoney(investments.reduce((sum, item) => sum + Number(item.currentValueIdr || item.currentValue || 0), 0))}</strong></li><li><span>Pengeluaran Tahunan</span><strong>${formatMoney(transactions.filter((item) => item.type !== "pemasukan").reduce((sum, item) => sum + Number(item.amountIdr || item.amount || 0), 0))}</strong></li></ul>`)}
      `
    });
  }

  if (state.route === "/membership/contact") {
    return shell({
      title: "Konfirmasi Pembayaran Pro",
      subtitle: "Tampilan native untuk alur konfirmasi pembayaran dan ticket queue user.",
      nav: memberNav,
      content: `${panel("Ticket Pembayaran", table(["Tanggal", "Status", "Nominal", "Bukti"], payments.map((item) => `<tr><td>${formatDate(item.createdAt)}</td><td>${item.status}</td><td>${formatMoney(item.amount)}</td><td>${item.proofImageUrl ? `<a href="${item.proofImageUrl}" target="_blank" rel="noreferrer">Lihat</a>` : "-"}</td></tr>`), "Belum ada ticket pembayaran."))}`
    });
  }

  if (state.route === "/membership/ai-leosiqra") {
    return shell({
      title: "AI Leosiqra",
      subtitle: "Ruang AI sudah disiapkan sebagai halaman native. Backend AI provider bisa ditancapkan belakangan langsung dari Worker.",
      nav: memberNav,
      content: `
        ${panel("Context Snapshot", `<ul class="summary-list"><li><span>Rekening</span><strong>${accounts.length}</strong></li><li><span>Transaksi</span><strong>${transactions.length}</strong></li><li><span>Investasi</span><strong>${investments.length}</strong></li><li><span>Budget</span><strong>${budgets.length}</strong></li></ul>`)}
        ${panel("Status", `<p class="muted">Halaman AI sudah dipindahkan ke struktur Cloudflare. Langkah berikutnya bila Anda mau adalah menyambungkan provider AI baru langsung dari Worker agar riwayat chat tersimpan di D1.</p>`)}
      `
    });
  }

  if (state.route === "/membership/profile") {
    return shell({
      title: "Profile",
      subtitle: "Identity settings, upload ke R2, dan ringkasan akun aktif.",
      nav: memberNav,
      content: `
        ${stats([
          { label: "Akun Aktif", value: String(accounts.length) },
          { label: "Total Transaksi", value: String(transactions.length) },
          { label: "Plan", value: state.user.plan || "-" },
          { label: "Status", value: state.user.status || "-" }
        ])}
        <section class="panel-grid">
          ${panel("Identity", `<form id="profile-form" class="stack-md"><label class="field"><span>Nama</span><input name="name" value="${state.user.name || ""}" /></label><label class="field"><span>WhatsApp</span><input name="whatsapp" /></label><label class="field"><span>Username</span><input name="username" /></label><label class="field"><span>Address</span><input name="address" /></label><button class="primary-btn full" type="submit">Simpan Profile</button><p class="muted" id="profile-status"></p></form>`)}
          ${panel("Security Center", `<form id="upload-form" class="stack-md"><label class="field"><span>Kategori Upload</span><input name="category" value="profile" /></label><label class="field"><span>File</span><input type="file" name="file" required /></label><button class="primary-btn full" type="submit">Upload ke R2</button><p class="muted" id="upload-status"></p></form>`)}
        </section>
      `
    });
  }

  return shell({
    title: "Member Area",
    subtitle: "Route ini sudah dipetakan, tetapi belum punya komponen khusus tambahan.",
    nav: memberNav,
    content: baseCards
  });
}

function renderAdminPage(data) {
  const { settings, users, payments, logs } = data;
  const approved = payments.filter((item) => item.status === "DISETUJUI");
  const pending = payments.filter((item) => item.status === "MENUNGGU");

  if (state.route === "/admin/dashboard" || state.route === "/admin") {
    return shell({
      title: "Dashboard Operasional",
      subtitle: "Ringkasan operasional admin yang sekarang berjalan penuh di Worker dan D1.",
      nav: adminNav,
      content: `
        ${stats([
          { label: "Total User", value: String(users.length) },
          { label: "PRO Aktif", value: String(users.filter((item) => item.plan === "PRO").length) },
          { label: "Pending Ticket", value: String(pending.length) },
          { label: "Revenue Approved", value: formatMoney(approved.reduce((sum, item) => sum + Number(item.amount || 0), 0)) }
        ])}
        <section class="panel-grid">
          ${panel("User Terbaru", table(["Nama", "Email", "Plan", "Status"], users.slice(0, 8).map((item) => `<tr><td>${item.name || "-"}</td><td>${item.email}</td><td>${item.plan}</td><td>${item.status}</td></tr>`)))}
          ${panel("Queue Pembayaran", table(["Tanggal", "User", "Status", "Nominal"], payments.slice(0, 8).map((item) => `<tr><td>${formatDate(item.createdAt)}</td><td>${item.userName || item.userEmail || item.userId}</td><td>${item.status}</td><td>${formatMoney(item.amount)}</td></tr>`)))}
        </section>
      `
    });
  }

  if (state.route === "/admin/pembayaran") {
    return shell({
      title: "Konfirmasi Pembayaran",
      subtitle: "Antrian verifikasi, approval, dan reject ticket pembayaran.",
      nav: adminNav,
      content: `
        ${stats([
          { label: "Total Ticket", value: String(payments.length) },
          { label: "Menunggu", value: String(pending.length) },
          { label: "Disetujui", value: String(approved.length) },
          { label: "Revenue", value: formatMoney(approved.reduce((sum, item) => sum + Number(item.amount || 0), 0)) }
        ])}
        ${panel("Antrian Pembayaran", table(["Tanggal", "User", "Status", "Nominal", "Aksi"], payments.map((item) => `<tr><td>${formatDate(item.createdAt)}</td><td>${item.userName || item.userEmail || item.userId}</td><td>${item.status}</td><td>${formatMoney(item.amount)}</td><td class="action-cell"><button class="ghost-btn payment-action" data-id="${item.id}" data-status="DISETUJUI" type="button">Approve</button><button class="ghost-btn payment-action" data-id="${item.id}" data-status="DITOLAK" type="button">Reject</button></td></tr>`)))}
        <p class="muted" id="payment-status"></p>
      `
    });
  }

  if (state.route === "/admin/user") {
    return shell({
      title: "User Console",
      subtitle: "Kelola plan, status, dan visibilitas akun member.",
      nav: adminNav,
      content: `${panel("Daftar Member", table(["Nama", "Email", "Role", "Plan", "Status", "Expired"], users.map((item) => `<tr><td>${item.name || "-"}</td><td>${item.email}</td><td>${item.role}</td><td>${item.plan}</td><td>${item.status}</td><td>${formatDate(item.expiredAt)}</td></tr>`)))}`
    });
  }

  if (state.route === "/admin/laporan") {
    return shell({
      title: "Laporan Eksekutif",
      subtitle: "Ringkasan KPI user, payment conversion, dan audit activity.",
      nav: adminNav,
      content: `
        ${stats([
          { label: "User Aktif", value: String(users.filter((item) => item.status === "AKTIF").length) },
          { label: "Free", value: String(users.filter((item) => item.plan === "FREE").length) },
          { label: "PRO", value: String(users.filter((item) => item.plan === "PRO").length) },
          { label: "Audit Log", value: String(logs.length) }
        ])}
        <section class="panel-grid">
          ${panel("Revenue & Queue", `<ul class="summary-list"><li><span>Approved Revenue</span><strong>${formatMoney(approved.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong></li><li><span>Pending Revenue</span><strong>${formatMoney(pending.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong></li><li><span>Pending Ticket</span><strong>${pending.length}</strong></li></ul>`)}
          ${panel("Audit Log", table(["Waktu", "Aksi", "Target", "Catatan"], logs.slice(0, 12).map((item) => `<tr><td>${formatDate(item.timestamp)}</td><td>${item.action}</td><td>${item.target}</td><td>${item.note}</td></tr>`)))}
        </section>
      `
    });
  }

  if (state.route === "/admin/pengaturan") {
    return shell({
      title: "Pengaturan",
      subtitle: "Konfigurasi pembayaran, maintenance, dan metadata member.",
      nav: adminNav,
      content: `
        <section class="panel-grid">
          ${panel("Konfigurasi Pembayaran", `<form id="settings-form" class="stack-md"><label class="field"><span>Billing Email</span><input name="billingEmail" value="${settings.billingEmail || ""}" /></label><label class="field"><span>WhatsApp</span><input name="whatsapp" value="${settings.whatsapp || ""}" /></label><label class="field"><span>Nama Bank</span><input name="bankName" value="${settings.bankName || ""}" /></label><label class="field"><span>Nama Rekening</span><input name="bankAccountName" value="${settings.bankAccountName || ""}" /></label><label class="field"><span>No Rekening</span><input name="bankNumber" value="${settings.bankNumber || ""}" /></label><button class="primary-btn full" type="submit">Simpan Settings</button><p class="muted" id="settings-status"></p></form>`)}
          ${panel("Maintenance & Package", `<ul class="summary-list"><li><span>Maintenance Active</span><strong>${settings.maintenance?.isActive ? "Ya" : "Tidak"}</strong></li><li><span>Free Plan Days</span><strong>${settings.freePlanDays || 0}</strong></li><li><span>Paket Pro</span><strong>${(settings.proPackages || []).length}</strong></li></ul>`)}
        </section>
      `
    });
  }

  return shell({
    title: "Admin",
    subtitle: "Route admin sudah dipetakan.",
    nav: adminNav,
    content: stats([{ label: "User", value: String(users.length) }, { label: "Payment", value: String(payments.length) }, { label: "Logs", value: String(logs.length) }, { label: "Settings", value: "Ready" }])
  });
}

function bindGlobalActions() {
  const logoutBtn = document.querySelector("#logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await api("/api/auth/logout", { method: "POST" });
      window.location.href = "/auth/login";
    });
  }

  const profileForm = document.querySelector("#profile-form");
  if (profileForm) {
    profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api("/api/profile", { method: "PATCH", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) });
        document.querySelector("#profile-status").textContent = "Profil berhasil diperbarui.";
      } catch (error) {
        document.querySelector("#profile-status").textContent = error.message;
      }
    });
  }

  const uploadForm = document.querySelector("#upload-form");
  if (uploadForm) {
    uploadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/uploads", { method: "POST", body: formData, credentials: "same-origin" });
      const payload = await response.json();
      document.querySelector("#upload-status").textContent = response.ok ? `Upload berhasil: ${payload.data.url}` : payload.error;
    });
  }

  const settingsForm = document.querySelector("#settings-form");
  if (settingsForm) {
    settingsForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) });
        document.querySelector("#settings-status").textContent = "Settings tersimpan.";
      } catch (error) {
        document.querySelector("#settings-status").textContent = error.message;
      }
    });
  }

  document.querySelectorAll(".payment-action").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api(`/api/admin/payments/${button.dataset.id}`, { method: "PATCH", body: JSON.stringify({ status: button.dataset.status }) });
        document.querySelector("#payment-status").textContent = `Payment ${button.dataset.id} diubah ke ${button.dataset.status}. Muat ulang halaman untuk sinkronisasi tampilan.`;
      } catch (error) {
        document.querySelector("#payment-status").textContent = error.message;
      }
    });
  });
}

async function guardRoute() {
  const publicRoutes = new Set(["/", "/login", "/register", "/auth/login", "/auth/register"]);
  if (publicRoutes.has(state.route)) return true;
  try {
    const user = await api("/api/auth/session");
    if (!user) {
      window.location.href = "/auth/login";
      return false;
    }
    state.user = user;
    if (state.route.startsWith("/admin") && user.role !== "admin") {
      window.location.href = "/membership/dashboard";
      return false;
    }
    return true;
  } catch {
    window.location.href = "/auth/login";
    return false;
  }
}

async function main() {
  const allowed = await guardRoute();
  if (!allowed) return;

  if (state.route === "/") return heroPage();
  if (["/login", "/auth/login"].includes(state.route)) return authPage("login");
  if (["/register", "/auth/register"].includes(state.route)) return authPage("register");
  if (state.route === "/dashboard") {
    window.location.replace("/membership/dashboard");
    return;
  }
  if (state.route === "/profile") {
    window.location.replace(state.user?.role === "admin" ? "/admin/pengaturan" : "/membership/profile");
    return;
  }
  if (state.route === "/admin") {
    window.location.replace("/admin/dashboard");
    return;
  }

  if (state.route.startsWith("/membership/")) {
    setView(shell({ title: "Memuat...", subtitle: "Menarik data dari D1...", nav: memberNav, content: `<section class="panel"><p class="muted">Loading module ${state.route}...</p></section>` }));
    return setView(renderMemberPage(await memberData()));
  }

  if (state.route.startsWith("/admin")) {
    setView(shell({ title: "Memuat...", subtitle: "Menarik data admin...", nav: adminNav, content: `<section class="panel"><p class="muted">Loading module ${state.route}...</p></section>` }));
    return setView(renderAdminPage(await adminData()));
  }

  return heroPage();
}

main().catch((error) => {
  setView(`${topbar()}<main class="dashboard-shell"><section class="panel"><h1>Terjadi error</h1><p>${error.message}</p></section></main>`);
});
