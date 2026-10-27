import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';

/**
 * The four-shot grammar of the trend, told with our own cut: every frame below is
 * lifted straight out of the sample film in the generator above, at the second the
 * beat actually lands. The strip therefore doubles as proof — the shot list is not
 * a claim about what the model can do, it is a timecode of what it already did.
 *
 * The accent bar under each frame runs cold to warm across the four shots, which is
 * the film's own arc: a dark cabin ending in a wheat field at sunset.
 */
const SHOTS = [
  {
    id: '1',
    src: '/images/shots/shot-1-cold-open.webp',
    bar: 'bg-sky-500/70',
  },
  { id: '2', src: '/images/shots/shot-2-face.webp', bar: 'bg-teal-500/70' },
  { id: '3', src: '/images/shots/shot-3-leap.webp', bar: 'bg-lime-500/70' },
  {
    id: '4',
    src: '/images/shots/shot-4-match-cut.webp',
    bar: 'bg-amber-500/80',
  },
] as const;

/** Frames are 720x414 (the sample film's 16:9 shape). */
const FRAME = { width: 720, height: 414 } as const;

export function ShotList() {
  return (
    <section className="border-border/60 border-t px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight uppercase sm:text-4xl">
            {m['landing.shot.title']()}
          </h2>
          <p className="text-muted-foreground mt-4">
            {m['landing.shot.subtitle']()}
          </p>
        </div>

        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHOTS.map((shot, index) => {
            const title =
              m[`landing.shot.s${shot.id}.title` as 'landing.shot.s1.title']();
            const desc =
              m[`landing.shot.s${shot.id}.desc` as 'landing.shot.s1.desc']();
            const time =
              m[`landing.shot.s${shot.id}.time` as 'landing.shot.s1.time']();
            return (
              <li
                key={shot.id}
                className="group border-border/70 bg-card/60 hover:border-primary/50 overflow-hidden rounded-xl border transition-colors"
              >
                <div className="relative">
                  <img
                    src={shot.src}
                    width={FRAME.width}
                    height={FRAME.height}
                    alt={m['landing.shot.frame_alt']({
                      n: String(index + 1),
                      title,
                    })}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="aspect-video size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-x-0 bottom-0 h-[3px]',
                      shot.bar
                    )}
                  />
                </div>
                <div className="p-5">
                  <p className="text-muted-foreground/80 font-mono text-[11px] tracking-wide">
                    {time}
                  </p>
                  <h3 className="font-display mt-2 text-sm font-semibold tracking-wide uppercase">
                    {title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
