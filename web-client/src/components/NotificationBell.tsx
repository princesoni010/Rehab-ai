import { useEffect, useRef, useState } from "react";
import { getPatientNotifications } from "../lib/api";
import { useAuth } from "../lib/auth";

interface Notification {
  id: string;
  exercise_name: string;
  target_reps: number;
  target_sets: number;
  rest_interval_seconds: number;
  status: string;
  notes?: string;
  created_at: string;
  is_today: boolean;
}

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

function statusColor(status: string): string {
  if (status === "in_progress") return "var(--accent-cyan)";
  if (status === "completed") return "var(--accent-emerald)";
  return "var(--accent-amber)";
}

function statusLabel(status: string): string {
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  return "New";
}

export function NotificationBell() {
  const { accessToken, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [seen, setSeen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch on mount
  useEffect(() => {
    if (!accessToken || user?.role !== "patient") return;
    setLoading(true);
    getPatientNotifications(accessToken)
      .then((data) => {
        setNotifications(data.notifications);
        setTodayCount(data.today_count);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [accessToken, user?.role]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Only show for patients
  if (user?.role !== "patient") return null;

  const unread = todayCount > 0 && !seen;

  return (
    <div ref={panelRef} style={{ position: "relative", display: "inline-flex" }}>
      {/* Bell Button */}
      <button
        onClick={() => { setOpen((o) => !o); setSeen(true); }}
        title="Today's Assignments"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          position: "relative",
          padding: "6px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          transition: "color 0.2s, background 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-glass-hover, rgba(255,255,255,0.08))";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "none";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
        }}
      >
        {/* Bell SVG */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>

        {/* Badge */}
        {unread && (
          <span style={{
            position: "absolute",
            top: "2px",
            right: "2px",
            minWidth: "16px",
            height: "16px",
            background: "var(--accent-coral, #ef4444)",
            borderRadius: "9999px",
            fontSize: "10px",
            fontWeight: 700,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 3px",
            lineHeight: 1,
            boxShadow: "0 0 0 2px var(--sidebar-bg, #1a1a2e)",
          }}>
            {todayCount > 9 ? "9+" : todayCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: "320px",
          background: "var(--bg-secondary, #1e2235)",
          border: "1px solid var(--border-medium, rgba(255,255,255,0.1))",
          borderRadius: "12px",
          boxShadow: "var(--shadow-xl, 0 8px 32px rgba(0,0,0,0.4))",
          zIndex: 1000,
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 16px 10px",
            borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
              🔔 Aaj ke Tasks
            </span>
            <span style={{
              fontSize: "0.75rem",
              background: todayCount > 0 ? "var(--accent-amber, #f59e0b)" : "var(--bg-glass-hover)",
              color: todayCount > 0 ? "#000" : "var(--text-muted)",
              borderRadius: "999px",
              padding: "2px 8px",
              fontWeight: 600,
            }}>
              {todayCount > 0 ? `${todayCount} naya` : "koi naya nahi"}
            </span>
          </div>

          {/* Body */}
          <div style={{ maxHeight: "340px", overflowY: "auto" }}>
            {loading && (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Loading...
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div style={{ padding: "28px 16px", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🎉</div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Koi pending task nahi hai</div>
              </div>
            )}

            {!loading && notifications.map((n) => (
              <div key={n.id} style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.05))",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                background: n.is_today ? "rgba(245,158,11,0.05)" : "transparent",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>
                    💪 {n.exercise_name}
                  </span>
                  <span style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: statusColor(n.status),
                    background: `${statusColor(n.status)}22`,
                    borderRadius: "6px",
                    padding: "2px 7px",
                  }}>
                    {statusLabel(n.status)}
                  </span>
                </div>

                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  {n.target_sets} sets × {n.target_reps} reps · {n.rest_interval_seconds}s rest
                </div>

                {n.notes && (
                  <div style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    fontStyle: "italic",
                    marginTop: "2px",
                  }}>
                    📝 {n.notes}
                  </div>
                )}

                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                  {n.is_today && (
                    <span style={{
                      background: "var(--accent-amber, #f59e0b)",
                      color: "#000",
                      borderRadius: "4px",
                      padding: "1px 5px",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                    }}>TODAY</span>
                  )}
                  {timeAgo(n.created_at)}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
            textAlign: "center",
            fontSize: "0.78rem",
            color: "var(--text-muted)",
          }}>
            Saare tasks dekhne ke liye <strong style={{ color: "var(--accent-cyan)" }}>Live Exercise</strong> pe jao
          </div>
        </div>
      )}
    </div>
  );
}
