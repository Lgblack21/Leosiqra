"use client";

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, Loader2, PlugZap, RefreshCw, Unplug } from 'lucide-react';
import { shopService, type Shop } from '@/lib/services/shopService';
import { accountService } from '@/lib/services/accountService';
import { isCreditAccountType } from '@/lib/creditCard';
import { cn } from '@/lib/utils';
import { AiMcpCard } from './AiMcpCard';
import { fieldCls, labelCls } from './UsahaView';

// Sambungkan website → Leosiqra: server website pengguna mengirim POST per order
// (webhook) dan penjualan langsung tercatat di kasir + saldo rekening tujuan.
// Kunci rahasia hanya ditampilkan sekali; Worker menyimpan hash-nya saja.

const ago = (iso?: string) => {
  if (!iso) return 'belum ada penjualan masuk';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'baru saja' : m < 60 ? `${m} menit lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

export function HookSection({ shop, onToast, onLeave }: { shop: Shop; onToast: (m: string) => void; onLeave?: () => void }) {
  const [accounts, setAccounts] = useState<{ id: string; name: string }[] | null>(null);
  const [accountId, setAccountId] = useState(shop.hookAccountId ?? '');
  const [busy, setBusy] = useState<'' | 'make' | 'off'>('');
  const [error, setError] = useState('');
  const [made, setMade] = useState<{ key: string; url: string } | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [tab, setTab] = useState<'curl' | 'node' | 'php'>('node');

  useEffect(() => {
    accountService.getUserAccounts('').then((list) => {
      const ok = list.filter((a) => a.id && !isCreditAccountType(a.type) && (a.currency || 'IDR') === 'IDR').map((a) => ({ id: String(a.id), name: a.name }));
      setAccounts(ok);
      setAccountId((cur) => (ok.some((a) => a.id === cur) ? cur : ok[0]?.id ?? ''));
    }).catch(() => setAccounts([]));
  }, []);

  const make = async () => {
    if (!accountId) { setError('Pilih rekening tujuan dulu.'); return; }
    setBusy('make');
    setError('');
    try { setMade(await shopService.createHook(shop.id, accountId)); } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal membuat kunci.'); }
    setBusy('');
  };
  const off = async () => {
    if (!confirmOff) { setConfirmOff(true); return; }
    setBusy('off');
    try { await shopService.removeHook(shop.id); setMade(null); setConfirmOff(false); onToast('Sambungan website diputus. Kunci lama tidak berlaku lagi.'); } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal memutus.'); }
    setBusy('');
  };
  const copy = (t: string, m: string) => navigator.clipboard.writeText(t).then(() => onToast(m), () => onToast('Tidak bisa menyalin otomatis — salin manual.'));

  const url = made?.url ?? `${typeof window !== 'undefined' ? window.location.origin : 'https://www.leosiqra.com'}/api/hooks/shop/${shop.id}`;
  const body = `{"order_id":"INV-1001","amount":45000,"product":"Kopi Susu Aren ×2","buyer":"Budi · 0812xxxx","qty":2}`;
  const code = {
    curl: `curl -X POST ${url} \\\n  -H "Authorization: Bearer $LEOSIQRA_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`,
    node: `// Jalankan di SERVER (mis. setelah pembayaran sukses), bukan di halaman.\nawait fetch("${url}", {\n  method: "POST",\n  headers: {\n    Authorization: \`Bearer \${process.env.LEOSIQRA_KEY}\`,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify({\n    order_id: order.id,        // wajib & unik\n    amount: order.total,       // Rupiah yang diterima\n    product: order.productName,\n    buyer: order.customerName, // nama / no. HP / ID pelanggan\n    qty: order.qty,\n  }),\n});`,
    php: `<?php // di server, setelah pembayaran sukses\n$ch = curl_init("${url}");\ncurl_setopt_array($ch, [\n  CURLOPT_POST => true,\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_HTTPHEADER => [\n    "Authorization: Bearer " . getenv("LEOSIQRA_KEY"),\n    "Content-Type: application/json",\n  ],\n  CURLOPT_POSTFIELDS => json_encode([\n    "order_id" => $order["id"],\n    "amount" => $order["total"],\n    "product" => $order["product"],\n    "buyer" => $order["customer_name"],\n  ]),\n]);\ncurl_exec($ch);`,
  }[tab];
  const prompt = `Bantu aku menyambungkan website tokoku ke Leosiqra supaya setiap order yang SUDAH DIBAYAR otomatis tercatat. Di kode SERVER (bukan di halaman/JavaScript browser), setelah pembayaran sukses kirim POST ke ${url} dengan header "Authorization: Bearer <isi dari environment variable LEOSIQRA_KEY>" dan body JSON: order_id (wajib, unik per order), amount (Rupiah yang diterima, angka bulat), product, buyer (nama/ID pembeli), qty. Kalau gagal jaringan, kirim ulang dengan order_id yang sama (tidak akan dobel). Lalu supaya harga di kasir selalu sama dengan website: setiap kali harga berubah (atau terjadwal tiap jam), kirim POST ke ${url}/products dengan header yang sama dan body { "mode": "update", "products": [{ "name": "Kopi Susu Aren", "price": 22000, "group": "Minuman" }, …] } (maks 120 produk, group = nama kategori). Tunjukkan di file mana kodenya harus ditaruh.`;
  const priceCode = `// Kirim daftar harga terbaru (mis. setiap harga berubah / cron tiap jam)\nawait fetch("${url}/products", {\n  method: "POST",\n  headers: {\n    Authorization: \`Bearer \${process.env.LEOSIQRA_KEY}\`,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify({\n    mode: "update", // "replace" = ganti seluruh katalog\n    products: products.map((p) => ({\n      name: p.name,       // mis. "Kopi Susu Aren"\n      price: p.price,     // Rupiah\n      group: p.category,  // mis. "Minuman"\n    })),\n  }),\n});\n// Balasan: { ok, total, updated, added, unchanged }`;
  const accName = accounts?.find((a) => a.id === shop.hookAccountId)?.name;

  return (
    <section className="rounded-3xl ring-1 ring-slate-100 p-4 dark:ring-slate-800">
      <p className="flex items-center gap-1.5 text-[14px] font-extrabold text-slate-900 dark:text-white"><PlugZap size={16} className="text-emerald-500" /> Sambungkan website (otomatis)</p>
      <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">Setiap order yang dibayar di websitemu langsung masuk ke kasir & saldo, dan harga kasir bisa ikut harga website — tanpa input manual.</p>
      {error && <p role="alert" className="mt-2 text-[12px] font-semibold text-rose-600">{error}</p>}
      {!shop.hookReady ? (
        <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">Fitur ini sedang disiapkan di server — sebentar lagi bisa dipakai.</p>
      ) : (
        <>
          {shop.hookOn && !made && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-500/10">
              <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
              <span className="min-w-0 flex-1 text-[12px] text-emerald-900 dark:text-emerald-200"><b>Tersambung</b>{accName ? ` → ${accName}` : ''} · {ago(shop.hookLastAt)}</span>
            </div>
          )}

          {made ? (
            <div className="mt-3 space-y-2.5 rounded-2xl bg-slate-950 p-3 text-white">
              <p className="flex items-start gap-1.5 text-[12px] font-semibold text-amber-300"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>Kunci hanya tampil SEKALI. Simpan di server websitemu (environment variable <code className="font-mono">LEOSIQRA_KEY</code>), jangan di kode halaman.</span></p>
              {[['Alamat', made.url], ['Kunci rahasia', made.key]].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[11px] text-white/50">{k}</p>
                  <div className="flex items-center gap-2"><code className="min-w-0 flex-1 truncate rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px]">{v}</code><button type="button" onClick={() => copy(v, `${k} tersalin.`)} aria-label={`Salin ${k}`} className="shrink-0 rounded-lg bg-white/10 p-2 hover:bg-white/20"><Copy size={13} /></button></div>
                </div>
              ))}
              <button type="button" onClick={() => setMade(null)} className="flex w-full items-center justify-center gap-1.5 rounded-full bg-white py-2 text-[12px] font-bold text-slate-900"><Check size={13} /> Sudah saya simpan</button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <label className="block"><span className={labelCls}>Penjualan masuk ke rekening</span>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={accounts === null} className={fieldCls}>{(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              </label>
              <div className={cn('grid gap-2', shop.hookOn ? 'grid-cols-2' : 'grid-cols-1')}>
                <button type="button" onClick={make} disabled={Boolean(busy)} className="flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 py-2.5 text-[13px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40">{busy === 'make' ? <Loader2 size={14} className="animate-spin" /> : shop.hookOn ? <RefreshCw size={14} /> : <PlugZap size={14} />} {shop.hookOn ? 'Ganti kunci' : 'Buat kunci sambungan'}</button>
                {shop.hookOn && <button type="button" onClick={off} disabled={Boolean(busy)} className={cn('flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-bold disabled:opacity-40', confirmOff ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300')}>{busy === 'off' ? <Loader2 size={14} className="animate-spin" /> : <Unplug size={14} />} {confirmOff ? 'Yakin putuskan?' : 'Putuskan'}</button>}
              </div>
              {shop.hookOn && <p className="text-[11px] text-slate-400">Ganti kunci = kunci lama langsung tidak berlaku (pasang kunci baru di websitemu).</p>}
            </div>
          )}

          {(shop.hookOn || made) && (
            <details className="mt-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <summary className="cursor-pointer text-[12px] font-bold text-slate-700 dark:text-slate-200">Cara pasang di websitemu</summary>
              <ul className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                <li><b>POST</b> ke alamat di atas, header <code>Authorization: Bearer &lt;kunci&gt;</code>, body JSON.</li>
                <li><code>order_id</code> wajib & unik — kirim ulang dengan order_id sama tidak akan dobel.</li>
                <li><code>amount</code> wajib (Rupiah diterima). Opsional: <code>product</code>, <code>buyer</code>, <code>qty</code>, <code>date</code> (YYYY-MM-DD).</li>
                <li>Kirim hanya setelah pembayaran SUKSES, dari server — bukan dari halaman pembeli.</li>
              </ul>
              <div className="mt-2 flex gap-1 rounded-full bg-white p-1 dark:bg-slate-900">{(['node', 'php', 'curl'] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={cn('flex-1 rounded-full py-1.5 text-[11px] font-bold', tab === t ? 'bg-slate-900 text-white dark:bg-violet-600' : 'text-slate-500')}>{t === 'node' ? 'Node.js' : t === 'php' ? 'PHP' : 'cURL'}</button>)}</div>
              <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-slate-950 p-3 text-[11px] leading-relaxed text-emerald-200">{code}</pre>
              <button type="button" onClick={() => copy(code, 'Contoh kode tersalin.')} className="mt-2 flex items-center gap-1 text-[11px] font-bold text-violet-600 dark:text-violet-300"><Copy size={12} /> Salin contoh kode</button>
            </details>
          )}
          {(shop.hookOn || made) && (
            <details className="mt-3 rounded-2xl bg-sky-50 p-3 dark:bg-sky-500/10">
              <summary className="cursor-pointer text-[12px] font-bold text-sky-900 dark:text-sky-200">Perbarui harga otomatis dari website{shop.catalogSyncedAt ? ` · terakhir ${ago(shop.catalogSyncedAt)}` : ''}</summary>
              <ul className="mt-2 space-y-1 text-[11px] text-sky-900/80 dark:text-sky-100/80">
                <li><b>POST</b> ke <code>…/{'{'}id{'}'}/products</code> dengan kunci yang sama, body <code>{'{'} mode, products {'}'}</code>.</li>
                <li><code>mode: &quot;update&quot;</code> (bawaan): produk dengan group + nama sama ikut harga baru, produk baru ditambah, lainnya tetap. <code>&quot;prices&quot;</code> = HANYA ubah harga produk yang sudah ada (tidak menambah; yang tidak cocok dilaporkan di <code>not_found</code>). <code>&quot;replace&quot;</code> = ganti semua.</li>
                <li>Kirim setiap harga berubah, atau jadwalkan (cron) tiap jam. Maks 120 produk.</li>
              </ul>
              <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-slate-950 p-3 text-[11px] leading-relaxed text-emerald-200">{priceCode}</pre>
              <button type="button" onClick={() => copy(priceCode, 'Contoh kode harga tersalin.')} className="mt-2 flex items-center gap-1 text-[11px] font-bold text-violet-600 dark:text-violet-300"><Copy size={12} /> Salin contoh kode</button>
            </details>
          )}
          {(shop.hookOn || made) && <AiMcpCard className="mt-3" title="Minta AI-mu memasangkannya" desc="AI-mu menunjukkan di mana kode ini ditaruh di websitemu. Kunci TIDAK ikut di perintah — isi sendiri di server." prompt={prompt} onLeave={onLeave} onToast={onToast} />}
        </>
      )}
    </section>
  );
}
