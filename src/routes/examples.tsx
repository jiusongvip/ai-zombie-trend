import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { showcaseItems } from '@/config/showcase';
import {
  breadcrumbSchema,
  itemListSchema,
  jsonLd,
} from '@/lib/schema';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { Footer } from '@/blocks/footer';
import { Header } from '@/blocks/header';
import { Showcase } from '@/blocks/showcase';
import { CtaBand } from '@/blocks/cta-band';

type Locale = (typeof locales)[number];

/**
 * Public case wall — a standalone, indexable surface for the example films.
 *
 * The homepage carries the same feed as one section among eight, so it can
 * never win an "ai zombie examples" query on its own. This page gives the wall
 * its own title, canonical and ItemList markup, and its cards route "Try this"
 * back to the homepage workbench with the story preselected.
 */
function ExamplesPage() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="px-4 pt-16 pb-2 text-center sm:pt-20">
          <h1 className="font-display mx-auto max-w-3xl text-4xl font-semibold tracking-tight uppercase sm:text-5xl">
            {m['landing.examples.title']()}
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-sm sm:text-base">
            {m['landing.examples.description']()}
          </p>
        </div>
        <Showcase />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute('/examples')({
  loader: () => {
    const locale = getLocale();
    return {
      locale,
      title: m['landing.examples.seo.title']({}, { locale }),
      description: m['landing.examples.seo.desc']({}, { locale }),
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { locale, title, description } = loaderData;
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/examples`, {
        locale: loc as Locale,
      }).href;
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:url', content: urlFor(locale) },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        {
          property: 'og:image',
          content: `${envConfigs.app_url}/og-image.webp`,
        },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      links: [
        { rel: 'canonical', href: urlFor(locale) },
        ...locales.map((loc) => ({
          rel: 'alternate',
          hrefLang: loc,
          href: urlFor(loc),
        })),
        { rel: 'alternate', hrefLang: 'x-default', href: urlFor('en') },
      ],
      scripts: jsonLd(
        itemListSchema({
          path: '/examples',
          locale: locale as Locale,
          title,
          description,
          items: showcaseItems.map((item) => {
            const label = m[
              `landing.usecases.${item.tag}.title` as 'landing.usecases.couple.title'
            ]({}, { locale });
            return {
              id: item.id,
              title: `${label} — ${item.model}`,
              cover: item.cover,
              video: item.video,
              prompt: item.prompt,
            };
          }),
        }),
        breadcrumbSchema(
          [
            { name: m['common.systems.home']({}, { locale }), path: '/' },
            { name: title },
          ],
          locale as Locale
        )
      ),
    };
  },
  component: ExamplesPage,
});
