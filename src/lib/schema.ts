/**
 * Schema.org JSON-LD builders.
 *
 * Every builder returns a plain object; `jsonLd()` packs them into the
 * `scripts` slot of a route's `head()` return value, which TanStack Router
 * server-renders as <script type="application/ld+json"> in <head>.
 *
 * Hard rule: never emit a URL we don't actually serve, and never emit
 * VideoObject for a clip that doesn't exist. Rich-result spam flags cost more
 * than the missing badge.
 */

import { envConfigs } from '@/config';
import { baseLocale, locales, localizeUrl } from '@/paraglide/runtime.js';

type Locale = (typeof locales)[number];

/**
 * Absolute origin used for every emitted URL.
 *
 * Mirrors the reasoning in `__root.tsx`: `head()` re-runs in the browser during
 * hydration, where `envConfigs.app_url` reverts to the localhost dev default if
 * VITE_APP_URL wasn't inlined into the client bundle. Preferring the live origin
 * keeps the client-rendered node identical to the server-rendered one crawlers
 * receive.
 */
function baseUrl(): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : envConfigs.app_url;
  return (origin || '').replace(/\/$/, '');
}

/** Absolute, locale-prefixed URL for the given path ('' or '/'). */
export function seoUrl(path = '/', locale: Locale = baseLocale): string {
  const clean = path === '/' ? '' : path;
  return localizeUrl(`${baseUrl()}${clean}`, { locale }).href;
}

/** Site root — the stable id every other node references. */
export function siteUrl(): string {
  return `${baseUrl()}/`;
}

function publisher() {
  return {
    '@type': 'Organization',
    '@id': `${siteUrl()}#organization`,
    name: envConfigs.app_name,
    url: siteUrl(),
    logo: {
      '@type': 'ImageObject',
      url: `${baseUrl()}/logo.svg`,
    },
    description: envConfigs.app_description,
  };
}

export function organizationSchema() {
  return publisher();
}

export function webSiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': `${siteUrl()}#website`,
    url: siteUrl(),
    name: envConfigs.app_name,
    description: envConfigs.app_description,
    inLanguage: locales,
    publisher: { '@id': `${siteUrl()}#organization` },
  };
}

/**
 * The generator itself. `offers` mirrors src/config/pricing.ts — keep the two
 * in sync; a schema price that disagrees with checkout is a manual-action risk.
 */
export function webApplicationSchema(params: {
  locale: Locale;
  description: string;
  faq?: { name: string; acceptedAnswer: string }[];
  offers: { name: string; price: number; credits: number }[];
  freeTrial?: boolean;
}) {
  const url = seoUrl('/', params.locale);
  return {
    '@type': 'WebApplication',
    '@id': `${url}#app`,
    name: envConfigs.app_name,
    url,
    applicationCategory: 'MultimediaApplication',
    applicationSubCategory: 'AI video generator',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript',
    softwareVersion: '1',
    description: params.description,
    image: `${baseUrl()}/images/showcase/zombie-cabin.webp`,
    inLanguage: params.locale,
    isAccessibleForFree: params.freeTrial ?? false,
    featureList: [
      'Four-shot zombie love story from two photos',
      'Couple, pet, friends and Halloween story modes',
      '15-second scored video, 9:16 and 16:9',
      'No prompt writing required',
      'No watermark',
    ],
    publisher: { '@id': `${siteUrl()}#organization` },
    offers: params.offers.map((offer) => ({
      '@type': 'Offer',
      name: offer.name,
      price: offer.price.toFixed(2),
      priceCurrency: 'USD',
      url,
      category: `${offer.credits} credits, one-time`,
      availability: 'https://schema.org/InStock',
    })),
  };
}

export function faqPageSchema(
  entries: { name: string; acceptedAnswer: string }[],
  url: string
) {
  return {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.name,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.acceptedAnswer,
      },
    })),
  };
}

