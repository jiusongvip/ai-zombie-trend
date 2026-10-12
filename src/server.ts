import handler from '@tanstack/react-start/server-entry';

import { getCookieFromHeader } from './lib/cookie';
import { locales } from './paraglide/runtime.js';
import { paraglideMiddleware } from './paraglide/server.js';

// On Cloudflare Workers, stash the binding env (D1, ASSETS, …) on globalThis
// so synchronous code paths (e.g. the db() singleton with DATABASE_PROVIDER=d1)
// can reach bindings without threading the request context through every call.
// The specifier is kept non-literal so bundlers leave the import to runtime;
// outside workerd the import rejects and we just move on.
const CF_WORKERS_MODULE = 'cloudflare:workers';
let cfEnvPromise: Promise<void> | null = null;

function ensureCloudflareEnv(): Promise<void> {
  if (!cfEnvPromise) {
    cfEnvPromise = import(/* @vite-ignore */ CF_WORKERS_MODULE)
      .then((mod) => {
        (globalThis as any).__CF_ENV__ = mod.env;
      })
      .catch(() => {
        // Not running on Cloudflare Workers — nothing to stash.
      });
  }
  return cfEnvPromise;
}

// Custom server entry — wraps every request in Paraglide's middleware so
// getLocale() resolves per-request (AsyncLocalStorage) during SSR.
export default {
  async fetch(req: Request): Promise<Response> {
    await ensureCloudflareEnv();
    // Guard against doubled locale prefixes (/zh/zh…) which Paraglide's URL
    // strategy happily strips into the real page, creating indexable URL
    // variants outside the sitemap. 301 to the single-prefix URL.
    const url = new URL(req.url);
    const doubled = new RegExp(`^/(${locales.join('|')})/\\1(?=/|$)`).exec(
      url.pathname
    );
    if (doubled) {
      url.pathname = url.pathname.slice(doubled[1].length + 1);
      return Response.redirect(url.toString(), 301);
    }
    const response = await paraglideMiddleware(req, () => handler.fetch(req));
    const utmSource = url.searchParams.get('utm_source');
    const existing = getCookieFromHeader(
      req.headers.get('cookie'),
      'utm_source'
    );
    if (utmSource && !existing) {
      const sanitized = utmSource.replace(/[^\w.\-]/g, '').slice(0, 100);
      if (sanitized) {
        response.headers.append(
          'Set-Cookie',
          `utm_source=${sanitized}; Max-Age=2592000; Path=/; SameSite=Lax`
        );
      }
    }
    return response;
  },
};
