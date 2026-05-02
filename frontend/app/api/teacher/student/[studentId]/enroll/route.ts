import { type NextRequest, NextResponse } from 'next/server'
import { getApiBase } from '@/lib/api'

function buildBackendUrl(studentId: string, path: string): string {
  const base = getApiBase().replace(/\/+$/, '')
  const cleanBase = base.endsWith('/api') ? base : `${base}/api`
  return `${cleanBase}/teacher/student/${studentId}${path}`
}

function forwardHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {}
  const auth = req.headers.get('authorization')
  if (auth) headers['Authorization'] = auth
  const ct = req.headers.get('content-type')
  if (ct) headers['Content-Type'] = ct
  return headers
}

export async function POST(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data (images + labels)
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

      const backendUrl = buildBackendUrl(params.studentId, '/enroll')
      console.log(`[Face Enroll Proxy] POST ${backendUrl}`)

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
      // Handle JSON fallback
      const body = await request.json().catch(() => ({}))
      const backendUrl = buildBackendUrl(params.studentId, '/enroll')
      console.log(`[Face Enroll Proxy] POST ${backendUrl}`)

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: forwardHeaders(request),
        body: JSON.stringify(body),
      })

      const data = await response.json().catch(() => ({}))
      return NextResponse.json(data, { status: response.status })
    }
  } catch (error) {
    console.error('Face enrollment proxy error:', error)
    return NextResponse.json(
      { error: 'backend_unavailable', details: String(error) },
      { status: 502 }
    )
  }
}
