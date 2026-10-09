'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/core/auth/client';
import { usePathname, useRouter } from '@/core/i18n/navigation';
import { apiGet } from '@/lib/api-client';
import { useUserPermissions } from '@/hooks/use-user-permissions';

/**
 * Shared authorization gate for every authenticated surface (`AppLayout` for
 * the console, `/library` for the film history page).
 *
 * Extracted rather than duplicated: this decides who may see a page and where
 * an unauthorized visitor is sent, so the surfaces must not be able to drift
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

  // Guard against a double redirect: useLocation() flips to "/sign-in" the moment
  // we navigate (while the shell is still mounted), which would otherwise re-fire
  // the effect and overwrite callbackUrl with the sign-in path itself.
  const redirectingRef = useRef(false);

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
      if (redirectingRef.current) return;
      redirectingRef.current = true;
      // Remember where the user was headed so sign-in can send them back.
      // pathname is already locale-free; append the live query string.
      const search =
        typeof window !== 'undefined' ? window.location.search : '';
      const callbackUrl = `${pathname}${search}`;
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    // Invite-only gate: wait for membership status, then bounce unredeemed
    // (incl. social) users to the redeem page. Admins are exempt server-side.
    if (userInfoQuery.isPending) return;
    if (needsInvite) {
      if (!redirectingRef.current) {
        redirectingRef.current = true;
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
