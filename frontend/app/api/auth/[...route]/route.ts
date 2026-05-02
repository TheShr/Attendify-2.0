import { NextRequest, NextResponse } from "next/server"
import { getApiBase } from "@/lib/api"

function buildBackendUrl(path: string, frontendHost?: string): URL {
  const base = getApiBase().replace(/\/+$/, "")
  if (
    process.env.NODE_ENV === "production" &&
    base === "http://localhost:5000/api"
  ) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not configured in production. Set your backend host in Vercel."
    )
  }
  // Remove /api if it's at the end of base, then add the full path
  const cleanBase = base.endsWith("/api") ? base : `${base}/api`
  const suffix = path.startsWith("/") ? path : `/${path}`
  const backendUrl = new URL(`${cleanBase}${suffix}`)
  if (frontendHost && backendUrl.host === frontendHost) {
    throw new Error(
      "NEXT_PUBLIC_API_URL points to the frontend host instead of the backend. Set it to the backend URL."
    )
  }
  return backendUrl
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
    const frontendHost = req.headers.get("host") || undefined
    const backendUrl = buildBackendUrl(backendPath, frontendHost)

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

    let response: Response
    try {
      response = await fetch(backendUrl.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
    } catch (fetchError) {
      console.error("Auth proxy fetch error:", fetchError)
      return NextResponse.json(
        {
          error: "backend_unavailable",
          details: String(fetchError),
        },
        { status: 502 }
      )
    }

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
    const frontendHost = req.headers.get("host") || undefined
    const backendUrl = buildBackendUrl(backendPath, frontendHost)

    const headers: Record<string, string> = {}
    const authHeader = req.headers.get("authorization")
    if (authHeader) headers["Authorization"] = authHeader

    console.log(`[Auth Proxy] GET ${backendPath} -> ${backendUrl}`)

    let response: Response
    try {
      response = await fetch(backendUrl.toString(), {
        method: "GET",
        headers,
      })
    } catch (fetchError) {
      console.error("Auth proxy fetch error:", fetchError)
      return NextResponse.json(
        {
          error: "backend_unavailable",
          details: String(fetchError),
        },
        { status: 502 }
      )
    }

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
