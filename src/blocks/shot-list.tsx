import { m } from '@/paraglide/messages.js';

const SHOTS = ['1', '2', '3', '4'] as const;

/**
 * The four-shot grammar of the trend — presented as a film strip timeline.
 */
export function ShotList() {
  return (
    <section className="border-border/60 border-t px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight uppercase sm:text-4xl">
            {m['landing.shot.title']()}
          </h2>
          <p className="text-muted-foreground mt-4">{m['landing.shot.subtitle']()}</p>
        </div>

        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHOTS.map((n) => {
            const title = m[`landing.shot.s${n}.title` as 'landing.shot.s1.title']();
            const desc = m[`landing.shot.s${n}.desc` as 'landing.shot.s1.desc']();
            return (
              <li
                key={n}
                className="group border-border/70 bg-card/60 relative rounded-xl border p-5 transition-colors hover:border-primary/50"
              >
                <span className="font-display text-primary/35 group-hover:text-primary/70 text-4xl font-bold transition-colors">
                  {String(n).padStart(2, '0')}
                </span>
                <h3 className="font-display mt-3 text-sm font-semibold tracking-wide uppercase">
                  {title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {desc}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
