import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { baseLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { getLocalPosts, mergePosts } from '@/content/posts';

const STATIC_PATHS = [
  '',
  '/examples',
  '/pricing',
  '/blog',
  '/privacy-policy',
  '/terms-of-service',
  '/refund-policy',
];

// Site content baseline date for pages without an explicit last-modified stamp.
const STATIC_LASTMOD = '2026-10-09';

type Entry = {
  path: string;
  lastModified?: string;
  changeFrequency: string;
  priority: number;
};

function urlFor(path: string, locale: string): string {
  return localizeUrl(`${envConfigs.app_url}${path || '/'}`, {
    locale: locale as (typeof locales)[number],
  }).href;
}

// Normalize an ISO timestamp (or fall back to the baseline) to YYYY-MM-DD.
function toDate(value?: string): string {
  return (value ?? STATIC_LASTMOD).slice(0, 10);
}

// One <url> block per locale: hreflang <xhtml:link> alternates are no longer
// emitted, so each localized page must be listed on its own or the /zh pages
// would drop out of the index entirely.
function entryXml(e: Entry): string {
  const lastmod = toDate(e.lastModified);
  return locales
    .map(
      (loc) =>
        [
          '  <url>',
          `    <loc>${urlFor(e.path, loc)}</loc>`,
          `    <lastmod>${lastmod}</lastmod>`,
          `    <changefreq>${e.changeFrequency}</changefreq>`,
          `    <priority>${e.priority}</priority>`,
          '  </url>',
        ].join('\n')
    )
    .join('\n');
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const entries: Entry[] = STATIC_PATHS.map((path) => ({
          path,
          changeFrequency: path === '/blog' ? 'daily' : 'weekly',
          priority: path === '' ? 1 : 0.8,
        }));

        // Blog posts: db posts merged with local MDX posts.
        try {
          const { listPublishedArticles } =
            await import('@/modules/posts/service');
          const rows = await listPublishedArticles().catch(() => []);
          const dbPosts = rows.map((row) => ({
            slug: row.slug,
            title: row.title || row.slug,
            description: row.description || '',
            createdAt: new Date(row.createdAt).toISOString(),
            source: 'db' as const,
          }));
          const posts = mergePosts(dbPosts, getLocalPosts(baseLocale));
          for (const post of posts) {
            entries.push({
              path: `/blog/${post.slug}`,
              lastModified: post.createdAt,
              changeFrequency: 'monthly',
              priority: 0.6,
            });
          }
        } catch {
          // Database unreachable — static paths + local posts still listed.
          for (const post of getLocalPosts(baseLocale)) {
            entries.push({
              path: `/blog/${post.slug}`,
              lastModified: post.createdAt,
              changeFrequency: 'monthly',
              priority: 0.6,
            });
          }
        }

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
          ...entries.map(entryXml),
          '</urlset>',
          '',
        ].join('\n');

        return new Response(xml, {
          headers: { 'Content-Type': 'application/xml' },
        });
      },
    },
  },
});
