// Ekstraksi teks PDF di browser (pdf.js) tanpa perlu konfigurasi worker
// terpisah — cukup untuk aksi sekali pakai (impor e-statement), jalan di
// main thread ("fake worker") sudah cukup dan lebih sederhana daripada
// meng-host file worker pdf.js sendiri di Next.js/Turbopack.

// PDF terkunci (e-statement/tagihan kartu kredit): `wrong` = kata sandi yang
// diberikan salah. Kata sandi hanya dipakai pdf.js di browser untuk membuka
// file — tidak dikirim ke server dan tidak disimpan.
export class PdfPasswordError extends Error {
  constructor(public wrong: boolean) {
    super(wrong ? 'Kata sandi PDF salah.' : 'PDF ini dikunci kata sandi.');
    this.name = 'PdfPasswordError';
  }
}

export async function extractPdfText(file: File, password?: string): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // "Fake worker" pdf.js hanya aktif kalau modul worker sudah ada di
  // globalThis.pdfjsWorker — tanpa ini browser melempar 'No
  // "GlobalWorkerOptions.workerSrc" specified' (Node tidak, karena di sana
  // pdf.js mengimpor worker-nya sendiri).
  const g = globalThis as { pdfjsWorker?: unknown };
  if (!g.pdfjsWorker) g.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');

  const buffer = await file.arrayBuffer();
  let doc: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;
  try {
    doc = await pdfjsLib.getDocument({ data: buffer, password }).promise;
  } catch (e) {
    // pdf.js: PasswordException code 1 = butuh sandi, 2 = sandi salah.
    const err = e as { name?: string; code?: number };
    if (err?.name === 'PasswordException') throw new PdfPasswordError(err.code === 2);
    throw e;
  }

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    // Kelompokkan item teks per baris berdasarkan koordinat Y (dengan
    // toleransi kecil), lalu urutkan tiap baris berdasarkan X — supaya tabel
    // multi-kolom yang posisinya absolut tetap terbaca dalam urutan baca
    // yang benar, bukan urutan acak sesuai stream internal PDF.
    type Item = { str: string; x: number; y: number };
    const items: Item[] = (content.items as Array<{ str?: string; transform: number[] }>)
      .filter((it) => typeof it.str === 'string' && it.str.trim() !== '')
      .map((it) => ({ str: it.str as string, x: it.transform[4], y: it.transform[5] }));

    const lines: Item[][] = [];
    const Y_TOLERANCE = 2;
    for (const item of items) {
      let line = lines.find((l) => Math.abs(l[0].y - item.y) <= Y_TOLERANCE);
      if (!line) {
        line = [];
        lines.push(line);
      }
      line.push(item);
    }

    lines.sort((a, b) => b[0].y - a[0].y);
    const pageText = lines
      .map((line) => line.sort((a, b) => a.x - b.x).map((it) => it.str).join(' '))
      .join('\n');
    pageTexts.push(pageText);
  }

  return pageTexts.join('\n');
}
