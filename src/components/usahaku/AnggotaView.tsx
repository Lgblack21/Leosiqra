'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Camera, Check, ChevronLeft, Download, IdCard, ImagePlus, Loader2, Lock, Printer, Share2, UserRound } from 'lucide-react';
import type { Shop } from '@/lib/services/shopService';
import { shopLoanService, type Borrower, type MemberFile } from '@/lib/services/shopLoanService';
import { fotoKeBase64 } from '@/lib/fotoKecil';
import { cn } from '@/lib/utils';
import { fieldCls, labelCls } from '@/components/ladang/UsahaView';
import { KASIR_THEME } from '@/components/ladang/kasirTheme';
import { bacaTepi } from './LogoUsaha';

// Anggota usaha Pinjaman: daftar 4 langkah (data diri → foto diri → foto KTP → setujui) lalu kartu anggota.
// Foto diri & KTP disimpan PRIVAT (R2, endpoint berlogin) — bukan Cloudinary publik. Rancangan:
// docs/rancangan/usahaku-anggota-jaminan-tim.md (ACC Bos 2026-11-16).

const LANGKAH = ['Data diri', 'Foto diri', 'Foto KTP', 'Setujui'] as const;

/** Foto anggota (privat) atau inisial. */
export function FotoAnggota({ shopId, b, className }: { shopId: string; b: Borrower; className?: string }) {
  const [gagal, setGagal] = useState(false);
  if (!b.hasPhoto || gagal)
    return (
      <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-slate-100 fs-13 font-extrabold text-slate-600 dark:bg-slate-800 dark:text-slate-300', className)}>
        {b.name.slice(0, 2).toUpperCase()}
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- foto privat lewat endpoint berlogin (bukan optimizer)
    <img
      src={shopLoanService.memberFileUrl(shopId, b, 'foto')}
      alt={`Foto ${b.name}`}
      onError={() => setGagal(true)}
      className={cn('shrink-0 rounded-full bg-slate-100 object-cover', className)}
    />
  );
}

