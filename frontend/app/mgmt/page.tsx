'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { BarChart3, Download, Users, GraduationCap, TrendingUp, AlertTriangle, BookOpen } from 'lucide-react'
import { apiJson } from '@/lib/api'

const navigation = [
  { name: "Overview", href: "/mgmt", icon: <BarChart3 className="h-4 w-4" />, current: true },
]

interface MgmtStats { total_students: number; total_teachers: number; avg_attendance: number; at_risk: number }
interface FacultyRow { name: string; dept: string; classes: number; avg: number; low_flags: number }

export default function ManagementDashboardPage() {
  const [term, setTerm] = useState<'semester' | '30d' | 'yoy'>('semester')
  const [dept, setDept] = useState('all')
  const [stats, setStats] = useState<MgmtStats | null>(null)
  const [faculty, setFaculty] = useState<FacultyRow[]>([])

  useEffect(() => {
    apiJson<MgmtStats>(`/insights/management?term=${term}`)
      .then(d => setStats(d))
      .catch(() => {})
    apiJson<{ faculty: FacultyRow[] }>(`/insights/management/faculty?term=${term}`)
      .then(d => setFaculty(d.faculty ?? []))
      .catch(() => {})
  }, [term])

  const filteredFaculty = dept === 'all' ? faculty : faculty.filter(f => f.dept?.toLowerCase().includes(dept))

  const kpis = [
    { label: 'Total Students', value: stats?.total_students?.toLocaleString() ?? '—', icon: GraduationCap, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Total Teachers', value: stats?.total_teachers?.toLocaleString() ?? '—', icon: Users, color: '#10b981', bg: '#f0fdf4' },
    { label: 'Average Attendance', value: stats?.avg_attendance != null ? `${stats.avg_attendance}%` : '—', icon: TrendingUp, color: '#f59e0b', bg: '#fffbeb' },
    { label: 'At-Risk Students', value: stats?.at_risk?.toLocaleString() ?? '—', icon: AlertTriangle, color: '#ef4444', bg: '#fff0f0' },
  ]

  function exportCSV() {
    const rows = [
      ['Management Dashboard Report', '', '', ''],
      ['', '', '', ''],
      ['Metric', 'Value', '', ''],
      ...kpis.map(k => [k.label, k.value, '', '']),
      ['', '', '', ''],
      ['Faculty Performance', '', '', ''],
      ['Name', 'Department', 'Avg Attendance', 'Low Flags'],
      ...faculty.map(f => [f.name, f.dept, `${f.avg}%`, String(f.low_flags)]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `attendify_mgmt_${term}.csv`
    a.click()
  }

  const btnBase: React.CSSProperties = { padding: '8px 14px', border: '1px solid #e8edf5', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }
  const activeBtn: React.CSSProperties = { ...btnBase, background: '#111827', color: 'white', border: '1px solid #111827' }
  const inactiveBtn: React.CSSProperties = { ...btnBase, background: 'white', color: '#6b7a99' }

  return (
    <DashboardLayout title="Management Dashboard" userType="mgmt" navigation={navigation}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['semester', '30d', 'yoy'] as const).map(t => (
              <button key={t} onClick={() => setTerm(t)} style={term === t ? activeBtn : inactiveBtn}>
                {t === 'semester' ? 'This Semester' : t === '30d' ? 'Last 30 Days' : 'Year-on-Year'}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} style={{ ...btnBase, display: 'flex', alignItems: 'center', gap: 6, background: 'white', color: '#374151' }}>
            <Download size={13} /> Export CSV
          </button>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: 'white', border: '1px solid #e8edf5', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7a99', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k.label}</p>
                  <p style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginTop: 6, fontFamily: "'DM Serif Display', serif" }}>{k.value}</p>
                </div>
                <span style={{ width: 36, height: 36, borderRadius: 9, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color, flexShrink: 0 }}>
                  <k.icon size={16} />
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Faculty performance */}
        <div style={{ background: 'white', border: '1px solid #e8edf5', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={16} color='#6b7a99' />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Faculty Performance</span>
            </div>
            <select
              value={dept}
              onChange={e => setDept(e.target.value)}
              style={{ padding: '6px 12px', fontSize: 13, border: '1px solid #e8edf5', borderRadius: 8, outline: 'none', color: '#374151', cursor: 'pointer' }}
            >
              <option value="all">All Departments</option>
              <option value="computer">Computer Science</option>
              <option value="math">Mathematics</option>
              <option value="physics">Physics</option>
              <option value="english">English</option>
            </select>
          </div>

          {faculty.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3b8', fontSize: 13 }}>
              No faculty data available — connect the management insights API.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Faculty Name', 'Department', 'Classes', 'Avg Attendance', 'Low Att. Flags'].map(h => (
                      <th key={h} style={{ padding: '8px 20px', fontSize: 11, fontWeight: 700, color: '#6b7a99', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left', borderBottom: '1px solid #e8edf5', background: '#f8fafc' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFaculty.map((f, i) => (
                    <tr key={i} onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: '#111827', borderBottom: '1px solid #f1f5f9' }}>{f.name}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: '#374151', borderBottom: '1px solid #f1f5f9' }}>{f.dept}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: '#374151', borderBottom: '1px solid #f1f5f9' }}>{f.classes}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: f.avg >= 80 ? '#10b981' : f.avg >= 70 ? '#f59e0b' : '#ef4444', borderBottom: '1px solid #f1f5f9' }}>{f.avg}%</td>
                      <td style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: f.low_flags === 0 ? '#f0fdf4' : '#fff0f0', color: f.low_flags === 0 ? '#10b981' : '#ef4444' }}>
                          {f.low_flags}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
