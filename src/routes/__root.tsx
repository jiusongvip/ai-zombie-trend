/// <reference types="vite/client" />
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { ThemeProvider } from 'next-themes';

import { envConfigs } from '@/config';
import { getQueryClient } from '@/lib/query-client';
import { jsonLd, organizationSchema, webSiteSchema } from '@/lib/schema';
import { getLocale } from '@/paraglide/runtime.js';
import { Ads } from '@/components/analytics/ads';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { Plausible } from '@/components/analytics/plausible';
import { Umami } from '@/components/analytics/umami';
import { AuthDialog } from '@/components/auth-dialog';
import { CustomerService } from '@/components/customer-service';
import { GoogleOneTap } from '@/components/google-one-tap';
import { SandboxPreviewBridge } from '@/components/sandbox-preview-bridge';
import { Toaster } from '@/components/ui/sonner';

import '@fontsource-variable/sora';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';

import soraVariableWoff2 from '@fontsource-variable/sora/files/sora-latin-wght-normal.woff2';
// The hero H1 is the mobile LCP element, and its timestamp is the font-swap
// repaint. Preloading that exact weight starts the fetch in parallel with the
// stylesheet instead of after it. Same for Sora — the body face; when the LCP
// lands on the hero sub-paragraph it waits on this swap instead.
import oswald700Woff2 from '@fontsource/oswald/files/oswald-latin-700-normal.woff2';

import '@/styles/globals.css';

// Analytics IDs live in the DB config (1h-cached service). Fetched via a
// server function so drizzle/db code never reaches the client bundle.
const DEFAULT_GA_ID = 'G-K7GZ3FHT83';
const getAnalyticsConfigs = createServerFn().handler(async () => {
  const { getAllConfigs } = await import('@/modules/config/service');
  const configs = await getAllConfigs();
  return {
    gaId: configs.google_analytics_id?.trim() || DEFAULT_GA_ID,
    plausibleDomain: configs.plausible_domain?.trim() || '',
    plausibleSrc: configs.plausible_src?.trim() || '',
    umamiSrc: configs.umami_src?.trim() || '',
    umamiWebsiteId: configs.umami_website_id?.trim() || '',
    adsenseCode: configs.adsense_code?.trim() || '',
    crispWebsiteId:
      configs.crisp_enabled === 'true'
        ? configs.crisp_website_id?.trim() || ''
        : '',
    tawkPropertyId:
      configs.tawk_enabled === 'true'
        ? configs.tawk_property_id?.trim() || ''
        : '',
    tawkWidgetId:
      configs.tawk_enabled === 'true'
        ? configs.tawk_widget_id?.trim() || ''
        : '',
  };
});

export const Route = createRootRoute({
  loader: () => getAnalyticsConfigs(),
  head: () => {
    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: envConfigs.app_name },
        { name: 'description', content: envConfigs.app_description },
        // One canonical brand string everywhere: title suffix, og:site_name
        // and the Organization schema all read envConfigs.app_name.
        { property: 'og:site_name', content: envConfigs.app_name },
      ],
      links: [
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/favicon.svg' },
        // Oswald 700 latin — the hero H1's face (see import above).
        {
          rel: 'preload',
          href: oswald700Woff2,
          as: 'font',
          type: 'font/woff2',
          crossorigin: 'anonymous',
        },
        // Sora variable latin — the body face the hero sub-paragraph renders in.
        {
          rel: 'preload',
          href: soraVariableWoff2,
          as: 'font',
          type: 'font/woff2',
          crossorigin: 'anonymous',
        },
      ],
      scripts: jsonLd(organizationSchema(), webSiteSchema()),
    };
  },
  component: RootComponent,
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  errorComponent: RootError,
});

function RootComponent() {
  const analytics = Route.useLoaderData();

  return (
    <QueryClientProvider client={getQueryClient()}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <Outlet />
        <SandboxPreviewBridge />
        <Toaster position="top-center" richColors />
        <GoogleOneTap />
        <AuthDialog />
        {analytics?.gaId ? (
          <GoogleAnalytics measurementId={analytics.gaId} />
        ) : null}
        {analytics?.plausibleDomain || analytics?.plausibleSrc ? (
          <Plausible
            domain={analytics.plausibleDomain}
            src={analytics.plausibleSrc || undefined}
          />
        ) : null}
        {analytics?.umamiWebsiteId ? (
          <Umami
            src={analytics.umamiSrc || undefined}
            websiteId={analytics.umamiWebsiteId}
          />
        ) : null}
        {analytics?.adsenseCode ? <Ads code={analytics.adsenseCode} /> : null}
        <CustomerService
          crispWebsiteId={analytics?.crispWebsiteId || undefined}
          tawkPropertyId={analytics?.tawkPropertyId || undefined}
          tawkWidgetId={analytics?.tawkWidgetId || undefined}
        />
      </ThemeProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <a href="/" className="text-sm underline underline-offset-4">
        Back to home
      </a>
    </div>
  );
}

function RootError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">Oops</h1>
      <p className="text-muted-foreground">
        Something went wrong. Please try again.
      </p>
      {import.meta.env.DEV && error instanceof Error && (
        <pre className="bg-muted mt-2 max-w-lg overflow-auto rounded p-4 text-xs">
          {error.message}
        </pre>
      )}
      <button
        type="button"
        onClick={reset}
        className="text-sm underline underline-offset-4"
      >
        Try again
      </button>
    </div>
  );
}
