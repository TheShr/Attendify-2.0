import { NextResponse } from 'next/server'
import { getApiBase } from '@/lib/api'

function buildBackendUrl(courseId: string, path: string): string {
  const base = getApiBase().replace(/\/+$/, '')
  const cleanBase = base.endsWith('/api') ? base : `${base}/api`
  return `${cleanBase}/teacher/course/${courseId}${path}`
}

function forwardHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = req.headers.get('authorization')
  if (auth) headers['Authorization'] = auth
  return headers
}

export async function POST(
  req: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const body = await req.json().catch(() => ({}))

    const backendUrl = buildBackendUrl(params.courseId, '/attendance/start')
    console.log(`[Teacher Attendance Start Proxy] POST ${backendUrl}`)

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: forwardHeaders(req),
      body: JSON.stringify(body),
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Teacher attendance start proxy error:', error)
    return NextResponse.json(
      { error: 'backend_unavailable', details: String(error) },
      { status: 502 }
    )
  }
}
