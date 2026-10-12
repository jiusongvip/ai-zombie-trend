import { m } from '@/paraglide/messages.js';

const WIKI_URL = 'https://en.wikipedia.org/wiki/Text-to-video_model';

/**
 * Trend context with a real external citation. AI engines cite pages that
 * quote and link trusted sources — the blockquote + cite pattern is the
 * machine-readable form of "this claim came from somewhere". The quote is
 * verbatim from the Wikipedia lead and stays English in both locales, which
 * is standard practice for quoted sources.
 */
export function TrendNote() {
  return (
    <section
      id="trend"
      className="border-border/60 border-t px-4 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display mb-6 text-center text-3xl font-semibold tracking-tight uppercase sm:text-4xl">
          {m['landing.trend.title']()}
        </h2>
        <p className="text-muted-foreground text-center text-sm leading-relaxed sm:text-base">
          {m['landing.trend.intro']()}
        </p>
        <blockquote
          cite={WIKI_URL}
          className="border-primary/50 bg-card/60 mt-6 rounded-xl border-l-4 px-6 py-5"
        >
          <p className="text-foreground/90 text-[15px] leading-relaxed italic sm:text-base">
            “A text-to-video model is a form of generative AI that uses a
            natural language description as input to produce a video relevant to
            the input text.”
          </p>
          <footer className="text-muted-foreground mt-3 text-sm">
            — <cite>{m['landing.trend.cite']()}</cite>,{' '}
            <a
              href={WIKI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              en.wikipedia.org
            </a>
          </footer>
        </blockquote>
        <p className="text-muted-foreground mt-6 text-center text-sm leading-relaxed sm:text-base">
          {m['landing.trend.outro']()}
        </p>
      </div>
    </section>
  );
}
