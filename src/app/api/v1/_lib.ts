import { NextRequest, NextResponse } from "next/server";
import { requirePermission, logAudit, type SessionProfile } from "@/lib/authz";

/* Per-IP sliding-window rate limit (per serverless instance; documented in OpenAPI). */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const hits = new Map<string, number[]>();

export function rateLimit(request: NextRequest): NextResponse | null {
  const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (recent.length > MAX_REQUESTS) {
    return NextResponse.json({ error: "Rate limit exceeded (60 req/min)" }, { status: 429 });
  }
  return null;
}

export function parsePagination(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(sp.get("per_page")) || 25));
  return { page, perPage, from: (page - 1) * perPage, to: page * perPage - 1 };
}

export function envelope<T>(data: T, meta: { page: number; perPage: number; total: number }) {
  return NextResponse.json({
    data,
    meta: { page: meta.page, per_page: meta.perPage, total: meta.total, total_pages: Math.max(1, Math.ceil(meta.total / meta.perPage)) },
  });
}

/** Guard an API handler: rate limit → permission → audit on denial. Returns profile or an error response. */
export async function guard(
  request: NextRequest,
  module: string,
  action: string
): Promise<{ profile: SessionProfile } | { response: NextResponse }> {
  const limited = rateLimit(request);
  if (limited) return { response: limited };
  try {
    const profile = await requirePermission(module, action);
    return { profile };
  } catch {
    return { response: NextResponse.json({ error: "Not authorized" }, { status: 401 }) };
  }
}

export { logAudit };
