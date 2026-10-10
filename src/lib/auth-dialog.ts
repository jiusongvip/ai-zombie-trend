import { useSyncExternalStore } from 'react';

import { deLocalizeHref } from '@/paraglide/runtime.js';

export interface AuthDialogState {
  open: boolean;
  /** Where to land after signing in: internal path or allow-listed app protocol. */
  target: string;
}

const CLOSED: AuthDialogState = { open: false, target: '' };

let state: AuthDialogState = CLOSED;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Locale-free current location, query string and hash included. */
export function currentLocationPath(fallback = '/'): string {
  if (typeof window === 'undefined') return fallback;
  const { search, hash } = window.location;
  return `${deLocalizeHref(window.location.pathname)}${search}${hash}`;
}

/**
 * Open the site-wide sign-in modal in place — no page navigation.
 * `target` defaults to staying on the current page.
 */
export function openAuthDialog(target?: string) {
  state = { open: true, target: target ?? currentLocationPath('/') };
  emit();
}

export function closeAuthDialog() {
  if (state === CLOSED) return;
  state = CLOSED;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuthDialog(): AuthDialogState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => CLOSED
  );
}
