// Tracks "this person arrived through an invitation or password-reset link and still has to choose a password".
//
// Opening such a link signs the browser in with a one-time session. Until a password is chosen the app must
// not let them in, so the marker is stored in localStorage: it survives reloads and closing the tab, and is
// cleared only when the password is set (or the person backs out, which signs them out).
//
// Invited users also carry `user_metadata.password_set === false` (set by the invite-user function), which
// covers the case where the marker is gone, e.g. a different browser. Accounts created before this existed have
// no such flag and are treated as having a password.

const KEY = "labswift-password-setup";

export type PasswordSetupKind = "invite" | "recovery";

export function markPasswordSetupPending(kind: PasswordSetupKind) {
  try {
    localStorage.setItem(KEY, kind);
  } catch {
    /* storage unavailable (private mode): the metadata check still applies for invites */
  }
}

export function clearPasswordSetup() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function getPendingPasswordSetup(): PasswordSetupKind | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "invite" || value === "recovery" ? value : null;
  } catch {
    return null;
  }
}

export function isPasswordSetupPending(user?: { user_metadata?: Record<string, unknown> } | null): boolean {
  return getPendingPasswordSetup() !== null || user?.user_metadata?.password_set === false;
}
