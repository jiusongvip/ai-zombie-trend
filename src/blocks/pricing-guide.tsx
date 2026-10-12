import type { ReactNode } from 'react';

import { tDynamic } from '@/core/i18n/dynamic';
import { Link } from '@/core/i18n/navigation';
import { formatPrice, listPricingProducts } from '@/config/pricing';
import { m } from '@/paraglide/messages.js';
import type { locales } from '@/paraglide/runtime.js';

const HOW = ['s1', 's2', 's3'] as const;
const PACKS = ['single', 'trio', 'ten', 'annual'] as const;
const INCLUDED = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'] as const;
const FAQ = ['1', '2', '3', '4', '5'] as const;

/**
 * Rendered and schema'd from the same list so the visible pricing FAQ and the
 * FAQPage JSON-LD on /pricing cannot drift apart.
 */
export function pricingFaqEntries(locale: (typeof locales)[number]) {
  return FAQ.map((n) => ({
    name: m[`landing.pgp.faq.q${n}` as 'landing.pgp.faq.q1']({}, { locale }),
    acceptedAnswer: m[`landing.pgp.faq.a${n}` as 'landing.pgp.faq.a1'](
      {},
      { locale }
    ),
  }));
}

function Section({
  ns,
  children,
  divided = true,
}: {
  ns: string;
  children: ReactNode;
  divided?: boolean;
}) {
  return (
    <section
      className={
        divided
          ? 'border-border/60 border-t px-4 py-16 sm:py-20'
          : 'px-4 py-16 sm:py-20'
      }
    >
      <div className="mx-auto max-w-4xl">
        <h2 className="font-display text-center text-2xl font-semibold tracking-tight uppercase sm:text-3xl">
          {tDynamic(`${ns}.title`)}
        </h2>
        {children}
      </div>
    </section>
  );
}

/**
 * The prose half of /pricing. The pack table above converts; this is the half
 * that answers "what am I actually paying for" and gives the page enough
 * substance to rank for credit, cost-per-film and refund queries.
 */
export function PricingGuide() {
  const packs = listPricingProducts();

  return (
    <>
      <Section ns="landing.pgp.how">
        <p className="text-muted-foreground mt-5 text-center text-sm leading-relaxed sm:text-[15px]">
          {tDynamic('landing.pgp.how.body')}
        </p>
        <div className="mt-10 space-y-6">
          {HOW.map((key) => (
            <article
              key={key}
              className="border-border/70 bg-card/60 rounded-xl border p-6"
            >
              <h3 className="font-display text-sm font-semibold tracking-wide uppercase sm:text-base">
                {tDynamic(`landing.pgp.how.${key}.title`)}
              </h3>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                {tDynamic(`landing.pgp.how.${key}.body`)}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section ns="landing.pgp.packs">
        <p className="text-muted-foreground mt-5 text-center text-sm leading-relaxed sm:text-[15px]">
          {tDynamic('landing.pgp.packs.intro')}
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {PACKS.map((key) => (
            <article
              key={key}
              className="border-border/70 bg-card/60 rounded-xl border p-6"
            >
              <h3 className="font-display text-sm font-semibold tracking-wide uppercase">
                {tDynamic(`landing.pgp.packs.${key}.title`)}
              </h3>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                {tDynamic(`landing.pgp.packs.${key}.body`)}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section ns="landing.pgp.compare">
        <p className="text-muted-foreground mt-5 text-center text-sm leading-relaxed sm:text-[15px]">
          {tDynamic('landing.pgp.compare.intro')}
        </p>
        <div className="border-border/70 mt-8 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">
              {tDynamic('landing.pgp.compare.title')}
            </caption>
            <thead className="bg-card/60 border-border/70 border-b">
              <tr className="text-left">
                {[
                  'h_std',
                  'h_paid',
                  'h_credits',
                  'h_std_films',
                  'h_hd_films',
                  'h_per_std',
                  'h_per_hd',
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="font-display px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap uppercase"
                  >
                    {m[
                      `landing.pgp.compare.${h}` as 'landing.pgp.compare.h_std'
                    ]()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {packs.map((p) => (
                <tr key={p.productId} className="text-muted-foreground">
                  <th
                    scope="row"
                    className="text-foreground px-4 py-3 text-left font-medium whitespace-nowrap"
                  >
                    {p.productName}
                  </th>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatPrice(p.priceInCents)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{p.credits}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{p.films}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {p.hdFilms > 0 ? p.hdFilms : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatPrice(Math.round(p.priceInCents / p.films))}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {p.hdFilms > 0
                      ? formatPrice(Math.round(p.priceInCents / p.hdFilms))
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground mt-4 text-center text-xs leading-relaxed sm:text-[13px]">
          {tDynamic('landing.pgp.compare.note')}
        </p>
      </Section>

      <Section ns="landing.pgp.included">
        <p className="text-muted-foreground mt-5 text-center text-sm leading-relaxed sm:text-[15px]">
          {tDynamic('landing.pgp.included.intro')}
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {INCLUDED.map((key) => (
            <li
              key={key}
              className="border-border/70 bg-card/60 flex items-start gap-3 rounded-xl border p-4"
            >
              <span className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
              <span className="text-muted-foreground text-sm leading-relaxed">
                {tDynamic(`landing.pgp.included.${key}`)}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section ns="landing.pgp.refund">
        <p className="text-muted-foreground mt-5 text-center text-sm leading-relaxed sm:text-[15px]">
          {tDynamic('landing.pgp.refund.body')}{' '}
          <Link
            href="/refund-policy"
            className="text-primary hover:text-primary/80 underline underline-offset-2"
          >
            {m['landing.pgp.refund.link']()}
          </Link>
          .
        </p>
      </Section>

      <Section ns="landing.pgp.faq" divided={false}>
        <div className="border-border/70 divide-border/70 mt-8 divide-y rounded-xl border">
          {FAQ.map((n) => (
            <details key={n} className="group open:bg-card/50 px-5 py-4">
              <summary className="hover:text-primary flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium transition-colors marker:hidden sm:text-base">
                {m[`landing.pgp.faq.q${n}` as 'landing.pgp.faq.q1']()}
                <span className="text-muted-foreground group-open:text-primary shrink-0 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed sm:text-[15px]">
                {m[`landing.pgp.faq.a${n}` as 'landing.pgp.faq.a1']()}
              </p>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}
