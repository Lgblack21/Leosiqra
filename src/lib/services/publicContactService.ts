import { cloudflareApi } from '../cloudflare-api';

export interface PublicContact {
  whatsapp?: string;
  billingEmail?: string;
}

export interface PublicDeveloperInfo {
  name?: string | null;
  photoUrl?: string | null;
  quote?: string | null;
}

// Sumbernya /api/auth/me (bukan /api/admin/settings) karena endpoint itu
// admin-only — pengunjung yang belum login dan member biasa akan selalu
// gagal fetch dan lihat "Belum diatur" kalau dipaksa lewat sana.
export const getPublicContact = async (): Promise<PublicContact> => {
  try {
    const data = await cloudflareApi<{ contact?: PublicContact | null }>('/api/auth/me');
    return data.contact ?? {};
  } catch {
    return {};
  }
};

export const getDeveloperInfo = async (): Promise<PublicDeveloperInfo> => {
  try {
    const data = await cloudflareApi<{ developer?: PublicDeveloperInfo | null }>('/api/auth/me');
    return data.developer ?? {};
  } catch {
    return {};
  }
};