// ── Daftar / lengkapi anggota ──────────────────────────────────────────────────
export function AnggotaWizard({
  shop,
  existing,
  onDone,
}: {
  shop: Shop;
  /** Peminjam lama yang dilengkapi (data & foto yang sudah ada dipakai). */
  existing?: Borrower;
  onDone: (b: { id: string; name: string; memberNo: string | null }) => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    wa: existing?.wa ?? '',
    address: existing?.address ?? '',
    job: existing?.job ?? '',
    note: existing?.note ?? '',
  });
  const [foto, setFoto] = useState<string | null>(null);
  const [ktp, setKtp] = useState<string | null>(null);
  const [setuju, setSetuju] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [borrowerId, setBorrowerId] = useState(existing?.id ?? '');
  const punyaFoto = Boolean(foto || existing?.hasPhoto);
  const punyaKtp = Boolean(ktp || existing?.hasKtp);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const cekLangkah = (i: number) => {
    if (i === 0) {
      if (!form.name.trim()) return 'Isi nama lengkap.';
      if (!/^\+?\d[\d\s-]{6,18}$/.test(form.wa.trim())) return 'Isi nomor WhatsApp yang benar (mis. 0812…).';
      if (form.address.trim().length < 5) return 'Isi alamat lengkap.';
    }
    if (i === 1 && !punyaFoto) return 'Tambahkan foto diri anggota.';
    if (i === 2 && !punyaKtp) return 'Tambahkan foto KTP anggota.';
    return '';
  };
  const lanjut = () => {
    const m = cekLangkah(step);
    if (m) return setError(m);
    setError('');
    setStep((s) => Math.min(3, s + 1));
  };
  const pilih = async (file: File | undefined, jadi: (v: string) => void, sisi: number) => {
    if (!file) return;
    setError('');
    setBusy('foto');
    try {
      jadi(await fotoKeBase64(file, sisi));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Foto gagal diproses.');
    } finally {
      setBusy('');
    }
  };

  // Simpan bertahap: data → foto → KTP → daftar. Gagal di tengah → borrowerId tersimpan, coba lagi lanjut dari situ.
  const simpan = async () => {
    if (!setuju) return setError('Centang persetujuan anggota dulu.');
    setError('');
    try {
      const data = {
        name: form.name.trim(),
        wa: form.wa.trim(),
        address: form.address.trim(),
        job: form.job.trim() || undefined,
        note: form.note.trim() || undefined,
      };
      let id = borrowerId;
      setBusy('Menyimpan data diri…');
      if (id) await shopLoanService.updateBorrower(shop.id, id, data);
      else {
        id = await shopLoanService.addBorrower(shop.id, data);
        setBorrowerId(id);
      }
      if (foto) {
        setBusy('Mengunggah foto diri…');
        await shopLoanService.uploadMemberFile(shop.id, id, 'foto', foto);
        setFoto(null);
      }
      if (ktp) {
        setBusy('Mengunggah foto KTP…');
        await shopLoanService.uploadMemberFile(shop.id, id, 'ktp', ktp);
        setKtp(null);
      }
      setBusy('Menerbitkan kartu anggota…');
      const memberNo = await shopLoanService.register(shop.id, id);
      onDone({ id, name: data.name, memberNo });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan. Coba lagi — data yang sudah tersimpan tidak hilang.');
      setBusy('');
    }
  };

  const fotoBox = (kind: MemberFile, val: string | null, jadi: (v: string) => void) => {
    const lama = existing && (kind === 'foto' ? existing.hasPhoto : existing.hasKtp) ? shopLoanService.memberFileUrl(shop.id, existing, kind) : null;
    const ada = val ?? lama;
    const ktpMode = kind === 'ktp';
    return (
      <div className="space-y-3">
        <div
          className={cn(
            'mx-auto flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50',
            ktpMode ? 'aspect-[85.6/54] w-full max-w-sm rounded-2xl' : 'h-48 w-40 rounded-3xl',
          )}
        >
          {busy === 'foto' ? (
            <Loader2 className="animate-spin text-slate-400" />
          ) : ada ? (
            // eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal / foto privat berlogin
            <img src={ada} alt={ktpMode ? 'Foto KTP' : 'Foto diri'} className="h-full w-full object-cover" />
          ) : ktpMode ? (
            <IdCard size={44} className="text-slate-300" />
          ) : (
            <UserRound size={52} className="text-slate-300" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 fs-13 font-bold text-white dark:bg-white dark:text-slate-900">
            <Camera size={15} /> {ada ? 'Foto ulang' : 'Ambil foto'}
            <input
              type="file"
              accept="image/*"
              capture={ktpMode ? 'environment' : 'user'}
              className="hidden"
              onChange={(e) => {
                void pilih(e.target.files?.[0], jadi, ktpMode ? 1600 : 1000);
                e.target.value = '';
              }}
            />
          </label>
          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 fs-13 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <ImagePlus size={15} /> Dari galeri
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                void pilih(e.target.files?.[0], jadi, ktpMode ? 1600 : 1000);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <p className="flex items-start gap-1.5 fs-12 text-slate-500">
          <Lock size={13} className="mt-0.5 shrink-0" />
          {ktpMode
            ? 'Pastikan tulisan KTP terbaca dan tidak silau. Foto KTP disimpan privat — hanya kamu yang bisa membukanya, tidak tampil di kartu.'
            : 'Wajah terlihat jelas, tanpa kacamata hitam. Foto ini tampil di kartu anggota.'}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-4 gap-1.5" aria-label="Langkah pendaftaran">
        {LANGKAH.map((l, i) => (
          <li key={l}>
            <span className={cn('block h-1.5 rounded-full', i <= step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700')} />
            <span className={cn('mt-1 block truncate fs-11 font-semibold', i === step ? 'text-slate-900 dark:text-white' : 'text-slate-400')}>
              {i + 1}. {l}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-3">
          <label className="block">
            <span className={labelCls}>Nama lengkap (sesuai KTP)</span>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={60} className={fieldCls} autoFocus />
          </label>
          <label className="block">
            <span className={labelCls}>Nomor WhatsApp</span>
            <input value={form.wa} onChange={(e) => set('wa', e.target.value)} inputMode="tel" placeholder="08…" className={fieldCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Alamat</span>
            <textarea value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={200} rows={2} placeholder="Jalan, RT/RW, kelurahan, patokan rumah" className={fieldCls} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={labelCls}>Pekerjaan / usaha (opsional)</span>
              <input value={form.job} onChange={(e) => set('job', e.target.value)} maxLength={60} placeholder="Mis. pedagang sayur" className={fieldCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Catatan (opsional)</span>
              <input value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={120} className={fieldCls} />
            </label>
          </div>
        </div>
      )}
      {step === 1 && fotoBox('foto', foto, setFoto)}
      {step === 2 && fotoBox('ktp', ktp, setKtp)}
      {step === 3 && (
        <div className="space-y-3">
          <div className="flex gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau */}
              {foto ? <img src={foto} alt="" className="h-full w-full object-cover" /> : existing?.hasPhoto ? <img src={shopLoanService.memberFileUrl(shop.id, existing, 'foto')} alt="" className="h-full w-full object-cover" /> : null}
            </span>
            <span className="min-w-0 fs-13 text-slate-600 dark:text-slate-300">
              <b className="block truncate fs-15 text-slate-900 dark:text-white">{form.name}</b>
              <span className="block">{form.wa}</span>
              <span className="block line-clamp-2">{form.address}</span>
              {form.job && <span className="block">{form.job}</span>}
              <span className="mt-1 flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                <Check size={13} /> Foto KTP ada (privat)
              </span>
            </span>
          </div>
          <label className="flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3 fs-13 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
            <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600" />
            <span>
              Anggota setuju data diri, foto, dan foto KTP-nya disimpan oleh <b>{shop.name}</b> untuk keperluan pinjaman, dan
              boleh minta datanya dihapus kalau sudah tidak meminjam.
            </span>
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 fs-13 font-semibold text-rose-600 dark:bg-rose-500/10">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => {
              setError('');
              setStep((s) => s - 1);
            }}
            disabled={Boolean(busy)}
            className="flex items-center gap-1 rounded-full bg-slate-100 px-4 py-3 fs-14 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <ChevronLeft size={16} /> Kembali
          </button>
        )}
        {step < 3 ? (
          <button type="button" onClick={lanjut} disabled={Boolean(busy)} className="flex-1 rounded-full bg-emerald-600 py-3 fs-14 font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50">
            Lanjut
          </button>
        ) : (
          <button
            type="button"
            onClick={simpan}
            disabled={Boolean(busy)}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 py-3 fs-14 font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />} {busy || (existing?.registered ? 'Simpan' : 'Daftarkan anggota')}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Kartu anggota (PNG dibuat di perangkat) ──────────────────────────────────────
const muatGambar = (src: string, cors = false) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const tglKartu = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${d.getDate()} ${BLN[d.getMonth()]} ${d.getFullYear()}`;
};

export type DataKartu = {
  jenis: 'ANGGOTA' | 'STAF';
  nama: string;
  nomor: string;
  baris: [string, string][];
  fotoUrl: string | null;
};
/** Gambar kartu 1012×638 px (rasio KTP 85,6×54 mm). Dipakai juga untuk kartu staf (3.40). */
export async function gambarKartu(shop: Shop, k: DataKartu): Promise<HTMLCanvasElement> {
  const W = 1012;
  const H = 638;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const warna = (KASIR_THEME[shop.style.theme] ?? KASIR_THEME.ungu).swatch;
  const r = 36;
  g.save();
  g.beginPath();
  g.roundRect(0, 0, W, H, r);
  g.clip();
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, warna);
  bg.addColorStop(1, '#0b1220');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.beginPath();
  g.arc(W - 80, 60, 260, 0, Math.PI * 2);
  g.fill();
  // Kepala: logo + nama usaha + jenis kartu
  const logo = shop.style.logoUrl ? await muatGambar(shop.style.logoUrl, true) : null;
  // Bingkai logo ikut gambarnya (sama dengan LogoUsaha): latar penuh → warna tepi & gambar memenuhi kotak; transparan → putih.
  const tepi = shop.style.logoUrl && logo ? await bacaTepi(shop.style.logoUrl) : null;
  g.save();
  g.beginPath();
  g.roundRect(48, 40, 84, 84, 20);
  g.fillStyle = tepi?.mode === 'penuh' && tepi.bg ? tepi.bg : '#fff';
  g.fill();
  g.clip();
  if (logo) {
    const pad = tepi?.mode === 'transparan' ? 10 : 0;
    const box = 84 - pad * 2;
    const sk = tepi?.mode === 'transparan' || tepi?.mode === 'penuh' ? Math.min(box / logo.width, box / logo.height) : Math.max(box / logo.width, box / logo.height);
    const w = logo.width * sk;
    const h = logo.height * sk;
    try {
      g.drawImage(logo, 48 + (84 - w) / 2, 40 + (84 - h) / 2, w, h);
    } catch {
      /* logo tanpa CORS → lewati */
    }
  } else {
    g.fillStyle = '#0b1220';
    g.font = '44px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(shop.emoji || '🤝', 90, 98);
    g.textAlign = 'left';
  }
  g.restore();
  g.fillStyle = '#fff';
  g.font = '800 38px system-ui, -apple-system, Segoe UI, sans-serif';
  g.fillText(shop.name.slice(0, 26), 154, 82);
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.font = '700 22px system-ui, sans-serif';
  g.fillText(`KARTU ${k.jenis}`, 156, 116);
  // Foto
  const fx = 48;
  const fy = 168;
  const fw = 250;
  const fh = 320;
  g.fillStyle = 'rgba(255,255,255,0.15)';
  g.beginPath();
  g.roundRect(fx, fy, fw, fh, 24);
  g.fill();
  const foto = k.fotoUrl ? await muatGambar(k.fotoUrl) : null;
  if (foto) {
    g.save();
    g.beginPath();
    g.roundRect(fx, fy, fw, fh, 24);
    g.clip();
    const s = Math.max(fw / foto.width, fh / foto.height);
    const w = foto.width * s;
    const h = foto.height * s;
    g.drawImage(foto, fx + (fw - w) / 2, fy + (fh - h) / 2, w, h);
    g.restore();
  } else {
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.font = '800 96px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(k.nama.slice(0, 2).toUpperCase(), fx + fw / 2, fy + fh / 2 + 34);
    g.textAlign = 'left';
  }
  // Data
  const tx = 336;
  g.fillStyle = '#fff';
  g.font = '800 46px system-ui, sans-serif';
  const nama = k.nama.length > 22 ? `${k.nama.slice(0, 21)}…` : k.nama;
  g.fillText(nama, tx, 222);
  g.fillStyle = 'rgba(255,255,255,0.65)';
  g.font = '600 22px system-ui, sans-serif';
  g.fillText(k.jenis === 'ANGGOTA' ? 'No. anggota' : 'No. staf', tx, 274);
  g.fillStyle = '#fff';
  g.font = '800 40px ui-monospace, SFMono-Regular, Menlo, monospace';
  g.fillText(k.nomor, tx, 318);
  k.baris.slice(0, 2).forEach(([label, isi], i) => {
    const y = 372 + i * 66;
    g.fillStyle = 'rgba(255,255,255,0.65)';
    g.font = '600 22px system-ui, sans-serif';
    g.fillText(label, tx, y);
    g.fillStyle = '#fff';
    g.font = '700 28px system-ui, sans-serif';
    g.fillText(isi.slice(0, 26), tx, y + 34);
  });
  // QR: hanya nomor kartu + nama usaha (tanpa data pribadi)
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, `${k.nomor} · ${shop.name}`, { width: 168, margin: 1, color: { dark: '#0b1220', light: '#ffffff' } });
  g.fillStyle = '#fff';
  g.beginPath();
  g.roundRect(W - 48 - 184, H - 48 - 184, 184, 184, 18);
  g.fill();
  g.drawImage(qr, W - 48 - 176, H - 48 - 176, 168, 168);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.font = '500 18px system-ui, sans-serif';
  g.fillText('Dibuat dengan Leosiqra', 48, H - 40);
  g.restore();
  return c;
}

export function KartuAnggota({ shop, b }: { shop: Shop; b: Borrower }) {
  return (
    <KartuView
      shop={shop}
      data={{
        jenis: 'ANGGOTA',
        nama: b.name,
        nomor: b.memberNo ?? '—',
        baris: [['Bergabung', tglKartu(b.registeredAt)], ...(b.job ? ([['Pekerjaan', b.job]] as [string, string][]) : [])],
        fotoUrl: b.hasPhoto ? shopLoanService.memberFileUrl(shop.id, b, 'foto') : null,
      }}
      namaFile={`Kartu-Anggota-${(b.memberNo ?? b.name).replace(/[^\w-]+/g, '-')}.png`}
      wa={b.wa}
      pesanWa={`Halo ${b.name}, ini kartu anggota ${shop.name} kamu (No. ${b.memberNo}). Gambarnya sudah kuunduh, kukirim setelah pesan ini ya.`}
      catatan="Kartu tidak memuat NIK atau foto KTP. QR hanya berisi nomor anggota."
    />
  );
}

/** Kartu (anggota / staf): gambar PNG dibuat di perangkat + Unduh · Kirim WA · Cetak. */
export function KartuView({
  shop,
  data,
  namaFile,
  wa,
  pesanWa,
  catatan,
}: {
  shop: Shop;
  data: DataKartu;
  namaFile: string;
  wa: string | null;
  pesanWa: string;
  catatan: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const blobRef = useRef<Blob | null>(null);
  const kunci = JSON.stringify(data);
  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const c = await gambarKartu(shop, JSON.parse(kunci) as DataKartu);
        const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
        if (!blob) throw new Error('x');
        blobRef.current = blob;
        objectUrl = URL.createObjectURL(blob);
        if (alive) setUrl(objectUrl);
      } catch {
        if (alive) setError('Kartu gagal dibuat. Coba muat ulang.');
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [shop, kunci]);
  const file = () => new File([blobRef.current!], namaFile, { type: 'image/png' });
  const unduh = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = namaFile;
    a.click();
  };
  const kirim = async () => {
    const f = file();
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], text: pesanWa });
        return;
      } catch {
        /* dibatalkan */
      }
    }
    unduh();
    const n = (wa ?? '').replace(/\D/g, '').replace(/^0/, '62');
    window.open(`https://wa.me/${n.length >= 9 ? n : ''}?text=${encodeURIComponent(pesanWa)}`, '_blank', 'noopener');
  };
  const cetak = () => {
    if (!url) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<title>${data.nama}</title><style>@page{size:auto;margin:12mm}body{margin:0}img{width:85.6mm;height:54mm;border-radius:3mm}</style><img src="${url}" onload="window.print()">`);
    w.document.close();
  };
  return (
    <div className="space-y-3">
      <div className="mx-auto aspect-[1012/638] w-full max-w-md overflow-hidden rounded-[18px] bg-slate-100 shadow-lg dark:bg-slate-800">
        {/* eslint-disable-next-line @next/next/no-img-element -- gambar kartu buatan perangkat (blob) */}
        {url ? <img src={url} alt={`Kartu ${data.nama}`} className="h-full w-full" /> : <div className="flex h-full items-center justify-center">{error ? <p className="px-4 text-center fs-13 text-rose-600">{error}</p> : <Loader2 className="animate-spin text-slate-400" />}</div>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={unduh} disabled={!url} className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 fs-13 font-bold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900">
          <Download size={15} /> Unduh
        </button>
        <button type="button" onClick={kirim} disabled={!url} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 fs-13 font-bold text-white disabled:opacity-40">
          <Share2 size={15} /> Kirim WA
        </button>
        <button type="button" onClick={cetak} disabled={!url} className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 fs-13 font-bold text-slate-700 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200">
          <Printer size={15} /> Cetak
        </button>
      </div>
      <p className="text-center fs-11 text-slate-400">{catatan}</p>
    </div>
  );
}
