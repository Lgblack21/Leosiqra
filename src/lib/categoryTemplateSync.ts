"use client";

import { useEffect } from 'react';
import { cloudflareApi } from './cloudflare-api';
import { notifyCollectionChanged } from './cf-firestore';
import { reloadCategoryPrefs } from './categoryEmoji';

// Sekali per buka aplikasi: minta server menerapkan template kategori
// (hanya menambah grup yang belum ada + ikon & jenis; diklaim sekali per user
// di server, jadi panggilan berikutnya langsung "applied: false").
let started = false;

export function useCategoryTemplateSync() {
  useEffect(() => {
    if (started) return;
    started = true;
    cloudflareApi<{ applied?: boolean }>('/api/member/categories/template', { method: 'POST' })
      .then((r) => {
        if (!r.applied) return;
        notifyCollectionChanged('categories');
        void reloadCategoryPrefs();
      })
      .catch(() => {
        started = false; // coba lagi di pemuatan berikutnya
      });
  }, []);
}
