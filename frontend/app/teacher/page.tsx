"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import AttendanceHistory from "@/components/teacher/attendance-history"
import ClassManagement from "@/components/teacher/class-management"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Calendar, Clock, CheckCircle, TrendingUp } from "lucide-react"
import { apiFetch } from "@/lib/api"

const navigation = [
  { name: "Dashboard", href: "/teacher", icon: <Users className="h-4 w-4" />, current: true },
  { name: "Attendance", href: "/teacher/attendance", icon: <CheckCircle className="h-4 w-4" /> },
  { name: "Classes", href: "/teacher/classes", icon: <Calendar className="h-4 w-4" /> },
  { name: "Reports", href: "/teacher/reports", icon: <Clock className="h-4 w-4" /> },
  { name: "Profile", href: "/teacher/profile", icon: <TrendingUp className="h-4 w-4" /> },
]

interface Stats {
  total_courses: number
  total_students: number
  active_sessions: number
  avg_attendance: number
}

export default function TeacherDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    apiFetch("/api/teacher/stats")
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setStats(d))
      .catch(() => {})
  }, [])

  const statCards = [
    {
      title: "Total Classes",
      value: stats?.total_courses ?? "—",
      helper: "Active this semester",
      icon: Calendar,
      color: "#3b82f6",
      bg: "#eff6ff",
    },
    {
      title: "Total Students",
      value: stats?.total_students ?? "—",
      helper: "Enrolled across classes",
      icon: Users,
      color: "#10b981",
      bg: "#f0fdf4",
    },
    {
      title: "Active Sessions",
      value: stats?.active_sessions ?? "—",
      helper: "Currently running",
      icon: Clock,
      color: "#f59e0b",
      bg: "#fffbeb",
    },
    {
      title: "Avg Attendance",
      value: stats?.avg_attendance != null ? `${stats.avg_attendance}%` : "—",
      helper: "Across all courses",
      icon: TrendingUp,
      color: "#8b5cf6",
      bg: "#f5f3ff",
    },
  ]

  return (
    <DashboardLayout title="Teacher Dashboard" userType="teacher" navigation={navigation}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s) => (
            <Card key={s.title} style={{border:"1px solid #e8edf5",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p style={{fontSize:12,fontWeight:600,color:"#6b7a99",textTransform:"uppercase",letterSpacing:"0.05em"}}>{s.title}</p>
                    <p style={{fontSize:28,fontWeight:700,color:"#111827",marginTop:6,fontFamily:"'DM Serif Display', serif"}}>{s.value}</p>
                    <p style={{fontSize:12,color:"#9ca3b8",marginTop:4}}>{s.helper}</p>
                  </div>
                  <span style={{width:40,height:40,borderRadius:10,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",color:s.color,flexShrink:0}}>
                    <s.icon size={18} />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6">
          <ClassManagement />
        </div>

        <AttendanceHistory />
      </div>
    </DashboardLayout>
  )
}
