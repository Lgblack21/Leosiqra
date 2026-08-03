// Ekstraksi teks PDF di browser (pdf.js) tanpa perlu konfigurasi worker
// terpisah — cukup untuk aksi sekali pakai (impor e-statement), jalan di
// main thread ("fake worker") sudah cukup dan lebih sederhana daripada
// meng-host file worker pdf.js sendiri di Next.js/Turbopack.
export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '';

  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

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
