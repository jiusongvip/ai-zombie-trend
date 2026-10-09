import type { ComponentType } from 'react';
import { notFound, useLoaderData } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import {
  articleSchema,
  breadcrumbSchema,
  jsonLd,
} from '@/lib/schema';
import { m } from '@/paraglide/messages.js';
import { baseLocale, getLocale, localizeUrl } from '@/paraglide/runtime.js';

type PageMeta = {
  title: string;
  description: string;
  updated_at: string;
};

type PageModule = {
  default: ComponentType;
  meta: PageMeta;
};

// Eagerly bundle the static content pages (small legal/info MDX files).
// Keys are absolute from the project root.
const pages = import.meta.glob<PageModule>('/src/content/pages/*.mdx', {
  eager: true,
});

function loadPage(slug: string, locale: string): PageModule | null {
  return (
    pages[`/src/content/pages/${slug}.${locale}.mdx`] ??
    pages[`/src/content/pages/${slug}.${baseLocale}.mdx`] ??
    null
  );
}

type LoaderData = { meta: PageMeta; slug: string; locale: string };

export interface StaticPageOptions {
  /**
   * Emit `Article` rather than plain `WebPage` structured data. For editorial
   * pages only — a privacy policy typed as an Article is noise.
   */
  article?: boolean;
}

// Shared route options for static MDX pages. Each page gets its own
// explicit route file (e.g. privacy-policy.tsx) so static segments
// always outrank dynamic ones — add a new page by creating the MDX
// content plus a thin route file using this factory.
export function staticPageRouteOptions(
  slug: string,
  options: StaticPageOptions = {}
) {
  return {
    loader: (): LoaderData => {
      const locale = getLocale();
      const page = loadPage(slug, locale);
      if (!page) throw notFound();
      return { meta: page.meta, slug, locale };
    },
    head: ({ loaderData }: { loaderData?: LoaderData }) => {
      if (!loaderData) return {};
      const { meta, locale, slug: pageSlug } = loaderData;
      const loc = locale as ReturnType<typeof getLocale>;
      const canonical = localizeUrl(`${envConfigs.app_url}/${pageSlug}`, {
        locale: loc,
      }).href;
      const nodes: unknown[] = [
        breadcrumbSchema(
          [
            { name: m['common.systems.home']({}, { locale: loc }), path: '/' },
            { name: meta.title },
          ],
          loc
        ),
      ];
      if (options.article) {
        nodes.push(
          articleSchema({
            title: meta.title,
            description: meta.description,
            path: `/${pageSlug}`,
            locale: locale as ReturnType<typeof getLocale>,
            datePublished: meta.updated_at,
            dateModified: meta.updated_at,
            type: 'Article',
          })
        );
      }
      return {
        meta: [
          { title: meta.title },
          { name: 'description', content: meta.description },
          { property: 'og:type', content: options.article ? 'article' : 'website' },
          { property: 'og:title', content: meta.title },
          { property: 'og:description', content: meta.description },
          {
            property: 'og:image',
            content: `${envConfigs.app_url}/og-image.webp`,
          },
          { name: 'twitter:card', content: 'summary_large_image' },
        ],
        links: [{ rel: 'canonical', href: canonical }],
        scripts: jsonLd(...nodes),
      };
    },
    component: StaticPage,
  };
}

function StaticPage() {
  const { meta, slug, locale } = useLoaderData({
    strict: false,
  }) as LoaderData;

  const page = loadPage(slug, locale)!;
  const Content = page.default;

  return (
    <article>
      <header className="border-border mb-6 border-b pb-5">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight md:text-4xl">
          {meta.title}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">{meta.description}</p>
        <p className="text-muted-foreground mt-2 text-xs">
          {m['common.pages.last_updated']()}: {meta.updated_at}
        </p>
      </header>
      <div className="text-foreground/90 text-[15px] leading-7">
        <Content />
      </div>
    </article>
  );
}
