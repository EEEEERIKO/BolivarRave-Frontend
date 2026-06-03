import { clearAuthSession, readAuthSession, writeAuthSession, type AuthSession } from "@/lib/auth-session";

const trimSlash = (value: string) => value.replace(/\/+$/, "");

const isSessionExpiredMessage = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("sesion invalida") ||
    normalized.includes("sesión invalida") ||
    normalized.includes("sesion expirada") ||
    normalized.includes("sesión expirada") ||
    normalized.includes("token invalido") ||
    normalized.includes("token inválido")
  );
};

const toFriendlyApiError = (path: string, message: string, status?: number) => {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("transaction api error") || normalizedMessage.includes("unable to start a transaction")) {
    return "El servidor está procesando muchas solicitudes. Se está reintentando automáticamente. Por favor, espera unos segundos.";
  }

  if (normalizedMessage.includes("no se encontraron hojas validas con nombre de dia para importar")) {
    return "No pudimos leer el Excel porque las hojas no tienen nombre de día válido. Renómbralas como Lunes, Martes, Miércoles/Miercoles, Jueves y Viernes.";
  }

  if (normalizedMessage.includes("faltan columnas requeridas")) {
    return "El archivo no trae todas las columnas necesarias. Revisa el formato del Excel o completa los datos manualmente en la vista previa.";
  }

  if (normalizedMessage.includes("la reserva se solapa")) {
    return "Este horario se cruza con otra clase en el mismo salón. Elige otro rango de hora o cambia de salón.";
  }

  if (normalizedMessage.includes("conflicto de horario") || normalizedMessage.includes("se solapa")) {
    return message;
  }

  if (normalizedMessage.includes("payload de") || normalizedMessage.includes("payload invalido")) {
    return "Hay datos incompletos o con formato inválido. Revisa los campos obligatorios e inténtalo de nuevo.";
  }

  // Map Zod / server validation patterns like "Too small: expected string to have >=3 characters"
  if (normalizedMessage.includes("too small") || /expected string to have >=\s*\d+\s*characters/.test(normalizedMessage)) {
    const match = normalizedMessage.match(/expected string to have >=\s*(\d+)\s*characters/);
    const min = match ? Number(match[1]) : 3;
    return `Uno o más campos son demasiado cortos (mínimo ${min} caracteres). Revisa los campos obligatorios y corrige los valores.`;
  }

  if (normalizedMessage.includes("too large") || /expected string to have <=\s*\d+\s*characters/.test(normalizedMessage)) {
    const match = normalizedMessage.match(/expected string to have <=\s*(\d+)\s*characters/);
    const max = match ? Number(match[1]) : null;
    return max ? `Uno o más campos exceden el límite de ${max} caracteres. Reduce la longitud y vuelve a intentar.` : `Uno o más campos exceden el tamaño permitido. Revisa los campos e inténtalo de nuevo.`;
  }

  if (status === 401 || normalizedMessage.includes("no autorizado")) {
    if (
      normalizedMessage.includes("sesion invalida") ||
      normalizedMessage.includes("sesión invalida") ||
      normalizedMessage.includes("sesion expirada") ||
      normalizedMessage.includes("sesión expirada") ||
      normalizedMessage.includes("token invalido") ||
      normalizedMessage.includes("token inválido")
    ) {
      return "Tu sesión expiró o es inválida. Vuelve a iniciar sesión.";
    }

    return "No se pudo validar tu sesión. Vuelve a iniciar sesión.";
  }

  if (status === 403 && path.includes("/api/staff/login")) {
    return message;
  }

  if (status === 403) {
    return "Esta acción fue bloqueada por seguridad. Intenta de nuevo o contacta al administrador.";
  }

  if (status === 404 && path.includes("/api/schedules/requests")) {
    return message;
  }

  if (status === 404) {
    return "No encontramos el recurso solicitado. Es posible que ya haya sido eliminado o movido.";
  }

  if (status === 409) {
    return path.includes("/api/schedules")
      ? "Se detectó un conflicto con el horario actual. Ajusta día, hora o salón para continuar."
      : "No se pudo completar la acción porque hay un conflicto con el estado actual de los datos.";
  }

  if (status === 500) {
    return normalizedMessage.includes("transaction")
      ? "El servidor está bajo carga. Se está reintentando automáticamente."
      : "El servidor tuvo un problema al procesar la solicitud. Inténtalo de nuevo en unos segundos.";
  }

  if (normalizedMessage.includes("failed to fetch") || normalizedMessage.includes("load failed")) {
    return "No se pudo conectar con el servidor. Revisa la conexión y confirma que el backend esté encendido.";
  }

  return message;
};

class HttpResponseError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpResponseError";
    this.status = status;
  }
}

const getCandidates = () => {
  const candidates: string[] = [];
  const fromEnv = (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    ""
  ).trim();

  if (typeof window !== "undefined") {
    // Prefer the same-origin proxy route first to avoid browser CORS blocks.
    candidates.push("");

    if (fromEnv) candidates.push(trimSlash(fromEnv));

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.startsWith("192.168");

    // Only include localhost fallbacks for local development.
    if (isLocalhost) {
      candidates.push("http://localhost:4000");
      candidates.push("http://127.0.0.1:4000");
    }
  } else {
    if (fromEnv) candidates.push(trimSlash(fromEnv));
    candidates.push("http://localhost:4000");
    candidates.push("http://127.0.0.1:4000");
  }

  return [...new Set(candidates)];
};

let refreshInFlight: Promise<AuthSession | null> | null = null;

