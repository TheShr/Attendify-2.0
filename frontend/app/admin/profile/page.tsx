'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AlertCircle, Users, User, Settings, ShieldCheck } from 'lucide-react'
import { apiJson } from '@/lib/api'

interface AdminProfile {
  user_id: number
  username: string
  role: string
  last_login?: string | null
}

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiJson<AdminProfile>('/admin/profile')
      .then((data) => setProfile(data))
      .catch((err) => setError(err.message || 'Unable to load profile'))
      .finally(() => setLoading(false))
  }, [])

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: <Settings className="h-5 w-5" /> },
    { name: 'Teachers', href: '/admin/teachers', icon: <Users className="h-5 w-5" /> },
    { name: 'Students', href: '/admin/students', icon: <User className="h-5 w-5" /> },
    { name: 'Geofencing', href: '/admin/geofencing', icon: <ShieldCheck className="h-5 w-5" /> },
    { name: 'Profile', href: '/admin/profile', icon: <AlertCircle className="h-5 w-5" />, current: true },
  ]

  const profileDisplay = profile || {
    user_id: 0,
    username: 'admin',
    role: 'admin',
    last_login: null,
  }

  const initials = profileDisplay.username
    .slice(0, 2)
    .toUpperCase()

  return (
    <DashboardLayout title="Profile" userType="admin" navigation={navigation}>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-none shadow-sm lg:col-span-2">
          <CardContent className="space-y-8 p-6 sm:p-8">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <Avatar className="h-20 w-20">
                <AvatarImage src="" alt={profileDisplay.username} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="text-center sm:text-left">
                <h2 className="text-2xl font-semibold text-gray-900">{profileDisplay.username}</h2>
                <p className="text-sm text-muted-foreground">Administrator</p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white/60 p-6 text-sm text-gray-700">Loading profile…</div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadonlyField label="Admin ID" value={String(profileDisplay.user_id)} />
                <ReadonlyField label="Username" value={profileDisplay.username} />
                <ReadonlyField label="Role" value={profileDisplay.role} />
                <ReadonlyField label="Last Login" value={profileDisplay.last_login ? new Date(profileDisplay.last_login).toLocaleString() : 'Not available'} />
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Admin profile is retrieved from the backend and reflects the current authenticated user.
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="space-y-4 p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-gray-900">Account Summary</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p><span className="font-medium text-gray-900">Role:</span> Administrator</p>
              <p><span className="font-medium text-gray-900">User ID:</span> {profileDisplay.user_id}</p>
              <p><span className="font-medium text-gray-900">Last Login:</span> {profileDisplay.last_login ? new Date(profileDisplay.last_login).toLocaleString() : 'Not available'}</p>
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
