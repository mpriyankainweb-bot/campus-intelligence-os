/**
 * Local account store (in-memory fallback).
 *
 * When Supabase is not configured, sign-up and sign-in fall back to this
 * in-memory account registry so the full auth experience still works in demo
 * mode. Accounts live for the server process lifetime only — adding Supabase
 * keys switches the app to real persisted users automatically.
 */

export type LocalAccount = {
  fullName: string;
  email: string;
  password: string;
  persona: "student" | "faculty" | "principal";
};

const accounts = new Map<string, LocalAccount>();

export function localSignup(account: LocalAccount): { ok: boolean; error?: string } {
  const email = account.email.trim().toLowerCase();
  if (!email || !account.fullName.trim()) {
    return { ok: false, error: "Full name and email are required." };
  }
  if (account.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (accounts.has(email)) {
    return { ok: false, error: "An account with this email already exists. Try signing in." };
  }
  accounts.set(email, { ...account, email });
  return { ok: true };
}

export function localLogin(
  email: string,
  password: string
): { ok: true; account: LocalAccount } | { ok: false; error: string } {
  const normalized = email.trim().toLowerCase();
  const account = accounts.get(normalized);
  if (!account) {
    return {
      ok: false,
      error: "No account found for this email. Create an account first or use a demo persona.",
    };
  }
  if (account.password !== password) {
    return { ok: false, error: "Incorrect password. Please try again." };
  }
  return { ok: true, account };
}

export function hasLocalAccounts(): boolean {
  return accounts.size > 0;
}
