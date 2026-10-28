import { m } from '@/paraglide/messages.js';
import { SiteHeader } from '@/components/site-header';

export function Header() {
  // The four links a visitor is most likely to want each land on a screen that
  // already holds the workbench — the homepage card and the three keyword
  // pages — so nobody has to hunt for the upload box after clicking.
  const navLinks = [
    { href: '/#generator', label: m['landing.nav.generator']() },
    { href: '/ai-zombie-couple-video', label: m['landing.nav.couple']() },
    { href: '/ai-zombie-pet-video', label: m['landing.nav.pet']() },
    { href: '/ai-zombie-trend-prompts', label: m['landing.nav.prompts']() },
    { href: '/examples', label: m['landing.nav.examples']() },
    { href: '/pricing', label: m['landing.nav.pricing']() },
    { href: '/blog', label: m['landing.nav.blog']() },
  ];

  return <SiteHeader navLinks={navLinks} />;
}
