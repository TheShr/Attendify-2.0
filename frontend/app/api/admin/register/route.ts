// app/api/admin/register/route.ts
import { NextResponse } from 'next/server';
import { getApiBase } from '@/lib/api';

export const runtime = 'nodejs'; // file streaming is safer on node runtime

function buildBackendUrl(path: string): string {
  const base = getApiBase().replace(/\/+$/, '');
  const cleanBase = base.endsWith('/api') ? base : `${base}/api`;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${suffix}`;
}

function forwardHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const auth = req.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;
  const ct = req.headers.get('content-type');
  if (ct) headers['Content-Type'] = ct;
  return headers;
}

export async function POST(req: Request) {
  const ct = req.headers.get('content-type') || '';
  try {
    if (ct.startsWith('multipart/form-data')) {
      // accept form + file from the browser
      const inForm = await req.formData();
      const outForm = new FormData();
      for (const [k, v] of inForm) {
        if (v instanceof File) outForm.append(k, v, v.name);
        else outForm.append(k, String(v));
      }
      // forward to Flask backend
      const backendUrl = buildBackendUrl('/admin/register');
      console.log(`[Admin Register Proxy] POST /admin/register -> ${backendUrl}`);
      
      const headers: Record<string, string> = {};
      const auth = req.headers.get('authorization');
      if (auth) headers['Authorization'] = auth;
      
      const r = await fetch(backendUrl, { 
        method: 'POST', 
        headers,
        body: outForm 
      });
      const body = await r.text();
      return new NextResponse(body, {
        status: r.status,
        headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
      });
    } else {
      // JSON fallback
      const json = await req.json().catch(() => ({}));
      const backendUrl = buildBackendUrl('/admin/register');
      console.log(`[Admin Register Proxy] POST /admin/register -> ${backendUrl}`);
      
      const r = await fetch(backendUrl, {
        method: 'POST',
        headers: forwardHeaders(req),
        body: JSON.stringify(json),
      });
      const body = await r.text();
      return new NextResponse(body, {
        status: r.status,
        headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
      });
    }
  } catch (err: unknown) {
    console.error('Admin register proxy error:', err);
    return NextResponse.json({ error: 'proxy_failed', detail: String(err) }, { status: 502 });
  }
}
