"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { SystemOverview } from "@/components/admin/system-overview"
import { UserManagement } from "@/components/admin/user-management"
import { RegistrationPanel } from "@/components/admin/registration-panel"
import { Users, UserCheck, GraduationCap, Settings, Activity } from "lucide-react"
import { apiJson } from "@/lib/api"
import "./dashboard.css"

const navigation = [
  { name: "Dashboard", href: "/admin", icon: <Settings className="h-4 w-4" />, current: true },
  { name: "Users", href: "/admin/users", icon: <Users className="h-4 w-4" /> },
  { name: "Teachers", href: "/admin/teachers", icon: <UserCheck className="h-4 w-4" /> },
  { name: "Students", href: "/admin/students", icon: <GraduationCap className="h-4 w-4" /> },
  { name: "Geofencing", href: "/admin/geofencing", icon: <Activity className="h-4 w-4" /> },
  { name: "Profile", href: "/admin/profile", icon: <Settings className="h-4 w-4" /> },
]

interface SystemStats {
  total_students: number
  total_teachers: number
  active_sessions: number
  system_health: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null)

  useEffect(() => {
    apiJson<SystemStats>("/api/admin/stats")
      .then(d => setStats(d))
      .catch(() => {})
  }, [])

  const cards = [
    { title: "Total Students", value: stats?.total_students?.toLocaleString() ?? "—", helper: "Enrolled in system", icon: GraduationCap, color: "#3b82f6", bg: "#eff6ff" },
    { title: "Total Teachers", value: stats?.total_teachers?.toLocaleString() ?? "—", helper: "Active faculty", icon: UserCheck, color: "#10b981", bg: "#f0fdf4" },
    { title: "Active Sessions", value: stats?.active_sessions?.toLocaleString() ?? "—", helper: "Currently running", icon: Activity, color: "#f59e0b", bg: "#fffbeb" },
    { title: "System Health", value: stats?.system_health != null ? `${stats.system_health}%` : "—", helper: "All systems operational", icon: Settings, color: "#8b5cf6", bg: "#f5f3ff" },
  ]

  return (
    <DashboardLayout title="Admin Dashboard" userType="admin" navigation={navigation}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.title} className="admin-dashboard-card">
              <div className="admin-dashboard-card-header">
                <div>
                  <p className="admin-dashboard-card-content">{c.title}</p>
                  <p className="admin-dashboard-card-value">{c.value}</p>
                  <p className="admin-dashboard-card-helper">{c.helper}</p>
                </div>
                <span className="admin-dashboard-card-icon" style={{background: c.bg, color: c.color}}>
                  <c.icon size={17} />
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_0.9fr] items-start">
          <RegistrationPanel />
          <SystemOverview />
        </div>

        <UserManagement />
      </div>
    </DashboardLayout>
  )
}
