'use client';

import { createContext, useContext } from 'react';

// Mode Petugas (akun tim di usaha pinjaman, 3.41): tampilan pinjaman yang sama dengan pemilik, tapi tombol
// khusus pemilik disembunyikan (cairkan pinjaman, hapus, geser jadwal, ubah jaminan, arsip, kas & laporan).
// Server tetap menolak aksi itu (staffLoanAllowed di Worker) — ini cuma supaya tombolnya tidak muncul.
export type Petugas = { kasName: string | null };
export const PetugasCtx = createContext<Petugas | null>(null);
export const usePetugas = () => useContext(PetugasCtx);
