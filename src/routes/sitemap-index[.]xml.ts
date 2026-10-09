import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';

// Sitemap index entrypoint — mirrors the `sitemap-index.xml` shape the Astro
// sites in the portfolio expose, so GSC/robots submissions stay uniform.
// Wraps the single dynamic urlset served at /sitemap.xml (9 URLs today, far
// below the 50k/50MB threshold that would require real sharding).
export const Route = createFileRoute('/sitemap-index.xml')({
  server: {
    handlers: {
      GET: () => {
        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          '  <sitemap>',
          `    <loc>${envConfigs.app_url}/sitemap.xml</loc>`,
          '  </sitemap>',
          '</sitemapindex>',
          '',
        ].join('\n');
        return new Response(xml, {
          headers: { 'Content-Type': 'application/xml' },
        });
      },
    },
  },
});
