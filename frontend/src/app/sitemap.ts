import type { MetadataRoute } from 'next';
import { countyHref, getAllCounties, snapshotMeta } from '@/lib/counties';

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(snapshotMeta.generatedOn);
  return [
    { url: `${BASE}/`, lastModified, priority: 1 },
    { url: `${BASE}/counties`, lastModified, priority: 0.8 },
    ...getAllCounties().map((c) => ({
      url: `${BASE}${countyHref(c)}`,
      lastModified,
      priority: 0.6,
    })),
  ];
}
