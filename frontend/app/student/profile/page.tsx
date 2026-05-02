'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, CheckCircle, Clock, AlertCircle, Newspaper } from 'lucide-react'
import { apiJson } from '@/lib/api'

interface StudentProfile {
  student_id: number
  roll_no: string
  name: string
  class_code: string
  email?: string | null
  phone?: string | null
  face_enrolled: boolean
}

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiJson<StudentProfile>('/student/profile')
      .then((data) => setProfile(data))
      .catch((err) => setError(err.message || 'Unable to load profile'))
      .finally(() => setLoading(false))
  }, [])

  const navigation = [
    { name: 'Dashboard', href: '/student', icon: <Calendar className="h-5 w-5" /> },
    { name: 'Attendance', href: '/student/attendance', icon: <CheckCircle className="h-5 w-5" /> },
    { name: 'Schedule', href: '/student/schedule', icon: <Clock className="h-5 w-5" /> },
    { name: 'Profile', href: '/student/profile', icon: <AlertCircle className="h-5 w-5" />, current: true },
    { name: 'Upcoming Exams', href: '/student/profile/upcoming-exams', icon: <Newspaper className="h-5 w-5" /> },
  ]

  const profileDisplay = profile || {
    student_id: 0,
    name: 'Student Name',
    email: 'not available',
    phone: 'not available',
    class_code: 'N/A',
    roll_no: 'N/A',
    face_enrolled: false,
  }

  const initials = profileDisplay.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const details = [
    { label: 'Student ID', value: String(profileDisplay.student_id ?? '—') },
    { label: 'Roll No', value: profileDisplay.roll_no },
    { label: 'Class Code', value: profileDisplay.class_code },
    { label: 'Phone', value: profileDisplay.phone || 'Not provided' },
    { label: 'Email', value: profileDisplay.email || 'Not provided' },
  ]

  return (
    <DashboardLayout title="Profile" userType="student" navigation={navigation}>
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
                <p className="text-sm text-muted-foreground">{profileDisplay.email || 'Profile email not available'}</p>
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
              <p><span className="font-medium text-gray-900">Role:</span> Student</p>
              <p><span className="font-medium text-gray-900">Roll Number:</span> {profileDisplay.roll_no}</p>
              <p><span className="font-medium text-gray-900">Class Code:</span> {profileDisplay.class_code}</p>
              <p><span className="font-medium text-gray-900">Face Enrolled:</span> {profileDisplay.face_enrolled ? 'Yes' : 'No'}</p>
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
