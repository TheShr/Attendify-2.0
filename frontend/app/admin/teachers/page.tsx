'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiJson } from '@/lib/api'
import { User, Users, GraduationCap } from 'lucide-react'

interface AdminTeacher {
  staff_id: number
  name: string
  email?: string | null
  department?: string | null
  designation?: string | null
}

export default function AdminTeachersPage() {
  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: <User className="h-5 w-5" /> },
    { name: 'Users', href: '/admin/users', icon: <Users className="h-5 w-5" /> },
    { name: 'Teachers', href: '/admin/teachers', icon: <GraduationCap className="h-5 w-5" />, current: true },
    { name: 'Students', href: '/admin/students', icon: <Users className="h-5 w-5" /> },
    { name: 'Profile', href: '/admin/profile', icon: <User className="h-5 w-5" /> },
  ]

  const [teachers, setTeachers] = useState<AdminTeacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiJson<{ teachers: AdminTeacher[] }>('/api/admin/teachers')
      .then((data) => setTeachers(data.teachers || []))
      .catch((err) => setError(err.message || 'Could not load teachers'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <DashboardLayout title="Teachers" userType="admin" navigation={navigation}>
      <Card>
        <CardHeader><CardTitle>Teacher Directory</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading teachers…</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : teachers.length === 0 ? (
            <div className="text-sm text-muted-foreground">No teachers found.</div>
          ) : (
            <ul className="space-y-2">
              {teachers.map((t) => (
                <li key={t.staff_id} className="border rounded-md p-3">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-sm text-muted-foreground">{t.department || 'No department'}</div>
                  <div className="text-sm text-muted-foreground">{t.designation || 'No title'}</div>
                  <div className="text-sm text-muted-foreground">{t.email || 'No email'}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
