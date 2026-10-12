// Sumber pendaftaran (first-touch): kunjungan pertama yang membawa
// ?utm_source/utm_medium/utm_campaign atau referrer dari situs luar disimpan
// di localStorage maks 30 hari, lalu dikirim saat register (email & Google)
// supaya tim tahu member datang dari video, artikel, atau Google.
// Worker menyaring ulang semua nilai (cloudflare/src/index.ts,
// sanitizeSignupSource) — ini bukan batas kepercayaan.

const KEY = "leosiqra_signup_source";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type SignupSource = {
  source?: string;
  medium?: string;
  campaign?: string;
  landingPath?: string;
  firstSeenAt: string;
};

const clip = (value: string | null | undefined) => {
  const v = (value ?? "").trim().slice(0, 64);
  return v || undefined;
};

export const readSignupSource = (): SignupSource | null => {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SignupSource;
    const seen = Date.parse(parsed.firstSeenAt);
    if (!Number.isFinite(seen) || Date.now() - seen > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

// Dipanggil sekali per halaman (root layout). First-touch: kalau sudah ada
// sumber yang masih berlaku, tidak ditimpa.
export const captureSignupSource = () => {
  try {
    if (readSignupSource()) return;
    const params = new URLSearchParams(window.location.search);
    let source = clip(params.get("utm_source"));
    let medium = clip(params.get("utm_medium"));
    const campaign = clip(params.get("utm_campaign"));
    if (!source && !medium && !campaign) {
      // Tanpa UTM: pakai host referrer kalau dari situs lain (mis. google.com).
      let refHost = "";
      try {
        refHost = document.referrer ? new URL(document.referrer).hostname : "";
      } catch {
        refHost = "";
      }
      if (!refHost || refHost === window.location.hostname) return;
      source = clip(refHost.replace(/^www\./, ""));
      medium = "referral";
    }
    const entry: SignupSource = {
      source,
      medium,
      campaign,
      landingPath: window.location.pathname.slice(0, 100),
      firstSeenAt: new Date().toISOString(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // localStorage diblokir (mode privat dsb.) — abaikan, pendaftaran tetap jalan.
  }
};

// URL login/daftar Google + sumber (dibawa Worker lewat cookie singkat ke callback).
// `src` dibaca di useEffect halaman (bukan saat render) supaya HTML hasil
// static export dan render pertama di browser tetap sama.
export const googleAuthHref = (next: string | null, src: SignupSource | null) => {
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  if (src) params.set("src", JSON.stringify(src));
  const query = params.toString();
  return query ? `/api/auth/google?${query}` : "/api/auth/google";
};
