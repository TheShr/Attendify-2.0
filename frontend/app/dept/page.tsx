'use client'

import React, { useMemo, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  Download,
  ShieldCheck,
  AlertTriangle,
  Wifi,
  MapPin
} from 'lucide-react'

type KPI = { label: string; value: string; delta?: string; positive?: boolean }
type Region = 'North' | 'South' | 'East' | 'West'
type TermKey = 'semester' | '30d' | 'yoy'
type RegionKey = 'all' | 'north' | 'south' | 'east' | 'west'

type Cohort = {
  institute: string
  region: Region
  program: string
  risk: 'High' | 'Medium'
  attendance: number
}

type BandRow = { band: string; institutions: number; share: number }

/* --------------------------- Mocked datasets --------------------------- */
const DATA_BY_TERM: Record<
  TermKey,
  {
    kpis: KPI[]
    ops: { onlineCompat: number; geofencing: number }
    complianceBands: BandRow[]
    cohorts: Cohort[]
  }
> = {
  semester: {
    kpis: [
      { label: 'Avg Attendance (All Colleges)', value: '82%', delta: '+1.8 pts', positive: true },
      { label: 'Compliance (>=75%)', value: '71%', delta: '+2.4 pts', positive: true },
      { label: 'At-Risk Cohorts', value: '18', delta: '-3', positive: true },
      { label: 'Institutions Reporting', value: '124', delta: '+7', positive: true }
    ],
    ops: { onlineCompat: 86, geofencing: 92 },
    complianceBands: [
      { band: '>= 90%', institutions: 34, share: 27 },
      { band: '80-89%', institutions: 41, share: 33 },
      { band: '75-79%', institutions: 13, share: 11 },
      { band: '60-74%', institutions: 28, share: 23 },
      { band: '< 60%', institutions: 8, share: 6 }
    ],
    cohorts: [
      { institute: 'Aurora Institute', region: 'North', program: 'B.Sc CS', risk: 'High', attendance: 62 },
      { institute: 'Brookfield College', region: 'West', program: 'B.Com', risk: 'Medium', attendance: 71 },
      { institute: 'Cypress Univ.', region: 'East', program: 'B.Tech ECE', risk: 'High', attendance: 59 },
      { institute: 'Dover College', region: 'South', program: 'BA Economics', risk: 'Medium', attendance: 68 },
      { institute: 'Elmwood Univ.', region: 'North', program: 'BBA', risk: 'High', attendance: 57 }
    ]
  },
  '30d': {
    kpis: [
      { label: 'Avg Attendance (All Colleges)', value: '79%', delta: '-2.2 pts', positive: false },
      { label: 'Compliance (>=75%)', value: '66%', delta: '-3.0 pts', positive: false },
      { label: 'At-Risk Cohorts', value: '24', delta: '+6', positive: false },
      { label: 'Institutions Reporting', value: '118', delta: '-4', positive: false }
    ],
    ops: { onlineCompat: 82, geofencing: 90 },
    complianceBands: [
      { band: '>= 90%', institutions: 22, share: 19 },
      { band: '80-89%', institutions: 36, share: 31 },
      { band: '75-79%', institutions: 20, share: 17 },
      { band: '60-74%', institutions: 29, share: 25 },
      { band: '< 60%', institutions: 11, share: 9 }
    ],
    cohorts: [
      { institute: 'Fairview Univ.', region: 'South', program: 'BCA', risk: 'High', attendance: 58 },
      { institute: 'Greendale Inst.', region: 'West', program: 'B.Sc Physics', risk: 'Medium', attendance: 70 },
      { institute: 'Hillside College', region: 'East', program: 'BA History', risk: 'High', attendance: 55 }
    ]
  },
  yoy: {
    kpis: [
      { label: 'Avg Attendance (All Colleges)', value: '84%', delta: '+3.6 pts', positive: true },
      { label: 'Compliance (>=75%)', value: '74%', delta: '+5.1 pts', positive: true },
      { label: 'At-Risk Cohorts', value: '15', delta: '-7', positive: true },
      { label: 'Institutions Reporting', value: '131', delta: '+15', positive: true }
    ],
    ops: { onlineCompat: 88, geofencing: 94 },
    complianceBands: [
      { band: '>= 90%', institutions: 40, share: 30 },
      { band: '80-89%', institutions: 45, share: 34 },
      { band: '75-79%', institutions: 12, share: 9 },
      { band: '60-74%', institutions: 26, share: 20 },
      { band: '< 60%', institutions: 8, share: 6 }
    ],
    cohorts: [
      { institute: 'North Valley Univ.', region: 'North', program: 'B.Tech CSE', risk: 'Medium', attendance: 73 },
      { institute: 'South Ridge College', region: 'South', program: 'B.Sc Chem', risk: 'High', attendance: 60 }
    ]
  }
}

