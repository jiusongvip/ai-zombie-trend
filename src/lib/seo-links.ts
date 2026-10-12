import { envConfigs } from '@/config';
import { locales, localizeUrl } from '@/paraglide/runtime.js';

type Locale = (typeof locales)[number];

export function localeUrl(path: string, loc: string) {
  return localizeUrl(`${envConfigs.app_url}${path}`, {
    locale: loc as Locale,
  }).href;
}

/**
 * Build a self-contained hreflang cluster for one page. Each page must ship
 * links that reference only its own locale alternates (plus x-default) —
 * a site-wide cluster pointing at the homepage makes Google treat every
 * deeper page as an "alternate page with proper canonical mark".
 */
export function localeLinks(path: string, locale: string) {
  const urlFor = (loc: string) => localeUrl(path, loc);
  return [
    { rel: 'canonical', href: urlFor(locale) },
    ...locales.map((loc) => ({
      rel: 'alternate',
      hrefLang: loc,
      href: urlFor(loc),
    })),
    { rel: 'alternate', hrefLang: 'x-default', href: urlFor('en') },
  ];
}

export function twitterMeta({
  title,
  description,
  image,
}: {
  title: string;
  description: string;
  image: string;
}) {
  return [
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
  ];
}
