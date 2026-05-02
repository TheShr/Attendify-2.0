import { NextRequest, NextResponse } from 'next/server'
import { getApiBase } from '@/lib/api'

function buildBackendUrl(path: string): string {
  const base = getApiBase().replace(/\/+$/, '')
  const cleanBase = base.endsWith('/api') ? base : `${base}/api`
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${cleanBase}${suffix}`
}

function forwardHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = req.headers.get('authorization')
  if (auth) headers['Authorization'] = auth
  return headers
}

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const id = params.id
    const body = await req.json().catch(() => null)
    
    const backendUrl = buildBackendUrl(`/geofences/${id}`)
    console.log(`[Geofence Proxy] PATCH /geofences/${id} -> ${backendUrl}`)

    const response = await fetch(backendUrl, {
      method: 'PATCH',
      headers: forwardHeaders(req),
      body: JSON.stringify(body || {}),
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Geofence patch proxy error:', error)
    return NextResponse.json(
      { error: 'backend_unavailable', details: String(error) },
      { status: 502 }
    )
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const id = params.id
    
    const backendUrl = buildBackendUrl(`/geofences/${id}`)
    console.log(`[Geofence Proxy] DELETE /geofences/${id} -> ${backendUrl}`)

    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: forwardHeaders(req),
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Geofence delete proxy error:', error)
    return NextResponse.json(
      { error: 'backend_unavailable', details: String(error) },
      { status: 502 }
    )
  }
}
