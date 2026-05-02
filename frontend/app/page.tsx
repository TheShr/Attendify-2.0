'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, saveAuthToken } from '@/lib/api'
import './login.css'

export default function LoginPage() {
  const router = useRouter()
  const [justRegistered, setJustRegistered] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const searchParams = new URLSearchParams(window.location.search)
    setJustRegistered(searchParams.get('registered') === '1')
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!username || !password) {
      setError('Please enter your username and password.')
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.message || data?.error || 'Invalid credentials.')
        return
      }
      const { access_token, role: userRole, user_id, name } = data
      saveAuthToken(access_token, userRole)
      if (user_id) localStorage.setItem('user_id', String(user_id))
      const userData = { role: userRole?.toUpperCase(), username, name: name || username }
      localStorage.setItem('user', JSON.stringify(userData))

      const roleRoutes: Record<string, string> = {
        student: '/student',
        teacher: '/teacher',
        admin: '/admin',
        mgmt: '/mgmt',
        dept: '/dept',
        policymaker: '/policymaker',
      }
      router.push(roleRoutes[role?.toLowerCase()] || '/')
    } catch (error) {
      console.error('Login request failed:', error)
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to connect to the server. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className={`login-root ${mounted ? 'mounted' : ''}`}>
        <div className="login-brand">
          <div className="grid-overlay" />
          <div className="brand-content brand-logo">
            <div className="brand-icon">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="2" y="2" width="8" height="8" rx="2" fill="white" opacity="0.9"/>
                <rect x="12" y="2" width="8" height="8" rx="2" fill="white" opacity="0.6"/>
                <rect x="2" y="12" width="8" height="8" rx="2" fill="white" opacity="0.6"/>
                <rect x="12" y="12" width="8" height="8" rx="2" fill="white" opacity="0.3"/>
              </svg>
            </div>
            <span className="brand-name">Attendify</span>
          </div>
          <div className="brand-hero">
            <h1 className="brand-headline">Attendance,<br /><em>reimagined</em><br />for the future.</h1>
            <p className="brand-subtitle">AI-powered face recognition, GPS geofencing, and real-time analytics — built for institutions that demand accuracy at scale.</p>
          </div>
          <div className="brand-stats">
            <div><div className="stat-val">99.2%</div><div className="stat-lbl">Accuracy</div></div>
            <div><div className="stat-val">&lt;2s</div><div className="stat-lbl">Check-in</div></div>
            <div><div className="stat-val">6</div><div className="stat-lbl">Role types</div></div>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="form-wrapper">
            <div className="form-top-logo">
              <div className="brand-icon" style={{width:'36px',height:'36px'}}>
                <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                  <rect x="2" y="2" width="8" height="8" rx="2" fill="white" opacity="0.9"/>
                  <rect x="12" y="2" width="8" height="8" rx="2" fill="white" opacity="0.6"/>
                  <rect x="2" y="12" width="8" height="8" rx="2" fill="white" opacity="0.6"/>
                  <rect x="12" y="12" width="8" height="8" rx="2" fill="white" opacity="0.3"/>
                </svg>
              </div>
              <span className="brand-name">Attendify</span>
            </div>

            <h2 className="form-title">Welcome back</h2>
            <p className="form-subtitle">Sign in to your institutional account as a student, teacher, or administrator.</p>

            {justRegistered && (
              <div className="success-banner">
                ✓ Admin registered successfully — you may now sign in.
              </div>
            )}

            {error && <div className="error-banner">⚠ {error}</div>}

            <form onSubmit={handleLogin}>
              <div className="field-group">
                <label className="field-label">Role</label>
                <select className="field-input" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                  <option value="mgmt">Management</option>
                  <option value="dept">Education Dept</option>
                  <option value="policymaker">Policymaker</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Username</label>
                <input className="field-input" type="text" placeholder="Enter your username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus />
              </div>
              <div className="field-group">
                <label className="field-label">Password</label>
                <input className="field-input" type="password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <button className="submit-btn" type="submit" disabled={loading}>
                {loading && <span className="spinner" />}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="form-footer">
              <span className="footer-link">
                Public dashboards: <a href="/dept">Education Dept</a><span className="divider">·</span><a href="/policymaker">Policymaker</a>
              </span>
              <br /><br />
              <span className="footer-link">Need a student or teacher account? Ask your administrator to register you, or use the admin panel if you already have access.</span>
              <br /><br />
              <span className="footer-link">Need an admin account? <a href="/admin/register">Register here</a></span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
