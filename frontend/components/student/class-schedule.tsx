"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, User } from "lucide-react"
import { apiJson } from "@/lib/api"

interface CourseSchedule {
  course_id: number
  code: string
  name: string
  section?: string
  schedule_info?: string
  teacher_name?: string
  attendance_percent?: number
}

export function ClassSchedule() {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" })
  const [courses, setCourses] = useState<CourseSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    apiJson<CourseSchedule[]>("/student/courses")
      .then((data) => {
        if (!mounted) return
        setCourses(data)
      })
      .catch((err) => {
        if (!mounted) return
        setError(err.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const getStatusBadge = (attendance_percent?: number) => {
    if (attendance_percent === undefined || attendance_percent === null) {
      return <Badge variant="outline">Scheduled</Badge>
    }

    if (attendance_percent >= 90) {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Strong</Badge>
    }

    if (attendance_percent >= 70) {
      return <Badge variant="outline">On track</Badge>
    }

    return <Badge className="bg-yellow-100 text-yellow-800">Attention</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s Schedule</CardTitle>
        <CardDescription>{today} - Your enrolled courses</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div>Loading schedule...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : courses.length === 0 ? (
          <div className="text-muted-foreground">No enrolled courses found.</div>
        ) : (
          <div className="space-y-4">
            {courses.map((course) => (
              <div key={course.course_id} className="p-4 rounded-lg border border-gray-200">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{course.code ?? "Course"}</p>
                    <h3 className="text-lg font-semibold">{course.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {course.section ? `${course.section} · ` : ""}
                      {course.schedule_info ?? "No schedule details available"}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{course.teacher_name ?? "Instructor not assigned"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{course.attendance_percent !== undefined ? `${course.attendance_percent}% attendance` : "Attendance pending"}</span>
                    </div>
                    {getStatusBadge(course.attendance_percent)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
