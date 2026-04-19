const bootstrap = window.__BOOTSTRAP__ || {};

export const app = document.querySelector("#app");

export const state = {
  user: bootstrap.user || null,
  route: bootstrap.route || "/",
  turnstileSiteKey: bootstrap.turnstileSiteKey || "",
  cache: new Map()
};

export function setView(html, onRendered) {
  app.innerHTML = html;
  if (typeof onRendered === "function") onRendered();
}

export function getMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export async function api(path, options = {}) {
  const headers = {
    ...(options.headers || {})
  };
  if (!(options.body instanceof FormData) && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers
  });
  const payload = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
  if (!response.ok) throw new Error(payload?.error || "Request gagal.");
  return payload?.data ?? payload;
}

export async function cached(path) {
  if (!state.cache.has(path)) state.cache.set(path, api(path));
  return state.cache.get(path);
}

export async function guardRoute() {
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

export function bindGlobalActions() {
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
        await api("/api/profile", {
          method: "PATCH",
          body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries()))
        });
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

  const paymentPackageSelect = document.querySelector("#payment-package");
  const paymentAmountInput = document.querySelector("#payment-amount");
  if (paymentPackageSelect && paymentAmountInput) {
    paymentPackageSelect.addEventListener("change", () => {
      const selectedOption = paymentPackageSelect.options[paymentPackageSelect.selectedIndex];
      paymentAmountInput.value = selectedOption.dataset.price || "";
    });
  }

  const paymentProofInput = document.querySelector("#payment-proof-file");
  if (paymentProofInput) {
    paymentProofInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      const paymentProofStatus = document.querySelector("#payment-proof-status");
      const paymentProofUrl = document.querySelector("#payment-proof-url");
      if (!file || !paymentProofStatus || !paymentProofUrl) return;
      paymentProofStatus.textContent = "Mengunggah bukti...";
      try {
        const formData = new FormData();
        formData.set("category", "payment-proof");
        formData.set("file", file);
        const response = await fetch("/api/uploads", { method: "POST", body: formData, credentials: "same-origin" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Gagal upload bukti.");
        paymentProofUrl.value = payload.data.url;
        paymentProofStatus.textContent = "Bukti pembayaran siap dipakai.";
      } catch (error) {
        paymentProofStatus.textContent = error.message;
      }
    });
  }

  const paymentForm = document.querySelector("#payment-form");
  if (paymentForm) {
    paymentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const statusEl = document.querySelector("#payment-form-status");
      const submitBtn = paymentForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      if (statusEl) statusEl.textContent = "Mengirim konfirmasi pembayaran...";
      try {
        const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
        const selectedOption = document.querySelector("#payment-package")?.selectedOptions?.[0];
        const pkg = {
          id: payload.packageId,
          name: selectedOption?.textContent?.trim() || payload.packageId,
          durationMonths: Number(selectedOption?.dataset.months || 1)
        };
        await api("/api/payments", {
          method: "POST",
          body: JSON.stringify({
            amount: Number(payload.amount || 0),
            note: payload.note || null,
            proofImageUrl: payload.proofImageUrl || null,
            package: pkg
          })
        });
        if (statusEl) statusEl.textContent = "Konfirmasi pembayaran terkirim. Muat ulang halaman ini untuk melihat status terbaru.";
        paymentForm.reset();
        if (selectedOption && paymentAmountInput) paymentAmountInput.value = selectedOption.dataset.price || "";
        if (document.querySelector("#payment-proof-status")) document.querySelector("#payment-proof-status").textContent = "";
      } catch (error) {
        if (statusEl) statusEl.textContent = error.message;
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  const settingsForm = document.querySelector("#settings-form");
  if (settingsForm) {
    settingsForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api("/api/admin/settings", {
          method: "PATCH",
          body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries()))
        });
        document.querySelector("#settings-status").textContent = "Settings tersimpan.";
      } catch (error) {
        document.querySelector("#settings-status").textContent = error.message;
      }
    });
  }

  document.querySelectorAll(".payment-action").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api(`/api/admin/payments/${button.dataset.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: button.dataset.status })
        });
        document.querySelector("#payment-status").textContent = `Payment ${button.dataset.id} diubah ke ${button.dataset.status}. Muat ulang halaman untuk sinkronisasi tampilan.`;
      } catch (error) {
        document.querySelector("#payment-status").textContent = error.message;
      }
    });
  });
}

export function bindPublicTopbar() {
  const topbar = document.querySelector(".marketing-topbar");
  const toggle = document.querySelector("#mobile-nav-toggle");
  const navLinks = Array.from(document.querySelectorAll(".public-nav a"));
  if (!topbar || !toggle) return;

  const closeMenu = () => {
    topbar.classList.remove("is-menu-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  const openMenu = () => {
    topbar.classList.add("is-menu-open");
    toggle.setAttribute("aria-expanded", "true");
  };

  toggle.addEventListener("click", () => {
    const isOpen = topbar.classList.contains("is-menu-open");
    if (isOpen) closeMenu();
    else openMenu();
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 720) closeMenu();
  });
}

export function bindMarketingInteractions() {
  bindPublicTopbar();
  const marketingTopbar = document.querySelector(".marketing-topbar");
  const navLinks = Array.from(document.querySelectorAll(".public-nav a"));
  const cleanup = [];
  const sections = navLinks
    .map((link) => {
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("#")) return null;
      const target = document.querySelector(href);
      return target ? { link, target } : null;
    })
    .filter(Boolean);

  const revealTargets = Array.from(document.querySelectorAll(
    ".hero-main, .hero-preview, .marketing-section, .site-footer, .feature-card, .step-card, .tax-card, .pricing-card, .final-cta-card"
  ));

  revealTargets.forEach((node) => {
    node.classList.add("reveal-item");
  });

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });

  revealTargets.forEach((node) => revealObserver.observe(node));

  const syncScrolledTopbar = () => {
    if (!marketingTopbar) return;
    marketingTopbar.classList.toggle("is-scrolled", window.scrollY > 20);
  };

  syncScrolledTopbar();
  window.addEventListener("scroll", syncScrolledTopbar, { passive: true });
  cleanup.push(() => window.removeEventListener("scroll", syncScrolledTopbar));

  if (sections.length) {
    const setCurrentLink = () => {
      const offset = window.scrollY + window.innerHeight * 0.28;
      let activeSection = sections[0];

      sections.forEach((section) => {
        if (section.target.offsetTop <= offset) activeSection = section;
      });

      sections.forEach(({ link, target }) => {
        link.classList.toggle("is-current", target === activeSection.target);
      });
    };

    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) {
        setCurrentLink();
        return;
      }

      sections.forEach(({ link, target }) => {
        link.classList.toggle("is-current", target === visible.target);
      });
    }, { threshold: [0.2, 0.45, 0.7], rootMargin: "-18% 0px -55% 0px" });

    sections.forEach(({ target }) => sectionObserver.observe(target));
    setCurrentLink();
    window.addEventListener("scroll", setCurrentLink, { passive: true });
    cleanup.push(() => {
      window.removeEventListener("scroll", setCurrentLink);
      sectionObserver.disconnect();
    });
  }

  window.addEventListener("beforeunload", () => {
    cleanup.forEach((fn) => fn());
  }, { once: true });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.forEach((item) => item.classList.toggle("is-current", item === link));
    });
  });

  if (revealTargets.length) {
    requestAnimationFrame(() => {
      revealTargets.slice(0, 2).forEach((node) => node.classList.add("is-visible"));
    });
  }
}