/* --------------------------------- Page --------------------------------- */
export default function EducationDeptPage() {
  const [term, setTerm] = useState<TermKey>('semester')
  const [region, setRegion] = useState<RegionKey>('all')

  const { kpis, ops, complianceBands, cohorts } = DATA_BY_TERM[term]

  const filteredCohorts = useMemo(
    () => (region === 'all' ? cohorts : cohorts.filter((c) => c.region.toLowerCase() === region)),
    [cohorts, region]
  )

  /* ----------------------------- Export actions ----------------------------- */
  function downloadCSV() {
    const lines: string[] = []
    lines.push('Education Department - Insights')
    lines.push(`Term,${term},Region,${region}`)
    lines.push('')
    lines.push('KPI,Value,Delta')
    kpis.forEach(k => lines.push(`${k.label},${k.value},${k.delta ?? ''}`))
    lines.push('')
    lines.push('Operational Metrics,Percent')
    lines.push(`Online-class Compatibility,${ops.onlineCompat}%`)
    lines.push(`Geofencing Coverage,${ops.geofencing}%`)
    lines.push('')
    lines.push('Compliance Distribution,,,')
    lines.push('Band,Institutions,Share')
    complianceBands.forEach(b => lines.push(`${b.band},${b.institutions},${b.share}%`))
    lines.push('')
    lines.push('At-Risk Cohorts,,,,')
    lines.push('Institute,Region,Program,Risk,Attendance')
    filteredCohorts.forEach(c =>
      lines.push(`${c.institute},${c.region},${c.program},${c.risk},${c.attendance}%`)
    )
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dept_insights_${term}_${region}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function downloadPDF() {
    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Education Dept - Brief (${term}, ${region})</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px;color:#111}
  h1{font-size:22px;margin:0 0 8px}
  h2{font-size:16px;margin:20px 0 8px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}
  th{background:#f5f5f5}
  .kpi{display:flex;justify-content:space-between;border:1px solid #eee;padding:10px;border-radius:8px;margin:6px 0}
  .muted{color:#666;font-size:12px}
</style>
</head>
<body>
  <h1>Smart Attendance - Education Department Brief</h1>
  <div class="muted">Term: <b>${term}</b> - Region: <b>${region}</b></div>

  <h2>Key Indicators</h2>
  ${kpis.map(k => `<div class="kpi"><div>${k.label}</div><div><b>${k.value}</b> ${k.delta ? `(${k.delta})` : ''}</div></div>`).join('')}

  <h2>Operational Metrics</h2>
  <table>
    <thead><tr><th>Metric</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Online-class Compatibility</td><td>${ops.onlineCompat}%</td></tr>
      <tr><td>Geofencing Coverage</td><td>${ops.geofencing}%</td></tr>
    </tbody>
  </table>

  <h2>Compliance Distribution</h2>
  <table>
    <thead><tr><th>Band</th><th>Institutions</th><th>Share</th></tr></thead>
    <tbody>
      ${complianceBands.map(b => `<tr><td>${b.band}</td><td>${b.institutions}</td><td>${b.share}%</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>At-Risk Cohorts</h2>
  <table>
    <thead><tr><th>Institute</th><th>Region</th><th>Program</th><th>Risk</th><th>Attendance</th></tr></thead>
    <tbody>
      ${filteredCohorts.map(c => `<tr><td>${c.institute}</td><td>${c.region}</td><td>${c.program}</td><td>${c.risk}</td><td>${c.attendance}%</td></tr>`).join('')}
    </tbody>
  </table>

  <p class="muted">Note: View is anonymized; no student-level PII is displayed. Figures reflect institution-reported attendance and exam outcomes.</p>
  <script>window.onload = () => window.print();</script>
</body>
</html>
    `.trim()

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <DashboardLayout title="Education Department Insights" userType="dept" navigation={[
      { name: 'Overview', href: '/dept', icon: <BarChart3 className="h-5 w-5" />, current: true }
    ]}>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="text-sm text-muted-foreground">Term:</div>
        <div className="flex overflow-hidden rounded-md border">
          <Segment label="This Semester" active={term === 'semester'} onClick={() => setTerm('semester')} />
          <Segment label="Last 30 days" active={term === '30d'} onClick={() => setTerm('30d')} />
          <Segment label="Year over Year" active={term === 'yoy'} onClick={() => setTerm('yoy')} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Region:</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as RegionKey)}
            className="h-9 rounded-md border bg-white px-2 text-sm"
          >
            <option value="all">All</option>
            <option value="north">North</option>
            <option value="south">South</option>
            <option value="east">East</option>
            <option value="west">West</option>
          </select>
          <Button variant="outline" size="sm" className="gap-2" onClick={downloadCSV}>
            <Download className="h-4 w-4" /> Download CSV
          </Button>
          <Button size="sm" className="gap-2" onClick={downloadPDF}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardHeader><CardTitle className="text-sm">{k.label}</CardTitle></CardHeader>
            <CardContent className="flex items-end justify-between">
              <div className="text-3xl font-bold">{k.value}</div>
              {k.delta && (
                <Badge variant={k.positive ? 'default' : 'destructive'} className="text-xs">
                  {k.delta}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ops metrics */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wifi className="h-5 w-5" /> Online-class Compatibility</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressLine label="Institutions meeting remote-class readiness standards" value={ops.onlineCompat} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Geofencing Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressLine label="Institutions with active geofenced attendance" value={ops.geofencing} />
          </CardContent>
        </Card>
      </div>

      {/* Compliance distribution */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Compliance Distribution (Institution Count)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {complianceBands.map(b => (
            <div key={b.band}>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">{b.band}</span>
                <span className="text-muted-foreground">{b.institutions} inst. - {b.share}%</span>
              </div>
              <div className="h-2 w-full rounded bg-muted">
                <div className="h-2 rounded bg-foreground" style={{ width: `${b.share}%` }} />
              </div>
            </div>
          ))}
          <p className="md:col-span-2 text-xs text-muted-foreground">
            Bands represent share of reporting institutions within the selected term and region.
          </p>
        </CardContent>
      </Card>

      {/* At-risk cohorts */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> At-Risk Cohorts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institute</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead className="text-right">Attendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCohorts.map((c, i) => (
                <TableRow key={`${c.institute}-${i}`}>
                  <TableCell>{c.institute}</TableCell>
                  <TableCell className="text-muted-foreground">{c.region}</TableCell>
                  <TableCell className="text-muted-foreground">{c.program}</TableCell>
                  <TableCell>
                    <Badge variant={c.risk === 'High' ? 'destructive' : 'default'} className="text-xs">
                      {c.risk}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{c.attendance}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-3">
            Criteria: cohorts flagged when attendance &lt; 70% for 3 consecutive weeks or when month-over-month decline exceeds 8 pts.
          </p>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}

/* ------------------------------ UI helpers ------------------------------ */
function Segment({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-sm ${active ? 'bg-foreground text-white' : 'bg-background text-muted-foreground'} transition`}
    >
      {label}
    </button>
  )
}

function ProgressLine({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <div className="h-2 w-full rounded bg-muted">
        <div className="h-2 rounded bg-foreground" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

