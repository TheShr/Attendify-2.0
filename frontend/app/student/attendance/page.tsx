"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AttendanceOverview } from "@/components/student/attendance-overview"
import { AttendanceRecord } from "@/components/student/attendance-record"
import { Calendar, CheckCircle, Clock, AlertCircle, Newspaper, MapPin, Loader } from "lucide-react"
import { apiFetch } from "@/lib/api"

const navigation = [
  { name: "Dashboard", href: "/student", icon: <Calendar className="h-4 w-4" /> },
  { name: "Attendance", href: "/student/attendance", icon: <CheckCircle className="h-4 w-4" />, current: true },
  { name: "Schedule", href: "/student/schedule", icon: <Clock className="h-4 w-4" /> },
  { name: "Profile", href: "/student/profile", icon: <AlertCircle className="h-4 w-4" /> },
  { name: "Upcoming Exams", href: "/student/profile/upcoming-exams", icon: <Newspaper className="h-4 w-4" /> },
]

export default function StudentAttendancePage() {
  const [refreshToken, setRefreshToken] = useState(0)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [checkInResult, setCheckInResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleCheckIn = async () => {
    setIsCheckingIn(true)
    setCheckInResult(null)
    try {
      const gps = await new Promise<{ lat: number; lng: number }>((resolve) =>
        navigator.geolocation
          ? navigator.geolocation.getCurrentPosition(
              (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
              () => resolve({ lat: 0, lng: 0 })
            )
          : resolve({ lat: 0, lng: 0 })
      )

      const response = await apiFetch("/api/attendance/checkin", {
        method: "POST",
        body: JSON.stringify({ gps }),
      })
      const data = await response.json()

      if (!response.ok) {
        setCheckInResult({ success: false, message: data?.error || data?.message || "Check-in failed." })
      } else {
        setCheckInResult({ success: true, message: data?.message || "Checked in successfully!" })
        setRefreshToken((t) => t + 1)
      }
    } catch {
      setCheckInResult({ success: false, message: "Unable to connect. Please try again." })
    } finally {
      setIsCheckingIn(false)
    }
  }

  return (
    <DashboardLayout title="My Attendance" userType="student" navigation={navigation}>
      <div className="space-y-6">
        {/* Check-in card */}
        <div style={{background:"white",border:"1px solid #e8edf5",borderRadius:12,padding:24,boxShadow:"0 1px 3px rgba(0,0,0,0.04)",display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:16}}>
          <div>
            <p style={{fontSize:16,fontWeight:700,color:"#111827"}}>Mark Today&apos;s Attendance</p>
            <p style={{fontSize:13,color:"#6b7a99",marginTop:3}}>
              Your GPS location will be verified against the active geofence zone.
            </p>
            {checkInResult && (
              <p style={{fontSize:13,marginTop:8,color:checkInResult.success?"#10b981":"#ef4444",fontWeight:500}}>
                {checkInResult.success ? "✓" : "⚠"} {checkInResult.message}
              </p>
            )}
          </div>
          <button
            onClick={handleCheckIn}
            disabled={isCheckingIn}
            style={{padding:"11px 22px",background:isCheckingIn?"#f1f5f9":"linear-gradient(135deg,#3b82f6,#6366f1)",border:"none",borderRadius:10,color:isCheckingIn?"#9ca3b8":"white",fontSize:14,fontWeight:600,cursor:isCheckingIn?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:8,transition:"opacity 0.2s",minWidth:160,justifyContent:"center"}}
          >
            {isCheckingIn ? <><Loader size={14} style={{animation:"spin 0.7s linear infinite"}}/> Locating…</> : <><MapPin size={14}/> GPS Check-in</>}
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <AttendanceOverview refreshToken={refreshToken} />
          <AttendanceRecord refreshToken={refreshToken} />
        </div>
      </div>
    </DashboardLayout>
  )
}
