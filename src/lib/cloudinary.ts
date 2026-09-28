// Batas setelah dikecilkan — batas upload gambar Cloudinary (paket gratis) 10MB.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const SHRINK_ABOVE_BYTES = 1024 * 1024;

// Foto kamera HP sering 3–12MB. Kecilkan ke sisi terpanjang 1600px (JPEG)
// sebelum upload: lebih cepat, hemat kuota, dan tidak mentok batas ukuran.
// Kalau browser tidak bisa membaca formatnya (mis. HEIC di Chrome), kirim
// file aslinya saja — Cloudinary yang menangani.
async function shrinkImage(file: File): Promise<File> {
  if (file.size <= SHRINK_ABOVE_BYTES || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#fff'; // PNG transparan → latar putih, bukan hitam
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

type Signature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  allowedFormats: string;
  signature: string;
};

// Minta tanda tangan upload ke Worker (hanya untuk user yang login).
// null = server belum dikonfigurasi (503) / Worker versi lama (404) → pakai
// preset unsigned lama. Error lain (401, 429, …) dilempar apa adanya.
async function requestSignature(): Promise<Signature | null> {
  const response = await fetch('/api/member/uploads/cloudinary-signature', {
    method: 'POST',
    credentials: 'include',
  });
  if (response.status === 503 || response.status === 404) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Gagal menyiapkan upload.');
  }
  return data as Signature;
}

export const uploadToCloudinary = async (original: File): Promise<string> => {
  if (!original.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar.");
  }
  const file = await shrinkImage(original);
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Ukuran gambar terlalu besar (maksimal 10MB).");
  }

  const formData = new FormData();
  formData.append("file", file);

  const signed = await requestSignature();
  let cloudName: string | undefined;
  if (signed) {
    cloudName = signed.cloudName;
    formData.append("api_key", signed.apiKey);
    formData.append("timestamp", String(signed.timestamp));
    formData.append("folder", signed.folder);
    formData.append("allowed_formats", signed.allowedFormats);
    formData.append("signature", signed.signature);
  } else {
    cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      // Secret Worker belum dipasang DAN build tanpa .env.local — lihat .env.example.
      throw new Error("Upload gambar sedang tidak tersedia. Coba lagi nanti.");
    }
    formData.append("upload_preset", uploadPreset);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Cloudinary upload failed:", response.status, errorData.error?.message);
    throw new Error("Upload gambar gagal. Coba lagi, atau pilih gambar lain.");
  }

  const data = await response.json();
  return data.secure_url;
};
