-- Sehatku: pengingat follow up klaim macet & angka hasil cek kesehatan.
-- Jalankan SETELAH 0038 & 0039. Boleh sebelum/sesudah deploy: tanpa kolom ini pengingat klaim dilewati
-- dan catatan cek tersimpan tanpa angka hasil (tidak ada yang error).
ALTER TABLE health_claims ADD COLUMN followup_at TEXT;
ALTER TABLE health_checks ADD COLUMN results_json TEXT;
