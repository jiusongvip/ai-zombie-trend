import type { ReactNode } from 'react';

import { tDynamic } from '@/core/i18n/dynamic';
import { m } from '@/paraglide/messages.js';
import type { locales } from '@/paraglide/runtime.js';

const LOOK = ['s1', 's2', 's3'] as const;
const MODES = ['couple', 'pet', 'friend', 'family'] as const;
const FAQ = ['1', '2', '3', '4'] as const;

export function examplesFaqEntries(locale: (typeof locales)[number]) {
  return FAQ.map((n) => ({
    name: m[`landing.exg.faq.q${n}` as 'landing.exg.faq.q1']({}, { locale }),
    acceptedAnswer: m[`landing.exg.faq.a${n}` as 'landing.exg.faq.a1'](
      {},
      { locale }
    ),
  }));
}

function Band({
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
          ? 'border-border/60 mt-4 border-t px-4 py-16 sm:py-20'
          : 'mt-4 px-4 py-16 sm:py-20'
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
 * Reading instructions for the example wall. /examples is the page that has to
 * answer "what does an AI zombie film actually look like", so the wall gets the
 * three things to check, the pipeline behind the clips, and a visible FAQ that
 * the page's FAQPage markup is generated from.
 */
export function ExamplesGuide() {
  return (
    <>
      <Band ns="landing.exg.look">
        <p className="text-muted-foreground mt-5 text-center text-sm leading-relaxed sm:text-[15px]">
          {tDynamic('landing.exg.look.intro')}
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {LOOK.map((key) => (
            <article
              key={key}
              className="border-border/70 bg-card/60 rounded-xl border p-6"
            >
              <h3 className="font-display text-sm font-semibold tracking-wide uppercase">
                {tDynamic(`landing.exg.look.${key}.title`)}
              </h3>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                {tDynamic(`landing.exg.look.${key}.body`)}
              </p>
            </article>
          ))}
        </div>
      </Band>

      <Band ns="landing.exg.made" divided={false}>
        <p className="text-muted-foreground mt-5 text-sm leading-relaxed sm:text-[15px]">
          {tDynamic('landing.exg.made.body')}
        </p>
        <p className="border-primary/50 bg-card/60 text-muted-foreground mt-6 rounded-xl border-l-4 px-5 py-4 text-sm leading-relaxed">
          {tDynamic('landing.exg.made.label')}
        </p>
      </Band>

      <Band ns="landing.exg.modes">
        <p className="text-muted-foreground mt-5 text-center text-sm leading-relaxed sm:text-[15px]">
          {tDynamic('landing.exg.modes.intro')}
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {MODES.map((mode) => (
            <li
              key={mode}
              className="border-border/70 bg-card/60 flex items-start gap-3 rounded-xl border p-4"
            >
              <span className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
              <span className="text-muted-foreground text-sm leading-relaxed">
                {tDynamic(`landing.exg.modes.${mode}`)}
              </span>
            </li>
          ))}
        </ul>
      </Band>

      <Band ns="landing.exg.next" divided={false}>
        <p className="text-muted-foreground mt-5 text-sm leading-relaxed sm:text-[15px]">
          {tDynamic('landing.exg.next.body')}
        </p>
      </Band>

      <Band ns="landing.exg.faq">
        <div className="border-border/70 divide-border/70 mt-8 divide-y rounded-xl border">
          {FAQ.map((n) => (
            <details key={n} className="group open:bg-card/50 px-5 py-4">
              <summary className="hover:text-primary flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium transition-colors marker:hidden sm:text-base">
                {m[`landing.exg.faq.q${n}` as 'landing.exg.faq.q1']()}
                <span className="text-muted-foreground group-open:text-primary shrink-0 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed sm:text-[15px]">
                {m[`landing.exg.faq.a${n}` as 'landing.exg.faq.a1']()}
              </p>
            </details>
          ))}
        </div>
      </Band>
    </>
  );
}
