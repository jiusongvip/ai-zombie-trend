import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { CREDITS_PER_FILM, pricingCatalog } from '@/config/pricing';
import {
  breadcrumbSchema,
  jsonLd,
  priceSpecificationSchema,
  seoUrl,
} from '@/lib/schema';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { Footer } from '@/blocks/footer';
import { Header } from '@/blocks/header';
import { Pricing } from '@/blocks/pricing';
import { CtaBand } from '@/blocks/cta-band';

export const Route = createFileRoute('/pricing')({
  loader: () => {
    const locale = getLocale();
    return {
      locale,
      title: m['landing.pricing.title']({}, { locale }),
      description: m['landing.pricing.description']({}, { locale }),
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { locale, title, description } = loaderData;
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/pricing`, { locale: loc as any }).href;
    const cheapest = Object.values(pricingCatalog).sort(
      (a, b) => a.priceInCents - b.priceInCents
    )[0];
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:url', content: urlFor(locale) },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:image', content: `${envConfigs.app_url}/og-image.webp` },
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
        breadcrumbSchema(
          [
            { name: m['common.systems.home']({}, { locale }), path: '/' },
            { name: title },
          ],
          locale
        ),
        priceSpecificationSchema({
          locale,
          path: '/pricing',
          credits: cheapest.credits,
          priceInCents: cheapest.priceInCents,
          films: Math.floor(cheapest.credits / CREDITS_PER_FILM),
        })
      ),
    };
  },
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Pricing headingAs="h1" />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
