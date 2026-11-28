import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { useImmersive } from "../lib/ImmersiveContext";
import { getPatientAssignments } from "../lib/api";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";

export function Shell() {
  const { user, logout, accessToken } = useAuth();
  const { isImmersive, setImmersive } = useImmersive();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasAssignments, setHasAssignments] = useState(false);

  const initial = user?.name?.charAt(0).toUpperCase() ?? "?";
  const isDoctor = user?.role === "doctor";
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (isDoctor || !accessToken) return;
    getPatientAssignments(accessToken).then(res => {
      setHasAssignments(res.length > 0);
    }).catch(console.error);
  }, [isDoctor, accessToken]);

  return (
    <div className={`app-shell ${isImmersive ? "immersive" : ""} ${isCollapsed ? "collapsed" : ""}`}>
      <div
        className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""} ${isImmersive ? "sidebar-hidden" : ""} ${isCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand">
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', cursor: isCollapsed ? 'pointer' : 'default' }}
            onClick={() => { if (isCollapsed) setIsCollapsed(false); }}
          >
            <div className="brand-icon">
              <img src="/logo.png" alt="Physico Health Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div className="brand-text">
              <span className="brand-name">Physico Health</span>
              <span className="brand-sub">Health Management</span>
            </div>
          </div>
          {!isCollapsed && (
            <button 
              className="sidebar-toggle-btn"
              onClick={() => setIsCollapsed(true)}
              title="Collapse sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <polyline points="15 8 11 12 15 16"/>
              </svg>
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-label">
            {isAdmin ? "Admin Panel" : isDoctor ? "Doctor Portal" : "Patient Care"}
          </span>

          {isAdmin ? (
            <>
              <NavLink
                to="/admin"
                end
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-link-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                </span>
                <span className="nav-link-text">Admin Dashboard</span>
              </NavLink>
              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-link-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </span>
                <span className="nav-link-text">Manage Users</span>
              </NavLink>
              <NavLink
                to="/admin/exercises"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-link-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2H5l4-4 4 4v16"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M5 4h14"/></svg>
                </span>
                <span className="nav-link-text">Exercise Catalog</span>
              </NavLink>
            </>
          ) : isDoctor ? (
            <>
              <NavLink
                to="/doctor"
                end
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-link-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                </span>
                <span className="nav-link-text">Clinical Dashboard</span>
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                to="/patient/exercise"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-link-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </span>
                <span className="nav-link-text">Live Exercise</span>
                {hasAssignments && !isCollapsed && (
                  <span style={{
                    width: "8px", height: "8px", background: "var(--accent-cyan)",
                    borderRadius: "50%", marginLeft: "auto",
                    boxShadow: "0 0 8px var(--accent-cyan)",
                  }} />
                )}
              </NavLink>
              <NavLink
                to="/patient/progress"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-link-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </span>
                <span className="nav-link-text">Recovery Analytics</span>
              </NavLink>
              <NavLink
                to="/health/dashboard"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-link-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="12" x2="12" y2="21"/><line x1="12" y1="12" x2="18.12" y2="18.12"/><line x1="12" y1="12" x2="5.88" y2="18.12"/><line x1="12" y1="12" x2="18.12" y2="5.88"/><line x1="12" y1="12" x2="5.88" y2="5.88"/></svg>
                </span>
                <span className="nav-link-text">Health Dashboard</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: "flex", justifyContent: isCollapsed ? "center" : "flex-start", alignItems: "center", marginBottom: "0.75rem", padding: isCollapsed ? "0" : "0 0.4rem", gap: "8px" }}>
            <ThemeToggle compact={isCollapsed} />
            {!isCollapsed && <NotificationBell />}
          </div>

          <div className="sidebar-user">
            <div className="user-avatar">{initial}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>{user?.role}</div>
            </div>
          </div>
          <button className="btn-ghost" style={{ width: "100%", marginTop: "0.5rem", padding: isCollapsed ? "0.5rem 0" : "0.5rem 0.75rem" }} onClick={logout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span className="nav-link-text">Sign Out</span>
          </button>
        </div>
      </aside>

      <div className={`main-content ${isImmersive ? "main-content-immersive" : ""}`}>
        {!isImmersive && (
          <div className="mobile-header">
            <button className="btn-icon btn-ghost mobile-toggle" onClick={() => setSidebarOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <span className="brand-name" style={{ fontSize: "1rem" }}>Physico Health</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
              <NotificationBell />
              <ThemeToggle compact={true} />
            </div>
          </div>
        )}

        <Outlet />
      </div>
    </div>
  );
}
