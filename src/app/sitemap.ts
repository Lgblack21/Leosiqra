import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const BASE_URL = 'https://www.leosiqra.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/catatan-keuangan-pribadi',
    '/catatan-keuangan-harian',
    '/panduan',
    '/install',
    '/panduan/cara-mengatur-gaji',
    '/panduan/mengatur-gaji-mingguan',
    '/panduan/dana-darurat',
    '/panduan/cara-membuat-anggaran-bulanan',
    '/panduan/cara-melunasi-utang',
    '/panduan/catat-keuangan-rumah-tangga',
    '/panduan/catat-pengeluaran-di-excel',
    '/panduan/aplikasi-pencatat-pengeluaran',
    '/panduan/catat-keuangan-usaha-kecil',
    '/panduan/cara-menabung-yang-benar',
    '/panduan/cara-menabung-10-juta',
    '/panduan/cara-mengatur-gaji-3-juta',
    '/panduan/cara-mengatur-gaji-2-juta',
    '/panduan/cara-mencatat-keuangan-di-hp',
    '/panduan/catatan-hutang-piutang',
    '/panduan/mcp',
    '/panduan/cara-mencatat-uang-kas',
    '/panduan/bukti-lapor-spt-coretax',
    '/auth/register',
    '/hubungi-kami',
    '/privacy',
    '/terms',
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : route.startsWith('/catatan-keuangan') ? 0.9 : route.startsWith('/panduan') ? 0.8 : 0.6,
  }));
}
