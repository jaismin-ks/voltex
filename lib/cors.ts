import { NextResponse } from "next/server";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://voltex-eight.vercel.app",
  "http://localhost:3000",
];

export function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv])];
}

/** Allow listed origins and any https *.vercel.app preview (unless disabled). */
export function resolveAllowedOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;

  const allowed = getAllowedOrigins();
  if (allowed.includes(requestOrigin)) return requestOrigin;

  if (process.env.CORS_ALLOW_VERCEL_PREVIEWS === "false") return null;

  try {
    const url = new URL(requestOrigin);
    if (url.protocol === "https:" && url.hostname.endsWith(".vercel.app")) {
      return requestOrigin;
    }
  } catch {
    return null;
  }

  return null;
}

export function buildCorsHeaders(origin: string): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  return headers;
}

export function handleApiCorsPreflight(request: Request): Response {
  const origin = resolveAllowedOrigin(request.headers.get("origin"));
  if (!origin) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}

export function withCors(request: Request, response: NextResponse): NextResponse {
  const origin = resolveAllowedOrigin(request.headers.get("origin"));
  if (!origin) return response;
  buildCorsHeaders(origin).forEach((value, key) => {
    response.headers.set(key, value);
  });
  return response;
}
