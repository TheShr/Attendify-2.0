import { NextRequest, NextResponse } from 'next/server'
import { getApiBase } from '@/lib/api'

function buildBackendUrl(path: string): string {
  const base = getApiBase().replace(/\/+$/, '')
  const cleanBase = base.endsWith('/api') ? base : `${base}/api`
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${cleanBase}${suffix}`
}

export async function GET(request: NextRequest, { params }: { params: { route: string[] } }) {
  const route = params.route.join('/')
  const url = buildBackendUrl(`/admin/${route}`)

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const auth = request.headers.get('Authorization')
    if (auth) headers['Authorization'] = auth

    console.log(`[Admin Proxy] GET ${url}`)
    const response = await fetch(url, { headers })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Admin API proxy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { route: string[] } }) {
  const route = params.route.join('/')
  const url = buildBackendUrl(`/admin/${route}`)

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const auth = request.headers.get('Authorization')
    if (auth) headers['Authorization'] = auth

    console.log(`[Admin Proxy] DELETE ${url}`)
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    })

    const data = await response.json().catch(() => ({ message: 'Deleted' }))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Admin API proxy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { route: string[] } }) {
  const route = params.route.join('/')
  const url = buildBackendUrl(`/admin/${route}`)

  try {
    const body = await request.json()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const auth = request.headers.get('Authorization')
    if (auth) headers['Authorization'] = auth

    console.log(`[Admin Proxy] POST ${url}`)
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Admin API proxy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}