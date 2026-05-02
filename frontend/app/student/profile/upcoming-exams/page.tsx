'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Calendar, CheckCircle, Clock, AlertCircle, Newspaper } from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/student', icon: <Calendar className="h-5 w-5" /> },
  { name: 'Attendance', href: '/student/attendance', icon: <CheckCircle className="h-5 w-5" /> },
  { name: 'Schedule', href: '/student/schedule', icon: <Clock className="h-5 w-5" /> },
  { name: 'Profile', href: '/student/profile', icon: <AlertCircle className="h-5 w-5" /> },
  { name: 'Upcoming Exams', href: '/student/profile/upcoming-exams', icon: <Newspaper className="h-5 w-5" />, current: true },
]

const exams = [
  {
    subject: 'Applied Mathematics IV',
    date: '14 Oct 2025',
    time: '09:00 AM - 12:00 PM',
    venue: 'Auditorium A',
  },
  {
    subject: 'Database Management Systems',
    date: '17 Oct 2025',
    time: '01:00 PM - 04:00 PM',
    venue: 'Lab 3',
  },
  {
    subject: 'Operating Systems',
    date: '20 Oct 2025',
    time: '09:00 AM - 12:00 PM',
    venue: 'Hall 2',
  },
  {
    subject: 'Computer Networks',
    date: '23 Oct 2025',
    time: '09:00 AM - 12:00 PM',
    venue: 'Room 204',
  },
  {
    subject: 'Software Engineering',
    date: '26 Oct 2025',
    time: '01:30 PM - 04:30 PM',
    venue: 'Innovation Hub',
  },
]

export default function UpcomingExamsPage() {
  return (
    <DashboardLayout title="Upcoming Exams" userType="student" navigation={navigation}>
      <Card className="border-none shadow-sm">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Exam Datesheet</h2>
              <p className="text-sm text-muted-foreground">
                Stay prepared with your upcoming assessment schedule. Arrive 15 minutes early for seating and verification.
              </p>
            </div>
          </div>

          <Table className="border border-gray-200 rounded-xl bg-white">
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Venue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map((exam) => (
                <TableRow key={exam.subject}>
                  <TableCell className="font-medium text-gray-900">{exam.subject}</TableCell>
                  <TableCell>{exam.date}</TableCell>
                  <TableCell>{exam.time}</TableCell>
                  <TableCell>{exam.venue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableCaption>Dates and venues are subject to change. Check notifications for updates.</TableCaption>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
