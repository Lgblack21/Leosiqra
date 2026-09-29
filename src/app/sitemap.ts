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
    '/panduan/dana-darurat',
    '/panduan/cara-melunasi-utang',
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
