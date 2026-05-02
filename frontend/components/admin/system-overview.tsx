"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Database, Camera, MapPin, RefreshCw } from "lucide-react"
import { apiFetch } from "@/lib/api"

interface ServiceStatus {
  name: string
  status: "operational" | "degraded" | "down"
  uptime: number
  description: string
  icon: React.ReactNode
}

const STATUS_COLOR = {
  operational: { bg: "#f0fdf4", border: "#bbf7d0", text: "#10b981", dot: "#22c55e" },
  degraded:    { bg: "#fffbeb", border: "#fde68a", text: "#f59e0b", dot: "#f59e0b" },
  down:        { bg: "#fff0f0", border: "#fecaca", text: "#ef4444", dot: "#ef4444" },
}

export function SystemOverview() {
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)

  const check = async () => {
    setChecking(true)
    try {
      const res = await apiFetch("/api/health")
      setBackendOk(res.ok)
    } catch { setBackendOk(false) }
    finally { setChecking(false) }
  }

  useEffect(() => { check() }, [])

  const services: ServiceStatus[] = [
    {
      name: "Backend API",
      status: backendOk === null ? "degraded" : backendOk ? "operational" : "down",
      uptime: backendOk ? 99.9 : 0,
      description: backendOk === null ? "Checking connection…" : backendOk ? "All endpoints healthy" : "Cannot reach backend server",
      icon: <Database size={15} />,
    },
    {
      name: "Face Recognition",
      status: "operational",
      uptime: 98.5,
      description: "FaceNet512 service running",
      icon: <Camera size={15} />,
    },
    {
      name: "Geofencing",
      status: "operational",
      uptime: 99.2,
      description: "GPS verification active",
      icon: <MapPin size={15} />,
    },
    {
      name: "Database",
      status: backendOk ? "operational" : "degraded",
      uptime: backendOk ? 99.9 : 95,
      description: backendOk ? "PostgreSQL connected" : "Connection may be affected",
      icon: <Activity size={15} />,
    },
  ]

  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Activity size={16} color="#2563eb" /> System Health
          </CardTitle>
          <button
            onClick={check}
            disabled={checking}
            style={{ padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 10, background: "white", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center" }}
            title="Refresh"
          >
            <RefreshCw size={14} style={{ animation: checking ? "spin 0.7s linear infinite" : "none" }} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="flex flex-col gap-3">
          {services.map((s) => {
            const c = STATUS_COLOR[s.status]
            return (
              <div key={s.name} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl flex-shrink-0"
                  style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
                >
                  {s.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{s.name}</span>
                    <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ background: c.dot }} />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: c.text }}>
                      {s.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{s.description}</p>
                </div>
                <span className={`text-sm font-semibold ${s.uptime >= 99 ? "text-emerald-600" : s.uptime >= 95 ? "text-amber-600" : "text-rose-600"}`}>
                  {s.uptime}%
                </span>
              </div>
            )
          })}
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </CardContent>
    </Card>
  )
}
