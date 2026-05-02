"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { clearAuthToken } from "@/lib/api"

interface NavigationChildItem {
  name: string
  href: string
  current?: boolean
  icon?: React.ReactNode
}

interface NavigationItem {
  name: string
  href: string
  icon: React.ReactNode
  current?: boolean
  children?: NavigationChildItem[]
}

interface StoredUser {
  role: string
  username?: string
  name?: string
}

interface DashboardLayoutProps {
  children: React.ReactNode
  title: string
  userType: "teacher" | "student" | "admin" | "mgmt" | "dept" | "policymaker"
  navigation: NavigationItem[]
}

const roleColors: Record<string, string> = {
  teacher: "#10b981",
  student: "#3b82f6",
  admin: "#8b5cf6",
  mgmt: "#f59e0b",
  dept: "#ef4444",
  policymaker: "#06b6d4",
}

const roleLabels: Record<string, string> = {
  teacher: "Teacher",
  student: "Student",
  admin: "Administrator",
  mgmt: "Management",
  dept: "Education Dept",
  policymaker: "Policymaker",
}

export function DashboardLayout({ children, title, userType, navigation }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<StoredUser | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const data = localStorage.getItem("user")
    if (!data) { router.push("/"); return }
    try {
      const parsed = JSON.parse(data) as Partial<StoredUser>
      if (!parsed || typeof parsed.role !== "string") throw new Error("invalid")
      const normalizedRoleKey = parsed.role.toUpperCase()
      setUser({ role: normalizedRoleKey, username: parsed.username, name: parsed.name })
      const roleMap: Record<string, string> = { STUDENT: "student", TEACHER: "teacher", ADMIN: "admin", MGMT: "mgmt", DEPT: "dept", POLICYMAKER: "policymaker" }
      const mappedRole = roleMap[normalizedRoleKey]
      if (!mappedRole || mappedRole !== userType) router.push("/")
    } catch { router.push("/") }
  }, [router, userType])

  const handleLogout = () => {
    clearAuthToken()
    localStorage.removeItem("user")
    router.push("/")
  }

  const displayName = user?.name || user?.username || "User"
  const initials = displayName.slice(0, 2).toUpperCase()
  const accentColor = roleColors[userType] || "#3b82f6"
  const roleLabel = roleLabels[userType] || userType

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

        .dash-root * { box-sizing: border-box; margin: 0; padding: 0; }
        .dash-root { display: flex; min-height: 100vh; background: #f8fafc; font-family: 'DM Sans', sans-serif; color: #0f172a; }

        /* ─── Sidebar ─── */
        .sidebar {
          width: 260px;
          min-width: 260px;
          background: #ffffff;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          position: fixed;
          inset-y: 0;
          left: 0;
          z-index: 50;
          transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
        }

        .sidebar-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 24px 20px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .logo-icon {
          width: 34px; height: 34px;
          background: linear-gradient(135deg, #38bdf8, #6366f1);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        .logo-text {
          font-family: 'DM Serif Display', serif;
          font-size: 18px;
          color: #0f172a;
          letter-spacing: -0.3px;
        }

        .sidebar-nav {
          flex: 1;
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .nav-section-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #64748b;
          padding: 12px 8px 6px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          text-decoration: none;
          color: #475569;
          font-size: 13.5px;
          font-weight: 500;
          transition: background 0.15s, color 0.15s;
          cursor: pointer;
        }

        .nav-item:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .nav-item.active {
          background: #eff6ff;
          color: #0f172a;
        }

        .nav-item.active .nav-icon {
          background: ${accentColor}22;
          color: ${accentColor};
        }

        .nav-icon {
          width: 30px; height: 30px;
          border-radius: 8px;
          background: #e2e8f0;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }

        .nav-children {
          padding-left: 40px;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .nav-child {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 8px;
          text-decoration: none;
          color: #64748b;
          font-size: 13px;
          transition: color 0.15s, background 0.15s;
        }

        .nav-child:hover { color: #0f172a; background: #f8fafc; }
        .nav-child.active { color: ${accentColor}; }

        .sidebar-user {
          padding: 14px 12px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 10px;
          background: #f8fafc;
        }

        .user-avatar {
          width: 34px; height: 34px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
          background: ${accentColor};
        }

        .user-info { flex: 1; min-width: 0; }
        .user-name { font-size: 13px; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .user-role { font-size: 11px; color: #64748b; margin-top: 1px; }

        .logout-btn {
          width: 28px; height: 28px;
          background: none;
          border: none;
          cursor: pointer;
          color: #475569;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .logout-btn:hover { background: #e2e8f0; color: #dc2626; }

        /* ─── Mobile overlay ─── */
        .sidebar-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          z-index: 49;
        }

        @media (max-width: 1024px) {
          .sidebar { transform: translateX(-100%); }
          .sidebar.open { transform: translateX(0); }
          .sidebar-overlay.open { display: block; }
        }

        /* ─── Main area ─── */
        .main-wrap {
          flex: 1;
          margin-left: 260px;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        @media (max-width: 1024px) { .main-wrap { margin-left: 0; } }

        /* ─── Topbar ─── */
        .topbar {
          height: 60px;
          background: white;
          border-bottom: 1px solid #e8edf5;
          display: flex;
          align-items: center;
          padding: 0 28px;
          gap: 14px;
          position: sticky;
          top: 0;
          z-index: 40;
        }

        .topbar-mobile-btn {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: #6b7a99;
          padding: 4px;
        }
        @media (max-width: 1024px) { .topbar-mobile-btn { display: flex; align-items: center; } }

        .topbar-title {
          flex: 1;
          font-size: 15px;
          font-weight: 600;
          color: #1a2540;
        }

        .role-badge {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 20px;
          color: white;
          background: ${accentColor};
        }

        /* ─── Content ─── */
        .page-content {
          flex: 1;
          padding: 28px 32px;
          max-width: 1400px;
          width: 100%;
        }

        @media (max-width: 768px) { .page-content { padding: 20px 16px; } }

        .page-header {
          margin-bottom: 24px;
        }

        .page-heading {
          font-family: 'DM Serif Display', serif;
          font-size: 24px;
          color: #111827;
          letter-spacing: -0.4px;
        }
      `}</style>

      <div className="dash-root">
        {/* Mobile overlay */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-inner">
            <div className="sidebar-logo">
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

            <nav className="sidebar-nav">
              <span className="nav-section-label">Navigation</span>
              {navigation.map((item) => {
                const isActive = pathname === item.href || item.current
                return (
                  <div key={item.name}>
                    <a
                      href={item.href}
                      className={`nav-item ${isActive ? "active" : ""}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      {item.name}
                    </a>
                    {item.children && item.children.length > 0 && (
                      <div className="nav-children">
                        {item.children.map((child) => (
                          <a
                            key={child.name}
                            href={child.href}
                            className={`nav-child ${pathname === child.href || child.current ? "active" : ""}`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <span style={{width:6,height:6,borderRadius:"50%",background:"currentColor",flexShrink:0,display:"inline-block"}} />
                            {child.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>

            <div className="sidebar-user">
              <div className="user-avatar">{initials}</div>
              <div className="user-info">
                <div className="user-name">{displayName}</div>
                <div className="user-role">{roleLabel}</div>
              </div>
              <button className="logout-btn" onClick={handleLogout} title="Sign out">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="main-wrap">
          <header className="topbar">
            <button className="topbar-mobile-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div className="topbar-title">{title}</div>
            <span className="role-badge">{roleLabel}</span>
          </header>

          <main className="page-content">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
