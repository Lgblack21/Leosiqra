const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

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

export const uploadToCloudinary = async (file: File): Promise<string> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Ukuran gambar maksimal 5MB.");
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
      throw new Error("Cloudinary configuration is missing. Please check your .env.local");
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
    throw new Error(errorData.error?.message || "Cloudinary upload failed");
  }

  const data = await response.json();
  return data.secure_url;
};
