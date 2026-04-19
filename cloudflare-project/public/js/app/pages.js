import { api, cached, getMonthKey, setView, state } from "./core.js";
import { adminNav, memberNav } from "./config.js";
import { formatDate, formatMoney } from "./utils.js";
import { emptyPrompt, loadingShell, panel, shell, stats, table, toneBadge, topbar } from "./ui.js";

export function heroPage() {
  setView(`
    ${topbar()}
    <main class="marketing-stack">
      <section class="hero-grid hero-premium" id="produk">
        <article class="hero-card hero-copy hero-main">
          <span class="eyebrow">Layanan Keuangan Terintegrasi</span>
          <h1>Member site premium untuk rekap finansial dan SPT tahunan otomatis.</h1>
          <p>Leosiqra membantu user melihat arus kas, tabungan, investasi, dan kesiapan pajak dalam satu workspace yang terasa rapi, cepat, dan dewasa dibuka dari desktop maupun HP.</p>
          <div class="cta-row hero-cta-row">
            <a class="primary-btn" href="/auth/register">Mulai Sekarang</a>
            <a class="ghost-btn" href="/auth/login">Masuk</a>
            <a class="ghost-btn" href="#fitur">Lihat Fitur</a>
          </div>
          <div class="trust-row hero-trust-row">
            <span class="mini-pill">Akurat</span>
            <span class="mini-pill">Cepat</span>
            <span class="mini-pill">Efisien</span>
            <span class="mini-pill">Terpantau</span>
          </div>
        </article>
        <article class="hero-card hero-preview">
          <div class="preview-window">
            <div class="preview-balance">
              <small>Current Balance</small>
              <strong>Rp 84,2jt</strong>
              <span>Naik 12% dari bulan lalu</span>
            </div>
            <div class="preview-stats">
              <div class="metric-box"><small>Income</small><strong>Rp 12,4jt</strong><span>cashflow sehat</span></div>
              <div class="metric-box"><small>Savings</small><strong>82%</strong><span>goal terkendali</span></div>
            </div>
            <div class="preview-chart">
              <span style="height:42%"></span>
              <span style="height:75%"></span>
              <span style="height:58%"></span>
              <span style="height:92%"></span>
              <span style="height:67%"></span>
              <span style="height:81%"></span>
            </div>
            <div class="preview-note">Dashboard ringkas untuk user yang ingin langsung paham tanpa membaca terlalu banyak.</div>
          </div>
        </article>
      </section>

      <section class="marketing-section feature-system">
        <article class="feature-copy">
          <span class="eyebrow">Module Preview</span>
          <h2>Semua sinyal finansial penting tampil dalam layout yang bersih.</h2>
          <p>Lupakan tabel yang melelahkan. Fokus utama Leosiqra adalah membuat user cepat memahami kondisi finansial dan cepat mengambil tindakan berikutnya.</p>
        </article>
        <div class="feature-stack">
          <article class="feature-card"><span class="eyebrow">Analisis</span><h3>Ringkasan yang lebih terukur</h3><p>Angka utama, tren, dan kondisi cashflow tampil lebih dulu sebelum detail.</p></article>
          <article class="feature-card"><span class="eyebrow">Planner</span><h3>Alokasi dana lebih rapi</h3><p>Budget, tabungan, dan investasi terasa saling nyambung dalam satu ritme kerja.</p></article>
          <article class="feature-card"><span class="eyebrow">Data</span><h3>Satu data, satu sumber keputusan</h3><p>Transaksi, aset, dan pembayaran berjalan dari fondasi data yang lebih modern.</p></article>
        </div>
      </section>

      <section class="marketing-section" id="fitur">
        <div class="section-copy centered-copy">
          <span class="eyebrow">Fitur Utama</span>
          <h2>Fitur utama bagi member modern.</h2>
          <p>Dirancang untuk user yang ingin dashboard personal, alokasi dana, kontrol investasi, dan persiapan pajak dalam alur yang masuk akal.</p>
        </div>
        <div class="trio-grid feature-gallery">
          <article class="feature-card"><h3>Dashboard analisis planner</h3><p>Ringkasan rekap pemasukan, pengeluaran, saldo, dan cashflow yang mudah dicerna.</p></article>
          <article class="feature-card"><h3>Alokasi dana instan</h3><p>Budget, tabungan, dan target jadi lebih gampang dipantau tanpa ribet pindah-pindah layar.</p></article>
          <article class="feature-card"><h3>Usul dashboard</h3><p>Flow aplikasi dibuat untuk terus berkembang sesuai kebutuhan member yang benar-benar pakai.</p></article>
          <article class="feature-card"><h3>Simpan aman</h3><p>Fondasi Cloudflare memberi arah yang lebih ringan untuk auth, file, dan data.</p></article>
          <article class="feature-card"><h3>SPT tahunan otomatis</h3><p>Transaksi dan aset lebih siap dipetakan ke ringkasan pajak tahunan.</p></article>
          <article class="feature-card"><h3>Efisien dan terukur</h3><p>Tampilan modern membantu user cepat scan, cepat klik, dan tidak cepat lelah.</p></article>
        </div>
      </section>

      <section class="marketing-section tax-band" id="pajak">
        <article class="tax-copy">
          <span class="eyebrow">Laporan Pajak</span>
          <h2>Laporan pajak SPT yang terasa lebih siap dan lebih rapi.</h2>
          <p>Tidak perlu memulai dari nol. Leosiqra mendorong alur finansial harian agar semakin mudah diteruskan menjadi ringkasan tahunan yang lebih tertib.</p>
        </article>
        <article class="tax-card">
          <div class="tax-card-head">
            <span>List Fitur SPT</span>
            <strong>Paling Populer</strong>
          </div>
          <ul class="tax-list">
            <li>Kalkulasi otomatis</li>
            <li>Struktur lebih siap untuk pelaporan</li>
            <li>Ringkasan aset dan transaksi</li>
            <li>Audit track record admin</li>
            <li>Flow yang lebih tenang untuk user</li>
          </ul>
        </article>
      </section>

      <section class="marketing-section decision-grid" id="keamanan">
        <article class="decision-main">
          <span class="eyebrow">Growth Mindset</span>
          <h2>Lebih sedikit kebingungan, lebih banyak keputusan yang sabar.</h2>
          <p>Produk ini seharusnya membantu user merasa tenang, bukan merasa bodoh. Karena itu hierarchy, spacing, dan CTA dibuat untuk menurunkan friksi.</p>
        </article>
        <div class="decision-side">
          <article class="feature-card"><h3>Analisis personal</h3><p>Pemetaan pengeluaran lebih detail dan lebih bisa dipakai untuk keputusan mingguan.</p></article>
          <article class="feature-card"><h3>Kontrol kontribusi</h3><p>Dana darurat, tabungan, dan investasi lebih mudah dibandingkan.</p></article>
          <article class="feature-card"><h3>Alokasi bijak</h3><p>User bisa melihat prioritas tanpa harus membaca penjelasan panjang.</p></article>
        </div>
      </section>

      <section class="marketing-section roadmap-band" id="cara-kerja">
        <div class="section-copy">
          <span class="eyebrow">Cara Kerja</span>
          <h2>Tiga langkah yang terasa natural.</h2>
        </div>
        <div class="step-grid">
          <article class="step-card"><strong>01</strong><h3>Buat akun</h3><p>Masuk ke workspace tanpa harus belajar ulang alur aplikasi.</p></article>
          <article class="step-card"><strong>02</strong><h3>Catat seperlunya</h3><p>Transaksi dan pembayaran diarahkan ke flow yang lebih cepat dipahami.</p></article>
          <article class="step-card"><strong>03</strong><h3>Pantau hasil</h3><p>Dashboard dan modul pajak merangkum data tanpa bikin user lelah membaca.</p></article>
        </div>
      </section>

      <section class="marketing-section quote-grid">
        <div class="section-copy centered-copy">
          <span class="eyebrow">Testimoni</span>
          <h2>Rasa profesional yang membuat user lebih percaya untuk mulai.</h2>
        </div>
        <div class="trio-grid">
          <article class="feature-card"><p>"Dulu saya rekap di Excel dan mudah berantakan. Sekarang jauh lebih jelas."</p><strong>Bambang Sudjatmiko</strong><small>Business Owner</small></article>
          <article class="feature-card"><p>"Yang paling terasa itu tampilannya bersih dan flow-nya tidak bikin capek."</p><strong>Siti Aminah</strong><small>Freelancer</small></article>
          <article class="feature-card"><p>"Saya lebih cepat lihat kondisi tabungan dan posisi investasi tanpa muter-muter."</p><strong>Andi Pratama</strong><small>Karyawan Swasta</small></article>
        </div>
      </section>

      <section class="marketing-section pricing-band" id="harga">
        <article class="pricing-copy">
          <span class="eyebrow">Harga</span>
          <h2>Mulai gratis. Upgrade saat produk sudah jadi kebiasaan.</h2>
          <p>Akses fitur dasar untuk mulai membangun ritme. Saat user sudah merasakan manfaatnya, upgrade bisa terasa lebih masuk akal.</p>
        </article>
        <article class="pricing-card">
          <div class="pricing-head">
            <div>
              <span>Trial Version</span>
              <h3>Rp 0 <small>/ selamanya</small></h3>
            </div>
            <strong>Efektif</strong>
          </div>
          <ul class="pricing-list">
            <li>Rekap bulanan</li>
            <li>Dashboard ringkasan</li>
            <li>Mobile friendly</li>
            <li>Flow awal yang cepat dipahami</li>
          </ul>
          <a class="primary-btn full" href="/auth/register">Mulai Sekarang</a>
        </article>
      </section>

      <section class="marketing-section transparency-band">
        <article class="transparency-copy">
          <span class="eyebrow">Visi Kami</span>
          <h2>Transparan sejak awal supaya trust terasa dewasa.</h2>
        </article>
        <div class="transparency-grid">
          <article class="feature-card accent-card"><h3>Data keamanan</h3><p>Alur member dan file sekarang bergerak di fondasi yang lebih rapi untuk aplikasi finansial.</p></article>
          <article class="feature-card accent-card"><h3>Infrastruktur modern</h3><p>Cloudflare stack dipertahankan agar backend baru tetap jadi kekuatan utama produk ini.</p></article>
        </div>
      </section>

      <section class="marketing-section final-cta-band">
        <article class="final-cta-card">
          <span class="eyebrow">Start Today</span>
          <h2>Mulai lebih rapi mengelola keuangan pribadi hari ini.</h2>
          <p>Buat akun gratis dan lihat kondisi finansial Anda dalam tampilan yang lebih jelas, modern, dan tenang.</p>
          <div class="cta-row center-cta">
            <a class="primary-btn" href="/auth/register">Daftar Gratis</a>
            <a class="ghost-btn" href="/auth/login">Masuk</a>
          </div>
        </article>
      </section>

      <footer class="site-footer">
        <div class="footer-brand">
          <span class="brand-badge">L</span>
          <div class="footer-copy">
            <strong>Leosiqra</strong>
            <p>Dashboard finansial pribadi premium untuk user Indonesia yang ingin cepat paham kondisi uangnya tanpa ribet.</p>
          </div>
        </div>
        <div class="footer-links">
          <a href="#produk">Produk</a>
          <a href="#fitur">Fitur</a>
          <a href="#pajak">Pajak</a>
          <a href="#harga">Harga</a>
          <a href="/auth/login">Login</a>
        </div>
      </footer>
    </main>
  `);
}

