"use client"

import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { apiJson } from "@/lib/api"
import { CalendarClock, CheckCircle2, Search, Users } from "lucide-react"

export interface ManualAttendanceSummary {
  classId: number
  date: string
  time: string
  saved: number
  statusSummary: Record<string, number>
}

interface ManualAttendanceProps {
  classId: string | number | null
  onSubmit?: (summary: ManualAttendanceSummary) => void
}

interface StudentOption {
  studentId: number
  name: string
  rollNo?: string | null
  email?: string | null
  username?: string | null
}

type SelectionMap = Record<number, "present" | "late">

function getDefaultDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function getDefaultTime(): string {
  const now = new Date()
  return now.toISOString().slice(11, 16)
}

function ManualAttendance({ classId, onSubmit }: ManualAttendanceProps) {
  const { toast } = useToast()
  const [students, setStudents] = useState<StudentOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selection, setSelection] = useState<SelectionMap>({})
  const [attendanceDate, setAttendanceDate] = useState(getDefaultDate)
  const [attendanceTime, setAttendanceTime] = useState(getDefaultTime)
  const [isSaving, setIsSaving] = useState(false)

  const numericClassId = useMemo(() => {
    if (classId === null || classId === undefined) {
      return null
    }
    if (typeof classId === "number") {
      return Number.isFinite(classId) ? classId : null
    }
    const trimmed = classId.trim()
    if (!trimmed) {
      return null
    }
    const value = Number(trimmed)
    return Number.isFinite(value) ? value : null
  }, [classId])

  useEffect(() => {
    let active = true
    const fetchStudents = async () => {
      if (numericClassId == null) {
        setStudents([])
        setSelection({})
        setLoadError(null)
        return
      }
      setIsLoading(true)
      setLoadError(null)
      try {
        const payload = await apiJson<{ ok: boolean; data?: { students: StudentOption[] } }>(
          `/api/classes?class_id=${numericClassId}&with_students=1`,
        )
        if (!active) return
        const studentsData = payload.data?.students ?? []
        setStudents(studentsData)
        setSelection({})
      } catch (error) {
        console.error("Unable to load enrolled students for the selected class.", error)
        if (!active) return
        setLoadError("Unable to load enrolled students for the selected class.")
        setStudents([])
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    fetchStudents()
    return () => {
      active = false
    }
  }, [numericClassId])

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return students
    return students.filter((student) => {
      const roll = student.rollNo ?? ""
      const username = student.username ?? ""
      return (
        student.name.toLowerCase().includes(term) ||
        roll.toLowerCase().includes(term) ||
        username.toLowerCase().includes(term)
      )
    })
  }, [students, searchTerm])

  const presentCount = useMemo(() => {
    return Object.keys(selection).length
  }, [selection])

  const lateCount = useMemo(() => {
    return Object.values(selection).filter((status) => status === "late").length
  }, [selection])

  const handleToggleStudent = (studentId: number, value: boolean | "indeterminate") => {
    const isChecked = value === true
    setSelection((prev) => {
      const next = { ...prev }
      if (isChecked) {
        next[studentId] = next[studentId] ?? "present"
      } else {
        delete next[studentId]
      }
      return next
    })
  }

  const handleStatusChange = (studentId: number, status: "present" | "late") => {
    setSelection((prev) => ({ ...prev, [studentId]: status }))
  }

  const handleSubmit = async () => {
    if (numericClassId == null || students.length === 0) {
      return
    }
    setIsSaving(true)
    try {
      const records = students.map((student) => {
        const status = selection[student.studentId] ?? "absent"
        return {
          studentId: student.studentId,
          status,
        }
      })

      const payload = {
        classId: numericClassId,
        date: attendanceDate,
        time: attendanceTime,
        records,
      }

      const response = await apiJson<ManualAttendanceSummary>("/attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      toast({
        title: "Attendance saved",
        description: `Recorded attendance for ${response.saved} students`,
      })
      onSubmit?.(response)
    } catch (error) {
      console.error("Error saving manual attendance", error)
      toast({
        title: "Unable to save attendance",
        description: "Please try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const hasClassSelected = numericClassId != null
  const totalStudents = students.length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          Manual Attendance
        </CardTitle>
        <CardDescription>Review enrolled students and record attendance manually</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasClassSelected && (
          <div className="rounded-md bg-muted/30 border border-dashed border-muted-foreground/40 px-3 py-2 text-sm text-muted-foreground">
            Select a class to load enrolled students.
          </div>
        )}

        {loadError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {loadError}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="attendance-date">Attendance Date</Label>
            <Input
              id="attendance-date"
              type="date"
              value={attendanceDate}
              onChange={(event) => setAttendanceDate(event.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="attendance-time">Time</Label>
            <Input
              id="attendance-time"
              type="time"
              value={attendanceTime}
              onChange={(event) => setAttendanceTime(event.target.value)}
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="student-search">Search Students</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="student-search"
              placeholder="Search by name, roll number, or username"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-8"
              disabled={!hasClassSelected}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {totalStudents} students
          </div>
          <Badge variant="secondary">Present: {presentCount}</Badge>
          {lateCount > 0 && <Badge variant="outline">Late: {lateCount}</Badge>}
        </div>

        <ScrollArea className="h-72 rounded-md border">
          <div className="divide-y">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading students?</div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No students found for this class.</div>
            ) : (
              filteredStudents.map((student) => {
                const isSelected = student.studentId in selection
                const status = selection[student.studentId] ?? "present"
                return (
                  <div key={student.studentId} className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <div className="font-medium">{student.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {student.rollNo ? `Roll: ${student.rollNo}` : student.username ? `User: ${student.username}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(value) => handleToggleStudent(student.studentId, value)}
                          id={`present-${student.studentId}`}
                          disabled={isSaving}
                        />
                        <Label htmlFor={`present-${student.studentId}`}>Present</Label>
                      </div>
                      {isSelected && (
                        <Select value={status} onValueChange={(value) => handleStatusChange(student.studentId, value as "present" | "late")} disabled={isSaving}>
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">On time</SelectItem>
                            <SelectItem value="late">Late</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!hasClassSelected || students.length === 0 || isSaving}
          className="w-full"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          {isSaving ? "Saving?" : "Save Attendance"}
        </Button>
      </CardContent>
    </Card>
  )
}
export default ManualAttendance;
export { ManualAttendance };
