export type CloudflareApiOptions = RequestInit & {
  json?: unknown;
};

const defaultBaseUrl =
  process.env.NEXT_PUBLIC_CLOUDFLARE_API_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "";

export async function cloudflareApi<T>(
  path: string,
  options: CloudflareApiOptions = {}
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
