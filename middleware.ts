import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildCorsHeaders, resolveAllowedOrigin } from "@/lib/cors";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const allowOrigin = resolveAllowedOrigin(request.headers.get("origin"));

  if (request.method === "OPTIONS") {
    if (!allowOrigin) {
      return new Response(null, { status: 403 });
    }
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(allowOrigin),
    });
  }

  const response = NextResponse.next();
  if (allowOrigin) {
    buildCorsHeaders(allowOrigin).forEach((value, key) => {
      response.headers.set(key, value);
    });
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
