'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Users, AlertCircle, CheckCircle, BookOpen, FileText } from 'lucide-react'
import { apiJson } from '@/lib/api'

interface TeacherProfile {
  staff_id: number
  username?: string
  name: string
  email?: string | null
  phone?: string | null
  department?: string | null
  designation?: string | null
}

export default function TeacherProfilePage() {
  const [profile, setProfile] = useState<TeacherProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiJson<TeacherProfile>('/teacher/profile')
      .then((data) => setProfile(data))
      .catch((err) => setError(err.message || 'Unable to load profile'))
      .finally(() => setLoading(false))
  }, [])

  const navigation = [
    { name: 'Dashboard', href: '/teacher', icon: <Users className="h-5 w-5" /> },
    { name: 'Attendance', href: '/teacher/attendance', icon: <CheckCircle className="h-5 w-5" /> },
    { name: 'Classes', href: '/teacher/classes', icon: <BookOpen className="h-5 w-5" /> },
    { name: 'Reports', href: '/teacher/reports', icon: <FileText className="h-5 w-5" /> },
    { name: 'Profile', href: '/teacher/profile', icon: <AlertCircle className="h-5 w-5" />, current: true },
  ]

  const profileDisplay = profile || {
    name: 'Teacher Name',
    username: 'username',
    email: 'not available',
    phone: 'not available',
    department: 'not assigned',
    designation: 'not assigned',
    staff_id: 0,
  }

  const initials = profileDisplay.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const details = [
    { label: 'Email', value: profileDisplay.email || 'Not provided' },
    { label: 'Phone', value: profileDisplay.phone || 'Not provided' },
    { label: 'Department', value: profileDisplay.department || 'Not provided' },
    { label: 'Designation', value: profileDisplay.designation || 'Not provided' },
  ]

  return (
    <DashboardLayout title="Profile" userType="teacher" navigation={navigation}>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-none shadow-sm lg:col-span-2">
          <CardContent className="space-y-8 p-6 sm:p-8">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <Avatar className="h-20 w-20">
                <AvatarImage src="" alt={profileDisplay.name} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="text-center sm:text-left">
                <h2 className="text-2xl font-semibold text-gray-900">{profileDisplay.name}</h2>
                <p className="text-sm text-muted-foreground">{profileDisplay.email || 'Email not available'}</p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white/60 p-6 text-sm text-gray-700">Loading profile…</div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {details.map((item) => (
                  <ReadonlyField key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              This profile is loaded directly from the database. Updates are managed by your institution.
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="space-y-4 p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-gray-900">Account Summary</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p><span className="font-medium text-gray-900">Role:</span> Teacher</p>
              <p><span className="font-medium text-gray-900">Username:</span> {profileDisplay.username}</p>
              <p><span className="font-medium text-gray-900">Department:</span> {profileDisplay.department}</p>
              <p><span className="font-medium text-gray-900">Designation:</span> {profileDisplay.designation}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-xl border border-dashed border-gray-200 bg-white/60 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-gray-900">{value}</div>
    </div>
  )
}
