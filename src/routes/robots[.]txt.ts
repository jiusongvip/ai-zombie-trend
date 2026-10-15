import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { baseLocale, locales } from '@/paraglide/runtime.js';

// The router serves the site under a `/<locale>` prefix for every non-base
// locale, and robots.txt matching starts at the site root — so a bare
// `Disallow: /settings` leaves `/zh/settings` wide open. Emit both forms.
function appPaths(): string[] {
  const privatePaths = ['/admin', '/settings', '/api/'];
  const prefixes = [
    '',
    ...locales.filter((l) => l !== baseLocale).map((l) => `/${l}`),
  ];
  return prefixes.flatMap((p) => privatePaths.map((path) => `${p}${path}`));
}

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () => {
        const body = [
          'User-Agent: *',
          'Allow: /',
          ...appPaths().map((path) => `Disallow: ${path}`),
          'Disallow: /*?*',
          '',
          `Sitemap: ${envConfigs.app_url}/sitemap-index.xml`,
          '',
        ].join('\n');
        return new Response(body, {
          headers: { 'Content-Type': 'text/plain' },
        });
      },
    },
  },
});
