import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const BASE_URL = 'https://www.leosiqra.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/hubungi-kami', '/auth/register', '/auth/login', '/privacy', '/terms'];

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.6,
  }));
}
