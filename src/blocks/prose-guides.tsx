import { tDynamic } from '@/core/i18n/dynamic';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';

type Guide = {
  /** Message namespace: `<ns>.title`, optional `<ns>.intro`, `<ns>.<key>.title|body`. */
  ns: string;
  keys: readonly string[];
  /** Alternate the band background so stacked guides do not read as one wall. */
  divided?: boolean;
};

function ProseGuide({ ns, keys, divided }: Guide) {
  return (
    <section
      className={cn(
        'px-4 py-20 sm:py-24',
        divided && 'border-border/60 border-t'
      )}
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-center text-3xl font-semibold tracking-tight uppercase sm:text-4xl">
          {tDynamic(`${ns}.title`)}
        </h2>
        {tDynamic(`${ns}.intro`) ? (
          <p className="text-muted-foreground mt-5 text-center text-sm leading-relaxed sm:text-[15px]">
            {tDynamic(`${ns}.intro`)}
          </p>
        ) : null}

        <div className="mt-12 space-y-10">
          {keys.map((key) => (
            <article
              key={key}
              className="border-border/70 bg-card/60 rounded-xl border p-6 sm:p-8"
            >
              <h3 className="font-display text-base font-semibold tracking-wide uppercase sm:text-lg">
                {tDynamic(`${ns}.${key}.title`)}
              </h3>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed sm:text-[15px]">
                {tDynamic(`${ns}.${key}.body`)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Photo-selection guidance — the input is the whole difference in output. */
export function PhotoGuide() {
  return (
    <ProseGuide
      ns="landing.photos"
      keys={['s1', 's2', 's3', 's4', 's5']}
      divided
    />
  );
}

/** Framing choice offered by the workbench: 9:16 or 16:9. */
export function FormatGuide() {
  return <ProseGuide ns="landing.format" keys={['v', 'w', 'n']} />;
}

/** What each resolution tier costs and why. */
export function TierGuide() {
  return <ProseGuide ns="landing.tier" keys={['s', 'h', 'm', 'c']} divided />;
}

/** Queue, moderation gates, consent declaration and deletion window. */
export function DeliveryNotes() {
  return (
    <ProseGuide
      ns="landing.deliver"
      keys={['s1', 's2', 's3', 's4', 's5']}
      divided
    />
  );
}

/**
 * The four-shot grammar, expanded per world: heading, body and a
 * photo-selection tip unique to that setting.
 */
export function StoryModes() {
  const worlds = ['cabin', 'shore', 'street', 'doorstep'] as const;
  return (
    <section className="border-border/60 border-t px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight uppercase sm:text-4xl">
            {m['landing.modes.title']()}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-3xl text-sm leading-relaxed sm:text-[15px]">
            {m['landing.modes.intro']()}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {worlds.map((world) => (
            <article
              key={world}
              className="border-border/70 bg-card/60 rounded-xl border p-6"
            >
              <h3 className="font-display text-sm font-semibold tracking-wide uppercase">
                {m[
                  `landing.worlds.${world}.title` as 'landing.worlds.cabin.title'
                ]()}
              </h3>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                {m[
                  `landing.worlds.${world}.body` as 'landing.worlds.cabin.body'
                ]()}
              </p>
              <p className="border-primary/50 text-foreground/90 mt-4 border-l-2 pl-4 text-sm leading-relaxed italic">
                {m[
                  `landing.worlds.${world}.tip` as 'landing.worlds.cabin.tip'
                ]()}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
