'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ClassSchedule } from '@/components/student/class-schedule'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, CheckCircle, Clock, AlertCircle, Newspaper } from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/student', icon: <Calendar className="h-5 w-5" /> },
  { name: 'Attendance', href: '/student/attendance', icon: <CheckCircle className="h-5 w-5" /> },
  { name: 'Schedule', href: '/student/schedule', icon: <Clock className="h-5 w-5" />, current: true },
  { name: 'Profile', href: '/student/profile', icon: <AlertCircle className="h-5 w-5" /> },
  { name: 'Upcoming Exams', href: '/student/profile/upcoming-exams', icon: <Newspaper className="h-5 w-5" /> },
]

export default function StudentSchedulePage(): JSX.Element {
  return (
    <DashboardLayout
      title="Schedule"
      userType="student"
      navigation={navigation}
    >
      <div className="space-y-8">
        <Card className="border-none shadow-sm">
          <CardContent className="space-y-4 p-6 sm:p-8">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Weekly Timetable</h2>
              <p className="text-sm text-muted-foreground">Review your upcoming classes and stay ahead of the schedule.</p>
            </div>
            <ClassSchedule />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
