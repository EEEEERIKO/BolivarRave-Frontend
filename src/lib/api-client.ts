const trimSlash = (value: string) => value.replace(/\/+$/, "");

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

export async function fetchApiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const candidates = getCandidates();
  let lastError: Error | null = null;
  let lastUrl = "";
  const attemptDetails: string[] = [];

  for (const base of candidates) {
    const url = `${base}${normalizedPath}`;
    lastUrl = url;
    try {
      const response = await fetch(url, init);
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
        const errorMessage =
          body && typeof body === "object" && "error" in body && typeof body.error === "string"
            ? body.error
            : `HTTP ${response.status}`;
        attemptDetails.push(`${url} -> ${errorMessage}`);
        throw new HttpResponseError(errorMessage, response.status);
      }

      if (body === null) {
        attemptDetails.push(`${url} -> Respuesta no JSON`);
        throw new Error("Respuesta invalida del servidor");
      }

      return body as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Load failed");
      if (attemptDetails.length < candidates.length) {
        attemptDetails.push(`${url} -> ${lastError.message}`);
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

  if (process.env.NODE_ENV !== "production") {
    const details = attemptDetails.join(" | ");
    console.error(
      `[API] Request failed path=${normalizedPath} lastUrl=${lastUrl} message=${lastError?.message ?? "Load failed"} attempts=${candidates.length} details=${details}`,
    );
  }

  const summary =
    lastError?.message ??
    (attemptDetails.length > 0 ? attemptDetails.join(" | ") : "Load failed");

  throw new Error(summary);
}
