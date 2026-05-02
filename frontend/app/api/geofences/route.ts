/**
 * /app/api/geofences/route.ts
 *
 * Proxies to the Flask backend instead of using in-memory storage.
 * This removes the "zones reset on every deploy" bug.
 */
import { NextResponse } from "next/server";
import { getApiBase } from "@/lib/api";

function backendUrl(path: string): string {
  const base = getApiBase().replace(/\/+$/, "")
  const cleanBase = base.endsWith('/api') ? base : `${base}/api`
  return `${cleanBase}${path}`;
}

function forwardHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const auth = req.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;
  return headers;
}

export async function GET(req: Request) {
  try {
    const resp = await fetch(backendUrl("/geofences"), {
      headers: forwardHeaders(req),
    });
    const data = await resp.json().catch(() => ({}));
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json({ error: "backend_unavailable" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

    const resp = await fetch(backendUrl("/geofences"), {
      method: "POST",
      headers: forwardHeaders(req),
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json({ error: "backend_unavailable" }, { status: 502 });
  }
}
