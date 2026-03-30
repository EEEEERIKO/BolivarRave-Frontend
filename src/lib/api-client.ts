const trimSlash = (value: string) => value.replace(/\/+$/, "");

const getCandidates = () => {
  const candidates: string[] = [""];
  const fromEnv = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();

  if (fromEnv) candidates.push(trimSlash(fromEnv));

  if (typeof window !== "undefined") {
    candidates.push(trimSlash(window.location.origin));

    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      candidates.push("http://localhost:4000");
    }
  } else if (!fromEnv) {
    candidates.push("http://localhost:4000");
  }

  return [...new Set(candidates)];
};

export async function fetchApiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const candidates = getCandidates();
  let lastError: Error | null = null;
  let lastUrl = "";

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
        throw new Error(errorMessage);
      }

      if (body === null) {
        throw new Error("Respuesta invalida del servidor");
      }

      return body as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Load failed");
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.error("[API] Request failed", {
      url: lastUrl,
      path: normalizedPath,
      message: lastError?.message ?? "Load failed",
      attempts: candidates.length,
    });
  }

  throw lastError ?? new Error("Load failed");
}
