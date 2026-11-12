import { useEffect, useState } from "react";

import {
  getHealthProfile,
  saveHealthProfile,
  getVitals,
  saveVitals,
  getHealthGoals,
  saveHealthGoal,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import type { HealthProfile, VitalSigns, HealthGoal } from "../lib/types";

export function HealthDashboardPage() {
  const { accessToken, user } = useAuth();
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [vitals, setVitals] = useState<VitalSigns[]>([]);
  const [goals, setGoals] = useState<HealthGoal[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [conditions, setConditions] = useState("");
  const [allergies, setAllergies] = useState("");

  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [hr, setHr] = useState("");
  const [sugar, setSugar] = useState("");

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalType, setGoalType] = useState("general");

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    Promise.all([
      getHealthProfile(accessToken).then(setProfile).catch(() => setProfile(null)),
      getVitals(accessToken).then(setVitals).catch(() => setVitals([])),
      getHealthGoals(accessToken).then(setGoals).catch(() => setGoals([])),
    ]).finally(() => setLoading(false));
  }, [accessToken]);

  async function saveProfile() {
    if (!accessToken) return;
    try {
      const saved = await saveHealthProfile(accessToken, {
        height_cm: parseFloat(height),
        weight_kg: parseFloat(weight),
        medical_conditions: conditions || undefined,
        allergies: allergies || undefined,
      });
      setProfile(saved);
      setShowProfileForm(false);
    } catch (err) {
      alert("Failed to save health profile");
    }
  }

  async function saveVital() {
    if (!accessToken) return;
    try {
      await saveVitals(accessToken, {
        systolic_bp: sys ? parseInt(sys) : undefined,
        diastolic_bp: dia ? parseInt(dia) : undefined,
        heart_rate: hr ? parseInt(hr) : undefined,
        blood_sugar: sugar ? parseFloat(sugar) : undefined,
      });
      const refreshed = await getVitals(accessToken);
      setVitals(refreshed);
      setShowVitalsForm(false);
      setSys(""); setDia(""); setHr(""); setSugar("");
    } catch (err) {
      alert("Failed to save vitals");
    }
  }

  async function saveGoal() {
    if (!accessToken) return;
    try {
      await saveHealthGoal(accessToken, {
        title: goalTitle,
        target_type: goalType,
      });
      const refreshed = await getHealthGoals(accessToken);
      setGoals(refreshed);
      setShowGoalForm(false);
      setGoalTitle("");
    } catch (err) {
      alert("Failed to save goal");
    }
  }

  const bmi = profile ? (profile.weight_kg / ((profile.height_cm / 100) ** 2)).toFixed(1) : "-";

  if (loading) return <div className="loading">Loading health data...</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Health Dashboard</h1>
        <p>Track your physical health, vitals, and goals.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{bmi}</div>
          <div className="stat-label">BMI</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{profile?.height_cm || "-"} cm</div>
          <div className="stat-label">Height</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{profile?.weight_kg || "-"} kg</div>
          <div className="stat-label">Weight</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{vitals.length}</div>
          <div className="stat-label">Vitals Logged</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{goals.filter(g => g.status === "active").length}</div>
          <div className="stat-label">Active Goals</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Health Profile</h3>
          {profile ? (
            <>
              <p><strong>BMI Category:</strong> {profile.bmi_category}</p>
              <p><strong>Conditions:</strong> {profile.medical_conditions || "None"}</p>
              <p><strong>Allergies:</strong> {profile.allergies || "None"}</p>
              <p><strong>Emergency Contact:</strong> {profile.emergency_contact || "None"}</p>
              <button className="btn-primary" onClick={() => {
                setHeight(profile.height_cm.toString());
                setWeight(profile.weight_kg.toString());
                setConditions(profile.medical_conditions || "");
                setAllergies(profile.allergies || "");
                setShowProfileForm(true);
              }}>Edit Profile</button>
            </>
          ) : (
            <>
              <p>No health profile yet.</p>
              <button className="btn-primary" onClick={() => setShowProfileForm(true)}>Create Profile</button>
            </>
          )}
        </div>

        <div className="dashboard-card">
          <h3>Recent Vitals</h3>
          {vitals.length > 0 ? (
            <ul className="vitals-list">
              {vitals.slice(0, 5).map(v => (
                <li key={v.id}>
                  {new Date(v.recorded_at).toLocaleDateString()} - HR: {v.heart_rate || "-"}, BP: {v.systolic_bp || "-"}/{v.diastolic_bp || "-"}
                </li>
              ))}
            </ul>
          ) : (
            <p>No vitals logged yet.</p>
          )}
          <button className="btn-primary" onClick={() => setShowVitalsForm(true)}>Add Vitals</button>
        </div>

        <div className="dashboard-card">
          <h3>Health Goals</h3>
          {goals.length > 0 ? (
            <ul className="goals-list">
              {goals.map(g => (
                <li key={g.id}>
                  {g.title} <span className={`badge badge-${g.status}`}>{g.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No goals set yet.</p>
          )}
          <button className="btn-primary" onClick={() => setShowGoalForm(true)}>Add Goal</button>
        </div>
      </div>

      {showProfileForm && (
        <div className="form-card">
          <h3>{profile ? "Edit" : "Create"} Health Profile</h3>
          <form onSubmit={e => { e.preventDefault(); saveProfile(); }}>
            <label>
              Height (cm)
              <input value={height} onChange={e => setHeight(e.target.value)} required />
            </label>
            <label>
              Weight (kg)
              <input value={weight} onChange={e => setWeight(e.target.value)} required />
            </label>
            <label>
              Medical Conditions
              <input value={conditions} onChange={e => setConditions(e.target.value)} />
            </label>
            <label>
              Allergies
              <input value={allergies} onChange={e => setAllergies(e.target.value)} />
            </label>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowProfileForm(false)}>Cancel</button>
              <button className="btn-primary" type="submit">Save Profile</button>
            </div>
          </form>
        </div>
      )}

      {showVitalsForm && (
        <div className="form-card">
          <h3>Add Vitals</h3>
          <form onSubmit={e => { e.preventDefault(); saveVital(); }}>
            <label>
              Systolic BP
              <input value={sys} onChange={e => setSys(e.target.value)} />
            </label>
            <label>
              Diastolic BP
              <input value={dia} onChange={e => setDia(e.target.value)} />
            </label>
            <label>
              Heart Rate
              <input value={hr} onChange={e => setHr(e.target.value)} />
            </label>
            <label>
              Blood Sugar
              <input value={sugar} onChange={e => setSugar(e.target.value)} />
            </label>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowVitalsForm(false)}>Cancel</button>
              <button className="btn-primary" type="submit">Save Vitals</button>
            </div>
          </form>
        </div>
      )}

      {showGoalForm && (
        <div className="form-card">
          <h3>Add Health Goal</h3>
          <form onSubmit={e => { e.preventDefault(); saveGoal(); }}>
            <label>
              Goal Title
              <input value={goalTitle} onChange={e => setGoalTitle(e.target.value)} required />
            </label>
            <label>
              Goal Type
              <select value={goalType} onChange={e => setGoalType(e.target.value as any)}>
                <option value="weight_loss">Weight Loss</option>
                <option value="weight_gain">Weight Gain</option>
                <option value="flexibility">Flexibility</option>
                <option value="strength">Strength</option>
                <option value="recovery">Recovery</option>
                <option value="general">General</option>
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowGoalForm(false)}>Cancel</button>
              <button className="btn-primary" type="submit">Save Goal</button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="loading">Loading...</div>}
    </div>
  );
}
