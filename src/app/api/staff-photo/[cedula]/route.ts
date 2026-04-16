import { NextResponse } from "next/server";

type Params = {
  cedula: string;
};

const STAFF_PHOTO_ORIGIN = "https://svga.unac.edu.co/svga/files/pics";

const fallbackSvg = (cedula: string) => `
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="Foto no disponible">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#d5e3ff" />
      <stop offset="100%" stop-color="#bcd4ff" />
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="80" fill="url(#bg)" />
  <circle cx="80" cy="62" r="28" fill="#5f7ea8" opacity="0.65" />
  <path d="M32 138c5-24 23-38 48-38s43 14 48 38" fill="#5f7ea8" opacity="0.65" />
  <text x="80" y="152" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#36506f">${cedula || "SIN FOTO"}</text>
</svg>`;

export async function GET(_request: Request, context: { params: Promise<Params> }) {
  const { cedula } = await context.params;
  const cleanCedula = (cedula ?? "").trim();
  const digitsCedula = cleanCedula.replace(/\D/g, "");
  const idCandidates = Array.from(new Set([digitsCedula, cleanCedula].filter(Boolean)));

  if (!cleanCedula) {
    return new NextResponse(fallbackSvg(""), {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  try {
    for (const candidate of idCandidates) {
      const remoteUrl = `${STAFF_PHOTO_ORIGIN}/${encodeURIComponent(candidate)}.jpg`;
      const upstream = await fetch(remoteUrl, {
        cache: "no-store",
        redirect: "follow",
      });

      const contentType = upstream.headers.get("content-type") ?? "";
      if (upstream.ok && contentType.startsWith("image/")) {
        const buffer = await upstream.arrayBuffer();
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=1800",
          },
        });
      }
    }
  } catch {
    // If upstream is unreachable, return local fallback image.
  }

  return new NextResponse(fallbackSvg(cleanCedula), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
