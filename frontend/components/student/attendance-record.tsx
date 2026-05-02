"use client"

import { useEffect, useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle, XCircle, Clock } from "lucide-react"
import { apiJson } from "@/lib/api"

interface AttendanceRecordProps {
  refreshToken: number
}

interface AttendanceLog {
  id: number
  studentId: number | null
  studentName?: string | null
  username?: string | null
  rollNo?: string | null
  matched: boolean | null
  distance: number | null
  score: number | null
  threshold: number | null
  source: string | null
  createdAt: string
}

interface LatestResponse {
  items: AttendanceLog[]
}

export function AttendanceRecord({ refreshToken }: AttendanceRecordProps) {
  const [records, setRecords] = useState<AttendanceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiJson<LatestResponse>("/attendance/latest")
        if (!cancelled) {
          setRecords(data.items)
        }
      } catch (err) {
        console.error("Failed to load attendance records", err)
        if (!cancelled) {
          setError("Unable to load attendance records")
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

  const getStatusIcon = (status: "present" | "absent" | "pending") => {
    switch (status) {
      case "present":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "absent":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: "present" | "absent" | "pending") => {
    switch (status) {
      case "present":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Present</Badge>
      case "absent":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Absent</Badge>
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
    }
  }

  const resolveStatus = (record: AttendanceLog): "present" | "absent" | "pending" => {
    if (record.matched === null) {
      return "pending"
    }
    return record.matched ? "present" : "absent"
  }

  const resolveStudentLabel = (record: AttendanceLog) => {
    if (record.studentName) {
      return record.studentName
    }
    if (record.username) {
      return record.username
    }
    if (record.studentId != null) {
      return `ID ${record.studentId}`
    }
    return "Unknown"
  }

  const resolveMethod = (record: AttendanceLog) => {
    if (!record.source) {
      return "Unknown"
    }
    return record.source.charAt(0).toUpperCase() + record.source.slice(1)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Attendance</CardTitle>
        <CardDescription>Your attendance record for the past week</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Loading records...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && records.length === 0 && (
          <p className="text-sm text-muted-foreground">No attendance entries yet.</p>
        )}
        {records.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Distance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const status = resolveStatus(record)
                const timestamp = new Date(record.createdAt)
                return (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {timestamp.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{resolveStudentLabel(record)}</span>
                        {record.rollNo && (
                          <span className="text-xs text-muted-foreground">{record.rollNo}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(status)}
                        {getStatusBadge(status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{resolveMethod(record)}</span>
                    </TableCell>
                    <TableCell>
                      {record.distance !== null && record.distance !== undefined
                        ? record.distance.toFixed(4)
                        : "-"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
