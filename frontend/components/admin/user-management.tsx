"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, UserCheck, GraduationCap, RefreshCw } from "lucide-react"
import { apiJson } from "@/lib/api"

interface Student {
  student_id: number
  roll_no: string
  name: string
  email: string
  class_code: string
  username: string
}

interface Teacher {
  staff_id: number
  name: string
  email: string
  department: string
  designation: string
  username: string
}

export function UserManagement() {
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const [s, t] = await Promise.all([
        apiJson<{ students: Student[] }>("/api/admin/students").then(d => d.students).catch(() => [] as Student[]),
        apiJson<{ teachers: Teacher[] }>("/api/admin/teachers").then(d => d.teachers).catch(() => [] as Teacher[]),
      ])
      setStudents(s)
      setTeachers(t)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filteredStudents = students.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.roll_no.toLowerCase().includes(search.toLowerCase())
  )
  const filteredTeachers = teachers.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.department?.toLowerCase().includes(search.toLowerCase())
  )

  const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" as const }
  const thStyle: React.CSSProperties = { padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#6b7a99", textTransform: "uppercase" as const, letterSpacing: "0.07em", textAlign: "left" as const, borderBottom: "1px solid #e8edf5", background: "#f8fafc" }
  const tdStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f1f5f9" }
  const nameTdStyle: React.CSSProperties = { ...tdStyle, fontWeight: 600, color: "#111827" }

  return (
    <Card style={{border:"1px solid #e8edf5",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
      <CardHeader style={{padding:"20px 24px 0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <CardTitle style={{fontSize:16,fontWeight:700,color:"#111827"}}>User Management</CardTitle>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{position:"relative"}}>
              <Search size={13} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#9ca3b8"}} />
              <input
                style={{paddingLeft:30,paddingRight:12,paddingTop:7,paddingBottom:7,fontSize:13,border:"1px solid #e8edf5",borderRadius:8,outline:"none",color:"#374151",background:"white",width:200}}
                placeholder="Search users…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button onClick={load} style={{padding:"7px 8px",border:"1px solid #e8edf5",borderRadius:8,background:"white",cursor:"pointer",color:"#6b7a99",display:"flex",alignItems:"center"}} title="Refresh">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent style={{padding:"16px 0 0"}}>
        <Tabs defaultValue="students">
          <TabsList style={{marginLeft:24,marginBottom:16}}>
            <TabsTrigger value="students" style={{gap:6,display:"flex",alignItems:"center"}}>
              <GraduationCap size={13} /> Students
              <Badge style={{marginLeft:4,fontSize:10,padding:"1px 6px",background:"#eff6ff",color:"#3b82f6",border:"none"}}>{filteredStudents.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="teachers" style={{gap:6,display:"flex",alignItems:"center"}}>
              <UserCheck size={13} /> Teachers
              <Badge style={{marginLeft:4,fontSize:10,padding:"1px 6px",background:"#f0fdf4",color:"#10b981",border:"none"}}>{filteredTeachers.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="students">
            {loading ? (
              <div style={{padding:"32px",textAlign:"center",color:"#9ca3b8",fontSize:13}}>Loading students…</div>
            ) : filteredStudents.length === 0 ? (
              <div style={{padding:"32px",textAlign:"center",color:"#9ca3b8",fontSize:13}}>No students found.</div>
            ) : (
              <div style={{overflowX:"auto"}}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Roll No.</th>
                      <th style={thStyle}>Class</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Username</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => (
                      <tr key={s.student_id} style={{transition:"background 0.1s"}}
                        onMouseEnter={e => (e.currentTarget.style.background="#f8fafc")}
                        onMouseLeave={e => (e.currentTarget.style.background="white")}>
                        <td style={nameTdStyle}>{s.name}</td>
                        <td style={tdStyle}><code style={{fontSize:12,background:"#f1f5f9",padding:"2px 6px",borderRadius:4}}>{s.roll_no}</code></td>
                        <td style={tdStyle}>{s.class_code || "—"}</td>
                        <td style={{...tdStyle,color:"#6b7a99"}}>{s.email || "—"}</td>
                        <td style={tdStyle}>{s.username}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="teachers">
            {loading ? (
              <div style={{padding:"32px",textAlign:"center",color:"#9ca3b8",fontSize:13}}>Loading teachers…</div>
            ) : filteredTeachers.length === 0 ? (
              <div style={{padding:"32px",textAlign:"center",color:"#9ca3b8",fontSize:13}}>No teachers found.</div>
            ) : (
              <div style={{overflowX:"auto"}}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Department</th>
                      <th style={thStyle}>Designation</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Username</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeachers.map((t) => (
                      <tr key={t.staff_id} style={{transition:"background 0.1s"}}
                        onMouseEnter={e => (e.currentTarget.style.background="#f8fafc")}
                        onMouseLeave={e => (e.currentTarget.style.background="white")}>
                        <td style={nameTdStyle}>{t.name}</td>
                        <td style={tdStyle}>{t.department || "—"}</td>
                        <td style={tdStyle}>{t.designation || "—"}</td>
                        <td style={{...tdStyle,color:"#6b7a99"}}>{t.email}</td>
                        <td style={tdStyle}>{t.username}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
