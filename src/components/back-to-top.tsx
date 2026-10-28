'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';

/**
 * How far down a reader has to be before the page is long enough that going
 * back up by hand is the annoying option. Below this the button would only
 * cover something on a screen they can already see the whole of.
 */
const SHOW_AFTER_PX = 600;

/**
 * Floating back-to-top, mounted once at the root so every long document gets
 * it: the keyword pages run past three screens, and blog posts and legal pages
 * have no in-content way back up.
 *
 * It sits one slot above `bottom-6`, which is where the support widget parks
 * its own launcher — two fixed buttons in the same corner would fight, and the
 * chat button is the one that has to stay reachable. Hidden rather than
 * unmounted so it can fade in, and taken out of the tab order while it is
 * invisible, so a keyboard user never lands on a control they cannot see.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function toTop() {
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label={m['common.pages.back_to_top']()}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={cn(
        'border-border/60 bg-card/90 text-muted-foreground hover:text-foreground',
        'hover:border-primary/40 hover:shadow-primary/20',
        'fixed right-6 bottom-20 z-40 flex size-12 items-center justify-center rounded-full border shadow-lg backdrop-blur-sm',
        'transition-all duration-300 hover:scale-105 hover:shadow-xl',
        visible ? 'opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      )}
    >
      <ArrowUp className="size-5" />
    </button>
  );
}
