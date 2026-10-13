import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { formatPrice, lowestPricePerFilmInCents } from '@/config/pricing';
import { baseLocale } from '@/paraglide/runtime.js';
import { getLocalPosts, mergePosts } from '@/content/posts';

const STATIC_PAGES: { path: string; title: string; description: string }[] = [
  {
    path: '',
    title: 'AI Zombie Video Generator',
    description:
      'Turn two photos into a 15-second AI zombie love story film with sound. Four story modes, no prompt writing, no watermark.',
  },
  {
    path: '/examples',
    title: 'Examples',
    description:
      'Rendered frames from the two-photo pipeline across the couple, pet, friends and family stories.',
  },
  {
    path: '/pricing',
    title: 'Pricing',
    description: `One-time credit packs, as low as ${formatPrice(lowestPricePerFilmInCents())} per film. 20 credits per film, credits never expire, failed renders refund automatically.`,
  },
  {
    path: '/blog',
    title: 'Blog',
    description: 'Guides to the AI zombie trend, workflow and photo privacy.',
  },
  {
    path: '/about',
    title: 'About',
    description:
      'Who builds AI Zombie Trend, how the two-photo pipeline works, and the consent, privacy and synthetic-media labeling principles behind it.',
  },
  {
    path: '/ai-zombie-pet-video',
    title: 'AI Zombie Pet Video',
    description:
      'The pet version of the two-photo film: the four shots with second ranges, the identity-lock line for a dog or cat (breed, coat, size, facial identity), the reference photo pair that holds, and the fixes for breed drift.',
  },
  {
    path: '/ai-zombie-trend-prompts',
    title: 'AI Zombie Trend Prompts',
    description:
      'Free, copy-ready prompts for the two-photo zombie love story: the four-shot beat map with second ranges, the identity-lock sentence, swap-in lines for partner, pet, parent and best friend, and fixes for the common first-render failures.',
  },
];

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: async () => {
        const { app_url, app_name, app_description } = envConfigs;

        let posts = getLocalPosts(baseLocale);
        try {
          const { listPublishedArticles } =
            await import('@/modules/posts/service');
          const rows = await listPublishedArticles().catch(() => []);
          const dbPosts = rows.map((row) => ({
            slug: row.slug,
            title: row.title || row.slug,
            description: row.description || '',
            createdAt: new Date(row.createdAt).toISOString(),
            source: 'db' as const,
          }));
          posts = mergePosts(dbPosts, posts);
        } catch {
          // Database unreachable — local posts still listed.
        }

        const lines: string[] = [
          `# ${app_name}`,
          '',
          `> ${app_description}`,
          '',
          '## Pages',
          '',
          ...STATIC_PAGES.map(
            (p) => `- [${p.title}](${app_url}${p.path}): ${p.description}`
          ),
        ];

        if (posts.length > 0) {
          lines.push('', '## Blog Posts', '');
          for (const post of posts) {
            lines.push(
              `- [${post.title}](${app_url}/blog/${post.slug}): ${post.description}`
            );
          }
        }

        lines.push('');

        return new Response(lines.join('\n'), {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      },
    },
  },
});
