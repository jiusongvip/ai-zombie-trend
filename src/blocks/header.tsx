import { m } from '@/paraglide/messages.js';
import { SiteHeader } from '@/components/site-header';

export function Header() {
  const navLinks = [
    { href: '/#generator', label: m['landing.nav.generator']() },
    { href: '/examples', label: m['landing.nav.examples']() },
    { href: '/pricing', label: m['landing.nav.pricing']() },
    { href: '/blog', label: m['landing.nav.blog']() },
    { href: '/ai-zombie-trend-prompts', label: m['landing.nav.prompts']() },
  ];

  return <SiteHeader navLinks={navLinks} />;
}
