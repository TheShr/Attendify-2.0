'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

export default function AdminRegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    setPhotoError(null)
    const file = event.target.files?.[0] ?? null
    if (!file) {
      setPhoto(null)
      setPhotoPreview(null)
      return
    }

    if (!file.type.startsWith('image/')) {
      setPhoto(null)
      setPhotoPreview(null)
      setPhotoError('Please upload a JPG, PNG, or WebP image.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhoto(null)
      setPhotoPreview(null)
      setPhotoError('Photo must be 5MB or smaller.')
      return
    }

    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!username || !password || !confirm) {
      setError('Please fill all fields.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const body = new FormData()
      body.append('username', username)
      body.append('password', password)
      if (photo) body.append('photo', photo)

      const res = await apiFetch('/api/admin/register', {
        method: 'POST',
        body,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || data?.message || 'Registration failed.')
        return
      }
      router.push('/?registered=1')
    } catch {
      setError('Unable to connect to the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #0a0f1e; min-height: 100vh; }
        .reg-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          opacity: ${mounted ? 1 : 0};
          transition: opacity 0.4s ease;
        }
        .reg-card {
          width: 100%;
          max-width: 420px;
          background: #0d1424;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 40px;
        }
        .reg-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
        .logo-icon { width: 34px; height: 34px; background: linear-gradient(135deg, #38bdf8, #6366f1); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .logo-text { font-family: 'DM Serif Display', serif; font-size: 18px; color: #f0f6ff; }
        .reg-title { font-family: 'DM Serif Display', serif; font-size: 24px; color: #f0f6ff; margin-bottom: 6px; }
        .reg-subtitle { font-size: 13px; color: #5a6a8a; margin-bottom: 28px; line-height: 1.5; }
        .error-banner { background: rgba(239,68,68,0.10); border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; color: #f87171; font-size: 13px; padding: 10px 14px; margin-bottom: 18px; }
        .field-group { margin-bottom: 14px; }
        .field-label { display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: #5a6a8a; margin-bottom: 7px; }
        .field-hint { font-size: 11px; color: #3a4a6b; margin-top: 4px; }
        .field-input { width: 100%; background: #111827; border: 1px solid #1e2a3f; border-radius: 9px; color: #e2eaf8; font-family: 'DM Sans', sans-serif; font-size: 14px; padding: 12px 14px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
        .field-input::placeholder { color: #2e3d5a; }
        .field-input:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,0.10); }
        .submit-btn { width: 100%; padding: 13px; background: linear-gradient(135deg, #0ea5e9, #6366f1); border: none; border-radius: 9px; color: #fff; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 6px; transition: opacity 0.2s, transform 0.1s; }
        .submit-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .back-link { display: block; text-align: center; margin-top: 20px; font-size: 13px; color: #5a6a8a; }
        .back-link a { color: #38bdf8; text-decoration: none; font-weight: 500; }
        .back-link a:hover { text-decoration: underline; }
        .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 7px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="reg-root">
        <div className="reg-card">
          <div className="reg-logo">
            <div className="logo-icon">
              <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                <rect x="2" y="2" width="8" height="8" rx="2" fill="white" opacity="0.9"/>
                <rect x="12" y="2" width="8" height="8" rx="2" fill="white" opacity="0.6"/>
                <rect x="2" y="12" width="8" height="8" rx="2" fill="white" opacity="0.6"/>
                <rect x="12" y="12" width="8" height="8" rx="2" fill="white" opacity="0.3"/>
              </svg>
            </div>
            <span className="logo-text">Attendify</span>
          </div>

          <h1 className="reg-title">Create Admin Account</h1>
          <p className="reg-subtitle">This account will have full access to system administration, user management, and geofencing controls.</p>

          {error && <div className="error-banner">⚠ {error}</div>}

          <form onSubmit={handleRegister}>
            <div className="field-group">
              <label className="field-label">Username</label>
              <input className="field-input" type="text" placeholder="Choose a username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus />
            </div>
            <div className="field-group">
              <label className="field-label">Password</label>
              <input className="field-input" type="password" placeholder="Create a password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
              <p className="field-hint">Minimum 6 characters</p>
            </div>
            <div className="field-group">
              <label className="field-label">Confirm Password</label>
              <input className="field-input" type="password" placeholder="Repeat your password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="field-group">
              <label className="field-label">Face Photo (optional)</label>
              <input className="field-input" type="file" accept="image/*" onChange={handlePhotoChange} />
              <p className="field-hint">Upload a face photo to enroll your admin account for biometric onboarding.</p>
              {photoError && <div className="error-banner">⚠ {photoError}</div>}
              {photoPreview && (
                <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <img src={photoPreview} alt="Face preview" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,.15)' }} />
                  <button type="button" className="submit-btn" style={{ padding: '10px 14px', background: '#334155' }} onClick={() => { setPhoto(null); setPhotoPreview(null); setPhotoError(null) }}>
                    Remove photo
                  </button>
                </div>
              )}
            </div>
            <button className="submit-btn" type="submit" disabled={loading}>
              {loading && <span className="spinner" />}
              {loading ? 'Creating account…' : 'Create Admin Account'}
            </button>
          </form>

          <span className="back-link">Already have an account? <Link href="/">Sign in</Link></span>
        </div>
      </div>
    </>
  )
}
