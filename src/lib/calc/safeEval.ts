// Evaluator kalkulator ringan buat AmountKeypad — bukan eval(), input selalu
// dibangun dari tombol keypad sendiri (bukan teks bebas user), tapi tetap
// dihitung manual biar aman & predictable. Mendukung urutan operasi
// matematis standar (× ÷ didahulukan dari + −), tanpa tanda kurung — cukup
// buat quick-entry, bukan kalkulator ilmiah.

export type CalcOperator = "+" | "-" | "×" | "÷";
export type CalcToken = string; // angka mentah (e.g. "1000", "12.5") atau salah satu CalcOperator

const isOperator = (token: CalcToken): token is CalcOperator =>
  token === "+" || token === "-" || token === "×" || token === "÷";

/**
 * Evaluasi array token angka/operator hasil bangunan tombol keypad.
 * Return null kalau ekspresi belum lengkap (diawali/diakhiri operator,
 * kosong, atau ada pembagian dengan nol) — pemanggil (tombol "=") harus
 * no-op dalam kasus ini, bukan menampilkan Infinity/NaN.
 */
export function evaluateExpression(tokens: CalcToken[]): number | null {
  if (tokens.length === 0) return null;
  if (isOperator(tokens[0]) || isOperator(tokens[tokens.length - 1])) return null;

  // Pass 1: kumpulkan semua × dan ÷ dari kiri ke kanan.
  const pass1: CalcToken[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === "×" || token === "÷") {
      const prevToken = pass1.pop();
      const nextToken = tokens[i + 1];
      const prev = Number(prevToken);
      const next = Number(nextToken);
      if (prevToken === undefined || nextToken === undefined || !Number.isFinite(prev) || !Number.isFinite(next)) {
        return null;
      }
      if (token === "÷") {
        if (next === 0) return null;
        pass1.push(String(prev / next));
      } else {
        pass1.push(String(prev * next));
      }
      i += 2;
    } else {
      pass1.push(token);
      i += 1;
    }
  }

  // Pass 2: jumlahkan/kurangkan sisanya dari kiri ke kanan.
  let result = Number(pass1[0]);
  if (!Number.isFinite(result)) return null;
  for (let j = 1; j < pass1.length; j += 2) {
    const op = pass1[j];
    const num = Number(pass1[j + 1]);
    if (!Number.isFinite(num)) return null;
    if (op === "+") result += num;
    else if (op === "-") result -= num;
    else return null;
  }

  return Number.isFinite(result) ? result : null;
}
