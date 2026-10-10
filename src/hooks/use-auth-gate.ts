'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/core/auth/client';
import { usePathname, useRouter } from '@/core/i18n/navigation';
import { apiGet } from '@/lib/api-client';
import { openAuthDialog } from '@/lib/auth-dialog';
import { useUserPermissions } from '@/hooks/use-user-permissions';

/**
 * Shared authorization gate for every authenticated surface (`AppLayout` for
 * the console, `/library` for the film history page).
 *
 * Extracted rather than duplicated: this decides who may see a page and how an
 * unauthorized visitor is prompted, so the surfaces must not be able to drift
 * apart on it.
 *
 * Resolution order mirrors the original imperative flow:
 * - no permission gate → authorized once a session exists and membership is ok
 * - permission gate    → authorized only when the query resolves with isAdmin
 */
export function useAuthGate({
  requirePermission,
  unauthorizedRedirect = '/settings',
}: {
  /** e.g. `"admin.*"` — omit for pages any signed-in user may see. */
  requirePermission?: string;
  unauthorizedRedirect?: string;
} = {}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // This effect re-runs on every session/query change while the shell is
  // mounted; without the latch a dismissed sign-in modal would reopen itself.
  const promptShownRef = useRef(false);

  // Invite-only gate: needs the user's membership status (also covers social
  // logins). `needsInvite` is computed server-side in /api/user/info.
  const userInfoQuery = useQuery({
    queryKey: ['user-info'],
    queryFn: () => apiGet<{ needsInvite?: boolean }>('/api/user/info'),
    staleTime: 60_000,
    enabled: !!session?.user,
  });
  const needsInvite = userInfoQuery.data?.needsInvite === true;
  const membershipResolved =
    !session?.user || userInfoQuery.isSuccess || userInfoQuery.isError;

  // Only query permissions once we have a session and a permission gate.
  const permissionsEnabled = !!session?.user && !!requirePermission;
  const permissionsQuery = useUserPermissions(permissionsEnabled);
  const isAdmin = permissionsQuery.data?.isAdmin === true;

  const authorized =
    !!session?.user &&
    membershipResolved &&
    !needsInvite &&
    (!requirePermission || isAdmin);

  useEffect(() => {
    if (isPending) return;

    if (!session?.user) {
      if (promptShownRef.current) return;
      promptShownRef.current = true;
      // Sign in in place — the modal brings the visitor back here afterwards.
      // pathname is already locale-free; append the live query string.
      const search =
        typeof window !== 'undefined' ? window.location.search : '';
      openAuthDialog(`${pathname}${search}`);
      return;
    }

    // Invite-only gate: wait for membership status, then bounce unredeemed
    // (incl. social) users to the redeem page. Admins are exempt server-side.
    if (userInfoQuery.isPending) return;
    if (needsInvite) {
      if (!promptShownRef.current) {
        promptShownRef.current = true;
        router.push('/redeem-invite');
      }
      return;
    }

    if (!requirePermission) return;

    // Wait for the permissions query to resolve before deciding.
    if (permissionsQuery.isPending) return;

    if (permissionsQuery.isError || !isAdmin) {
      router.push(unauthorizedRedirect);
    }
  }, [
    isPending,
    session,
    router,
    pathname,
    requirePermission,
    unauthorizedRedirect,
    userInfoQuery.isPending,
    needsInvite,
    permissionsQuery.isPending,
    permissionsQuery.isError,
    isAdmin,
  ]);

  /** True once the gate has finished resolving and the visitor is allowed in. */
  const ready = !isPending && authorized;

  return { session, authorized, ready };
}
