import { state } from "./core.js";
import { adminQuickActions, memberQuickActions } from "./config.js";

function normalizeTone(value = "") {
  const key = String(value).toLowerCase();
  if (["aktif", "approved", "disetujui", "pro", "success"].includes(key)) return "is-positive";
  if (["guest", "free", "pending", "menunggu"].includes(key)) return "is-warn";
  if (["ditolak", "gagal", "revoked", "expired"].includes(key)) return "is-danger";
  return "is-neutral";
}

export function toneBadge(label, tone = "") {
  return `<span class="tone-badge ${tone || normalizeTone(label)}">${label || "-"}</span>`;
}

export function emptyPrompt({ eyebrow = "Belum Ada Data", title, description, ctaHref, ctaLabel }) {
  return `
    <div class="empty-prompt">
      <span class="eyebrow">${eyebrow}</span>
      <h3>${title}</h3>
      <p>${description}</p>
      ${ctaHref && ctaLabel ? `<a class="primary-btn" href="${ctaHref}">${ctaLabel}</a>` : ""}
    </div>
  `;
}

export function topbar() {
  if (!state.user) {
    const isLoginRoute = ["/login", "/auth/login"].includes(state.route);
    const isRegisterRoute = ["/register", "/auth/register"].includes(state.route);
    return `
      <header class="topbar marketing-topbar">
        <a class="brand brand-lockup" href="/">
          <span class="brand-badge">L</span>
          <span class="brand-copy">
            <strong>Leosiqra</strong>
            <small>Financial Member Site</small>
          </span>
        </a>
        <button class="mobile-nav-toggle" id="mobile-nav-toggle" type="button" aria-expanded="false" aria-controls="public-nav">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <nav class="public-nav" id="public-nav">
          <a href="#produk">Produk</a>
          <a href="#fitur">Fitur</a>
          <a href="#pajak">Pajak</a>
          <a href="#cara-kerja">Cara Kerja</a>
          <a href="#harga">Harga</a>
          <a href="#keamanan">Keamanan</a>
        </nav>
        <div class="topbar-actions">
          <a class="ghost-btn ${isLoginRoute ? "is-active-auth" : ""}" href="/auth/login">Login</a>
          <a class="primary-btn ${isRegisterRoute ? "is-active-auth" : ""}" href="/auth/register">Daftar Gratis</a>
        </div>
      </header>
    `;
  }

  return `
    <header class="topbar workspace-topbar">
      <a class="brand brand-lockup" href="${state.user.role === "admin" ? "/admin/dashboard" : "/membership/dashboard"}">
        <span class="brand-badge">L</span>
        <span class="brand-copy">
          <strong>Leosiqra</strong>
          <small>${state.user.role === "admin" ? "Operational Console" : "Member Workspace"}</small>
        </span>
      </a>
      <div class="topbar-actions">
        <span class="pill">${state.user.role === "admin" ? "Admin Console" : state.user.plan || "FREE"} / ${state.user.status || "-"}</span>
        <a class="ghost-btn" href="${state.user.role === "admin" ? "/admin/pengaturan" : "/membership/profile"}">Profile</a>
        <button class="ghost-btn" type="button" id="logout-btn">Logout</button>
      </div>
    </header>
  `;
}

export function shell({ title, subtitle, nav, content }) {
  const quickActions = state.user?.role === "admin" ? adminQuickActions : memberQuickActions;
  return `
    ${topbar()}
    <main class="workspace-shell">
      <aside class="sidebar">
        <div class="sidebar-card sidebar-hero">
          <span class="eyebrow">${state.user?.role === "admin" ? "Admin Area" : "Member Area"}</span>
          <h2>${state.user?.name || "Leosiqra"}</h2>
          <p>${state.user?.email || "Cloudflare migration shell"}</p>
          <div class="sidebar-plan">
            ${toneBadge(state.user?.plan || "FREE")}
            ${toneBadge(state.user?.status || "GUEST")}
          </div>
        </div>
        <nav class="menu-list">
          ${nav.map((item) => `<a class="menu-link ${state.route === item.href ? "active" : ""}" href="${item.href}">${item.label}</a>`).join("")}
        </nav>
      </aside>
      <section class="content">
        <section class="section-head">
          <div class="section-head-copy">
            <span class="eyebrow">${state.user?.role === "admin" ? "Operational Console" : "Finance Workspace"}</span>
            <h1>${title}</h1>
            <p>${subtitle}</p>
          </div>
          <div class="quick-actions">
            ${quickActions.map((item) => `<a class="quick-link" href="${item.href}">${item.label}</a>`).join("")}
          </div>
        </section>
        ${content}
      </section>
    </main>
  `;
}

export function stats(cards) {
  return `
    <section class="stats-grid">
      ${cards.map((card) => `
        <article class="stat-card">
          <small>${card.label}</small>
          <strong>${card.value}</strong>
          <span>${card.note || ""}</span>
        </article>
      `).join("")}
    </section>
  `;
}

export function panel(title, body, tone = "") {
  return `<article class="panel ${tone}"><h2>${title}</h2>${body}</article>`;
}

export function table(headers, rows, empty = "Belum ada data.") {
  return `
    <div class="table-scroll">
      <table>
        <thead><tr>${headers.map((item) => `<th>${item}</th>`).join("")}</tr></thead>
        <tbody>${rows.length ? rows.join("") : `<tr><td colspan="${headers.length}" class="table-empty">${empty}</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

export function loadingShell(title, subtitle, nav) {
  return shell({
    title,
    subtitle,
    nav,
    content: `
      <section class="loading-grid">
        <article class="loading-panel">
          <span></span><span></span><span></span>
        </article>
        <article class="loading-panel">
          <span></span><span></span><span></span>
        </article>
      </section>
    `
  });
}
