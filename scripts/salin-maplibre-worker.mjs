// Salin web worker MapLibre ke public/ supaya bisa dimuat dari /maplibre-gl-worker.mjs
// (MapLibre menghitung URL worker relatif ke file bundel, yang tidak ada di output Next).
// Dijalankan otomatis sebelum `next dev` / `next build` (predev / prebuild).
import { copyFileSync, mkdirSync } from 'node:fs';

const from = new URL('../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url);
const to = new URL('../public/maplibre-gl-worker.mjs', import.meta.url);
mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
copyFileSync(from, to);
