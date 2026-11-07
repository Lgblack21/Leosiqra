import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

// Satu sumber versi: "version" di package.json (dinaikkan lewat `npm run versi`).
// Nomor build diisi workflow deploy (nomor run); build lokal tanpa nomor.
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_APP_BUILD: process.env.LEOSIQRA_BUILD ?? "",
  },
};

export default nextConfig;
