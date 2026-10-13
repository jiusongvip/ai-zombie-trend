import { oneTapClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

const baseURL =
  typeof window !== 'undefined'
    ? window.location.origin
    : import.meta.env?.VITE_APP_URL || 'http://localhost:3000';

export const authClient = createAuthClient({ baseURL });

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
  changePassword,
} = authClient;

// Mirrors better-auth's own `emailAndPassword.minPasswordLength` default — the
// server rejects anything shorter, so the forms must not promise otherwise.
export const MIN_PASSWORD_LENGTH = 8;

// Build a per-call auth client with the Google One Tap plugin attached.
// The plugin needs the client_id at construction time, so we can't add
// it to the default `authClient` — callers must pass live configs.
export function getAuthClient(configs: Record<string, string>) {
  return createAuthClient({
    baseURL,
    plugins:
      configs.google_client_id && configs.google_one_tap_enabled === 'true'
        ? [
            oneTapClient({
              clientId: configs.google_client_id,
              autoSelect: false,
              cancelOnTapOutside: false,
              context: 'signin',
              promptOptions: {
                baseDelay: 1000,
                maxAttempts: 1,
              },
            }),
          ]
        : [],
  });
}