export function breadcrumbSchema(
  crumbs: { name: string; path?: string }[],
  locale: Locale
) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      ...(crumb.path === undefined
        ? {}
        : { item: seoUrl(crumb.path || '/', locale) }),
    })),
  };
}

export function articleSchema(params: {
  title: string;
  description: string;
  path: string;
  locale: Locale;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  image?: string;
  type?: 'BlogPosting' | 'Article';
}) {
  const url = seoUrl(params.path, params.locale);
  return {
    '@type': params.type ?? 'BlogPosting',
    '@id': url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: params.title,
    description: params.description,
    articleSection: 'AI zombie trend',
    inLanguage: params.locale,
    datePublished: params.datePublished,
    dateModified: params.dateModified ?? params.datePublished,
    author: params.authorName
      ? {
          '@type': 'Person',
          name: params.authorName,
          url: `${siteUrl()}#organization`,
        }
      : { '@id': `${siteUrl()}#organization` },
    publisher: { '@id': `${siteUrl()}#organization` },
    image: params.image
      ? [
          params.image.startsWith('http')
            ? params.image
            : `${baseUrl()}${params.image}`,
        ]
      : [`${baseUrl()}/images/showcase/zombie-reunion.webp`],
  };
}

/**
 * One example clip. `contentUrl` is required by Google for VideoObject, so an
 * entry without a real rendered clip degrades to ImageObject instead of
 * shipping a URL that 404s. Both `contentUrl` and `embedUrl` must be absolute
 * — Google discards VideoObject nodes with relative URLs.
 */
function exampleEntity(item: ExampleLike, locale: Locale) {
  const base = {
    name: item.title,
    description: item.prompt[locale === 'zh' ? 'zh' : 'en'],
    thumbnailUrl: `${baseUrl()}${item.cover}`,
  };
  if (!item.video) {
    return {
      '@type': 'ImageObject',
      url: `${baseUrl()}${item.cover}`,
      ...base,
    };
  }
  return {
    '@type': 'VideoObject',
    contentUrl: `${baseUrl()}${item.video}`,
    embedUrl: `${seoUrl('/examples', locale)}#${item.id}`,
    uploadDate: item.uploadDate ?? '2026-01-01',
    duration: item.duration ?? 'PT15S',
    ...base,
  };
}

export interface ExampleLike {
  id: string;
  title: string;
  cover: string;
  video?: string;
  prompt: { en: string; zh: string };
  uploadDate?: string;
  duration?: string;
}

/** ItemList wrapping the example entities — the public case wall. */
export function itemListSchema(params: {
  path: string;
  locale: Locale;
  title: string;
  description: string;
  items: ExampleLike[];
}) {
  const url = seoUrl(params.path, params.locale);
  return {
    '@type': 'ItemList',
    '@id': `${url}#list`,
    name: params.title,
    description: params.description,
    numberOfItems: params.items.length,
    itemListElement: params.items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${url}#${item.id}`,
      item: exampleEntity(item, params.locale),
    })),
  };
}

/** Pack + per-film price, for the pricing page. */
export function priceSpecificationSchema(params: {
  locale: Locale;
  path: string;
  credits: number;
  priceInCents: number;
  films: number;
}) {
  const url = seoUrl(params.path, params.locale);
  return {
    '@type': 'Service',
    '@id': `${url}#service`,
    serviceType: 'AI zombie video generation',
    provider: { '@id': `${siteUrl()}#organization` },
    areaServed: 'Worldwide',
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: url,
    },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: (params.priceInCents / 100).toFixed(2),
      offerCount: params.credits,
      valueAdded: [
        `${params.credits} credits for $${(params.priceInCents / 100).toFixed(2)}`,
        `${params.films} films included`,
      ],
    },
  };
}

/** Collapse a list of schema objects into TanStack Router's `scripts` head slot. */
export function jsonLd(...nodes: unknown[]) {
  return nodes
    .filter(Boolean)
    .map((node) => ({
      type: 'application/ld+json',
      children: JSON.stringify(node),
    }));
}
