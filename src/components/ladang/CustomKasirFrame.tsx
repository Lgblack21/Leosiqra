"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Shop, ShopProduct } from '@/lib/services/shopService';

// Desain kasir BEBAS (HTML/CSS/JS buatan pengguna atau AI-nya). Keamanan:
// - <iframe sandbox="allow-scripts"> TANPA allow-same-origin → origin kosong: tidak
//   bisa membaca cookie/localStorage Leosiqra, memanggil API dengan sesi, atau
//   menyentuh halaman induk; tanpa allow-forms/popups/top-navigation.
// - CSP di awal dokumen: tanpa koneksi (fetch/XHR/WebSocket), gambar https:/data:.
// - Hanya bertukar data KATALOG lewat postMessage; pesan dari iframe divalidasi
//   (sumber = iframe ini, jenis & indeks produk). Struk, ID pembeli & pencatatan
//   uang tetap di komponen Leosiqra.

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src https: data: blob:; media-src data: blob:; form-action 'none'; base-uri 'none'";
const BRIDGE = `(function(){var cbs=[],data=null;function send(m){parent.postMessage(m,'*')}
window.Leosiqra={onData:function(cb){cbs.push(cb);if(data){try{cb(data)}catch(e){console.error(e)}}},
add:function(i){send({type:'leosiqra:add',i:i})},remove:function(i){send({type:'leosiqra:remove',i:i})},
checkout:function(){send({type:'leosiqra:checkout'})},
rupiah:function(n){return 'Rp'+Number(n||0).toLocaleString('id-ID')}};
window.addEventListener('message',function(e){if(e.source!==parent)return;var d=e.data;if(d&&d.type==='leosiqra:data'){data=d.payload;cbs.forEach(function(cb){try{cb(data)}catch(err){console.error(err)}})}});
function h(){send({type:'leosiqra:height',h:Math.ceil(document.documentElement.scrollHeight)})}
try{new ResizeObserver(h).observe(document.documentElement)}catch(e){}
window.addEventListener('load',h);send({type:'leosiqra:ready'})})();`;

