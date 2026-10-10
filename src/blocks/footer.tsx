import { m } from '@/paraglide/messages.js';
import { SiteFooter, type FooterColumn } from '@/components/site-footer';

export function Footer() {
  const columns: FooterColumn[] = [
    {
      title: m['landing.footer.product'](),
      links: [
        { label: m['landing.footer.generator'](), href: '/#generator' },
        { label: m['landing.footer.examples'](), href: '/examples' },
        { label: m['landing.footer.library'](), href: '/library' },
        { label: m['landing.footer.pricing'](), href: '/pricing' },
      ],
    },
    {
      title: m['landing.footer.resources'](),
      links: [
        { label: m['landing.footer.blog'](), href: '/blog' },
        { label: m['landing.footer.settings'](), href: '/settings' },
      ],
    },
    {
      title: m['landing.footer.legal'](),
      links: [
        { label: m['landing.footer.privacy'](), href: '/privacy-policy' },
        { label: m['landing.footer.terms'](), href: '/terms-of-service' },
        { label: m['landing.footer.refunds'](), href: '/refund-policy' },
      ],
    },
    {
      title: m['landing.footer.contact'](),
      links: [
        {
          label: m['landing.footer.contact_email'](),
          href: 'mailto:jiusongvip@gmail.com',
        },
        {
          label: m['landing.footer.contact_support'](),
          href: '/sign-in?callbackUrl=%2Fsettings%2Ftickets',
        },
      ],
    },
  ];

  return (
    <SiteFooter
      tagline={m['landing.footer.tagline']()}
      columns={columns}
    />
  );
}
