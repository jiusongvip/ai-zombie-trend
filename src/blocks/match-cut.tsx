import { m } from '@/paraglide/messages.js';

const WIKI_MATCH_CUT = 'https://en.wikipedia.org/wiki/Match_cut';
const ADOBE_MATCH_CUT =
  'https://www.adobe.com/creativecloud/video/post-production/cuts-in-film/match-cut.html';

/**
 * The technique behind shot four, with the definition quoted rather than
 * paraphrased — a blockquote + cite pair is the machine-readable form of
 * "this claim came from somewhere", which is what AI answers cite.
 */
export function MatchCut() {
  return (
    <section className="border-border/60 border-t px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-center text-3xl font-semibold tracking-tight uppercase sm:text-4xl">
          {m['landing.cut.title']()}
        </h2>
        <p className="text-muted-foreground mt-5 text-sm leading-relaxed sm:text-[15px]">
          {m['landing.cut.body1']()}
        </p>

        <blockquote
          cite={WIKI_MATCH_CUT}
          className="border-primary/50 bg-card/60 mt-6 rounded-xl border-l-4 px-6 py-5"
        >
          <p className="text-foreground/90 text-[15px] leading-relaxed italic sm:text-base">
            “{m['landing.cut.q']()}”
          </p>
          <footer className="text-muted-foreground mt-3 text-sm">
            — <cite>{m['landing.cut.qcite']()}</cite>,{' '}
            <a
              href={WIKI_MATCH_CUT}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline underline-offset-2"
            >
              en.wikipedia.org
            </a>
          </footer>
        </blockquote>

        <p className="text-muted-foreground mt-6 text-sm leading-relaxed sm:text-[15px]">
          {m['landing.cut.body2']()}{' '}
          <a
            href={ADOBE_MATCH_CUT}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 underline underline-offset-2"
          >
            {m['landing.cut.adobe']()}
          </a>
          .
        </p>

        <article className="border-border/70 bg-card/60 mt-10 rounded-xl border p-6 sm:p-8">
          <h3 className="font-display text-base font-semibold tracking-wide uppercase sm:text-lg">
            {m['landing.cut.h3']()}
          </h3>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed sm:text-[15px]">
            {m['landing.cut.h3body']()}
          </p>
        </article>
      </div>
    </section>
  );
}