export function authPage(mode) {
  const isLogin = mode === "login";
  const authGuide = isLogin
    ? `
      <div class="auth-guide">
        <article class="auth-guide-item">
          <strong>01</strong>
          <div><h3>Email terdaftar</h3><p>Masuk dengan email member yang sudah aktif di sistem.</p></div>
        </article>
        <article class="auth-guide-item">
          <strong>02</strong>
          <div><h3>Password utama</h3><p>Gunakan password akun. Jika 2FA aktif, lanjutkan dengan OTP enam digit.</p></div>
        </article>
      </div>
    `
    : `
      <div class="auth-guide">
        <article class="auth-guide-item">
          <strong>01</strong>
          <div><h3>Isi identitas dasar</h3><p>Nama, WhatsApp, email, dan password dipakai untuk aktivasi awal member.</p></div>
        </article>
        <article class="auth-guide-item">
          <strong>02</strong>
          <div><h3>Aktifkan lapisan aman</h3><p>Generate TOTP bila Anda ingin setup 2FA sejak registrasi pertama.</p></div>
        </article>
      </div>
    `;
  setView(`
    ${topbar()}
    <main class="auth-layout">
      <section class="auth-panel">
        <span class="eyebrow">${isLogin ? "Login" : "Register"}</span>
        <h1>${isLogin ? "Akses ruang kerja finansial yang lebih tenang." : "Buat akun baru dan masuk ke workspace premium."}</h1>
        <p>${isLogin ? "Masuk dengan email dan password. Jika 2FA aktif, masukkan OTP enam digit." : "Daftar cepat, lanjutkan setup TOTP bila ingin lapisan keamanan tambahan sejak awal."}</p>
        <div class="auth-benefits">
          <div class="mini-stat"><strong>Cloudflare</strong><span>lebih ringan di edge</span></div>
          <div class="mini-stat"><strong>D1 + R2</strong><span>data dan file lebih rapi</span></div>
          <div class="mini-stat"><strong>2FA</strong><span>opsional sejak registrasi</span></div>
        </div>
        ${authGuide}
      </section>
      <section class="auth-card">
        <div class="auth-card-head">
          <span class="eyebrow">${isLogin ? "Member Access" : "Member Setup"}</span>
          <h2>${isLogin ? "Masuk ke akun Anda" : "Aktifkan akun baru Anda"}</h2>
          <p>${isLogin ? "Gunakan email yang terdaftar untuk membuka workspace member." : "Lengkapi data dasar di bawah ini, lalu lanjutkan ke workspace Leosiqra."}</p>
        </div>
        <form id="${mode}-form" class="stack-lg">
          ${!isLogin ? `<label class="field"><span>Nama Lengkap</span><input name="name" type="text" required /></label><label class="field"><span>WhatsApp</span><input name="whatsapp" type="text" /></label>` : ""}
          <label class="field"><span>Email</span><input name="email" type="email" required /></label>
          <label class="field"><span>Password</span><input name="password" type="password" required /></label>
          <label class="field"><span>Kode 2FA</span><input name="twoFactorCode" type="text" maxlength="6" placeholder="Opsional" /></label>
          ${!isLogin ? `<div class="field field-highlight"><span>Setup TOTP</span><div class="inline-actions"><button class="ghost-btn" id="totp-setup-btn" type="button">Generate Secret</button><small id="totp-status">Belum dibuat</small></div><textarea id="totp-secret-box" rows="4" readonly></textarea><small class="field-help">Opsional, tapi disarankan jika akun ini akan dipakai jangka panjang.</small></div>` : `<small class="field-help field-inline-help">Kosongkan kode 2FA jika akun Anda belum mengaktifkannya.</small>`}
          <p class="form-error" id="${mode}-error"></p>
          <button class="primary-btn full" type="submit">${isLogin ? "Login" : "Register"}</button>
        </form>
        <div class="auth-card-foot">
          <small>${isLogin ? "Belum punya akun?" : "Sudah punya akun?"}</small>
          <a href="${isLogin ? "/auth/register" : "/auth/login"}">${isLogin ? "Daftar Gratis" : "Masuk Sekarang"}</a>
        </div>
      </section>
    </main>
  `, () => {
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
  });
}

