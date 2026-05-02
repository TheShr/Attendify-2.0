import { type NextRequest, NextResponse } from 'next/server'
import { getApiBase } from '@/lib/api'

function buildBackendUrl(path: string): string {
  const base = getApiBase().replace(/\/+$/, '')
  const cleanBase = base.endsWith('/api') ? base : `${base}/api`
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${cleanBase}${suffix}`
}

function forwardHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {}
  const auth = req.headers.get('authorization')
  if (auth) headers['Authorization'] = auth
  const ct = req.headers.get('content-type')
  if (ct) headers['Content-Type'] = ct
  return headers
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data (image + metadata fields)
      const formData = await request.formData()
      const outForm = new FormData()

      // Forward all form fields and files
      for (const [key, value] of formData) {
        if (value instanceof File) {
          outForm.append(key, value, value.name)
        } else {
          outForm.append(key, value)
        }
      }

      const backendUrl = buildBackendUrl('/attendance/mark/face')
      console.log(`[Face Mark Proxy] POST /attendance/mark/face -> ${backendUrl}`)

      const headers: Record<string, string> = {}
      const auth = request.headers.get('authorization')
      if (auth) headers['Authorization'] = auth

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers,
        body: outForm,
      })

      const text = await response.text()
      return new NextResponse(text, {
        status: response.status,
        headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
      })
    } else {
      // Handle JSON fallback (for metadata-only requests)
      const body = await request.json().catch(() => ({}))
      const backendUrl = buildBackendUrl('/attendance/mark/face')
      console.log(`[Face Mark Proxy] POST /attendance/mark/face -> ${backendUrl}`)

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: forwardHeaders(request),
        body: JSON.stringify(body),
      })

      const data = await response.json().catch(() => ({}))
      return NextResponse.json(data, { status: response.status })
    }
  } catch (error) {
    console.error('Face mark proxy error:', error)
    return NextResponse.json(
      { error: 'backend_unavailable', details: String(error) },
      { status: 502 }
    )
  }
}
