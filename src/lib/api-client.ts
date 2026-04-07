const trimSlash = (value: string) => value.replace(/\/+$/, "");

const getCandidates = () => {
  const candidates: string[] = [];
  const fromEnv = (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    ""
  ).trim();

  if (typeof window !== "undefined") {
    // Keep same-origin as fallback (for setups using Next rewrites).
    candidates.push(trimSlash(window.location.origin));

    if (fromEnv) candidates.push(trimSlash(fromEnv));

    // Always include common local backend URLs for development resilience.
    candidates.push("http://localhost:4000");
    candidates.push("http://127.0.0.1:4000");
  } else {
    if (fromEnv) candidates.push(trimSlash(fromEnv));
    candidates.push("http://localhost:4000");
    candidates.push("http://127.0.0.1:4000");
  }

  // Try relative path at the end to reduce false failures when no rewrite exists.
  candidates.push("");

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
        throw new Error(errorMessage);
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