export async function memberData() {
  const month = getMonthKey();
  const [summary, accounts, transactions, budgets, investments, recurring, savings, categories, currencies, payments, billingSettings] = await Promise.all([
    cached(`/api/dashboard/summary?month=${month}`),
    cached("/api/accounts"),
    cached("/api/transactions"),
    cached("/api/budgets"),
    cached("/api/investments"),
    cached("/api/recurring"),
    cached("/api/savings"),
    cached("/api/categories"),
    cached("/api/currencies"),
    cached("/api/payments"),
    cached("/api/billing/settings")
  ]);
  return { summary, accounts, transactions, budgets, investments, recurring, savings, categories, currencies, payments, billingSettings };
}

export async function adminData() {
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

export function renderMemberPage(data) {
  const { summary, accounts, transactions, budgets, investments, recurring, savings, categories, currencies, payments, billingSettings } = data;
  const recentTransactions = transactions.slice(0, 8);
  const topExpenses = transactions
    .filter((item) => item.type !== "pemasukan")
    .sort((a, b) => Number(b.amountIdr || b.amount || 0) - Number(a.amountIdr || a.amount || 0))
    .slice(0, 3);
  const upcomingRecurring = recurring
    .slice()
    .sort((a, b) => String(a.nextDate || "").localeCompare(String(b.nextDate || "")))
    .slice(0, 3);
  const expenseRatio = summary.totalIncome > 0 ? Math.round((summary.totalExpense / summary.totalIncome) * 100) : 0;
  const activePackages = billingSettings?.proPackages?.length ? billingSettings.proPackages : [{ id: "pro-1m", name: "Pro 1 Bulan", durationMonths: 1, price: 0 }];
  const baseCards = stats([
    { label: "Saldo Total", value: formatMoney(summary.totalBalance), note: "Semua rekening aktif" },
    { label: "Pemasukan Bulan Ini", value: formatMoney(summary.totalIncome), note: "Berdasarkan transaksi" },
    { label: "Pengeluaran Bulan Ini", value: formatMoney(summary.totalExpense), note: "Cash outflow" },
    { label: "Investasi Aktif", value: formatMoney(summary.totalInvestment), note: "Current value" }
  ]);
  const dashboardIntro = `
    <section class="hero-strip">
      <article class="hero-strip-card">
        <span class="eyebrow">Ringkasan Utama</span>
        <h2>Workspace member yang lebih rapat dan lebih mudah dipindai.</h2>
        <p>Halaman ini sekarang mulai mengadopsi hierarchy visual project lama: angka dominan, aktivitas terbaru, dan akses cepat ke modul penting.</p>
      </article>
    </section>
  `;

  if (state.route === "/membership/dashboard") {
    return shell({
      title: "Dashboard Bulanan",
      subtitle: "Ringkasan utama dengan hierarki informasi yang lebih jelas.",
      nav: memberNav,
      content: `
        ${dashboardIntro}
        ${baseCards}
        <section class="panel-grid dashboard-grid">
          ${panel("Kesehatan Cashflow", `
            <div class="health-band">
              <div class="health-primary">
                <strong>${summary.totalIncome > 0 ? Math.max(100 - expenseRatio, 0) : 0}%</strong>
                <span>${expenseRatio > 85 ? "Pengeluaran mulai menekan ruang gerak bulan ini." : "Cashflow masih punya ruang napas yang sehat."}</span>
              </div>
              <div class="health-meter">
                <div class="health-meter-fill" style="width:${Math.min(expenseRatio, 100)}%"></div>
              </div>
              <div class="health-legend">
                <small>Expense ratio</small>
                <strong>${expenseRatio}% dari pemasukan</strong>
              </div>
            </div>
          `, "soft-panel")}
          ${panel("Agenda Berikutnya", `
            <ul class="summary-list">
              ${upcomingRecurring.length ? upcomingRecurring.map((item) => `<li><span>${item.name}</span><strong>${formatDate(item.nextDate)}</strong></li>`).join("") : "<li><span>Belum ada jadwal recurring</span><strong>Aman</strong></li>"}
            </ul>
          `, "accent-panel")}
        </section>
        <section class="panel-grid">
          ${panel("Aktivitas Terbaru", table(["Tanggal", "Kategori", "Tipe", "Nominal"], recentTransactions.map((row) => `<tr><td>${formatDate(row.date)}</td><td>${row.category}</td><td>${row.type}</td><td>${formatMoney(row.amountIdr || row.amount)}</td></tr>`)), "soft-panel")}
          ${panel("Snapshot Modul", `<ul class="summary-list"><li><span>Rekening</span><strong>${accounts.length}</strong></li><li><span>Budget</span><strong>${budgets.length}</strong></li><li><span>Investasi</span><strong>${investments.length}</strong></li><li><span>Recurring</span><strong>${recurring.length}</strong></li></ul>`, "accent-panel")}
        </section>
        <section class="panel-grid">
          ${panel("Pengeluaran Tertinggi", `
            <div class="rank-list">
              ${topExpenses.length ? topExpenses.map((item, index) => `
                <article class="rank-item">
                  <div class="rank-index">#${index + 1}</div>
                  <div class="rank-copy">
                    <small>${item.category}</small>
                    <strong>${item.note || item.subCategory || item.category}</strong>
                  </div>
                  <div class="rank-value">${formatMoney(item.amountIdr || item.amount)}</div>
                </article>
              `).join("") : `<p class="muted">Belum ada pengeluaran besar yang perlu diawasi.</p>`}
            </div>
          `)}
          ${panel("Shortcut Minggu Ini", `
            <div class="action-stack">
              <a class="action-card" href="/membership/transactions/daily"><small>Input & Review</small><strong>Rapikan transaksi harian</strong><span>Cek transaksi terbaru dan validasi kategori yang masih campur.</span></a>
              <a class="action-card" href="/membership/contact"><small>Upgrade</small><strong>Aktifkan akses Pro</strong><span>Buka fitur premium dan percepat verifikasi pembayaran Anda.</span></a>
              <a class="action-card" href="/membership/pajak-center"><small>SPT</small><strong>Review ringkasan pajak</strong><span>Pantau aset, tabungan, dan transaksi tahunan di satu tempat.</span></a>
            </div>
          `)}
        </section>
      `
    });
  }

  if (state.route === "/membership/annual") {
    const income = transactions.filter((item) => item.type === "pemasukan").reduce((sum, item) => sum + Number(item.amountIdr || item.amount || 0), 0);
    const expense = transactions.filter((item) => item.type !== "pemasukan").reduce((sum, item) => sum + Number(item.amountIdr || item.amount || 0), 0);
    return shell({
      title: "Dashboard Tahunan",
      subtitle: "Versi native laporan tahunan dengan fokus fiskal dan posisi aset.",
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
    const budgetUsage = budgets.map((item) => {
      const actual = transactions
        .filter((trx) => String(trx.category || "").toLowerCase() === String(item.category || "").toLowerCase())
        .reduce((sum, trx) => sum + Number(trx.amountIdr || trx.amount || 0), 0);
      const ratio = item.amount > 0 ? Math.round((actual / item.amount) * 100) : 0;
      return { item, actual, ratio };
    });
    const overBudget = budgetUsage.filter(({ ratio }) => ratio > 100).length;
    return shell({
      title: "Budget & Target",
      subtitle: "Target pemasukan, batas pengeluaran, dan baseline tabungan/investasi.",
      nav: memberNav,
      content: `
        <section class="panel-grid budget-overview">
          ${panel("Kontrol Bulan Ini", `
            <div class="health-band">
              <div class="health-primary">
                <strong>${budgets.length}</strong>
                <span>${overBudget > 0 ? `${overBudget} kategori sudah melewati target dan perlu perhatian.` : "Belum ada kategori yang melewati target bulan ini."}</span>
              </div>
            </div>
          `, "soft-panel")}
          ${panel("Budget yang Paling Ketat", `
            <div class="rank-list">
              ${budgetUsage.length ? budgetUsage.slice().sort((a, b) => b.ratio - a.ratio).slice(0, 3).map(({ item, ratio }, index) => `
                <article class="rank-item">
                  <div class="rank-index">#${index + 1}</div>
                  <div class="rank-copy">
                    <small>${item.type}</small>
                    <strong>${item.category}</strong>
                  </div>
                  <div class="rank-value">${ratio}%</div>
                </article>
              `).join("") : `<p class="muted">Belum ada budget aktif untuk dianalisis.</p>`}
            </div>
          `, "accent-panel")}
        </section>
        ${baseCards}
        ${panel("Daftar Budget", table(["Tipe", "Kategori", "Period", "Target", "Realisasi", "Rasio"], budgetUsage.map(({ item, actual, ratio }) => `<tr><td>${item.type}</td><td>${item.category}</td><td>${item.period}</td><td>${formatMoney(item.amount)}</td><td>${formatMoney(actual)}</td><td>${ratio}%</td></tr>`)))}
      `
    });
  }

  if (state.route === "/membership/rekening") {
    const accountTypeMap = accounts.reduce((acc, item) => {
      const type = item.type || "Lainnya";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    const topAccounts = accounts.slice().sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0)).slice(0, 3);
    return shell({
      title: "Rekening & Kartu",
      subtitle: "Pengganti halaman rekening dan kartu aktif.",
      nav: memberNav,
      content: `
        <section class="panel-grid account-overview">
          ${panel("Distribusi Rekening", `
            <ul class="summary-list">
              ${Object.keys(accountTypeMap).length ? Object.entries(accountTypeMap).map(([type, total]) => `<li><span>${type}</span><strong>${total}</strong></li>`).join("") : "<li><span>Belum ada rekening</span><strong>0</strong></li>"}
            </ul>
          `, "soft-panel")}
          ${panel("Akun Dengan Saldo Terbesar", `
            <div class="rank-list">
              ${topAccounts.length ? topAccounts.map((item, index) => `
                <article class="rank-item">
                  <div class="rank-index">#${index + 1}</div>
                  <div class="rank-copy">
                    <small>${item.type}</small>
                    <strong>${item.name}</strong>
                  </div>
                  <div class="rank-value">${formatMoney(item.balance)}</div>
                </article>
              `).join("") : `<p class="muted">Tambahkan rekening untuk melihat ranking saldo terbesar.</p>`}
            </div>
          `, "accent-panel")}
        </section>
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
    const incomeCount = transactions.filter((trx) => trx.type === "pemasukan").length;
    const expenseCount = transactions.filter((trx) => trx.type !== "pemasukan").length;
    const latestSearchMatches = transactions
      .filter((trx) => String(trx.note || trx.category || "").toLowerCase().includes("transfer") || String(trx.type || "").toLowerCase().includes("topup"))
      .slice(0, 3);
    return shell({
      title: "Transaksi Harian",
      subtitle: "Daftar transaksi harian lengkap beserta tenor dan bunga jika ada.",
      nav: memberNav,
      content: `
        <section class="panel-grid transaction-overview">
          ${panel("Pulse Transaksi", `
            <div class="summary-split">
              <div class="summary-split-item">
                <small>Pemasukan</small>
                <strong>${incomeCount}</strong>
                <span>transaksi masuk pada periode ini</span>
              </div>
              <div class="summary-split-item">
                <small>Pengeluaran</small>
                <strong>${expenseCount}</strong>
                <span>transaksi keluar pada periode ini</span>
              </div>
            </div>
          `, "soft-panel")}
          ${panel("Pola yang Sering Dicari", `
            <div class="rank-list">
              ${latestSearchMatches.length ? latestSearchMatches.map((item, index) => `
                <article class="rank-item">
                  <div class="rank-index">#${index + 1}</div>
                  <div class="rank-copy">
                    <small>${item.type}</small>
                    <strong>${item.note || item.category}</strong>
                  </div>
                  <div class="rank-value">${formatMoney(item.amountIdr || item.amount)}</div>
                </article>
              `).join("") : `<p class="muted">Belum ada pola transfer/top up yang muncul di periode ini.</p>`}
            </div>
          `, "accent-panel")}
        </section>
        ${panel("Transaksi", table(["Tanggal", "Kategori", "Tipe", "Nominal", "Tenor", "Bunga/Bulan"], transactions.map((trx) => `<tr><td>${formatDate(trx.date)}</td><td>${trx.category}</td><td>${trx.type}</td><td>${formatMoney(trx.amountIdr || trx.amount)}</td><td>${trx.installmentTenor || "-"}</td><td>${trx.monthlyInterest ? formatMoney(trx.monthlyInterest) : "-"}</td></tr>`)))}
      `
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
        ${panel("Daftar Hutang / Piutang", table(["Tanggal", "Pihak", "Kategori", "Status", "Tenor", "Nominal"], debtItems.map((item) => `<tr><td>${formatDate(item.date)}</td><td>${item.lenderName || "-"}</td><td>${item.category}</td><td>${toneBadge(item.paymentStatus || item.status)}</td><td>${item.installmentTenor || "-"}</td><td>${formatMoney(item.amountIdr || item.amount)}</td></tr>`), "Belum ada item hutang/piutang. Mulai dari transaksi harian lalu tandai item yang perlu dipantau."))}
      `
    });
  }

  if (state.route === "/membership/transactions/topup") {
    const topups = transactions.filter((item) => ["topup", "transfer"].includes(item.type));
    return shell({
      title: "Top Up & Transfer",
      subtitle: "Mutasi antar akun dan transfer masuk/keluar.",
      nav: memberNav,
      content: `
        ${panel("Riwayat Top Up / Transfer", table(["Tanggal", "Dari Akun", "Ke Akun", "Tipe", "Nominal"], topups.map((item) => `<tr><td>${formatDate(item.date)}</td><td>${item.accountId || "-"}</td><td>${item.targetAccountId || "-"}</td><td>${toneBadge(item.type, "is-neutral")}</td><td>${formatMoney(item.amountIdr || item.amount)}</td></tr>`), "Belum ada top up atau transfer di periode ini. Gunakan flow transaksi agar mutasi akun lebih rapi."))}
      `
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
        ${panel("Daftar Tabungan", table(["Tanggal", "Deskripsi", "Goal", "Kategori", "Nominal"], savings.map((item) => `<tr><td>${formatDate(item.date)}</td><td>${item.description}</td><td>${item.toGoal}</td><td>${item.category}</td><td>${formatMoney(item.amountIdr || item.amount)}</td></tr>`), "Belum ada setoran tabungan. Mulai dari nominal kecil agar target terasa realistis."))}
      `
    });
  }

  if (state.route === "/membership/investment" || state.route.startsWith("/membership/investasi/")) {
    const pageType = state.route.includes("/saham") ? "saham" : state.route.includes("/deposito") ? "deposito" : state.route.includes("/lainnya") ? "lainnya" : "all";
    const items = filtersForInvestments(investments, pageType);
    const pageTitle = pageType === "saham" ? "Portofolio Saham" : pageType === "deposito" ? "Deposito" : pageType === "lainnya" ? "Investasi Lainnya" : "Ringkasan Investasi";
    const totalCurrent = items.reduce((sum, item) => sum + Number(item.currentValueIdr || item.currentValue || 0), 0);
    const totalInvested = items.reduce((sum, item) => sum + Number(item.amountIdr || item.amountInvested || 0), 0);
    const gainValue = totalCurrent - totalInvested;
    const topPerformers = items.slice().sort((a, b) => Number(b.returnPercentage || 0) - Number(a.returnPercentage || 0)).slice(0, 3);
    return shell({
      title: pageTitle,
      subtitle: "Tampilan native untuk modul investasi lengkap dengan filter tipe dan status portofolio.",
      nav: memberNav,
      content: `
        <section class="panel-grid investment-overview">
          ${panel("Performa Portofolio", `
            <div class="health-band">
              <div class="health-primary">
                <strong>${formatMoney(gainValue)}</strong>
                <span>${gainValue >= 0 ? "Portofolio berada di zona keuntungan dibanding modal awal." : "Portofolio masih berada di bawah modal awal dan perlu dipantau."}</span>
              </div>
            </div>
          `, "soft-panel")}
          ${panel("Posisi Paling Menonjol", `
            <div class="rank-list">
              ${topPerformers.length ? topPerformers.map((item, index) => `
                <article class="rank-item">
                  <div class="rank-index">#${index + 1}</div>
                  <div class="rank-copy">
                    <small>${item.type}</small>
                    <strong>${item.stockCode || item.name}</strong>
                  </div>
                  <div class="rank-value">${Number(item.returnPercentage || 0).toFixed(2)}%</div>
                </article>
              `).join("") : `<p class="muted">Belum ada posisi investasi yang bisa dibandingkan.</p>`}
            </div>
          `, "accent-panel")}
        </section>
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
      subtitle: "Draft ringkasan SPT berbasis transaksi, aset, dan investasi di D1.",
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
    const latestPayments = payments.slice(0, 6);
    return shell({
      title: "Konfirmasi Pembayaran Pro",
      subtitle: "Flow upgrade yang lebih jelas, singkat, dan meyakinkan.",
      nav: memberNav,
      content: `
        <section class="panel-grid payment-layout">
          ${panel("Upgrade ke Pro", `
            <div class="payment-hero">
              <div class="payment-hero-copy">
                <span class="eyebrow">Benefit Pro</span>
                <h3>Buat aktivasi member terasa mudah dan terpercaya.</h3>
                <p>Isi paket, upload bukti, lalu admin akan memverifikasi. Halaman ini sekarang lebih fokus ke satu tujuan: membuat user yakin untuk lanjut.</p>
              </div>
              <ul class="payment-benefits">
                <li>Dashboard lebih lengkap untuk finance tracking</li>
                <li>Alur pembayaran dan verifikasi lebih rapi</li>
                <li>Pajak Center dan workspace premium lebih siap dipakai</li>
              </ul>
            </div>
            <form id="payment-form" class="stack-lg payment-form">
              <label class="field">
                <span>Pilih Paket</span>
                <select id="payment-package" name="packageId">
                  ${activePackages.map((pkg) => `<option value="${pkg.id}" data-price="${pkg.price}" data-months="${pkg.durationMonths}">${pkg.name} - ${formatMoney(pkg.price)}</option>`).join("")}
                </select>
              </label>
              <label class="field">
                <span>Nominal</span>
                <input id="payment-amount" name="amount" value="${activePackages[0]?.price || 0}" type="number" min="0" />
              </label>
              <label class="field">
                <span>Catatan</span>
                <textarea name="note" rows="4" placeholder="Tulis keterangan transfer, nama pengirim, atau info tambahan lain."></textarea>
              </label>
              <div class="field">
                <span>Upload Bukti</span>
                <input id="payment-proof-file" type="file" accept="image/*,.pdf" />
                <input id="payment-proof-url" type="hidden" name="proofImageUrl" value="" />
                <small id="payment-proof-status" class="muted"></small>
              </div>
              <button class="primary-btn full" type="submit">Kirim Konfirmasi Pembayaran</button>
              <p id="payment-form-status" class="muted"></p>
            </form>
          `, "soft-panel")}
          ${panel("Detail Pembayaran", `
            <div class="payment-detail-stack">
              <div class="detail-block"><small>Bank Tujuan</small><strong>${billingSettings.bankName || "-"}</strong><span>${billingSettings.bankAccountName || "-"}</span></div>
              <div class="detail-block"><small>No. Rekening</small><strong>${billingSettings.bankNumber || "-"}</strong><span>Pastikan nominal sesuai paket agar verifikasi cepat.</span></div>
              <div class="detail-block"><small>Billing Email</small><strong>${billingSettings.billingEmail || "-"}</strong><span>Gunakan jika butuh bantuan verifikasi manual.</span></div>
              <div class="detail-block"><small>WhatsApp</small><strong>${billingSettings.whatsapp || "-"}</strong><span>Channel tercepat untuk follow up.</span></div>
            </div>
          `, "accent-panel")}
        </section>
        ${panel("Riwayat Ticket Pembayaran", table(["Tanggal", "Status", "Nominal", "Bukti"], latestPayments.map((item) => `<tr><td>${formatDate(item.createdAt)}</td><td><span class="status-chip ${String(item.status || "").toLowerCase()}">${item.status}</span></td><td>${formatMoney(item.amount)}</td><td>${item.proofImageUrl ? `<a href="${item.proofImageUrl}" target="_blank" rel="noreferrer">Lihat</a>` : "-"}</td></tr>`), "Belum ada ticket pembayaran."))}
      `
    });
  }

  if (state.route === "/membership/ai-leosiqra") {
    return shell({
      title: "AI Leosiqra",
      subtitle: "Ruang AI native. Provider AI bisa ditancapkan langsung dari Worker.",
      nav: memberNav,
      content: `
        ${panel("Context Snapshot", `<ul class="summary-list"><li><span>Rekening</span><strong>${accounts.length}</strong></li><li><span>Transaksi</span><strong>${transactions.length}</strong></li><li><span>Investasi</span><strong>${investments.length}</strong></li><li><span>Budget</span><strong>${budgets.length}</strong></li></ul>`)}
        ${panel("Status", emptyPrompt({ eyebrow: "Coming Next", title: "Halaman AI siap dijadikan fitur premium.", description: "Fondasinya sudah ada. Langkah berikutnya adalah menyambungkan provider AI langsung dari Worker agar user bisa bertanya berdasarkan data finansial mereka.", ctaHref: "/membership/contact", ctaLabel: "Aktifkan Pro Lebih Dulu" }))}
      `
    });
  }

  if (state.route === "/membership/profile") {
    const latestAccount = accounts[0];
    return shell({
      title: "Profile",
      subtitle: "Profil yang lebih hangat, lebih jelas, dan lebih berguna untuk member.",
      nav: memberNav,
      content: `
        <section class="panel-grid profile-overview">
          ${panel("Identity Ringkas", `
            <div class="profile-card">
              <div class="profile-avatar">${(state.user.name || state.user.email || "L").slice(0, 1).toUpperCase()}</div>
              <div class="profile-copy">
                <small>Member Identity</small>
                <strong>${state.user.name || "Member Leosiqra"}</strong>
                <span>${state.user.email || "-"}</span>
              </div>
              <div class="profile-plan">${state.user.plan || "FREE"}</div>
            </div>
          `, "soft-panel")}
          ${panel("Snapshot Aktivitas", `
            <ul class="summary-list">
              <li><span>Akun Aktif</span><strong>${accounts.length}</strong></li>
              <li><span>Total Transaksi</span><strong>${transactions.length}</strong></li>
              <li><span>Rekening Terakhir</span><strong>${latestAccount?.name || "-"}</strong></li>
              <li><span>Status Member</span><strong>${state.user.status || "-"}</strong></li>
            </ul>
          `, "accent-panel")}
        </section>
        ${stats([
          { label: "Akun Aktif", value: String(accounts.length) },
          { label: "Total Transaksi", value: String(transactions.length) },
          { label: "Plan", value: state.user.plan || "-" },
          { label: "Status", value: state.user.status || "-" }
        ])}
        <section class="panel-grid">
          ${panel("Identity Settings", `<form id="profile-form" class="stack-md"><label class="field"><span>Nama</span><input name="name" value="${state.user.name || ""}" /></label><label class="field"><span>WhatsApp</span><input name="whatsapp" placeholder="08xxxxxxxxxx" /></label><label class="field"><span>Username</span><input name="username" placeholder="username-anda" /></label><label class="field"><span>Address</span><input name="address" placeholder="Kota / alamat singkat" /></label><button class="primary-btn full" type="submit">Simpan Profile</button><p class="muted" id="profile-status"></p></form>`)}
          ${panel("Security Center", `<form id="upload-form" class="stack-md"><label class="field"><span>Kategori Upload</span><input name="category" value="profile" /></label><label class="field"><span>File</span><input type="file" name="file" required /></label><button class="primary-btn full" type="submit">Upload ke R2</button><p class="muted" id="upload-status"></p></form><div class="subtle-note"><strong>Catatan:</strong> gunakan upload ini untuk avatar, bukti identitas, atau file pendukung lain yang memang perlu disimpan privat.</div>`, "soft-panel")}
        </section>
      `
    });
  }

  return shell({
    title: "Member Area",
    subtitle: "Route ini sudah dipetakan, tetapi belum punya komponen khusus tambahan.",
    nav: memberNav,
    content: `${baseCards}${panel("Langkah Berikutnya", emptyPrompt({ title: "Halaman ini sudah punya fondasi data.", description: "Komponen khusus untuk route ini belum dipoles penuh, tetapi data inti dan shell workspace sudah siap dipakai.", ctaHref: "/membership/dashboard", ctaLabel: "Kembali ke Dashboard" }))}`
  });
}

export function renderAdminPage(data) {
  const { settings, users, payments, logs } = data;
  const approved = payments.filter((item) => item.status === "DISETUJUI");
  const pending = payments.filter((item) => item.status === "MENUNGGU");

  if (state.route === "/admin/dashboard" || state.route === "/admin") {
    return shell({
      title: "Dashboard Operasional",
      subtitle: "Ringkasan operasional admin yang berjalan penuh di Worker dan D1.",
      nav: adminNav,
      content: `
        ${stats([
          { label: "Total User", value: String(users.length) },
          { label: "PRO Aktif", value: String(users.filter((item) => item.plan === "PRO").length) },
          { label: "Pending Ticket", value: String(pending.length) },
          { label: "Revenue Approved", value: formatMoney(approved.reduce((sum, item) => sum + Number(item.amount || 0), 0)) }
        ])}
        <section class="panel-grid">
          ${panel("Prioritas Hari Ini", `
            <div class="action-stack">
              <a class="action-card" href="/admin/pembayaran"><small>Queue</small><strong>Verifikasi pembayaran pending</strong><span>${pending.length ? `${pending.length} ticket menunggu tindakan admin.` : "Tidak ada ticket yang tertahan saat ini."}</span></a>
              <a class="action-card" href="/admin/user"><small>Member</small><strong>Cek kesehatan akun member</strong><span>${users.filter((item) => item.status === "GUEST").length} akun masih berstatus guest dan bisa ditinjau.</span></a>
            </div>
          `, "soft-panel")}
          ${panel("Signals", `
            <ul class="summary-list">
              <li><span>User Aktif</span><strong>${users.filter((item) => item.status === "AKTIF").length}</strong></li>
              <li><span>Ticket Pending</span><strong>${pending.length}</strong></li>
              <li><span>Audit Log Baru</span><strong>${logs.slice(0, 5).length}</strong></li>
            </ul>
          `, "accent-panel")}
        </section>
        <section class="panel-grid">
          ${panel("User Terbaru", table(["Nama", "Email", "Plan", "Status"], users.slice(0, 8).map((item) => `<tr><td>${item.name || "-"}</td><td>${item.email}</td><td>${toneBadge(item.plan)}</td><td>${toneBadge(item.status)}</td></tr>`), "Belum ada user baru yang masuk."))}
          ${panel("Queue Pembayaran", table(["Tanggal", "User", "Status", "Nominal"], payments.slice(0, 8).map((item) => `<tr><td>${formatDate(item.createdAt)}</td><td>${item.userName || item.userEmail || item.userId}</td><td>${toneBadge(item.status)}</td><td>${formatMoney(item.amount)}</td></tr>`), "Belum ada pembayaran yang masuk."))}
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
        ${panel("Antrian Pembayaran", table(["Tanggal", "User", "Status", "Nominal", "Aksi"], payments.map((item) => `<tr><td>${formatDate(item.createdAt)}</td><td>${item.userName || item.userEmail || item.userId}</td><td>${toneBadge(item.status)}</td><td>${formatMoney(item.amount)}</td><td class="action-cell"><button class="ghost-btn payment-action" data-id="${item.id}" data-status="DISETUJUI" type="button">Approve</button><button class="ghost-btn payment-action" data-id="${item.id}" data-status="DITOLAK" type="button">Reject</button></td></tr>`), "Belum ada ticket pembayaran untuk diverifikasi."))}
        <p class="muted" id="payment-status"></p>
      `
    });
  }

  if (state.route === "/admin/user") {
    return shell({
      title: "User Console",
      subtitle: "Kelola plan, status, dan visibilitas akun member.",
      nav: adminNav,
      content: `${panel("Daftar Member", table(["Nama", "Email", "Role", "Plan", "Status", "Expired"], users.map((item) => `<tr><td>${item.name || "-"}</td><td>${item.email}</td><td>${toneBadge(item.role, "is-neutral")}</td><td>${toneBadge(item.plan)}</td><td>${toneBadge(item.status)}</td><td>${formatDate(item.expiredAt)}</td></tr>`), "Belum ada member yang bisa ditampilkan."))}`
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
    content: stats([
      { label: "User", value: String(users.length) },
      { label: "Payment", value: String(payments.length) },
      { label: "Logs", value: String(logs.length) },
      { label: "Settings", value: "Ready" }
    ])
  });
}

export function renderMemberLoading() {
  setView(loadingShell("Memuat workspace...", "Menarik data member dari D1...", memberNav));
}

export function renderAdminLoading() {
  setView(loadingShell("Memuat console...", "Menarik data admin dari D1...", adminNav));
}
