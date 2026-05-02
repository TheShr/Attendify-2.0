import { NextRequest, NextResponse } from 'next/server'
import { getApiBase } from '@/lib/api'

export const dynamic = 'force-dynamic'

function buildBackendUrl(path: string, searchParams?: Record<string, string>): string {
  const base = getApiBase().replace(/\/+$/, '')
  const cleanBase = base.endsWith('/api') ? base : `${base}/api`
  const suffix = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${cleanBase}${suffix}`)
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

function forwardHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const auth = req.headers.get('authorization')
  if (auth) headers['Authorization'] = auth
  return headers
}

export async function GET(request: NextRequest) {
  try {
    const range = request.nextUrl.searchParams.get('range') || 'month'
    
    const backendUrl = buildBackendUrl('/insights/policymaker', { range })
    console.log(`[Insights Policymaker Proxy] GET ${backendUrl}`)

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: forwardHeaders(request),
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Insights policymaker proxy error:', error)
    return NextResponse.json(
      { error: 'backend_unavailable', details: String(error) },
      { status: 502 }
    )
  }
}
