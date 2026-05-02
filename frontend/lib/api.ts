/**
 * api.ts — central HTTP client for Attendify frontend.
 *
 * All fetch calls go through here so:
 *  - JWT token is always injected from localStorage
 *  - Backend host comes from NEXT_PUBLIC_API_URL env var (Vercel/Render)
 *  - Local development falls back to http://localhost:5000/api
 *  - 401 responses auto-redirect to login
 */

const DEFAULT_API_BASE = "http://localhost:5000/api";

export function getApiBase(): string {
  const candidate =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) || "";
  if (candidate.trim().length > 0) {
    return candidate.trim().replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not configured in production. Set it in Vercel environment variables."
    );
  }

  return DEFAULT_API_BASE;
}

export function resolveApiUrl(path: string): string {
  if (path.startsWith("/api/")) {
    // Route same-origin application API requests through Next.js.
    // This avoids CORS issues in local development and keeps browser
    // requests on the frontend origin.
    return path
  }

  const base = getApiBase()
  if (/^https?:\/\//i.test(path)) return path
  const relative = path.startsWith("/") ? path : `/${path}`
  // If base already ends with /api and path starts with /api/, de-dup
  const trimmedBase = base.replace(/\/+$/, "")
  if (trimmedBase.endsWith("/api") && relative.startsWith("/api/")) {
    return `${trimmedBase}${relative.slice(4)}`
  }
  return `${trimmedBase}${relative}`
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function buildHeaders(extra?: HeadersInit, skipJson?: boolean): HeadersInit {
  const token = getToken();
  const base: Record<string, string> = {};
  if (!skipJson) base["Content-Type"] = "application/json";
  if (token) base["Authorization"] = `Bearer ${token}`;
  return { ...base, ...(extra as Record<string, string> || {}) };
}

export async function apiFetch(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const url = resolveApiUrl(path);
  const timeoutMs = init?.timeoutMs ?? 15000;

  // Don't add Content-Type for FormData — browser sets it with boundary
  const isFormData = init?.body instanceof FormData;
  const controller = new AbortController();
  const signal = controller.signal;
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: buildHeaders(init?.headers as HeadersInit, isFormData),
      signal,
    });
  } finally {
    globalThis.clearTimeout(timer);
  }

  // Auto-logout on 401
  if (response.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    window.location.href = "/";
  }

  return response;
}

export async function apiJson<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = `Request failed with ${response.status}`;
    try {
      const json = JSON.parse(text);
      if (json?.error) message = json.error;
      else if (json?.message) message = json.message;
    } catch {
      if (text) message += `: ${text}`;
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

// ── Auth helpers ──────────────────────────────────────────────
export function saveAuthToken(token: string, role: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("access_token", token);
  localStorage.setItem("user_role", role);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_role");
  localStorage.removeItem("user_id");
}

export function getStoredRole(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("user_role");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
