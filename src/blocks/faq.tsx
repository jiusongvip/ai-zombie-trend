import { formatPrice, lowestPricePerFilmInCents } from '@/config/pricing';
import { m } from '@/paraglide/messages.js';
import type { locales } from '@/paraglide/runtime.js';

const QS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

/**
 * The FAQ in one place so the rendered accordion and the FAQPage JSON-LD can
 * never drift apart — a mismatch between visible text and structured data is a
 * rich-result spam signal.
 */
export function faqEntries(locale: (typeof locales)[number]) {
  const price = formatPrice(lowestPricePerFilmInCents());
  return QS.map((n) => ({
    name: m[`landing.faq.q${n}` as 'landing.faq.q1']({ price }, { locale }),
    acceptedAnswer: m[`landing.faq.a${n}` as 'landing.faq.a1']({ price }, { locale }),
  }));
}

export function Faq() {
  const price = formatPrice(lowestPricePerFilmInCents());
  return (
    <section id="faq" className="border-border/60 border-t px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display mb-10 text-center text-3xl font-semibold tracking-tight uppercase sm:text-4xl">
          {m['landing.faq.title']()}
        </h2>

        <div className="divide-border/70 divide-y rounded-xl border border-border/70">
          {QS.map((n) => (
            <details key={n} className="group px-5 py-4 open:bg-card/50">
              <summary className="hover:text-primary flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium transition-colors marker:hidden sm:text-base">
                {m[`landing.faq.q${n}` as 'landing.faq.q1']({ price })}
                <span className="text-muted-foreground group-open:text-primary shrink-0 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed sm:text-[15px]">
                {m[`landing.faq.a${n}` as 'landing.faq.a1']({ price })}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
