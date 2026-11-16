// Kecilkan foto di perangkat sebelum diunggah (foto kamera HP 3–12 MB → ±200–500 KB JPEG).
// Dipakai untuk foto privat (anggota, KTP, jaminan, staf) yang batasnya 2 MB di server.
export async function fotoKeBase64(file: File, maxSisi = 1280, kualitas = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa foto (JPG, PNG, atau WebP).');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Foto tidak bisa dibaca. Coba ambil ulang atau pilih foto lain (JPG/PNG).');
  }
  const skala = Math.min(1, maxSisi / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * skala);
  const h = Math.round(bitmap.height * skala);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Perangkat tidak bisa mengolah foto.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', kualitas);
  if (dataUrl.length > 2_700_000) throw new Error('Foto terlalu besar. Coba foto ulang dengan resolusi lebih kecil.');
  return dataUrl;
}
