import { formatPrice, lowestPricePerFilmInCents } from '@/config/pricing';
import { m } from '@/paraglide/messages.js';

/**
 * Zombie-poster hero — deliberately short. The generator workbench starts in
 * the same first screen directly under it, so this band only carries the
 * keyword H1 and the "two photos in → one film out" promise. No CTAs, no
 * repeat of the render-time note: the real button is the workbench itself,
 * which already carries the note.
 */
export function Hero() {
  return (
    <section className="grain-overlay relative isolate flex flex-col items-center overflow-hidden px-4 pt-6 pb-1 text-center sm:pt-8 lg:pt-4 lg:pb-0">
      {/* Cold drift fog — clears for the golden story band below */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="animate-drift-a absolute -top-1/3 left-1/2 size-[120vmin] -translate-x-1/2 rounded-full opacity-25 blur-3xl [background:radial-gradient(circle_at_center,var(--primary)_0%,transparent_60%)]" />
        <div className="animate-drift-b absolute -bottom-1/2 -left-1/4 size-[90vmin] rounded-full opacity-15 blur-3xl [background:radial-gradient(circle_at_center,var(--primary)_0%,transparent_65%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background" />
      </div>

      <div className="w-full max-w-3xl">
        <span className="border-primary/40 bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-wide uppercase">
          <span className="bg-primary animate-pulse size-1.5 rounded-full" />
          {m['landing.hero.badge']()}
        </span>

        <h1 className="font-display text-glow mt-4 text-3xl leading-[1.05] font-bold tracking-tight text-balance uppercase sm:text-4xl lg:text-5xl">
          {m['landing.hero.headline']()}
        </h1>

        <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-sm leading-relaxed sm:text-[15px] lg:mt-2">
          {m['landing.hero.subheadline']({
            price: formatPrice(lowestPricePerFilmInCents()),
          })}
        </p>
      </div>
    </section>
  );
}
