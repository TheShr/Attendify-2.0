"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { GeofenceManagement } from "@/components/admin/geofence-management"
import { Users, UserCheck, GraduationCap, Settings, MapPin } from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/admin", icon: <Settings className="h-5 w-5" /> },
  { name: "Users", href: "/admin/users", icon: <Users className="h-5 w-5" /> },
  { name: "Teachers", href: "/admin/teachers", icon: <UserCheck className="h-5 w-5" /> },
  { name: "Students", href: "/admin/students", icon: <GraduationCap className="h-5 w-5" /> },
  { name: "Geofencing", href: "/admin/geofencing", icon: <MapPin className="h-5 w-5" />, current: true },
  { name: "Profile", href: "/admin/profile", icon: <Settings className="h-5 w-5" /> },
]

export default function GeofencingPage() {
  return (
    <DashboardLayout title="Geofencing Management" userType="admin" navigation={navigation}>
      <GeofenceManagement />
    </DashboardLayout>
  )
}
