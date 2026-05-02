"use client"

import { useEffect, useMemo, useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { apiJson } from "@/lib/api"

interface AttendanceOverviewProps {
  refreshToken: number
}

interface SubjectSummary {
  subjectId: string
  attendance: number
  present: number
  total: number
}

interface SummaryResponse {
  subjects: SubjectSummary[]
  overall: {
    present: number
    total: number
    attendance: number
  }
}

export function AttendanceOverview({ refreshToken }: AttendanceOverviewProps) {
  const [subjects, setSubjects] = useState<SubjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiJson<SummaryResponse>('/attendance/summary')
        if (!cancelled) {
          setSubjects(data.subjects)
        }
      } catch (err) {
        console.error('Failed to load attendance summary', err)
        if (!cancelled) {
          setError('Unable to load attendance summary')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [refreshToken])

  const derivedSubjects = useMemo(() => {
    return subjects.map((subject) => {
      const trend = subject.attendance >= 90 ? 'up' : subject.attendance <= 75 ? 'down' : 'stable'
      const status = subject.attendance >= 90 ? 'excellent' : subject.attendance >= 80 ? 'good' : subject.attendance >= 70 ? 'fair' : 'poor'
      return {
        ...subject,
        trend,
        status,
      }
    })
  }, [subjects])

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-500" />
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-500" />
      default:
        return <Minus className="h-3 w-3 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'excellent':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Excellent</Badge>
      case 'good':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Good</Badge>
      case 'fair':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Fair</Badge>
      case 'poor':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Poor</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance Overview</CardTitle>
        <CardDescription>Your attendance performance across all subjects</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Loading summary...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && derivedSubjects.length === 0 && (
          <p className="text-sm text-muted-foreground">No attendance records yet.</p>
        )}
        <div className="space-y-6">
          {derivedSubjects.map((subject) => (
            <div key={subject.subjectId} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm">{subject.subjectId}</h3>
                  {getTrendIcon(subject.trend)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{subject.attendance}%</span>
                  {getStatusBadge(subject.status)}
                </div>
              </div>
              <Progress value={subject.attendance} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {subject.present}/{subject.total} records marked present
                </span>
                <span>{Math.max(subject.total - subject.present, 0)} missed</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

