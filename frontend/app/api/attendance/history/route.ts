import { NextResponse } from "next/server"
import { getApiBase } from "@/lib/api"

type BackendHistoryResponse = {
  items?: Array<Record<string, unknown>>
  meta?: {
    page?: number
    perPage?: number
    total?: number
    totalPages?: number
  }
  error?: string
}

type BackendManualResponse = {
  classId?: number
  saved?: number
  created?: number
  updated?: number
  statusSummary?: Record<string, unknown>
  error?: string
}

function buildBackendUrl(path: string): URL {
  const base = getApiBase().replace(/\/+$/, "")
  const cleanBase = base.endsWith("/api") ? base : `${base}/api`
  const suffix = path.startsWith("/") ? path : `/${path}`
  return new URL(`${cleanBase}${suffix}`)
}

function mapHistoryRow(input: Record<string, unknown>) {
  return {
    id: input.attendanceId ?? input.id ?? null,
    student_id: input.studentId ?? input.student_id ?? null,
    student_name: input.studentName ?? input.student_name ?? "",
    roll_no: input.rollNo ?? input.roll_no ?? null,
    class_id: input.classId ?? input.class_id ?? null,
    class_name: input.className ?? input.class_name ?? "",
    date: input.date ?? null,
    time: input.time ?? null,
    status: typeof input.status === "string" ? input.status : null,
    recognized_name: input.recognizedName ?? input.recognized_name ?? null,
    source: input.source ?? null,
  }
}

function toPositiveInt(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value)
  return Number.isFinite(num) && num > 0 ? Math.trunc(num) : fallback
}

export async function GET(req: Request) {
  try {
    const incoming = new URL(req.url)
    const backendUrl = buildBackendUrl("/attendance/history")

    const classId = incoming.searchParams.get("class_id")
    if (classId && classId !== "all") {
      backendUrl.searchParams.set("classId", classId)
    }

    const startDate = incoming.searchParams.get("start_date")
    if (startDate) backendUrl.searchParams.set("fromDate", startDate)

    const endDate = incoming.searchParams.get("end_date")
    if (endDate) backendUrl.searchParams.set("toDate", endDate)

    const studentQuery = incoming.searchParams.get("student_query")
    if (studentQuery) backendUrl.searchParams.set("student", studentQuery)

    const pageValue = incoming.searchParams.get("page") ?? "1"
    const pageSizeValue = incoming.searchParams.get("page_size") ?? "20"
    backendUrl.searchParams.set("page", pageValue)
    backendUrl.searchParams.set("perPage", pageSizeValue)

    const headers: Record<string, string> = { Accept: "application/json" }
    const auth = req.headers.get("authorization")
    if (auth) headers["Authorization"] = auth

    const backendResponse = await fetch(backendUrl, {
      method: "GET",
      headers,
    })

    const data = (await backendResponse.json().catch(() => null)) as BackendHistoryResponse | null

    if (!backendResponse.ok || !data) {
      return NextResponse.json(
        { ok: false, error: data?.error ?? "Unable to fetch attendance history" },
        { status: backendResponse.status || 502 },
      )
    }

    const items = Array.isArray(data.items) ? data.items : []
    const mapped = items.map((item) => mapHistoryRow(item as Record<string, unknown>))

    const meta = data.meta ?? {}
    const page = toPositiveInt(meta.page, Number(pageValue) || 1)
    const perPage = toPositiveInt(meta.perPage, Number(pageSizeValue) || 20)
    const total = toPositiveInt(meta.total, mapped.length)
    const totalPages = toPositiveInt(meta.totalPages, Math.max(1, Math.ceil(total / Math.max(1, perPage))))

    return NextResponse.json({
      ok: true,
      data: mapped,
      pagination: {
        page,
        page_size: perPage,
        total,
        total_pages: totalPages,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message || "Failed to load attendance history" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    const classIdRaw = body?.class_id ?? body?.classId
    const classId = Number(classIdRaw)
    if (!Number.isFinite(classId) || classId <= 0) {
      return NextResponse.json({ ok: false, error: "class_id must be a positive number" }, { status: 400 })
    }

    const dateValue = typeof body?.date === "string" ? body.date.trim() : ""
    if (!dateValue) {
      return NextResponse.json({ ok: false, error: "date is required" }, { status: 400 })
    }

    const items: Array<Record<string, unknown>> = Array.isArray(body?.items) ? body.items : []
    if (!items.length) {
      return NextResponse.json({ ok: false, error: "items must include attendance records" }, { status: 400 })
    }

    const records = items.map((item) => {
      const studentIdRaw = item?.student_id ?? item?.studentId
      const studentId = Number(studentIdRaw)
      if (!Number.isFinite(studentId)) return null

      const statusValue = typeof item?.status === "string" ? item.status.trim().toLowerCase() : "absent"
      const normalizedStatus = statusValue === "present" ? "present" : statusValue === "late" ? "late" : "absent"
      const recognizedName = typeof item?.recognized_name === "string"
        ? item.recognized_name.trim() || null
        : typeof item?.recognizedName === "string"
        ? item.recognizedName.trim() || null
        : null

      return {
        studentId,
        status: normalizedStatus,
        recognizedName,
      }
    }).filter((record): record is { studentId: number; status: string; recognizedName: string | null } => record !== null)

    if (!records.length) {
      return NextResponse.json({ ok: false, error: "No valid attendance records supplied" }, { status: 400 })
    }

    const backendPayload = {
      classId,
      date: dateValue,
      records,
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" }
    const auth = req.headers.get("authorization")
    if (auth) headers["Authorization"] = auth

    const backendResponse = await fetch(buildBackendUrl("/attendance/manual"), {
      method: "POST",
      headers,
      body: JSON.stringify(backendPayload),
    })

    const data = (await backendResponse.json().catch(() => null)) as BackendManualResponse | null

    if (!backendResponse.ok || !data) {
      return NextResponse.json(
        { ok: false, error: data?.error ?? "Unable to save attendance" },
        { status: backendResponse.status || 500 },
      )
    }

    const inserted = toPositiveInt(data.saved ?? data.created ?? records.length, records.length)
    return NextResponse.json({
      ok: true,
      inserted,
      created: toPositiveInt(data.created, 0),
      updated: toPositiveInt(data.updated, 0),
      status_summary: data.statusSummary ?? {},
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message || "Failed to save attendance" }, { status: 500 })
  }
}
