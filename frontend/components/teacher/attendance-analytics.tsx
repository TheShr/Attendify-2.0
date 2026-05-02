"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { TrendingUp, Users, Clock, CheckCircle } from "lucide-react"

export function AttendanceAnalytics() {
  // Mock data for analytics
  const weeklyData = [
    { day: "Mon", present: 42, total: 45 },
    { day: "Tue", present: 38, total: 45 },
    { day: "Wed", present: 44, total: 45 },
    { day: "Thu", present: 40, total: 45 },
    { day: "Fri", present: 43, total: 45 },
  ]

  const attendanceByMethod = [
    { method: "Face Recognition", count: 156, color: "#3b82f6" },
    { method: "Manual Entry", count: 23, color: "#10b981" },
    { method: "Late Arrival", count: 12, color: "#f59e0b" },
  ]

  const classPerformance = [
    { class: "CS101", attendance: 92, trend: "up" },
    { class: "MATH201", attendance: 85, trend: "stable" },
    { class: "PHY301", attendance: 78, trend: "down" },
  ]

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b"]

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Average</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">91%</div>
            <p className="text-xs text-muted-foreground">+3% from last week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Face Recognition</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87%</div>
            <p className="text-xs text-muted-foreground">Success rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manual Entries</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Attendance Trend</CardTitle>
            <CardDescription>Daily attendance numbers for this week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="present" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance by Method</CardTitle>
            <CardDescription>How students were marked present</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={attendanceByMethod}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ method, count }) => `${method}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {attendanceByMethod.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Class Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Class Performance</CardTitle>
          <CardDescription>Attendance rates across different classes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {classPerformance.map((cls, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{cls.class}</h3>
                    <Badge
                      variant={cls.trend === "up" ? "default" : cls.trend === "down" ? "destructive" : "secondary"}
                    >
                      {cls.trend === "up" ? "↗" : cls.trend === "down" ? "↘" : "→"} {cls.trend}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium">{cls.attendance}%</span>
                </div>
                <Progress value={cls.attendance} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
