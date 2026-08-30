/**
 * Absolute origin for canonical URLs and the sitemap.
 *
 * A wrong value here is published to crawlers: the sitemap lists 3,146 URLs,
 * and a localhost origin would put all of them in front of a search engine.
 * So a production build must state its origin rather than inherit a
 * development default.
 */
const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

if (!configured && process.env.NODE_ENV === 'production') {
  throw new Error(
    'NEXT_PUBLIC_SITE_URL must be set for a production build. It is the origin ' +
      'used for canonical URLs and every URL in sitemap.xml; falling back to ' +
      'localhost would publish development URLs to crawlers.'
  );
}

export const SITE_URL = (configured || 'http://localhost:3000').replace(/\/$/, '');
