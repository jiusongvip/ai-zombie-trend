import type { ComponentType } from 'react';
import { notFound, useLoaderData } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { stageFilmFor } from '@/config/showcase';
import { articleSchema, breadcrumbSchema, jsonLd } from '@/lib/schema';
import { localeLinks, localeUrl, twitterMeta } from '@/lib/seo-links';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { baseLocale, getLocale } from '@/paraglide/runtime.js';
import { CtaBand } from '@/blocks/cta-band';
import { Generator } from '@/blocks/generator';

type PageMeta = {
  title: string;
  description: string;
  /**
   * What a reader sees under the headline. `description` is written for a search
   * result and reads like an index of the page; a workbench line has to say what
   * happens when you click. Optional because only the pages that carry the
   * block need it — everywhere else falls back to the description.
   */
  lead?: string;
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

type LoaderData = {
  meta: PageMeta;
  slug: string;
  locale: string;
  generator: boolean;
};

export interface StaticPageOptions {
  /**
   * Emit `Article` rather than plain `WebPage` structured data. For editorial
   * pages only — a privacy policy typed as an Article is noise.
   */
  article?: boolean;
  /**
   * Put the workbench in the first screen, under the page's own headline.
   * Keyword pages set this: a visitor who searched for the thing should not
   * have to scroll through an explainer to reach the button.
   */
  generator?: boolean;
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
      return { meta: page.meta, slug, locale, generator: !!options.generator };
    },
    head: ({ loaderData }: { loaderData?: LoaderData }) => {
      if (!loaderData) return {};
      const { meta, locale, slug: pageSlug } = loaderData;
      const loc = locale as ReturnType<typeof getLocale>;
      const ogImage = `${envConfigs.app_url}/og-image.webp`;
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
          { title: `${meta.title} | ${envConfigs.app_name}` },
          { name: 'description', content: meta.description },
          { property: 'og:url', content: localeUrl(`/${pageSlug}`, loc) },
          {
            property: 'og:type',
            content: options.article ? 'article' : 'website',
          },
          { property: 'og:title', content: meta.title },
          { property: 'og:description', content: meta.description },
          { property: 'og:image', content: ogImage },
          ...twitterMeta({
            title: meta.title,
            description: meta.description,
            image: ogImage,
          }),
        ],
        links: localeLinks(`/${pageSlug}`, loc),
        scripts: jsonLd(...nodes),
      };
    },
    component: StaticPage,
  };
}

function StaticPage() {
  const { meta, slug, locale, generator } = useLoaderData({
    strict: false,
  }) as LoaderData;

  const page = loadPage(slug, locale)!;
  const Content = page.default;

  // A page that carries the workbench runs it at the homepage's measure, which
  // is wider than a reading column — so the shell follows the block, and the
  // prose below it is capped back to the column the rest of the group uses.
  const shell = generator
    ? 'mx-auto w-full max-w-6xl px-4 sm:px-6'
    : 'mx-auto w-full max-w-3xl px-6 md:px-8';

  return (
    <div className={cn(shell, 'pt-8 pb-12 md:pb-16')}>
      {/* A page that opens on the workbench has no business spending its first
          screen on a way back — the header is sticky and already holds home. */}
      {!generator && (
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="size-4" />
          {m['common.pages.back_to_home']()}
        </Link>
      )}
      <article>
        {/* The workbench carries its own promise column, so a page that opens on
            it puts the headline there — the slot the homepage uses — instead of a
            band of text above the fold that the reader has to scroll past. A page
            without the block keeps the plain header. */}
        {generator ? (
          <Generator
            variant="card"
            sample={stageFilmFor(slug) ?? undefined}
            pitch={{ title: meta.title, lead: meta.lead ?? meta.description }}
          />
        ) : (
          <header className="border-border mb-6 border-b pb-5">
            <h1 className="text-foreground text-3xl font-semibold tracking-tight md:text-4xl">
              {meta.title}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {meta.description}
            </p>
          </header>
        )}
        {/* The block brings its own vertical padding, so the prose starts
            straight under it. */}
        <div
          className={cn(
            'text-foreground/90 text-[15px] leading-7',
            generator && 'max-w-3xl'
          )}
        >
          <Content />
        </div>
        {/* Read after the page, not before it: a date is a credibility check, and
            above the fold it was the third thing a buyer saw. */}
        <p className="text-muted-foreground mt-10 text-xs">
          {m['common.pages.last_updated']()}: {meta.updated_at}
        </p>
      </article>
      {/* A page that opened on the workbench closes on it too. The band jumps to
          this page's own `#generator` rather than the homepage's: by the bottom
          of an explainer the reader has decided what they want, and the slowest
          route to a render is another page. */}
      {generator && <CtaBand href="#generator" />}
    </div>
  );
}
