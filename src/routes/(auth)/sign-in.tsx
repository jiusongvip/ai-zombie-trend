import { useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';

import { useRouter } from '@/core/i18n/navigation';
import { openAuthDialog } from '@/lib/auth-dialog';

/**
 * Legacy URL — sign-in now happens in the site-wide modal over the page the
 * visitor was on. This shim keeps email links, the footer support link and any
 * bookmarked `/sign-in?callbackUrl=…` working: it carries the way back into the
 * modal and lands on the homepage.
 */
function SignInPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get('callbackUrl') || params.get('redirect');
    openAuthDialog(target ?? undefined);
    router.replace('/');
  }, [router]);

  return null;
}

export const Route = createFileRoute('/(auth)/sign-in')({
  component: SignInPage,
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, follow' }],
  }),
});
