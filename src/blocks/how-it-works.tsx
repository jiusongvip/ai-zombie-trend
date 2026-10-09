import { Check, Clapperboard, ImageUp, Palette, Ticket } from 'lucide-react';

import { tDynamic } from '@/core/i18n/dynamic';
import { formatPrice, lowestPricePerFilmInCents } from '@/config/pricing';
import { m } from '@/paraglide/messages.js';

const STEPS = [
  { icon: ImageUp, key: '1' },
  { icon: Palette, key: '2' },
  { icon: Ticket, key: '3' },
  { icon: Clapperboard, key: '4' },
] as const;

/** Everything downstream is interpolation — these two frames are the input. */
const PHOTO_TIPS = ['p1', 'p2', 'p3', 'p4', 'p5'] as const;

export function HowItWorks() {
  return (
    <section id="how" className="px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display mb-12 text-center text-3xl font-semibold tracking-tight uppercase sm:text-4xl">
          {m['landing.how.title']()}
        </h2>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, key }, i) => (
            <div key={key} className="relative">
              <div className="border-border/70 bg-card/60 h-full rounded-xl border p-6">
                <div className="flex items-center gap-3">
                  <span className="bg-primary/15 text-primary flex size-10 items-center justify-center rounded-full">
                    <Icon className="size-5" />
                  </span>
                  <span className="font-display text-muted-foreground text-2xl font-bold">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-display mt-4 text-sm font-semibold tracking-wide uppercase">
                  {m[`landing.how.step${key}.title` as 'landing.how.step1.title']()}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {m[`landing.how.step${key}.desc` as 'landing.how.step1.desc']({
                    price: formatPrice(lowestPricePerFilmInCents()),
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-border/70 bg-card/60 mt-6 rounded-xl border p-6 sm:p-8">
          <h3 className="font-display text-sm font-semibold tracking-wide uppercase">
            {m['landing.how.photos.title']()}
          </h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {PHOTO_TIPS.map((key) => (
              <li
                key={key}
                className="text-muted-foreground flex items-start gap-2 text-sm leading-relaxed"
              >
                <Check className="text-primary mt-1 size-4 shrink-0" />
                {tDynamic(`landing.how.photos.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
