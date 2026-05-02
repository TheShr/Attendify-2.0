'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiJson } from '@/lib/api'
import { User, Users, GraduationCap, Trash2 } from 'lucide-react'

interface AdminUser {
  user_id: number
  username: string
  role: string
  name: string
  email?: string | null
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: <User className="h-5 w-5" /> },
    { name: 'Users', href: '/admin/users', icon: <Users className="h-5 w-5" />, current: true },
    { name: 'Teachers', href: '/admin/teachers', icon: <GraduationCap className="h-5 w-5" /> },
    { name: 'Students', href: '/admin/students', icon: <Users className="h-5 w-5" /> },
    { name: 'Profile', href: '/admin/profile', icon: <User className="h-5 w-5" /> },
  ]

  useEffect(() => {
    apiJson<{ users: AdminUser[] }>('/api/admin/users')
      .then((data) => setUsers(data.users || []))
      .catch((err) => setError(err.message || 'Could not load users'))
      .finally(() => setLoading(false))
  }, [])

  const deleteUser = async (userId: number) => {
    const confirmed = window.confirm('Delete this user and all related data? This cannot be undone.')
    if (!confirmed) return

    setDeletingId(userId)
    try {
      await apiJson(`/api/admin/user/${userId}`, { method: 'DELETE' })
      setUsers((prev) => prev.filter((user) => user.user_id !== userId))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete user')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <DashboardLayout title="Users" userType="admin" navigation={navigation}>
      <Card>
        <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>Loading users…</TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-red-600">{error}</TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>No users found.</TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>{u.name}</TableCell>
                    <TableCell>{u.username}</TableCell>
                    <TableCell>{u.email || '—'}</TableCell>
                    <TableCell>{u.role}</TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteUser(u.user_id)}
                        disabled={deletingId === u.user_id}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