export const buildKasirDoc = (html: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><script>${BRIDGE}</script><style>html,body{margin:0}</style></head><body>${html}</body></html>`;

export function CustomKasirFrame({ shop, products, cart, onAdd, onRemove, onCheckout, minHeight = 320, title = 'Desain kasir' }: {
  shop: Shop;
  products: ShopProduct[];
  cart: Record<number, number>;
  onAdd?: (i: number) => void;
  onRemove?: (i: number) => void;
  onCheckout?: () => void;
  minHeight?: number;
  title?: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);
  const doc = useMemo(() => buildKasirDoc(shop.style.customHtml), [shop.style.customHtml]);
  const payload = useMemo(() => {
    const count = Object.values(cart).reduce((a, b) => a + b, 0);
    const total = Object.entries(cart).reduce((a, [i, q]) => a + (products[Number(i)]?.price ?? 0) * q, 0);
    return {
      shop: { name: shop.name, emoji: shop.emoji ?? '', tagline: shop.tagline ?? '', greeting: shop.style.greeting },
      products: products.map((p, i) => ({ i, name: p.name, price: p.price, unit: p.unit, group: p.group ?? '' })),
      cart, count, total, theme: shop.style.theme,
    };
  }, [shop, products, cart]);
  const latest = useRef(payload);
  const handlers = useRef({ onAdd, onRemove, onCheckout });
  useEffect(() => { handlers.current = { onAdd, onRemove, onCheckout }; }, [onAdd, onRemove, onCheckout]);
  useEffect(() => {
    latest.current = payload;
    ref.current?.contentWindow?.postMessage({ type: 'leosiqra:data', payload }, '*');
  }, [payload]);
  useEffect(() => {
    let windowStart = 0, inWindow = 0;
    const onMsg = (e: MessageEvent) => {
      if (!ref.current || e.source !== ref.current.contentWindow) return; // hanya iframe ini
      const d = e.data as { type?: unknown; i?: unknown; h?: unknown };
      if (!d || typeof d.type !== 'string') return;
      const ok = (i: unknown): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < latest.current.products.length;
      if (d.type === 'leosiqra:ready') ref.current.contentWindow?.postMessage({ type: 'leosiqra:data', payload: latest.current }, '*');
      else if (d.type === 'leosiqra:height' && typeof d.h === 'number') setHeight(Math.min(8000, Math.max(minHeight, Math.round(d.h))));
      else {
        const now = Date.now();
        if (now - windowStart > 1000) { windowStart = now; inWindow = 0; }
        if (++inWindow > 15) return; // redam banjir aksi dari skrip (maks 15/detik)
        if (d.type === 'leosiqra:add' && ok(d.i)) handlers.current.onAdd?.(d.i);
        else if (d.type === 'leosiqra:remove' && ok(d.i)) handlers.current.onRemove?.(d.i);
        else if (d.type === 'leosiqra:checkout') handlers.current.onCheckout?.();
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [minHeight]);

  return <iframe ref={ref} title={title} sandbox="allow-scripts" srcDoc={doc} referrerPolicy="no-referrer" style={{ height }} className="block w-full rounded-[26px] border-0 bg-white ring-1 ring-slate-100 dark:ring-slate-800" />;
}

// Contoh awal desain bebas — memakai window.Leosiqra (lihat KASIR_TEMPLATE_DOC di Worker).
export const KASIR_SAMPLE_HTML = `<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0f1a;color:#e5e7eb;padding:16px}
  h1{margin:0 0 4px;font-size:22px} .sub{color:#94a3b8;font-size:13px;margin-bottom:14px}
  .tabs{display:flex;gap:8px;overflow:auto;margin-bottom:14px} .tab{border:0;border-radius:999px;padding:8px 14px;background:#1e293b;color:#cbd5e1;font-weight:700}
  .tab.on{background:linear-gradient(90deg,#22d3ee,#a78bfa);color:#0b0f1a}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
  .card{position:relative;border:1px solid #1e293b;border-radius:16px;padding:14px;background:#111827;text-align:left;color:inherit}
  .card.in{border-color:#22d3ee;box-shadow:0 0 0 2px #22d3ee55} .nm{font-weight:800;font-size:15px} .pr{margin-top:10px;font-weight:800;color:#5eead4}
  .q{position:absolute;top:8px;right:8px;background:#22d3ee;color:#0b0f1a;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:800}
  .bar{position:sticky;bottom:0;margin-top:16px;display:flex;justify-content:space-between;align-items:center;background:#111827ee;border:1px solid #1e293b;border-radius:16px;padding:12px 14px}
  .pay{border:0;border-radius:999px;padding:10px 18px;background:#22d3ee;color:#0b0f1a;font-weight:800}
</style>
<h1 id="nm"></h1><div class="sub" id="sub"></div>
<div class="tabs" id="tabs"></div><div class="grid" id="grid"></div>
<div class="bar"><span id="sum">Struk kosong</span><button class="pay" onclick="Leosiqra.checkout()">Bayar</button></div>
<script>
  var active = null;
  Leosiqra.onData(function (d) {
    document.getElementById('nm').textContent = (d.shop.emoji ? d.shop.emoji + ' ' : '') + d.shop.name;
    document.getElementById('sub').textContent = d.shop.greeting || d.shop.tagline || 'Pilih produk';
    var groups = []; d.products.forEach(function (p) { if (groups.indexOf(p.group) < 0) groups.push(p.group); });
    var tabs = document.getElementById('tabs'); tabs.innerHTML = '';
    [null].concat(groups).forEach(function (g) {
      var b = document.createElement('button'); b.className = 'tab' + (active === g ? ' on' : '');
      b.textContent = g === null ? 'Semua' : (g || 'Lainnya'); b.onclick = function () { active = g; render(d); };
      tabs.appendChild(b);
    });
    render(d);
  });
  function render(d) {
    var grid = document.getElementById('grid'); grid.innerHTML = '';
    d.products.filter(function (p) { return active === null || p.group === active; }).forEach(function (p) {
      var q = d.cart[p.i] || 0, b = document.createElement('button');
      b.className = 'card' + (q ? ' in' : ''); b.onclick = function () { Leosiqra.add(p.i); };
      b.innerHTML = (q ? '<span class="q">×' + q + '</span>' : '') + '<div class="nm"></div><div class="pr"></div>';
      b.querySelector('.nm').textContent = p.name; b.querySelector('.pr').textContent = Leosiqra.rupiah(p.price);
      grid.appendChild(b);
    });
    document.getElementById('sum').textContent = d.count ? d.count + ' item · ' + Leosiqra.rupiah(d.total) : 'Struk kosong';
    document.querySelectorAll('.tab').forEach(function (t, k) { t.classList.toggle('on', (k === 0 && active === null) || t.textContent === active); });
  }
</script>`;
