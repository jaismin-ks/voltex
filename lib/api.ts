const DEFAULT_PROD_API = "https://gale-projecton-production.up.railway.app";

/** Resolve API origin: localhost in dev, Railway (or override) in prod. */
export function getApiBaseUrl(): string {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? "dev";
  if (appEnv === "prod") {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_PROD_API;
    return base.replace(/\/$/, "");
  }
  const host = process.env.NEXT_PUBLIC_DEV_API_HOST ?? "localhost";
  const port = process.env.NEXT_PUBLIC_DEV_API_PORT ?? "3000";
  return `http://${host}:${port}`;
}

/** Build a full URL for a Next.js API route (e.g. `/api/assess-batch`). */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  if (!base) return normalized;
  return `${base}${normalized}`;
}
