"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiJson } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Calendar, Clock, CheckCircle, Loader2 } from "lucide-react";

// NOTE: Default import (fixes "Element type is invalid" if component exports default)
import AttendanceSession from "@/components/teacher/attendance-session";

interface ClassRow {
  id: number;
  class_name: string;
  section: string | null;
  subject: string | null;
  schedule_info: string | null;
  created_at: string;
  student_count: number;
}

interface StudentRow {
  id: number;
  name: string;
  roll_no: string | null;
  email: string | null;
}

const navigation = [
  { name: "Dashboard", href: "/teacher", icon: <Users className="h-5 w-5" /> },
  { name: "Attendance", href: "/teacher/attendance", icon: <CheckCircle className="h-5 w-5" />, current: true },
  { name: "Classes", href: "/teacher/classes", icon: <Calendar className="h-5 w-5" /> },
  { name: "Reports", href: "/teacher/reports", icon: <Clock className="h-5 w-5" /> },
  { name: "Profile", href: "/teacher/profile", icon: <Loader2 className="h-5 w-5" /> },
];

export default function AttendancePage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<number, "present" | "absent">>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadClasses() {
      setClassesLoading(true);
      try {
        const res = await apiFetch("/api/classes");
        if (!res.ok) throw new Error(`Failed to load classes (${res.status})`);
        const payload = await res.json();
        if (!payload?.ok) throw new Error(payload?.error ?? "Failed to load classes");
        if (!Array.isArray(payload.data)) throw new Error("Invalid classes payload");
        if (active) {
          setClasses(payload.data);
          setSelectedClassId((prev) => {
            if (prev) return prev;
            if (payload.data.length === 1) return String(payload.data[0].id);
            return prev;
          });
        }
      } catch (err: unknown) {
        if (active) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(err);
          setError(message || "Unable to load classes");
        }
      } finally {
        if (active) setClassesLoading(false);
      }
    }
    loadClasses();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setMarks({});
      return;
    }
    let active = true;
    async function loadStudents() {
      setStudentsLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const res = await apiFetch(`/api/classes?class_id=${selectedClassId}&with_students=1`);
        if (!res.ok) throw new Error(`Failed to load students (${res.status})`);
        const payload = await res.json();
        if (!payload?.ok) throw new Error(payload?.error ?? "Failed to load students");
        if (!payload?.data?.students || !Array.isArray(payload.data.students)) {
          throw new Error("Invalid students payload");
        }
        if (active) {
          const studentRows: StudentRow[] = payload.data.students;
          setStudents(studentRows);
          setMarks(() => {
            const next: Record<number, "present" | "absent"> = {};
            for (const student of studentRows) next[student.id] = "absent";
            return next;
          });
        }
      } catch (err: unknown) {
        if (active) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(err);
          setError(message || "Unable to load students");
          setStudents([]);
          setMarks({});
        }
      } finally {
        if (active) setStudentsLoading(false);
      }
    }
    loadStudents();
    return () => {
      active = false;
    };
  }, [selectedClassId]);

  const presentCount = useMemo(
    () => students.reduce((acc, s) => acc + (marks[s.id] === "present" ? 1 : 0), 0),
    [students, marks]
  );
  const absentCount = students.length - presentCount;

  const handleMarkAll = (status: "present" | "absent") => {
    const next: Record<number, "present" | "absent"> = {};
    for (const student of students) next[student.id] = status;
    setMarks(next);
  };

  const handleSubmit = async () => {
    if (!selectedClassId) return setError("Please select a class before saving attendance.");
    if (!date) return setError("Please choose a date for this attendance record.");
    if (!students.length) return setError("There are no students enrolled in this class.");

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const classId = Number(selectedClassId);
      const payload = {
        class_id: classId,
        date,
        items: students.map((student) => ({
          student_id: student.id,
          status: marks[student.id] ?? "absent",
          time: null,
          recognized_name: null,
        })),
      };
      const data = await apiJson<{ ok: boolean; error?: string; inserted?: number }>("/api/attendance/history", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!data.ok) throw new Error(data.error ?? "Failed to save attendance");
      setSuccess(`Saved ${data.inserted ?? students.length} attendance record(s).`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(err);
      setError(message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Attendance Management" userType="teacher" navigation={navigation}>
      <div className="space-y-6">
        {/* Facial Attendance (top) */}
        <AttendanceSession />

        {/* Controls */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Attendance Management</h2>
            <p className="text-sm text-muted-foreground">
              Select a class, choose a date, and mark students as present or absent.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="grid gap-1">
              <Label htmlFor="attendance-date">Date</Label>
              <Input
                id="attendance-date"
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setSuccess(null);
                }}
                className="w-full md:w-44"
              />
            </div>
            <div className="grid gap-1">
              <Label>Class</Label>
              <Select
                value={selectedClassId ?? ""}
                onValueChange={(value) => setSelectedClassId(value || undefined)}
                disabled={classesLoading || !classes.length}
              >
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder={classesLoading ? "Loading classes..." : "Select a class"} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={String(cls.id)}>
                      {cls.class_name}{cls.section ? ` - ${cls.section}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg">Enrolled Students</CardTitle>
              <p className="text-sm text-muted-foreground">
                {studentsLoading
                  ? "Fetching students..."
                  : students.length
                  ? `${students.length} student${students.length === 1 ? "" : "s"} enrolled`
                  : "No students enrolled for this class"}
              </p>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="text-sm text-muted-foreground">
                Present: <span className="font-medium text-foreground">{presentCount}</span> - Absent:
                <span className="ml-1 font-medium text-foreground">{Math.max(absentCount, 0)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleMarkAll("present")} disabled={!students.length}>
                  Mark all Present
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleMarkAll("absent")} disabled={!students.length}>
                  Mark all Absent
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {studentsLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading students...
              </div>
            ) : students.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Roll</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="w-40 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-mono text-xs uppercase text-muted-foreground">
                        {student.roll_no || "—"}
                      </TableCell>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {student.email || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            type="button"
                            variant={marks[student.id] === "present" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setMarks((prev) => ({ ...prev, [student.id]: "present" }))}
                          >
                            Present
                          </Button>
                          <Button
                            type="button"
                            variant={marks[student.id] === "absent" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setMarks((prev) => ({ ...prev, [student.id]: "absent" }))}
                          >
                            Absent
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Select a class to load enrolled students.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={saving || !students.length}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Attendance
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
