import { createFileRoute } from '@tanstack/react-router';

import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { breadcrumbSchema, jsonLd } from '@/lib/schema';
import { localeLinks, localeUrl, twitterMeta } from '@/lib/seo-links';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales } from '@/paraglide/runtime.js';
import { Footer } from '@/blocks/footer';
import { Header } from '@/blocks/header';
import { BlogCard } from '@/components/blog-card';
import { formatPostDate } from '@/content/posts';
import { getBlogPostsFn } from '@/content/posts/server';

export const Route = createFileRoute('/blog/')({
  loader: async () => {
    const locale = getLocale();
    const posts = await getBlogPostsFn({ data: { locale } });
    return { locale, posts };
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.locale;
    const canonical = localeUrl('/blog', locale ?? 'en');
    const title = m['blog.seo.title']({}, { locale: locale as any });
    const description = m['blog.seo.description'](
      {},
      { locale: locale as any }
    );
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:url', content: canonical },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        {
          property: 'og:image',
          content: `${envConfigs.app_url}/og-image.webp`,
        },
        ...twitterMeta({
          title,
          description,
          image: `${envConfigs.app_url}/og-image.webp`,
        }),
      ],
      links: localeLinks('/blog', locale ?? 'en'),
      scripts: jsonLd(
        breadcrumbSchema(
          [
            {
              name: m['common.systems.home']({}, { locale: locale as any }),
              path: '/',
            },
            { name: m['blog.title']({}, { locale: locale as any }) },
          ],
          (locale ?? 'en') as (typeof locales)[number]
        )
      ),
    };
  },
  component: BlogPage,
});

function BlogPage() {
  const { locale, posts } = Route.useLoaderData();

  // The three guides have a reading order — what the format is, how to make
  // one, what happens to the face you upload — that the date-sorted grid does
  // not express. Slugs first, then whatever else exists.
  const ORDER = [
    'what-is-the-ai-zombie-trend',
    'how-to-make-ai-zombie-video',
    'ai-zombie-trend-photo-privacy',
  ];
  const ordered = [
    ...ORDER.map((slug) => posts.find((p) => p.slug === slug)).filter(
      (p): p is (typeof posts)[number] => !!p
    ),
    ...posts.filter((p) => !ORDER.includes(p.slug)),
  ];
  const stepBlurb = ['blog.step.1', 'blog.step.2', 'blog.step.3'] as const;

  const OTHER = [
    { href: '/', desc: 'landing.directory.gen.desc' },
    { href: '/examples', desc: 'landing.directory.ex.desc' },
    { href: '/pricing', desc: 'landing.directory.pr.desc' },
    { href: '/about', desc: 'landing.directory.po4.desc' },
  ] as const;

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              {m['blog.h1']()}
            </h1>
            <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-sm leading-relaxed sm:text-[15px]">
              {m['blog.intro']()}
            </p>
          </div>
          {posts.length === 0 ? (
            <p className="text-muted-foreground text-center">
              {m['blog.no_posts']()}
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <BlogCard
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  title={post.title}
                  description={post.description}
                  image={post.image}
                  date={formatPostDate(post.createdAt, locale)}
                  authorName={post.authorName}
                  authorImage={post.authorImage}
                />
              ))}
            </div>
          )}

          {ordered.length > 0 ? (
            <section className="border-border/60 mt-20 border-t pt-16">
              <h2 className="font-display text-center text-2xl font-semibold tracking-tight uppercase sm:text-3xl">
                {m['blog.start.title']()}
              </h2>
              <p className="text-muted-foreground mt-4 text-center text-sm leading-relaxed sm:text-[15px]">
                {m['blog.start.intro']()}
              </p>
              <ol className="mt-10 space-y-4">
                {ordered.slice(0, 3).map((post, i) => (
                  <li key={post.slug}>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="group border-border/70 bg-card/60 hover:border-primary/50 flex items-start gap-5 rounded-xl border p-5 transition-colors sm:p-6"
                    >
                      <span className="font-display text-primary/85 group-hover:text-primary text-3xl leading-none font-bold transition-colors">
                        0{i + 1}
                      </span>
                      <span>
                        <span className="font-display group-hover:text-primary block text-sm font-semibold tracking-wide uppercase transition-colors sm:text-base">
                          {post.title}
                        </span>
                        <span className="text-muted-foreground mt-1.5 block text-sm leading-relaxed">
                          {m[stepBlurb[i]]()}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="border-border/60 mt-16 border-t pt-16">
            <div className="mx-auto max-w-3xl">
              <h2 className="font-display text-center text-2xl font-semibold tracking-tight uppercase sm:text-3xl">
                {m['blog.written.title']()}
              </h2>
              <p className="text-muted-foreground mt-5 text-sm leading-relaxed sm:text-[15px]">
                {m['blog.written.body']()}
              </p>
            </div>
          </section>

          <section className="border-border/60 mt-16 border-t pt-16">
            <h2 className="font-display text-center text-2xl font-semibold tracking-tight uppercase sm:text-3xl">
              {m['blog.also.title']()}
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {OTHER.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group border-border/70 bg-card/60 hover:border-primary/50 rounded-xl border p-5 transition-colors"
                >
                  <h3 className="font-display group-hover:text-primary text-sm font-semibold tracking-wide uppercase transition-colors">
                    {m[
                      item.href === '/'
                        ? 'landing.footer.generator'
                        : item.href === '/examples'
                          ? 'landing.footer.examples'
                          : item.href === '/pricing'
                            ? 'landing.footer.pricing'
                            : 'landing.footer.about'
                    ]()}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {m[item.desc as 'landing.directory.gen.desc']()}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
