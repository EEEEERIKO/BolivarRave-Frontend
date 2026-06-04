import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

const trimSlash = (value: string) => value.replace(/\/+$/, "");

const buildTargetUrl = (path: string[], requestUrl: string) => {
  const base = trimSlash(BACKEND_BASE_URL);
  const upstream = new URL(`${base}/api/objetos-perdidos/${path.join("/")}`);

  const incoming = new URL(requestUrl);
  upstream.search = incoming.search;
  return upstream.toString();
};

const proxy = async (request: NextRequest, path: string[]) => {
  const targetUrl = buildTargetUrl(path, request.url);

  try {
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("connection");

    const body = request.method === "GET" || request.method === "HEAD" ? undefined : Buffer.from(await request.arrayBuffer());

    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });

    if (!upstreamResponse.ok) {
      const text = await upstreamResponse.clone().text();
      console.error("[ObjetosPerdidos Proxy] Upstream error", {
        targetUrl,
        method: request.method,
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        body: text.slice(0, 500),
      });
    }

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: upstreamResponse.headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proxy error";
    console.error("[ObjetosPerdidos Proxy] Connection failure", {
      targetUrl,
      method: request.method,
      message,
    });

    return NextResponse.json(
      {
        error: `Proxy connection error: ${message}`,
        targetUrl,
      },
      { status: 502 }
    );
  }
};

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}
