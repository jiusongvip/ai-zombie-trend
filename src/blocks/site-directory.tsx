import { tDynamic } from '@/core/i18n/dynamic';
import { Link } from '@/core/i18n/navigation';
import { m } from '@/paraglide/messages.js';

const ENTRIES = [
  {
    href: '/#generator',
    title: 'landing.footer.generator',
    desc: 'landing.directory.gen.desc',
  },
  {
    href: '/examples',
    title: 'landing.footer.examples',
    desc: 'landing.directory.ex.desc',
  },
  {
    href: '/pricing',
    title: 'landing.footer.pricing',
    desc: 'landing.directory.pr.desc',
  },
  {
    href: '/blog',
    title: 'landing.footer.blog',
    desc: 'landing.directory.bl.desc',
  },
  {
    href: '/blog/how-to-make-ai-zombie-video',
    title: 'landing.directory.po1.title',
    desc: 'landing.directory.po1.desc',
  },
  {
    href: '/blog/what-is-the-ai-zombie-trend',
    title: 'landing.directory.po2.title',
    desc: 'landing.directory.po2.desc',
  },
  {
    href: '/blog/ai-zombie-trend-photo-privacy',
    title: 'landing.directory.po3.title',
    desc: 'landing.directory.po3.desc',
  },
  {
    href: '/ai-zombie-pet-video',
    title: 'landing.directory.pv.title',
    desc: 'landing.directory.pv.desc',
  },
  {
    href: '/ai-zombie-trend-prompts',
    title: 'landing.directory.pm.title',
    desc: 'landing.directory.pm.desc',
  },
  {
    href: '/library',
    title: 'landing.footer.library',
    desc: 'landing.directory.lib.desc',
  },
  {
    href: '/about',
    title: 'landing.footer.about',
    desc: 'landing.directory.po4.desc',
  },
] as const;

/**
 * Descriptive anchor-text directory of everything on the site. It is the only
 * place the three blog guides are linked from the homepage with real anchor
 * text, which is what moves PageRank between the money page and the explainers.
 */
export function SiteDirectory() {
  return (
    <section className="border-border/60 border-t px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight uppercase sm:text-4xl">
            {m['landing.directory.title']()}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-sm leading-relaxed sm:text-[15px]">
            {m['landing.directory.intro']()}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ENTRIES.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="group border-border/70 bg-card/60 hover:border-primary/50 rounded-xl border p-5 transition-colors"
            >
              <h3 className="font-display group-hover:text-primary text-sm font-semibold tracking-wide uppercase transition-colors">
                {tDynamic(entry.title)}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {tDynamic(entry.desc)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
