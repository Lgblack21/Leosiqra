export type CloudflareApiOptions = RequestInit & {
  json?: unknown;
};

const defaultBaseUrl =
  process.env.NEXT_PUBLIC_CLOUDFLARE_API_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "";

// Pindah halaman dulu memanggil ulang endpoint yang sama berkali-kali (mis.
// /api/auth/me 6× sekali buka, 2.000 transaksi tiap halaman). GET yang sama
// sekarang: (1) digabung kalau sedang berjalan, (2) dipakai ulang maks
// GET_CACHE_TTL_MS. Cache dibuang total pada SETIAP request non-GET, setiap
// sinyal perubahan data (notifyCollectionChanged, juga dari tab lain), dan
// saat aplikasi aktif lagi — jadi data tidak basi setelah ada perubahan.
const GET_CACHE_TTL_MS = 20_000;
const getCache = new Map<string, { at: number; promise: Promise<unknown> }>();
export const clearApiCache = () => getCache.clear();

export async function cloudflareApi<T>(
  path: string,
  options: CloudflareApiOptions = {}
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const cacheable = method === "GET" && options.body === undefined && options.json === undefined && options.cache !== "no-store";
  if (!cacheable) {
    // Dibuang sebelum & sesudah: GET yang berjalan bersamaan dengan perubahan
    // ini tidak boleh tersimpan sebagai jawaban "terbaru".
    clearApiCache();
    try {
      return await request<T>(path, options);
    } finally {
      clearApiCache();
    }
  }
  const hit = getCache.get(path);
  if (hit && Date.now() - hit.at < GET_CACHE_TTL_MS) {
    // Salinan per pemanggil: komponen yang mengurutkan/mengubah hasil tidak
    // saling mengganggu.
    return structuredClone((await hit.promise) as T);
  }
  const promise = request<T>(path, options);
  getCache.set(path, { at: Date.now(), promise });
  promise.catch(() => {
    if (getCache.get(path)?.promise === promise) getCache.delete(path);
  });
  return structuredClone(await promise);
}

async function request<T>(
  path: string,
  options: CloudflareApiOptions
): Promise<T> {
  const url = path.startsWith("http") ? path : `${defaultBaseUrl}${path}`;
  const headers = new Headers(options.headers);

  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Request ke Cloudflare API gagal.";
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) {
        message = data.error;
      }
    } catch {
      // noop
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}
