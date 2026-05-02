import { NextResponse } from "next/server"
import { getApiBase } from "@/lib/api"

type BackendResponse = {
  ok?: boolean
  data?: { students?: Array<Record<string, unknown>> }
  error?: string
}

function buildBackendUrl(path: string): URL {
  const base = getApiBase().replace(/\/+$/, "")
  const cleanBase = base.endsWith("/api") ? base : `${base}/api`
  const suffix = path.startsWith("/") ? path : `/${path}`
  return new URL(`${cleanBase}${suffix}`)
}

export async function GET(req: Request) {
  try {
    const incoming = new URL(req.url)
    const classIdParam = incoming.searchParams.get("class_id") ?? incoming.searchParams.get("classId")
    if (!classIdParam || classIdParam === "all") {
      return NextResponse.json(
        { ok: false, error: "class_id is required and must be a number" },
        { status: 400 },
      )
    }

    const backendUrl = buildBackendUrl("/class-students")
    backendUrl.searchParams.set("class_id", classIdParam)

    const headers: Record<string, string> = { Accept: "application/json" }
    const auth = req.headers.get("authorization")
    if (auth) headers["Authorization"] = auth

    const backendResponse = await fetch(backendUrl, {
      method: "GET",
      headers,
    })
    const data = (await backendResponse.json().catch(() => null)) as BackendResponse | null

    if (!backendResponse.ok || !data || !data.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error ?? "Unable to fetch students" },
        { status: backendResponse.status || 502 },
      )
    }

    const students = Array.isArray(data.data?.students) ? data.data?.students : []
    return NextResponse.json({ ok: true, data: { students } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message || "Failed to load students" }, { status: 500 })
  }
}
