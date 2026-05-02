'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiJson } from '@/lib/api'
import { User, Users, GraduationCap } from 'lucide-react'

interface AdminStudent {
  student_id: number
  roll_no: string
  name: string
  email?: string | null
  class_code: string
}

export default function AdminStudentsPage() {
  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: <User className="h-5 w-5" /> },
    { name: 'Users', href: '/admin/users', icon: <Users className="h-5 w-5" /> },
    { name: 'Teachers', href: '/admin/teachers', icon: <GraduationCap className="h-5 w-5" /> },
    { name: 'Students', href: '/admin/students', icon: <Users className="h-5 w-5" />, current: true },
    { name: 'Profile', href: '/admin/profile', icon: <User className="h-5 w-5" /> },
  ]

  const [students, setStudents] = useState<AdminStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiJson<{ students: AdminStudent[] }>('/api/admin/students')
      .then((data) => setStudents(data.students || []))
      .catch((err) => setError(err.message || 'Could not load students'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <DashboardLayout title="Students" userType="admin" navigation={navigation}>
      <Card>
        <CardHeader><CardTitle>Student Directory</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading students…</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : students.length === 0 ? (
            <div className="text-sm text-muted-foreground">No students found.</div>
          ) : (
            <ul className="space-y-2">
              {students.map((s) => (
                <li key={s.student_id} className="border rounded-md p-3">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-sm text-muted-foreground">{s.roll_no} · {s.class_code}</div>
                  <div className="text-sm text-muted-foreground">{s.email || 'No email'}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
