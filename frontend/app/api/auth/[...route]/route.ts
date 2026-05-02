import { NextRequest, NextResponse } from "next/server"
import { getApiBase } from "@/lib/api"

function buildBackendUrl(path: string): URL {
  const base = getApiBase().replace(/\/+$/, "")
  // Remove /api if it's at the end of base, then add the full path
  const cleanBase = base.endsWith("/api") ? base : `${base}/api`
  const suffix = path.startsWith("/") ? path : `/${path}`
  return new URL(`${cleanBase}${suffix}`)
}

async function parseBackendResponse(response: Response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return {
      error: "backend_response_not_json",
      status: response.status,
      statusText: response.statusText,
      body: text,
    }
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { route: string[] } }
) {
  try {
    const route = params.route || []
    const backendPath = `/auth/${route.join("/")}`
    const backendUrl = buildBackendUrl(backendPath)

    console.log(`[Auth Proxy] POST ${backendPath} -> ${backendUrl}`)
    const contentType = req.headers.get("content-type") || ""
    console.log(`[Auth Proxy] content-type: ${contentType}`)

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const outForm = new FormData()
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          outForm.append(key, value, value.name)
        } else {
          outForm.append(key, value)
        }
      }

      const headers: Record<string, string> = {}
      const authHeader = req.headers.get("authorization")
      if (authHeader) headers["Authorization"] = authHeader

      const response = await fetch(backendUrl.toString(), {
        method: "POST",
        headers,
        body: outForm,
      })

      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      })
    }

    const body = await req.json().catch(() => ({}))
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    const authHeader = req.headers.get("authorization")
    if (authHeader) headers["Authorization"] = authHeader

    const response = await fetch(backendUrl.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })

    const data = await parseBackendResponse(response)
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Auth proxy error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET(
  req: Request,
  { params }: { params: { route: string[] } }
) {
  try {
    const route = params.route || []
    const backendPath = `/auth/${route.join("/")}`

    const headers: Record<string, string> = {}
    const authHeader = req.headers.get("authorization")
    if (authHeader) headers["Authorization"] = authHeader

    const backendUrl = buildBackendUrl(backendPath)
    console.log(`[Auth Proxy] GET ${backendPath} -> ${backendUrl}`)

    const response = await fetch(backendUrl.toString(), {
      method: "GET",
      headers,
    })

    const data = await parseBackendResponse(response)
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Auth proxy error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    )
  }
}
