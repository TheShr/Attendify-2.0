'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ShieldCheck, BarChart3, TrendingUp, Download, Globe, AlertTriangle } from 'lucide-react'
import { apiJson } from '@/lib/api'

const navigation = [
  { name: "National Overview", href: "/policymaker", icon: <Globe className="h-4 w-4" />, current: true },
]

interface PolicyStats { national_avg: number; districts_below_75: number; pass_rate: number; institutions: number }
interface DistrictRow { name: string; region: string; attendance: number }
type RangeKey = 'semester' | '30d' | 'yoy'

export default function PolicymakerPage() {
  const [range, setRange] = useState<RangeKey>('semester')
  const [region, setRegion] = useState('all')
  const [stats, setStats] = useState<PolicyStats | null>(null)
  const [districts, setDistricts] = useState<DistrictRow[]>([])

  useEffect(() => {
    apiJson<PolicyStats>(`/insights/policymaker?range=${range}`)
      .then(d => setStats(d)).catch(() => {})
    apiJson<{ districts: DistrictRow[] }>(`/insights/policymaker/districts?range=${range}`)
      .then(d => setDistricts(d.districts ?? [])).catch(() => {})
  }, [range])

  const filtered = region === 'all' ? districts : districts.filter(d => d.region?.toLowerCase() === region)

  const kpis = [
    { label: 'National Attendance Avg', value: stats?.national_avg != null ? `${stats.national_avg}%` : '—', icon: TrendingUp, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Districts Below 75%', value: stats?.districts_below_75?.toLocaleString() ?? '—', icon: AlertTriangle, color: '#ef4444', bg: '#fff0f0' },
    { label: 'Semester Pass Rate', value: stats?.pass_rate != null ? `${stats.pass_rate}%` : '—', icon: BarChart3, color: '#10b981', bg: '#f0fdf4' },
    { label: 'Institutions Onboarded', value: stats?.institutions?.toLocaleString() ?? '—', icon: ShieldCheck, color: '#8b5cf6', bg: '#f5f3ff' },
  ]

  function exportCSV() {
    const rows = [
      ['Policymaker Report', '', ''],
      ['Range', range, ''],
      ['', '', ''],
      ['District', 'Region', 'Attendance %'],
      ...districts.map(d => [d.name, d.region, String(d.attendance)]),
    ]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' }))
    a.download = `attendify_policy_${range}.csv`
    a.click()
  }

  const btnBase: React.CSSProperties = { padding: '7px 13px', border: '1px solid #e8edf5', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }

  return (
    <DashboardLayout title="Policymaker Dashboard" userType="policymaker" navigation={navigation}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['semester', '30d', 'yoy'] as const).map(t => (
              <button key={t} onClick={() => setRange(t)}
                style={range === t ? { ...btnBase, background: '#111827', color: 'white', border: '1px solid #111827' } : { ...btnBase, background: 'white', color: '#6b7a99' }}>
                {t === 'semester' ? 'This Semester' : t === '30d' ? 'Last 30 Days' : 'Year-on-Year'}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} style={{ ...btnBase, display: 'flex', alignItems: 'center', gap: 6, background: 'white', color: '#374151' }}>
            <Download size={13} /> Export CSV
          </button>
        </div>

        {/* KPIs */}
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

        {/* District compliance table */}
        <div style={{ background: 'white', border: '1px solid #e8edf5', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>District Compliance</span>
            <select value={region} onChange={e => setRegion(e.target.value)}
              style={{ padding: '6px 12px', fontSize: 13, border: '1px solid #e8edf5', borderRadius: 8, outline: 'none', color: '#374151', cursor: 'pointer' }}>
              <option value="all">All Regions</option>
              <option value="north">North</option>
              <option value="south">South</option>
              <option value="east">East</option>
              <option value="west">West</option>
            </select>
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3b8', fontSize: 13 }}>
              No district data — connect policymaker insights API endpoints.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['District', 'Region', 'Attendance Rate', 'Compliance'].map(h => (
                      <th key={h} style={{ padding: '8px 20px', fontSize: 11, fontWeight: 700, color: '#6b7a99', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left', borderBottom: '1px solid #e8edf5', background: '#f8fafc' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d, i) => {
                    const compliant = d.attendance >= 75
                    return (
                      <tr key={i} onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                        <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: '#111827', borderBottom: '1px solid #f1f5f9' }}>{d.name}</td>
                        <td style={{ padding: '12px 20px', fontSize: 13, color: '#374151', borderBottom: '1px solid #f1f5f9' }}>{d.region}</td>
                        <td style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', maxWidth: 100 }}>
                              <div style={{ height: '100%', width: `${d.attendance}%`, background: d.attendance >= 80 ? '#10b981' : d.attendance >= 75 ? '#f59e0b' : '#ef4444', borderRadius: 3, transition: 'width 0.4s' }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: d.attendance >= 80 ? '#10b981' : d.attendance >= 75 ? '#f59e0b' : '#ef4444' }}>{d.attendance}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: compliant ? '#f0fdf4' : '#fff0f0', color: compliant ? '#10b981' : '#ef4444' }}>
                            {compliant ? 'Compliant' : 'At Risk'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
