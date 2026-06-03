export type UserRole = "admin" | "monitor" | "colaborador" | "registro";

export type AuthSession = {
  role: UserRole;
  name: string;
  roleLabel: string;
  avatarUrl?: string;
  cedula: string;
  staffId?: string;
  accessToken: string;
};

const AUTH_SESSION_KEY = "unac_auth_session_v1";

function normalizeSessionText(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeUserRole(rawRole: unknown, roleLabel?: string, name?: string): UserRole | null {
  const normalizedName = normalizeSessionText(typeof name === "string" ? name : undefined);

  if (typeof roleLabel === "string") {
    const normalizedLabel = normalizeSessionText(roleLabel);
    if (normalizedLabel.includes("monitor") && normalizedLabel.includes("registro")) return "registro";
    if (normalizedLabel === "registro") return "registro";
  }

  if (normalizedName.includes("monitor registro")) {
    return "registro";
  }

  if (typeof rawRole === "string") {
    const normalized = rawRole.trim().toLowerCase();
    if (normalized === "admin" || normalized === "monitor" || normalized === "colaborador" || normalized === "registro") {
      return normalized;
    }
  }

  if (typeof roleLabel === "string") {
    const normalizedLabel = normalizeSessionText(roleLabel);
    if (normalizedLabel.includes("monitor")) return "monitor";
    if (normalizedLabel.includes("admin")) return "admin";
    if (normalizedLabel.includes("registro")) return "registro";
    if (normalizedLabel.includes("colaborador")) return "colaborador";
  }

  return null;
}

export function isMonitorRegistroSession(session: Pick<AuthSession, "role" | "roleLabel" | "name"> | null | undefined): boolean {
  if (!session) {
    return false;
  }

  const normalizedLabel = normalizeSessionText(session.roleLabel);
  const normalizedName = normalizeSessionText(session.name);

  return (session.role === "registro" && normalizedLabel.includes("monitor") && normalizedLabel.includes("registro")) || normalizedName.includes("monitor registro");
}

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
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    const normalizedRole = normalizeUserRole(parsed?.role, parsed?.roleLabel, parsed?.name);

    if (!parsed || !normalizedRole || !parsed.name || !parsed.roleLabel || !parsed.cedula || !parsed.accessToken) {
      return null;
    }

    return {
      role: normalizedRole,
      name: parsed.name,
      roleLabel: parsed.roleLabel,
      cedula: parsed.cedula,
      accessToken: parsed.accessToken,
      ...(parsed.avatarUrl ? { avatarUrl: parsed.avatarUrl } : {}),
      ...(parsed.staffId ? { staffId: parsed.staffId } : {}),
    };
  } catch {
    return null;
  }
}

export function writeAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedRole = normalizeUserRole(session.role, session.roleLabel, session.name);

  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
    ...session,
    role: normalizedRole ?? session.role,
  }));
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_KEY);
}
