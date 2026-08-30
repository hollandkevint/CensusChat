import type { MetadataRoute } from 'next';
import { countyHref, getAllCounties, snapshotMeta } from '@/lib/counties';
import { SITE_URL } from '@/lib/siteUrl';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(snapshotMeta.generatedOn);
  return [
    { url: `${SITE_URL}/`, lastModified, priority: 1 },
    { url: `${SITE_URL}/counties`, lastModified, priority: 0.8 },
    ...getAllCounties().map((c) => ({
      url: `${SITE_URL}${countyHref(c)}`,
      lastModified,
      priority: 0.6,
    })),
  ];
}
