'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Users, FileText, BookOpen, AlertCircle } from 'lucide-react'

interface ClassEntry {
  id: number
  class_name: string
  section?: string | null
  schedule_info?: string | null
  student_count?: number | null
}

export default function TeacherClassesPage() {
  const navigation = [
    { name: 'Dashboard', href: '/teacher', icon: <Calendar className="h-5 w-5" /> },
    { name: 'Attendance', href: '/teacher/attendance', icon: <Users className="h-5 w-5" /> },
    { name: 'Classes', href: '/teacher/classes', icon: <BookOpen className="h-5 w-5" />, current: true },
    { name: 'Reports', href: '/teacher/reports', icon: <FileText className="h-5 w-5" /> },
    { name: 'Profile', href: '/teacher/profile', icon: <AlertCircle className="h-5 w-5" /> },
  ]

  const [classes, setClasses] = useState<ClassEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const fetchClasses = async () => {
      try {
        const res = await apiFetch("/api/classes", { cache: "no-store" })
        const json = await res.json()
        if (active && json?.ok) {
          setClasses(json.data ?? [])
        }
      } catch (error) {
        console.error("Unable to load classes", error)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchClasses()
    return () => {
      active = false
    }
  }, [])

  return (
    <DashboardLayout title="My Classes" userType="teacher" navigation={navigation}>
      <Card>
        <CardHeader>
          <CardTitle>Assigned Classes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading your classes...</div>
          ) : classes.length === 0 ? (
            <div className="text-sm text-muted-foreground">No classes assigned yet.</div>
          ) : (
            <div className="grid gap-3">
              {classes.map((cls) => (
                <div key={cls.id} className="rounded-md border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold">{cls.class_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {cls.section ? `Section ${cls.section}` : "Section not set"}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {cls.student_count != null ? `${cls.student_count} students` : "Student count unknown"}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {cls.schedule_info ?? "Schedule not configured"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
