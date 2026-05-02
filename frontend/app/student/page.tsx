"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AttendanceOverview } from "@/components/student/attendance-overview"
import { ClassSchedule } from "@/components/student/class-schedule"
import { AttendanceRecord } from "@/components/student/attendance-record"
import { LocationStatus } from "@/components/student/location-status"
import { Calendar, Clock, CheckCircle, AlertCircle, Newspaper, TrendingUp } from "lucide-react"
import { apiJson } from "@/lib/api"

const navigation = [
  { name: "Dashboard", href: "/student", icon: <Calendar className="h-4 w-4" />, current: true },
  { name: "Attendance", href: "/student/attendance", icon: <CheckCircle className="h-4 w-4" /> },
  { name: "Schedule", href: "/student/schedule", icon: <Clock className="h-4 w-4" /> },
  { name: "Profile", href: "/student/profile", icon: <AlertCircle className="h-4 w-4" /> },
  { name: "Upcoming Exams", href: "/student/profile/upcoming-exams", icon: <Newspaper className="h-4 w-4" /> },
]

interface StudentStats {
  overall_attendance: number
  classes_attended: number
  total_classes: number
  this_week_attended: number
  this_week_total: number
  streak: number
}

const statConfig = [
  { key: "overall_attendance", title: "Overall Attendance", format: (v: number) => `${v}%`, helper: "This semester", icon: TrendingUp, color: "#3b82f6", bg: "#eff6ff" },
  { key: "classes_attended", title: "Classes Attended", format: (v: number) => `${v}`, helper: (s: StudentStats) => `Out of ${s.total_classes} total`, icon: Calendar, color: "#10b981", bg: "#f0fdf4" },
  { key: "this_week_attended", title: "This Week", format: (v: number, s: StudentStats) => `${v}/${s.this_week_total}`, helper: "Classes attended", icon: Clock, color: "#f59e0b", bg: "#fffbeb" },
  { key: "streak", title: "Streak", format: (v: number) => `${v} days`, helper: "Consecutive attendance", icon: CheckCircle, color: "#8b5cf6", bg: "#f5f3ff" },
]

export default function StudentDashboard() {
  const [stats, setStats] = useState<StudentStats | null>(null)

  useEffect(() => {
    apiJson<StudentStats>("/student/stats")
      .then(d => setStats(d))
      .catch(() => {})
  }, [])

  return (
    <DashboardLayout title="Student Dashboard" userType="student" navigation={navigation}>
      <div className="space-y-6">
        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statConfig.map((s) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawVal = stats ? (stats as any)[s.key] : null
            const displayVal = rawVal != null && stats ? s.format(rawVal, stats) : "—"
            const helperText = typeof s.helper === "function" ? (stats ? s.helper(stats) : "—") : s.helper
            return (
              <div key={s.title} style={{background:"white",border:"1px solid #e8edf5",borderRadius:12,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
                  <div>
                    <p style={{fontSize:11,fontWeight:600,color:"#6b7a99",textTransform:"uppercase",letterSpacing:"0.07em"}}>{s.title}</p>
                    <p style={{fontSize:30,fontWeight:700,color:"#111827",marginTop:6,fontFamily:"'DM Serif Display', serif",letterSpacing:"-0.5px"}}>{displayVal}</p>
                    <p style={{fontSize:12,color:"#9ca3b8",marginTop:4}}>{helperText}</p>
                  </div>
                  <span style={{width:38,height:38,borderRadius:10,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",color:s.color,flexShrink:0}}>
                    <s.icon size={17} />
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Attendance warning banner */}
        {stats && stats.overall_attendance < 75 && (
          <div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
            <AlertCircle size={16} color="#f97316" />
            <span style={{fontSize:13,color:"#c2410c",fontWeight:500}}>
              Your attendance is below 75%. You may be barred from exams. Please attend classes regularly.
            </span>
          </div>
        )}

        {/* Main content grid */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <AttendanceOverview refreshToken={0} />
            <AttendanceRecord refreshToken={0} />
          </div>
          <div className="space-y-6 lg:col-span-4">
            <LocationStatus />
            <ClassSchedule />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
