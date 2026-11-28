import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getDietPlans,
  getHealthGoals,
  getHealthProfile,
  getVitals,
  saveHealthGoal,
  saveHealthProfile,
  saveVitals,
  updateHealthGoalStatus,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import type { DietPlan, HealthGoal, HealthProfile, VitalSigns } from "../lib/types";

function getBmiMeta(bmiValue: number | null): {
  label: string;
  color: string;
  bg: string;
  percent: number;
} {
  if (bmiValue === null || Number.isNaN(bmiValue)) {
    return {
      label: "Not set",
      color: "var(--text-muted)",
      bg: "var(--bg-glass)",
      percent: 0,
    };
  }
  const clamped = Math.min(40, Math.max(12, bmiValue));
  const percent = ((clamped - 12) / (40 - 12)) * 100;
  if (bmiValue < 18.5) {
    return {
      label: "Underweight",
      color: "var(--accent-cyan)",
      bg: "var(--accent-cyan-glow)",
      percent,
    };
  }
  if (bmiValue < 25) {
    return {
      label: "Normal",
      color: "var(--accent-emerald)",
      bg: "var(--accent-emerald-glow)",
      percent,
    };
  }
  if (bmiValue < 30) {
    return {
      label: "Overweight",
      color: "var(--accent-amber)",
      bg: "var(--accent-amber-glow)",
      percent,
    };
  }
  return {
    label: "Obese",
    color: "var(--accent-coral)",
    bg: "var(--accent-coral-glow)",
    percent,
  };
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function formatDateShort(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      day: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function goalTypeLabel(type: string): string {
  switch (type) {
    case "weight_loss":
      return "Weight Loss";
    case "weight_gain":
      return "Weight Gain";
    case "flexibility":
      return "Flexibility";
    case "strength":
      return "Strength";
    case "recovery":
      return "Recovery";
    default:
      return "General";
  }
}

function goalTypeIcon(type: string): string {
  switch (type) {
    case "weight_loss":
    case "weight_gain":
      return "⚖️";
    case "flexibility":
      return "🧘";
    case "strength":
      return "💪";
    case "recovery":
      return "🩺";
    default:
      return "🎯";
  }
}

export function HealthDashboardPage() {
  const { accessToken, user } = useAuth();
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [vitals, setVitals] = useState<VitalSigns[]>([]);
  const [goals, setGoals] = useState<HealthGoal[]>([]);
  const [dietPlans, setDietPlans] = useState<DietPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Modals
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [conditions, setConditions] = useState("");
  const [allergies, setAllergies] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [hr, setHr] = useState("");
  const [sugar, setSugar] = useState("");
  const [tempC, setTempC] = useState("");
  const [vitalNotes, setVitalNotes] = useState("");

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalType, setGoalType] = useState("recovery");
  const [goalTargetValue, setGoalTargetValue] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [goalDesc, setGoalDesc] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    Promise.all([
      getHealthProfile(accessToken).then(setProfile).catch(() => setProfile(null)),
      getVitals(accessToken).then(setVitals).catch(() => setVitals([])),
      getHealthGoals(accessToken).then(setGoals).catch(() => setGoals([])),
      getDietPlans(accessToken).then(setDietPlans).catch(() => setDietPlans([])),
    ]).finally(() => setLoading(false));
  }, [accessToken]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowProfileForm(false);
        setShowVitalsForm(false);
        setShowGoalForm(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function flashSuccess(msg: string) {
    setBannerSuccess(msg);
    setTimeout(() => setBannerSuccess(null), 3500);
  }

  function openProfileModal() {
    setModalError(null);
    if (profile) {
      setHeight(profile.height_cm.toString());
      setWeight(profile.weight_kg.toString());
      setConditions(profile.medical_conditions || "");
      setAllergies(profile.allergies || "");
      setEmergencyContact(profile.emergency_contact || "");
    } else {
      setHeight("");
      setWeight("");
      setConditions("");
      setAllergies("");
      setEmergencyContact("");
    }
    setShowProfileForm(true);
  }

  function openVitalsModal() {
    setModalError(null);
    setSys("");
    setDia("");
    setHr("");
    setSugar("");
    setTempC("");
    setVitalNotes("");
    setShowVitalsForm(true);
  }

  function openGoalModal() {
    setModalError(null);
    setGoalTitle("");
    setGoalType("recovery");
    setGoalTargetValue("");
    setGoalTargetDate("");
    setGoalDesc("");
    setShowGoalForm(true);
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (Number.isNaN(h) || h <= 0 || h > 300 || Number.isNaN(w) || w <= 0 || w > 300) {
      setModalError("Please enter valid height (1–300 cm) and weight (1–300 kg).");
      return;
    }

    setSaving(true);
    setModalError(null);
    try {
      const saved = await saveHealthProfile(
        accessToken,
        {
          height_cm: h,
          weight_kg: w,
          medical_conditions: conditions.trim() || undefined,
          allergies: allergies.trim() || undefined,
          emergency_contact: emergencyContact.trim() || undefined,
        },
        Boolean(profile)
      );
      setProfile(saved);
      setShowProfileForm(false);
      flashSuccess(profile ? "Health profile updated." : "Health profile created.");
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to save health profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveVital(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    if (!sys && !dia && !hr && !sugar && !tempC) {
      setModalError("Enter at least one vital sign measurement.");
      return;
    }

    setSaving(true);
    setModalError(null);
    try {
      await saveVitals(accessToken, {
        systolic_bp: sys ? parseInt(sys, 10) : undefined,
        diastolic_bp: dia ? parseInt(dia, 10) : undefined,
        heart_rate: hr ? parseInt(hr, 10) : undefined,
        blood_sugar: sugar ? parseFloat(sugar) : undefined,
        temperature_c: tempC ? parseFloat(tempC) : undefined,
        notes: vitalNotes.trim() || undefined,
      });
      const refreshed = await getVitals(accessToken);
      setVitals(refreshed);
      setShowVitalsForm(false);
      flashSuccess("Vitals logged successfully.");
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to save vitals");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveGoal(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    if (goalTitle.trim().length < 2) {
      setModalError("Goal title must be at least 2 characters.");
      return;
    }

    setSaving(true);
    setModalError(null);
    try {
      await saveHealthGoal(accessToken, {
        title: goalTitle.trim(),
        target_type: goalType,
        target_value: goalTargetValue ? parseFloat(goalTargetValue) : undefined,
        target_date: goalTargetDate ? new Date(goalTargetDate).toISOString() : undefined,
        description: goalDesc.trim() || undefined,
      });
      const refreshed = await getHealthGoals(accessToken);
      setGoals(refreshed);
      setShowGoalForm(false);
      flashSuccess("Health goal added.");
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to save goal");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleGoalStatus(goal: HealthGoal) {
    if (!accessToken) return;
    const nextStatus = goal.status === "completed" ? "active" : "completed";
    setBannerError(null);
    try {
      await updateHealthGoalStatus(accessToken, goal.id, nextStatus);
      setGoals((prev) =>
        prev.map((g) => (g.id === goal.id ? { ...g, status: nextStatus } : g))
      );
      flashSuccess(
        nextStatus === "completed" ? "Goal marked as completed!" : "Goal reactivated."
      );
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : "Failed to update goal status");
    }
  }

  const bmiValue = useMemo(() => {
    if (!profile) return null;
    if (typeof profile.bmi === "number") return profile.bmi;
    return Number((profile.weight_kg / (profile.height_cm / 100) ** 2).toFixed(1));
  }, [profile]);

  const bmiMeta = getBmiMeta(bmiValue);
  const latestVital = vitals[0] ?? null;
  const activeGoalsCount = goals.filter((g) => g.status === "active").length;
  const completedGoalsCount = goals.filter((g) => g.status === "completed").length;

  const vitalsChartData = useMemo(() => {
    return vitals
      .slice(0, 8)
      .reverse()
      .map((v) => ({
        date: formatDateShort(v.recorded_at),
        hr: v.heart_rate ?? undefined,
        sys: v.systolic_bp ?? undefined,
        dia: v.diastolic_bp ?? undefined,
      }));
  }, [vitals]);

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: "55vh" }}>
        <div className="loading-spinner" />
        <span className="empty-text">Loading your health dashboard...</span>
      </div>
    );
  }

  return (
    <div className="health-layout" id="health-dashboard-page">
      {/* Header */}
      <div className="health-header">
        <div>
          <h1 className="page-title">Health Dashboard</h1>
          <p className="page-subtitle">
            {user?.name ? `Welcome back, ${user.name} — ` : ""}
            Track your body metrics, vital signs, and wellness goals
          </p>
        </div>

        <div className="health-header-actions">
          <button type="button" className="btn-secondary" onClick={openVitalsModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Log Vitals
          </button>
          <button type="button" className="btn-secondary" onClick={openGoalModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
            Add Goal
          </button>
          <button type="button" className="btn-primary" onClick={openProfileModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {profile ? "Edit Profile" : "Setup Profile"}
          </button>
        </div>
      </div>

      {bannerError && <div className="error-text">{bannerError}</div>}
      {bannerSuccess && <div className="success-text">{bannerSuccess}</div>}

      {/* Top KPI Cards */}
      <div className="health-stats-row">
        <div className="glass-card health-stat-card accent-emerald">
          <div className="health-stat-top">
            <span className="stat-card-label">BMI Index</span>
            <span
              className="health-stat-icon"
              style={{ background: bmiMeta.bg, color: bmiMeta.color }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </span>
          </div>
          <div className="health-stat-value" style={{ color: bmiMeta.color }}>
            {bmiValue !== null ? bmiValue.toFixed(1) : "--"}
          </div>
          <div className="health-stat-sub" style={{ color: bmiMeta.color, fontWeight: 600 }}>
            {profile?.bmi_category || bmiMeta.label}
          </div>
        </div>

        <div className="glass-card health-stat-card">
          <div className="health-stat-top">
            <span className="stat-card-label">Height</span>
            <span
              className="health-stat-icon"
              style={{ background: "var(--accent-cyan-glow)", color: "var(--accent-cyan)" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M8 6l4-4 4 4M8 18l4 4 4-4" />
              </svg>
            </span>
          </div>
          <div className="health-stat-value">
            {profile ? profile.height_cm : "--"}
            <span className="health-stat-unit">cm</span>
          </div>
          <div className="health-stat-sub">
            {profile ? "Recorded height" : "Add in health profile"}
          </div>
        </div>

        <div className="glass-card health-stat-card accent-purple">
          <div className="health-stat-top">
            <span className="stat-card-label">Weight</span>
            <span
              className="health-stat-icon"
              style={{ background: "var(--accent-purple-glow)", color: "var(--accent-purple)" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <path d="M12 8v4l2 2" />
              </svg>
            </span>
          </div>
          <div className="health-stat-value">
            {profile ? profile.weight_kg : "--"}
            <span className="health-stat-unit">kg</span>
          </div>
          <div className="health-stat-sub">
            {profile ? `Updated ${formatDateShort(profile.updated_at)}` : "Add in health profile"}
          </div>
        </div>

        <div className="glass-card health-stat-card accent-coral">
          <div className="health-stat-top">
            <span className="stat-card-label">Vitals Logged</span>
            <span
              className="health-stat-icon"
              style={{ background: "var(--accent-coral-glow)", color: "var(--accent-coral)" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </span>
          </div>
          <div className="health-stat-value">{vitals.length}</div>
          <div className="health-stat-sub">
            {latestVital
              ? `Last HR: ${latestVital.heart_rate ?? "--"} bpm`
              : "No readings yet"}
          </div>
        </div>

        <div className="glass-card health-stat-card accent-amber">
          <div className="health-stat-top">
            <span className="stat-card-label">Active Goals</span>
            <span
              className="health-stat-icon"
              style={{ background: "var(--accent-amber-glow)", color: "var(--accent-amber)" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </span>
          </div>
          <div className="health-stat-value">{activeGoalsCount}</div>
          <div className="health-stat-sub">
            {completedGoalsCount} completed
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="health-main-grid">
        {/* Left Column: Health Profile + Health Goals */}
        <div className="health-column">
          {/* Health Profile Card */}
          <div className="glass-card health-card">
            <div className="health-card-header">
              <div className="health-card-title">
                <span
                  className="health-card-icon"
                  style={{ background: "var(--accent-cyan-glow)", color: "var(--accent-cyan)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <div>
                  <h3>Health Profile</h3>
                  <div className="health-card-subtitle">Personal baseline & clinical details</div>
                </div>
              </div>
              <button
                type="button"
                className={profile ? "btn-secondary" : "btn-primary"}
                style={{ padding: "0.45rem 0.85rem", fontSize: "0.82rem" }}
                onClick={openProfileModal}
              >
                {profile ? "Edit" : "Create Profile"}
              </button>
            </div>

            {profile ? (
              <>
                <div className="bmi-panel">
                  <div className="bmi-panel-top">
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Body Mass Index
                      </span>
                      <div style={{ fontSize: "1.35rem", fontWeight: 800, fontFamily: '"Outfit", sans-serif', color: bmiMeta.color }}>
                        {bmiValue?.toFixed(1)} · {profile.bmi_category}
                      </div>
                    </div>
                    <span className="badge" style={{ background: bmiMeta.bg, color: bmiMeta.color, borderColor: "transparent" }}>
                      Healthy: 18.5 – 24.9
                    </span>
                  </div>

                  <div className="bmi-track-wrap">
                    <div className="bmi-track">
                      <div className="bmi-marker" style={{ left: `${bmiMeta.percent}%` }} />
                    </div>
                  </div>
                  <div className="bmi-scale-labels">
                    <span>Underweight</span>
                    <span>Normal</span>
                    <span>Overweight</span>
                    <span>Obese</span>
                  </div>
                </div>

                <div className="health-info-grid">
                  <div className="health-info-item">
                    <span className="health-info-label">Medical Conditions</span>
                    <span className="health-info-value">{profile.medical_conditions || "None reported"}</span>
                  </div>
                  <div className="health-info-item">
                    <span className="health-info-label">Allergies</span>
                    <span className="health-info-value">{profile.allergies || "None reported"}</span>
                  </div>
                  <div className="health-info-item">
                    <span className="health-info-label">Emergency Contact</span>
                    <span className="health-info-value">{profile.emergency_contact || "Not set"}</span>
                  </div>
                  <div className="health-info-item">
                    <span className="health-info-label">Last Updated</span>
                    <span className="health-info-value">{formatDateTime(profile.updated_at)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state" style={{ padding: "1.75rem 1rem" }}>
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="1.6" opacity="0.75">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.95rem" }}>
                  No health profile yet
                </div>
                <span className="empty-text" style={{ maxWidth: "34ch" }}>
                  Add your height, weight, and medical info to calculate your BMI and personalize recovery tracking.
                </span>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: "0.5rem" }}
                  onClick={openProfileModal}
                >
                  Create Health Profile
                </button>
              </div>
            )}
          </div>

          {/* Health Goals Card */}
          <div className="glass-card health-card">
            <div className="health-card-header">
              <div className="health-card-title">
                <span
                  className="health-card-icon"
                  style={{ background: "var(--accent-amber-glow)", color: "var(--accent-amber)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                </span>
                <div>
                  <h3>Health Goals</h3>
                  <div className="health-card-subtitle">
                    {goals.length > 0 ? `${activeGoalsCount} active · ${completedGoalsCount} completed` : "Set recovery milestones"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "0.45rem 0.85rem", fontSize: "0.82rem" }}
                onClick={openGoalModal}
              >
                + Add Goal
              </button>
            </div>

            {goals.length > 0 ? (
              <div className="health-list">
                {goals.map((g) => (
                  <div key={g.id} className="goal-row">
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: "1.2rem", lineHeight: 1.3 }}>{goalTypeIcon(g.target_type)}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: "0.92rem",
                              color: "var(--text-primary)",
                              textDecoration: g.status === "completed" ? "line-through" : "none",
                              opacity: g.status === "completed" ? 0.75 : 1,
                            }}
                          >
                            {g.title}
                          </span>
                          <span className={`badge badge-${g.status}`}>{g.status}</span>
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                          {goalTypeLabel(g.target_type)}
                          {g.target_value !== null && g.target_value !== undefined ? ` · Target: ${g.target_value}` : ""}
                          {g.target_date ? ` · Due ${formatDateShort(g.target_date)}` : ""}
                        </div>
                        {g.description && (
                          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.3rem" }}>
                            {g.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="goal-action-btn"
                      onClick={() => void handleToggleGoalStatus(g)}
                    >
                      {g.status === "completed" ? "Reopen" : "Complete"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: "1.5rem 1rem" }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" strokeWidth="1.6" opacity="0.75">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
                <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.95rem" }}>
                  No goals set yet
                </div>
                <span className="empty-text">
                  Create a mobility, strength, or weight goal to stay motivated.
                </span>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: "0.4rem" }}
                  onClick={openGoalModal}
                >
                  Add First Goal
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Vitals Monitoring + Nutrition Plans */}
        <div className="health-column">
          <div className="glass-card health-card">
            <div className="health-card-header">
              <div className="health-card-title">
                <span
                  className="health-card-icon"
                  style={{ background: "var(--accent-coral-glow)", color: "var(--accent-coral)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </span>
                <div>
                  <h3>Vitals Monitoring</h3>
                  <div className="health-card-subtitle">
                    {latestVital ? `Latest entry: ${formatDateTime(latestVital.recorded_at)}` : "Blood pressure, heart rate & glucose"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: "0.45rem 0.85rem", fontSize: "0.82rem" }}
                onClick={openVitalsModal}
              >
                + Log Vitals
              </button>
            </div>

            {/* Latest Vitals Tiles */}
            <div className="vitals-summary-grid">
              <div className="vital-tile">
                <span className="vital-tile-label">Blood Pressure</span>
                <span className="vital-tile-value" style={{ color: "var(--accent-coral)" }}>
                  {latestVital?.systolic_bp || latestVital?.diastolic_bp
                    ? `${latestVital.systolic_bp ?? "--"}/${latestVital.diastolic_bp ?? "--"}`
                    : "--"}
                </span>
                <span className="vital-tile-unit">mmHg</span>
              </div>
              <div className="vital-tile">
                <span className="vital-tile-label">Heart Rate</span>
                <span className="vital-tile-value" style={{ color: "var(--accent-emerald)" }}>
                  {latestVital?.heart_rate ?? "--"}
                </span>
                <span className="vital-tile-unit">bpm</span>
              </div>
              <div className="vital-tile">
                <span className="vital-tile-label">Blood Sugar</span>
                <span className="vital-tile-value" style={{ color: "var(--accent-amber)" }}>
                  {latestVital?.blood_sugar ?? "--"}
                </span>
                <span className="vital-tile-unit">mg/dL</span>
              </div>
              <div className="vital-tile">
                <span className="vital-tile-label">Temperature</span>
                <span className="vital-tile-value" style={{ color: "var(--accent-cyan)" }}>
                  {latestVital?.temperature_c ?? "--"}
                </span>
                <span className="vital-tile-unit">°C</span>
              </div>
            </div>

            {/* Vitals Trend Chart (when 2+ entries exist) */}
            {vitalsChartData.length >= 2 && (
              <div
                style={{
                  padding: "0.9rem",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.65rem" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    Heart Rate & Systolic BP Trend
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    Last {vitalsChartData.length} logs
                  </span>
                </div>
                <div style={{ width: "100%", height: "180px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={vitalsChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                      <RechartsTooltip
                        contentStyle={{
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border-medium)",
                          borderRadius: "10px",
                          fontSize: "0.8rem",
                        }}
                      />
                      <Line type="monotone" dataKey="hr" name="Heart Rate (bpm)" stroke="var(--accent-emerald)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey="sys" name="Systolic BP" stroke="var(--accent-coral)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Recent Vitals Log */}
            <div>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "0.6rem" }}>
                Recent Vitals History
              </div>

              {vitals.length > 0 ? (
                <div className="health-list">
                  {vitals.slice(0, 8).map((v) => (
                    <div key={v.id} className="vital-row">
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                          {formatDateTime(v.recorded_at)}
                        </div>
                        {v.notes && (
                          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "2px" }}>
                            {v.notes}
                          </div>
                        )}
                      </div>
                      <div className="vital-row-metrics">
                        {(v.systolic_bp || v.diastolic_bp) && (
                          <span className="vital-pill">BP {v.systolic_bp ?? "-"}/{v.diastolic_bp ?? "-"}</span>
                        )}
                        {v.heart_rate && <span className="vital-pill">HR {v.heart_rate} bpm</span>}
                        {v.blood_sugar && <span className="vital-pill">Sugar {v.blood_sugar}</span>}
                        {v.temperature_c && <span className="vital-pill">{v.temperature_c}°C</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: "1.75rem 1rem", background: "var(--bg-input)", borderRadius: "var(--radius-lg)", border: "1px dashed var(--border-medium)" }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-coral)" strokeWidth="1.6" opacity="0.75">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.95rem" }}>
                    No vitals logged yet
                  </div>
                  <span className="empty-text">
                    Record your blood pressure, heart rate, or blood sugar to spot trends over time.
                  </span>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ marginTop: "0.4rem" }}
                    onClick={openVitalsModal}
                  >
                    Log First Reading
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Diet Plans (if assigned by doctor) */}
          {dietPlans.length > 0 && (
            <div className="glass-card health-card">
              <div className="health-card-header">
                <div className="health-card-title">
                  <span
                    className="health-card-icon"
                    style={{ background: "var(--accent-emerald-glow)", color: "var(--accent-emerald)" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  </span>
                  <div>
                    <h3>Nutrition & Diet Plans</h3>
                    <div className="health-card-subtitle">Prescribed recovery nutrition targets</div>
                  </div>
                </div>
              </div>

              <div className="health-list">
                {dietPlans.map((plan) => (
                  <div key={plan.id} className="vital-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                      <strong style={{ fontSize: "0.92rem", color: "var(--text-primary)" }}>{plan.title}</strong>
                      <span className={`badge badge-${plan.status}`}>{plan.status}</span>
                    </div>
                    {plan.description && (
                      <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{plan.description}</p>
                    )}
                    <div className="vital-row-metrics">
                      {plan.calories_target && <span className="vital-pill">{plan.calories_target} kcal</span>}
                      {plan.protein_g && <span className="vital-pill">Protein {plan.protein_g}g</span>}
                      {plan.carbs_g && <span className="vital-pill">Carbs {plan.carbs_g}g</span>}
                      {plan.fat_g && <span className="vital-pill">Fat {plan.fat_g}g</span>}
                    </div>
                    {plan.meal_plan && (
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
                        {plan.meal_plan}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Health Profile */}
      {showProfileForm && (
        <div className="modal-backdrop" onClick={() => setShowProfileForm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>{profile ? "Edit Health Profile" : "Create Health Profile"}</h3>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  Used to compute BMI and clinical baseline
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost btn-icon"
                onClick={() => setShowProfileForm(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {modalError && <div className="error-text" style={{ marginBottom: "1rem" }}>{modalError}</div>}
              <form onSubmit={handleSaveProfile}>
                <div className="modal-grid-2">
                  <label>
                    Height (cm) *
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="300"
                      placeholder="e.g. 172"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Weight (kg) *
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="300"
                      placeholder="e.g. 68"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      required
                    />
                  </label>
                </div>

                <label>
                  Emergency Contact
                  <input
                    type="text"
                    placeholder="Name & phone number"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                  />
                </label>

                <label>
                  Medical Conditions
                  <input
                    type="text"
                    placeholder="e.g. ACL recovery, mild hypertension"
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                  />
                </label>

                <label>
                  Allergies
                  <input
                    type="text"
                    placeholder="e.g. Penicillin, none"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                  />
                </label>

                <div className="form-actions">
                  <button type="button" className="btn-ghost" onClick={() => setShowProfileForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Log Vitals */}
      {showVitalsForm && (
        <div className="modal-backdrop" onClick={() => setShowVitalsForm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Log Vital Signs</h3>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  Fill in whichever readings you measured today
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost btn-icon"
                onClick={() => setShowVitalsForm(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {modalError && <div className="error-text" style={{ marginBottom: "1rem" }}>{modalError}</div>}
              <form onSubmit={handleSaveVital}>
                <div className="modal-grid-2">
                  <label>
                    Systolic BP (mmHg)
                    <input
                      type="number"
                      min="50"
                      max="300"
                      placeholder="e.g. 120"
                      value={sys}
                      onChange={(e) => setSys(e.target.value)}
                    />
                  </label>
                  <label>
                    Diastolic BP (mmHg)
                    <input
                      type="number"
                      min="30"
                      max="200"
                      placeholder="e.g. 80"
                      value={dia}
                      onChange={(e) => setDia(e.target.value)}
                    />
                  </label>
                  <label>
                    Heart Rate (bpm)
                    <input
                      type="number"
                      min="30"
                      max="220"
                      placeholder="e.g. 72"
                      value={hr}
                      onChange={(e) => setHr(e.target.value)}
                    />
                  </label>
                  <label>
                    Blood Sugar (mg/dL)
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="600"
                      placeholder="e.g. 95"
                      value={sugar}
                      onChange={(e) => setSugar(e.target.value)}
                    />
                  </label>
                </div>

                <label>
                  Temperature (°C)
                  <input
                    type="number"
                    step="0.1"
                    min="30"
                    max="45"
                    placeholder="e.g. 36.8"
                    value={tempC}
                    onChange={(e) => setTempC(e.target.value)}
                  />
                </label>

                <label>
                  Notes
                  <input
                    type="text"
                    placeholder="e.g. Measured after morning walk"
                    value={vitalNotes}
                    onChange={(e) => setVitalNotes(e.target.value)}
                  />
                </label>

                <div className="form-actions">
                  <button type="button" className="btn-ghost" onClick={() => setShowVitalsForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? "Saving..." : "Save Vitals"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Health Goal */}
      {showGoalForm && (
        <div className="modal-backdrop" onClick={() => setShowGoalForm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Add Health Goal</h3>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  Define a measurable milestone for your recovery
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost btn-icon"
                onClick={() => setShowGoalForm(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {modalError && <div className="error-text" style={{ marginBottom: "1rem" }}>{modalError}</div>}
              <form onSubmit={handleSaveGoal}>
                <label>
                  Goal Title *
                  <input
                    type="text"
                    placeholder="e.g. Reach 90° knee flexion"
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    required
                  />
                </label>

                <div className="modal-grid-2">
                  <label>
                    Goal Type
                    <select value={goalType} onChange={(e) => setGoalType(e.target.value)}>
                      <option value="recovery">Recovery</option>
                      <option value="flexibility">Flexibility</option>
                      <option value="strength">Strength</option>
                      <option value="weight_loss">Weight Loss</option>
                      <option value="weight_gain">Weight Gain</option>
                      <option value="general">General</option>
                    </select>
                  </label>
                  <label>
                    Target Date (Optional)
                    <input
                      type="date"
                      value={goalTargetDate}
                      onChange={(e) => setGoalTargetDate(e.target.value)}
                    />
                  </label>
                </div>

                <label>
                  Target Value (Optional)
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 65 (kg) or 90 (degrees)"
                    value={goalTargetValue}
                    onChange={(e) => setGoalTargetValue(e.target.value)}
                  />
                </label>

                <label>
                  Description (Optional)
                  <textarea
                    placeholder="Notes about this milestone..."
                    value={goalDesc}
                    onChange={(e) => setGoalDesc(e.target.value)}
                  />
                </label>

                <div className="form-actions">
                  <button type="button" className="btn-ghost" onClick={() => setShowGoalForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? "Saving..." : "Save Goal"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
