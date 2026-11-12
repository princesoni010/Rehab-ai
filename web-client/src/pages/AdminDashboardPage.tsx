import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getAdminUsers, getAdminExercises } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { UserProfile } from "../lib/types";

export function AdminDashboardPage() {
  const { accessToken } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    Promise.all([
      getAdminUsers(accessToken).then(setUsers).catch(() => setUsers([])),
      getAdminExercises(accessToken).then(setExercises).catch(() => setExercises([])),
    ]).finally(() => setLoading(false));
  }, [accessToken]);

  const doctors = users.filter(u => u.role === "doctor").length;
  const patients = users.filter(u => u.role === "patient").length;
  const admins = users.filter(u => u.role === "admin").length;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p>Manage users, exercises, and platform settings.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{users.length}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{doctors}</div>
          <div className="stat-label">Doctors</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{patients}</div>
          <div className="stat-label">Patients</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{admins}</div>
          <div className="stat-label">Admins</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{exercises.length}</div>
          <div className="stat-label">Exercises</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>User Management</h3>
          <p>Add, edit, or remove doctors, patients, and admins.</p>
          <Link to="/admin/users" className="btn-primary">Manage Users</Link>
        </div>
        <div className="dashboard-card">
          <h3>Exercise Catalog</h3>
          <p>Manage the library of available exercises and workouts.</p>
          <Link to="/admin/exercises" className="btn-primary">Manage Exercises</Link>
        </div>
      </div>

      {loading && <div className="loading">Loading...</div>}
    </div>
  );
}
