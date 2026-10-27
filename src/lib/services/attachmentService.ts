import { cloudflareApi } from '../cloudflare-api';

// Lampiran foto struk (lihat Worker: handleAttachmentRoutes). Foto disimpan
// server saat AI membaca struk; di sini cuma menautkan & menampilkan.
export const attachmentService = {
  // Best effort — transaksi sudah tersimpan; gagal menautkan foto tidak boleh
  // membuat user mengira transaksinya gagal.
  async link(attachmentId: string | null | undefined, transactionId: string | null | undefined) {
    if (!attachmentId || !transactionId) return;
    try {
      await cloudflareApi(`/api/member/attachments/${attachmentId}/link`, { method: 'POST', json: { transactionId } });
    } catch (e) {
      console.warn('Lampiran struk tidak tertaut:', e);
    }
  },

  async list() {
    const res = await cloudflareApi<{ items: { id: string; transaction_id: string }[] }>('/api/member/attachments');
    return res.items;
  },

  url: (attachmentId: string) => `/api/member/attachments/${attachmentId}`,
};
