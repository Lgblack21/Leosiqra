import { NumberInput } from '@/components/ui/NumberInput';

export interface CardCycleFormValues {
  statementDay: string;
  dueDay: string;
  minPaymentPercent: string;
  minPaymentAmount: string;
}

export const emptyCardCycleForm: CardCycleFormValues = {
  statementDay: '',
  dueDay: '',
  minPaymentPercent: '',
  minPaymentAmount: '',
};

// Nilai form → field Account. String kosong = tidak diatur (dikirim null ke
// API, jadi pengaturan lama ikut terhapus saat dikosongkan).
export const cardCycleFromForm = (v: CardCycleFormValues) => {
  const num = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? undefined : Number(s));
  return {
    statementDay: num(v.statementDay),
    dueDay: num(v.dueDay),
    minPaymentPercent: num(v.minPaymentPercent),
    minPaymentAmount: num(v.minPaymentAmount),
  };
};

export const cardCycleToForm = (a: { statementDay?: number; dueDay?: number; minPaymentPercent?: number; minPaymentAmount?: number }): CardCycleFormValues => ({
  statementDay: a.statementDay ? String(a.statementDay) : '',
  dueDay: a.dueDay ? String(a.dueDay) : '',
  minPaymentPercent: a.minPaymentPercent !== undefined ? String(a.minPaymentPercent) : '',
  minPaymentAmount: a.minPaymentAmount !== undefined ? String(a.minPaymentAmount) : '',
});

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);
const inputClass = 'w-full bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all';
const labelClass = 'text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1';

// Pengaturan siklus tagihan kartu kredit (opsional). Tanpa tanggal cetak &
// jatuh tempo, fitur tagihan periode/jatuh tempo/pengingat tidak aktif.
export function CardCycleFields({ value, onChange }: { value: CardCycleFormValues; onChange: (v: CardCycleFormValues) => void }) {
  const set = (patch: Partial<CardCycleFormValues>) => onChange({ ...value, ...patch });
  const invalid = value.statementDay !== '' && value.dueDay !== '' && value.statementDay === value.dueDay;
  return (
    <div className="col-span-full space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
      <div>
        <p className="text-xs font-black text-indigo-600">Siklus tagihan (opsional)</p>
        <p className="text-[11px] text-slate-500 mt-0.5">Isi supaya Leosiqra bisa hitung tagihan per periode, minimum bayar, dan kirim pengingat H-3 & H-1 jatuh tempo.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className={labelClass}>Tanggal cetak</label>
          <select value={value.statementDay} onChange={(e) => set({ statementDay: e.target.value })} className={inputClass} aria-label="Tanggal cetak tagihan">
            <option value="">–</option>
            {DAYS.map((d) => <option key={d} value={d}>Tgl {d}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className={labelClass}>Jatuh tempo</label>
          <select value={value.dueDay} onChange={(e) => set({ dueDay: e.target.value })} className={inputClass} aria-label="Tanggal jatuh tempo">
            <option value="">–</option>
            {DAYS.map((d) => <option key={d} value={d}>Tgl {d}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className={labelClass}>Minimum bayar (%)</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.5"
            value={value.minPaymentPercent}
            onChange={(e) => set({ minPaymentPercent: e.target.value })}
            placeholder="10"
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <label className={labelClass}>Minimum paling kecil</label>
          <NumberInput value={value.minPaymentAmount} onChange={(v) => set({ minPaymentAmount: v })} placeholder="50000" className={inputClass} />
        </div>
      </div>
      {invalid && <p className="text-[11px] font-bold text-rose-500">Tanggal cetak dan jatuh tempo tidak boleh sama.</p>}
    </div>
  );
}
