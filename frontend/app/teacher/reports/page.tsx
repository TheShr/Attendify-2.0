'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Users, FileText, BookOpen, AlertCircle } from 'lucide-react'

interface ReportClass {
  id: number
  class_name: string
  section?: string | null
  schedule_info?: string | null
  student_count?: number | null
}

export default function TeacherReportsPage() {
  const navigation = [
    { name: 'Dashboard', href: '/teacher', icon: <Calendar className="h-5 w-5" /> },
    { name: 'Attendance', href: '/teacher/attendance', icon: <Users className="h-5 w-5" /> },
    { name: 'Classes', href: '/teacher/classes', icon: <BookOpen className="h-5 w-5" /> },
    { name: 'Reports', href: '/teacher/reports', icon: <FileText className="h-5 w-5" />, current: true },
    { name: 'Profile', href: '/teacher/profile', icon: <AlertCircle className="h-5 w-5" /> },
  ]

  const [classes, setClasses] = useState<ReportClass[]>([])
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
        console.error("Unable to load report data", error)
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
    <DashboardLayout title="Reports" userType="teacher" navigation={navigation}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Review attendance performance for your classes below.</p>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {loading ? (
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">Loading report data...</p>
              </CardContent>
            </Card>
          ) : classes.length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">No class data available for reports.</p>
              </CardContent>
            </Card>
          ) : (
            classes.map((cls) => (
              <Card key={cls.id}>
                <CardHeader>
                  <CardTitle>{cls.class_name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {cls.section ? `Section ${cls.section}` : "Section not set"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {cls.schedule_info ?? "No schedule information provided."}
                  </p>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {cls.student_count != null ? `${cls.student_count} enrolled students` : "Student count unavailable"}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