const refreshAccessTokenSilently = async (): Promise<AuthSession | null> => {
  if (typeof window === "undefined") {
    return null;
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  const refreshTask = (async () => {
    const candidates = getCandidates();

    for (const base of candidates) {
      const refreshUrl = `${base}/api/staff/refresh`;
      try {
        const response = await fetch(refreshUrl, {
          method: "POST",
          credentials: "include",
        });

        if (!response.ok) {
          if (response.status === 404 && base === "") {
            continue;
          }
          return null;
        }

        const body = (await response.json()) as { session?: AuthSession };
        if (!body.session?.accessToken) {
          return null;
        }

        writeAuthSession(body.session);
        return body.session;
      } catch {
        continue;
      }
    }

    return null;
  })();

  refreshInFlight = refreshTask;
  try {
    return await refreshTask;
  } finally {
    refreshInFlight = null;
  }
};

export async function fetchApiJson<T>(path: string, init?: RequestInit): Promise<T> {
  return fetchApiJsonWithOptions<T>(path, init);
}

export async function fetchApiJsonWithRetry<T>(
  path: string,
  init?: RequestInit,
  options?: FetchApiOptions & { maxRetries?: number; baseDelayMs?: number }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 500;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchApiJsonWithOptions<T>(path, init, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTransactionError =
        errorMessage.includes("Transaction") ||
        errorMessage.includes("transaction") ||
        errorMessage.includes("Unable to start a transaction");

      if (!isTransactionError || attempt >= maxRetries) {
        throw error;
      }

      // Exponential backoff: 500ms, 1000ms, 2000ms, etc.
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error("Retry exhausted");
}
type FetchApiOptions = {
  suppressExpectedStatuses?: number[];
  skipRefreshOnAuthError?: boolean;
};

export async function fetchApiJsonWithOptions<T>(path: string, init?: RequestInit, options?: FetchApiOptions): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const candidates = getCandidates();
  let lastError: Error | null = null;
  let lastUrl = "";
  const attemptDetails: string[] = [];
  let attempts = 0;

  for (const base of candidates) {
    const url = `${base}${normalizedPath}`;
    lastUrl = url;
    attempts += 1;
    try {
      const session = typeof window !== "undefined" ? readAuthSession() : null;
      const headers = new Headers(init?.headers ?? undefined);

      if (session?.accessToken && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${session.accessToken}`);
      }

      const response = await fetch(url, {
        ...init,
        headers,
        credentials: init?.credentials ?? "include",
      });
      const rawText = await response.text();
      let body: (T | { error?: string }) | null = null;

      if (rawText) {
        try {
          body = JSON.parse(rawText) as T | { error?: string };
        } catch {
          body = null;
        }
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;

        if (body && typeof body === "object") {
          if (Array.isArray((body as any).details)) {
            const details = (body as any).details as Array<{ path?: string; message?: string }>;
            const mapped = details.map((d) => (d.path ? `${d.path}: ${d.message}` : d.message)).join("; ");
            errorMessage = `${(body as any).error ?? 'Error de validación'}: ${mapped}`;
          } else if ("error" in body && typeof (body as any).error === "string") {
            errorMessage = (body as any).error;
          }
        }

        throw new HttpResponseError(errorMessage, response.status);
      }

      if (body === null) {
        attemptDetails.push(`${url} -> Respuesta no JSON`);
        throw new Error("Respuesta invalida del servidor");
      }

      return body as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Load failed");
      attemptDetails.push(`${url} -> ${lastError.message}`);

      const isLoginCall = normalizedPath.includes("/api/staff/login");
      const isRefreshCall = normalizedPath.includes("/api/staff/refresh");
      const isLogoutCall = normalizedPath.includes("/api/staff/logout");
      const isAuthHttpError =
        error instanceof HttpResponseError &&
        (error.status === 401 || error.status === 403) &&
        isSessionExpiredMessage(lastError.message);

      const canTryRefresh =
        typeof window !== "undefined" &&
        !options?.skipRefreshOnAuthError &&
        !isLoginCall &&
        !isRefreshCall &&
        !isLogoutCall &&
        isAuthHttpError;

      if (canTryRefresh) {
        const refreshedSession = await refreshAccessTokenSilently();
        if (refreshedSession?.accessToken) {
          return fetchApiJsonWithOptions<T>(path, init, {
            ...options,
            skipRefreshOnAuthError: true,
          });
        }
      }

      if (!isLoginCall && isAuthHttpError && typeof window !== "undefined") {
        clearAuthSession();

        const pathname = window.location.pathname;
        const isPublicPath = pathname.startsWith("/login") || pathname.startsWith("/public");

        if (!isPublicPath) {
          window.location.assign("/login");
        }
      }

      // If the same-origin proxy returns 404 in dev, allow fallback hosts.
      // This helps when /api rewrites are unavailable or misconfigured.
      if (error instanceof HttpResponseError && error.status === 404 && base === "") {
        continue;
      }

      // If the upstream responded with an HTTP error, stop trying other hosts.
      // Retrying alternate origins after a real 4xx/5xx usually adds CORS noise.
      if (error instanceof HttpResponseError) {
        break;
      }
    }
  }

  const shouldSuppressDevLog =
    lastError instanceof HttpResponseError &&
    !!options?.suppressExpectedStatuses?.includes(lastError.status);

  if (process.env.NODE_ENV !== "production" && !shouldSuppressDevLog) {
    const details = attemptDetails.join(" | ");
    console.error(
      `[API] Request failed path=${normalizedPath} lastUrl=${lastUrl} message=${lastError?.message ?? "Load failed"} attempts=${attempts} details=${details}`,
    );
  }

  const summary =
    lastError?.message ??
    (attemptDetails.length > 0 ? attemptDetails.join(" | ") : "Load failed");
  const httpStatus = lastError instanceof HttpResponseError ? lastError.status : undefined;
  throw new Error(toFriendlyApiError(normalizedPath, summary, httpStatus));
}
