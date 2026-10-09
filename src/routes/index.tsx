import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { pricingCatalog, formatPrice, lowestPricePerFilmInCents } from '@/config/pricing';
import { showcaseItems } from '@/config/showcase';
import {
  faqPageSchema,
  itemListSchema,
  jsonLd,
  webApplicationSchema,
} from '@/lib/schema';
import { faqEntries } from '@/blocks/faq';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { CtaBand } from '@/blocks/cta-band';
import { Faq } from '@/blocks/faq';
import { Footer } from '@/blocks/footer';
import { Generator } from '@/blocks/generator';
import { Header } from '@/blocks/header';
import { Hero } from '@/blocks/hero';
import { HowItWorks } from '@/blocks/how-it-works';
import { Pricing } from '@/blocks/pricing';
import { Showcase } from '@/blocks/showcase';
import { ShotList } from '@/blocks/shot-list';
import { SupportWidget } from '@/blocks/support-widget';

/**
 * Single-page landing for the "ai zombie trend" keyword: compact poster hero
 * and the generator workbench together fill the first screen — upload two
 * photos, pick a story, render, all on this page. Below: shot list, community
 * feed, then the conversion ladder (how → pricing → FAQ). Only /library,
 * /pricing, /blog and account pages remain as separate routes.
 */
function HomePage() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <Header />
      <main>
        <Hero />
        <Generator />
        <ShotList />
        <Showcase />
        <HowItWorks />
        <Pricing />
        <Faq />
        <CtaBand />
      </main>
      <Footer />
      <SupportWidget />
    </div>
  );
}

export const Route = createFileRoute('/')({
  loader: () => {
    const locale = getLocale();
    return {
      locale,
      title: m['landing.seo.home.title']({}, { locale }),
      description: m['landing.seo.home.desc'](
        { price: formatPrice(lowestPricePerFilmInCents()) },
        { locale }
      ),
    };
  },
  head: ({ loaderData }) => {
    const locale = (loaderData?.locale ?? 'en') as (typeof locales)[number];
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/`, { locale: loc as any }).href;
    const description = loaderData?.description ?? envConfigs.app_description;
    return {
      meta: [
        { title: loaderData?.title },
        { name: 'description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: loaderData?.title },
        { property: 'og:description', content: description },
        { property: 'og:image', content: `${envConfigs.app_url}/og-image.webp` },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: `${envConfigs.app_url}/og-image.webp` },
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
        webApplicationSchema({
          locale,
          description,
          offers: Object.values(pricingCatalog).map((product) => ({
            name: product.productName,
            price: product.priceInCents / 100,
            credits: product.credits,
          })),
        }),
        // The homepage renders the same example feed as /examples, so the two
        // real clips get VideoObject markup here too — the homepage is the
        // page that ranks for "ai zombie trend", and video rich results are
        // awarded per page, not per site.
        itemListSchema({
          path: '/',
          locale,
          title: loaderData?.title ?? envConfigs.app_name,
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
        faqPageSchema(faqEntries(locale), urlFor(locale))
      ),
    };
  },
  component: HomePage,
});
