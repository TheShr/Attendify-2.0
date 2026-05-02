import { NextResponse } from 'next/server'
import { getApiBase } from '@/lib/api'

function buildBackendUrl(path: string): string {
  const base = getApiBase().replace(/\/+$/, '')
  const cleanBase = base.endsWith('/api') ? base : `${base}/api`
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${cleanBase}${suffix}`
}

function forwardHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = req.headers.get('authorization')
  if (auth) headers['Authorization'] = auth
  return headers
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })

    const backendUrl = buildBackendUrl('/attendance/mark')
    console.log(`[Attendance Proxy] POST /attendance/mark -> ${backendUrl}`)

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: forwardHeaders(req),
      body: JSON.stringify(body),
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Attendance checkin proxy error:', error)
    return NextResponse.json(
      { error: 'backend_unavailable', details: String(error) },
      { status: 502 }
    )
  }
}

