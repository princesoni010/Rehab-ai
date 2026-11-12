import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { ThemeToggle } from "../components/ThemeToggle";

type RoleType = "doctor" | "patient" | "admin";

export function LoginPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleType>("patient");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register({ name, username, email, password, role });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function fillDoctor() {
    setEmail("doctor.demo@physico.local");
    setPassword("Doctor@123");
  }
  function fillPatient() {
    setEmail("pathak@physico.local");
    setPassword("12345678");
  }
  function fillAdmin() {
    setEmail("admin@physico.local");
    setPassword("Admin@123");
  }

  return (
    <div className="auth-layout">
      <div className="auth-theme-bar">
        <ThemeToggle />
      </div>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-badge">⚡ AI-Powered Health Management</div>
        <h1>Physico Health</h1>
        <p>
          Complete physical health management platform. Real-time motion tracking,
          health vitals, diet plans, and doctor-supervised progression — all from your browser.
        </p>
        <div className="hero-features">
          <div className="hero-feature">
            <div className="hero-feature-icon">🎯</div>
            <span>ROM, Stability &amp; Tempo scoring per rep</span>
          </div>
          <div className="hero-feature">
            <div className="hero-feature-icon">🏥</div>
            <span>Doctor-patient management &amp; prescriptions</span>
          </div>
          <div className="hero-feature">
            <div className="hero-feature-icon">📊</div>
            <span>Health vitals, BMI &amp; goal tracking</span>
          </div>
          <div className="hero-feature">
            <div className="hero-feature-icon">🥗</div>
            <span>Diet plans &amp; nutrition management</span>
          </div>
        </div>
      </section>

      {/* Auth Card */}
      <section style={{ display: "grid", placeItems: "center", padding: "2rem" }}>
        <div className="auth-card">
          <h2>{mode === "login" ? "Welcome Back" : "Create Account"}</h2>
          <p className="auth-subtitle">
            {mode === "login"
              ? "Sign in to your Physico Health account"
              : "Get started with your health journey"}
          </p>

          {/* Mode Tabs */}
          <div className="mode-switch">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
              type="button"
            >
              Sign In
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => setMode("register")}
              type="button"
            >
              Create Account
            </button>
          </div>

          {/* Quick Demo Fill Buttons (Login mode only) */}
          {mode === "login" && (
            <div style={{ marginBottom: "1.2rem", marginTop: "0.5rem" }}>
              <div style={{
                fontSize: "0.72rem",
                color: "var(--text-dim)",
                marginBottom: "0.4rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 600,
              }}>
                Quick Demo Fill
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={fillDoctor}
                  style={{
                    padding: "0.45rem 0.5rem",
                    fontSize: "0.75rem",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--accent-cyan)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  🩺 Doctor
                </button>
                <button
                  type="button"
                  onClick={fillPatient}
                  style={{
                    padding: "0.45rem 0.5rem",
                    fontSize: "0.75rem",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--accent-emerald)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  🏃 Patient
                </button>
                <button
                  type="button"
                  onClick={fillAdmin}
                  style={{
                    padding: "0.45rem 0.5rem",
                    fontSize: "0.75rem",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--accent-amber)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  👑 Admin
                </button>
              </div>
            </div>
          )}

          {/* The Form */}
          <form onSubmit={onSubmit}>
            {/* Register-only fields */}
            {mode === "register" && (
              <>
                <label>
                  Full Name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. Jane Smith"
                    required
                  />
                </label>
                <label>
                  Username
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="janesmith"
                    required
                  />
                </label>
                <label>Role</label>
                <div className="role-picker">
                  <button
                    type="button"
                    className={`role-option ${role === "patient" ? "active" : ""}`}
                    onClick={() => setRole("patient")}
                  >
                    <span className="role-option-icon">🏃</span>
                    Patient
                  </button>
                  <button
                    type="button"
                    className={`role-option ${role === "doctor" ? "active" : ""}`}
                    onClick={() => setRole("doctor")}
                  >
                    <span className="role-option-icon">🩺</span>
                    Doctor
                  </button>
                  <button
                    type="button"
                    className={`role-option ${role === "admin" ? "active" : ""}`}
                    onClick={() => setRole("admin")}
                  >
                    <span className="role-option-icon">👑</span>
                    Admin
                  </button>
                </div>
                <p className="demo-hint">
                  Demo logins: admin@physico.local / Admin@123 · doctor.demo@physico.local / Doctor@123 · any patient / 12345678
                </p>
              </>
            )}

            {/* Common fields */}
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>

            {error && <p className="error-text">{error}</p>}

            <button className="btn-primary" disabled={busy} type="submit">
              {busy ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
