"use client"

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Upload, CheckCircle, ImagePlus } from "lucide-react"

interface StudentEntry {
  id: number
  name: string
  roll_no?: string | null
  face_enrolled?: boolean
}

interface StudentFaceEnrollmentProps {
  classId?: number | null
}

export function StudentFaceEnrollment({ classId }: StudentFaceEnrollmentProps) {
  const [students, setStudents] = useState<StudentEntry[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!classId) {
      setStudents([])
      setSelectedStudentId(null)
      return
    }

    let active = true
    const fetchStudents = async () => {
      setError(null)
      setMessage(null)
      try {
        const res = await apiFetch(`/api/class-students?class_id=${classId}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`Unable to load class students (${res.status})`)
        const payload = await res.json()
        if (!payload?.ok) throw new Error(payload?.error ?? "Invalid student data")
        const studentList = Array.isArray(payload.data?.students) ? payload.data.students : []
        if (!active) return
        setStudents(studentList)
        if (studentList.length > 0) setSelectedStudentId(studentList[0].id)
      } catch (err: unknown) {
        if (!active) return
        setError(err instanceof Error ? err.message : String(err))
        setStudents([])
        setSelectedStudentId(null)
      }
    }
    fetchStudents()
    return () => { active = false }
  }, [classId])

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [students, selectedStudentId]
  )

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    setMessage(null)
    setError(null)
    const chosen = event.target.files ? Array.from(event.target.files) : []
    const validImages = chosen.filter((file) => file.type.startsWith("image/"))
    if (!validImages.length) {
      setFiles([])
      setError("Please select at least one image file.")
      return
    }
    setFiles(validImages.slice(0, 3))
  }

  async function handleEnroll(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    setError(null)

    if (!classId) {
      setError("Please select a class before enrolling a student.")
      return
    }
    if (!selectedStudentId) {
      setError("Please choose a student to enroll.")
      return
    }
    if (files.length === 0) {
      setError("Please upload at least one face photo for enrollment.")
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      files.forEach((file, index) => {
        formData.append("image", file, file.name)
        formData.append("label", index === 0 ? "frontal" : `angle-${index + 1}`)
      })

      const res = await apiFetch(`/api/teacher/student/${selectedStudentId}/enroll`, {
        method: "POST",
        body: formData,
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || "Enrollment failed")
      }

      const successText = payload?.message
        ? `${payload.message} for ${selectedStudent?.name || "student"}.`
        : `Face enrollment complete for ${selectedStudent?.name || "student"}.`
      setMessage(successText)
      setFiles([])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Student Face Enrollment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!classId ? (
          <p className="text-sm text-muted-foreground">Select a class above to load enrolled students and enroll faces.</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students found in this class yet.</p>
        ) : (
          <form onSubmit={handleEnroll} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="student-select">Student</Label>
                <Select value={selectedStudentId ? String(selectedStudentId) : ""} onValueChange={(value) => setSelectedStudentId(Number(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={String(student.id)}>
                        {student.name} {student.roll_no ? `(${student.roll_no})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Enrollment Status</Label>
                <div className="flex items-center gap-2">
                  <Badge variant={selectedStudent?.face_enrolled ? "secondary" : "outline"} className="uppercase text-xs">
                    {selectedStudent?.face_enrolled ? "Face enrolled" : "Not enrolled"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="face-images">Face Images</Label>
              <Input id="face-images" type="file" accept="image/*" multiple onChange={handleFilesChange} />
              <p className="text-xs text-muted-foreground">Upload up to 3 images for different angles. JPG/PNG/WebP only.</p>
            </div>

            {files.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-3">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="rounded-lg border p-2">
                    <p className="text-xs font-medium">Photo {index + 1}</p>
                    <p className="truncate text-xs text-muted-foreground">{file.name}</p>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-green-600">{message}</p>}

            <Button type="submit" disabled={loading || !selectedStudentId || files.length === 0}>
              {loading ? "Enrolling…" : "Enroll Face"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
