"use client";

import { Keyboard, Mic, Camera, Hash, Calculator, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRecordingPrefs, type InputMode, type AmountKeypad } from '@/lib/useRecordingPrefs';
import { useFeedback } from '@/components/ui/Feedback';

// Panel Pengaturan → Cara catat utama & Keyboard nominal. Pilihan langsung
// tersimpan (prefs.inputMode / prefs.amountKeypad), berlaku di semua perangkat.

type Option<T> = { id: T; title: string; desc: string; icon: React.ElementType; tint: string };

function OptionCards<T extends string>({ options, value, onPick }: { options: Option<T>[]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            aria-pressed={on}
            className={cn('relative flex items-start gap-3 rounded-[22px] p-4 text-left transition', on ? 'bg-indigo-50 ring-2 ring-indigo-500' : 'bg-white ring-1 ring-slate-200 hover:ring-indigo-200')}
          >
            <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', o.tint)}><o.icon size={22} /></span>
            <span className="min-w-0 flex-1 pr-6">
              <span className="block text-[15px] font-bold text-slate-900">{o.title}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{o.desc}</span>
            </span>
            {on && <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white"><Check size={14} strokeWidth={3} /></span>}
          </button>
        );
      })}
    </div>
  );
}

const MODES: Option<InputMode>[] = [
  { id: 'ketik', title: 'Ketik', desc: 'Form lengkap: nominal, kategori, rekening, tag.', icon: Keyboard, tint: 'bg-slate-100 text-slate-700' },
  { id: 'suara', title: 'Ucapkan', desc: '“Makan siang 35 ribu pakai BCA” — langsung mendengarkan.', icon: Mic, tint: 'bg-rose-50 text-rose-600' },
  { id: 'foto', title: 'Foto struk', desc: 'Kamera terbuka, AI membaca total & tokonya.', icon: Camera, tint: 'bg-amber-50 text-amber-600' },
];

export function CaraCatatView() {
  const { toast } = useFeedback();
  const { inputMode, save } = useRecordingPrefs();
  const pick = (v: InputMode) => {
    if (v === inputMode) return;
    save({ inputMode: v })
      .then(() => toast.success(`Tombol + sekarang membuka: ${MODES.find((m) => m.id === v)?.title}.`))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.'));
  };
  return (
    <div className="space-y-4">
      <p className="px-1 text-[14px] text-slate-600">Pilih yang paling sering kamu pakai. Tombol <b>+</b> akan langsung membukanya — cara lain tetap bisa dipakai kapan saja.</p>
      <OptionCards options={MODES} value={inputMode} onPick={pick} />
      <p className="px-1 text-[12px] text-slate-500">Suara & foto butuh izin mikrofon/kamera di browser. Hasilnya selalu bisa dicek sebelum disimpan.</p>
    </div>
  );
}

const KEYPADS: Option<AmountKeypad>[] = [
  { id: 'standar', title: 'Standar', desc: 'Keyboard angka bawaan HP / laptop.', icon: Hash, tint: 'bg-slate-100 text-slate-700' },
  { id: 'kalkulator', title: 'Kalkulator mini', desc: 'Tombol kalkulator di kolom nominal — hitung 25.000 + 12.500 × 2 langsung.', icon: Calculator, tint: 'bg-indigo-50 text-indigo-600' },
];

export function KeyboardNominalView() {
  const { toast } = useFeedback();
  const { amountKeypad, save } = useRecordingPrefs();
  const pick = (v: AmountKeypad) => {
    if (v === amountKeypad) return;
    save({ amountKeypad: v })
      .then(() => toast.success(v === 'kalkulator' ? 'Kalkulator mini aktif di kolom nominal.' : 'Kembali ke keyboard standar.'))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.'));
  };
  return (
    <div className="space-y-4">
      <OptionCards options={KEYPADS} value={amountKeypad} onPick={pick} />
      <div className="rounded-[22px] bg-slate-50 p-4">
        <p className="text-[13px] font-semibold text-slate-700">Berlaku di</p>
        <p className="mt-1 text-[13px] text-slate-500">Form Tambah transaksi dan Input Cepat.</p>
      </div>
    </div>
  );
}
