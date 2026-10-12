import { Clapperboard, ImageUp, Lock, Ticket } from 'lucide-react';

import { m } from '@/paraglide/messages.js';

const CARDS = [
  { key: 'c1', icon: ImageUp },
  { key: 'c2', icon: Clapperboard },
  { key: 'c3', icon: Ticket },
  { key: 'c4', icon: Lock },
] as const;

const BULLETS = ['b1', 'b2', 'b3', 'b4'] as const;

/**
 * The four facts a buyer actually needs — input, output, payment, delivery —
 * with every number taken from the product itself: pricing catalog, the story
 * template in config/zombie-styles, and the frame-slot limits.
 */
export function SpecCards() {
  return (
    <section className="border-border/60 border-t px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight uppercase sm:text-4xl">
            {m['landing.spec.title']()}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-3xl text-sm leading-relaxed sm:text-[15px]">
            {m['landing.spec.intro']()}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {CARDS.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className="border-border/70 bg-card/60 rounded-xl border p-6"
            >
              <div className="flex items-center gap-3">
                <span className="bg-primary/15 text-primary flex size-10 items-center justify-center rounded-full">
                  <Icon className="size-5" />
                </span>
                <h3 className="font-display text-sm font-semibold tracking-wide uppercase">
                  {m[`landing.spec.${key}.title` as 'landing.spec.c1.title']()}
                </h3>
              </div>
              <ul className="mt-4 space-y-3">
                {BULLETS.map((b) => (
                  <li
                    key={b}
                    className="text-muted-foreground flex items-start gap-2 text-sm leading-relaxed"
                  >
                    <span className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
                    {m[`landing.spec.${key}.${b}` as 'landing.spec.c1.b1']()}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
