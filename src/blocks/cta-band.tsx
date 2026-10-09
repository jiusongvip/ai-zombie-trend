import { ArrowRight } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { formatPrice, lowestPricePerFilmInCents } from '@/config/pricing';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { buttonVariants } from '@/components/ui/button';

export function CtaBand() {
  return (
    <section className="grain-overlay relative overflow-hidden px-4 py-24">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="animate-drift-c absolute top-1/2 left-1/2 size-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl [background:radial-gradient(circle_at_center,var(--primary)_0%,transparent_60%)]" />
      </div>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-glow text-3xl font-bold tracking-tight uppercase sm:text-4xl">
          {m['landing.cta.title']()}
        </h2>
        <p className="text-muted-foreground mt-4">
          {m['landing.cta.desc']({
            price: formatPrice(lowestPricePerFilmInCents()),
          })}
        </p>
        <Link
          href="/#generator"
          className={cn(
            buttonVariants({ size: 'lg' }),
            'font-display mt-8 h-12 rounded-full bg-primary px-8 text-sm font-semibold uppercase shadow-lg shadow-primary/30 hover:bg-primary/90'
          )}
        >
          {m['landing.cta.button']()}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
