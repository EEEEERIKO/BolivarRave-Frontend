export type UserRole = "admin" | "monitor" | "colaborador";

export type AuthSession = {
  role: UserRole;
  name: string;
  roleLabel: string;
  avatarUrl?: string;
  cedula: string;
};

const AUTH_SESSION_KEY = "unac_auth_session_v1";

export function getAuthSessionKey(): string {
  return AUTH_SESSION_KEY;
}

export function readAuthSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed || !parsed.role || !parsed.name || !parsed.roleLabel || !parsed.cedula) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_KEY);
}
