import { cloudflareApi } from '@/lib/cloudflare-api';
import type { QuickDraft } from './parse';

interface AiSuggestion {
  type: 'pengeluaran' | 'pemasukan';
  amount: number;
  category: string | null;
  sub_category: string | null;
  note: string | null;
  confidence: 'high' | 'medium' | 'low';
  account_id?: string | null;
  date?: string | null;
}

// Baca transaksi dari teks (transkrip suara) atau foto struk lewat
// /api/member/ai/parse-transaction. Server hanya mengembalikan kategori &
// rekening yang benar-benar milik user, dan tanggal yang masuk akal.
export const aiParse = async (input: { text: string } | { imageBase64: string }): Promise<QuickDraft & { confidence: AiSuggestion['confidence'] }> => {
  const res = await cloudflareApi<{ ok: boolean; suggestion?: AiSuggestion; error?: string }>('/api/member/ai/parse-transaction', {
    method: 'POST',
    json: input,
  });
  if (!res.ok || !res.suggestion) throw new Error(res.error || 'AI tidak bisa membaca transaksi ini.');
  const s = res.suggestion;
  return {
    type: s.type,
    amount: s.amount,
    category: s.category ?? undefined,
    subCategory: s.sub_category ?? undefined,
    note: s.note ?? undefined,
    accountId: s.account_id ?? undefined,
    date: s.date ?? undefined,
    confidence: s.confidence,
  };
};

// Foto kamera HP bisa 5–10 MB — perkecil ke sisi terpanjang 1600px JPEG
// sebelum dikirim (cukup untuk membaca struk, jauh lebih ringan untuk upload).
export const imageFileToBase64 = (file: File, maxSide = 1600, quality = 0.8): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Gagal memproses foto.')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1] ?? '');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('File bukan gambar yang bisa dibaca.')); };
    img.src = url;
  });
