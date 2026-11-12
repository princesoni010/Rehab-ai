import { FormEvent, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { UserProfile } from "../lib/types";

export function UserManagementPage() {
  const { accessToken } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"doctor" | "patient" | "admin">("patient");

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    getAdminUsers(accessToken)
      .then(setUsers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [accessToken]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const payload = {
        name: formName,
        email: formEmail,
        username: formUsername,
        password: formPassword,
        role: formRole,
      };
      if (editingId) {
        await updateAdminUser(accessToken, editingId, {
          name: formName || undefined,
          email: formEmail || undefined,
          username: formUsername || undefined,
          password: formPassword || undefined,
          role: formRole,
        });
      } else {
        await createAdminUser(accessToken, payload);
      }
      setSuccess(editingId ? "User updated successfully" : "User created successfully");
      resetForm();
      setOpenForm(false);
      const refreshed = await getAdminUsers(accessToken);
      setUsers(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(userId: string) {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    if (!accessToken) return;
    try {
      await deleteAdminUser(accessToken, userId);
      setSuccess("User deleted successfully");
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  function resetForm() {
    setEditingId(null);
    setFormName("");
    setFormEmail("");
    setFormUsername("");
    setFormPassword("");
    setFormRole("patient");
  }

  function editUser(user: UserProfile) {
    setEditingId(user.id);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormUsername(user.username);
    setFormRole(user.role as "doctor" | "patient" | "admin");
    setFormPassword("");
    setOpenForm(true);
  }

  if (loading) return <div className="loading">Loading users...</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Manage Users</h1>
        <p>Add, edit, or remove doctors, patients, and admins.</p>
      </div>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Username</th>
              <th>Role</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.username}</td>
                <td>
                  <span className={`badge badge-${u.role}`}>{u.role}</span>
                </td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                  <button className="btn-ghost" onClick={() => editUser(u)}>Edit</button>
                  <button className="btn-ghost btn-danger" onClick={() => handleDelete(u.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="form-card">
        <button
          className="btn-primary"
          onClick={() => { resetForm(); setOpenForm(true); }}
        >
          {editingId ? "Edit User" : "Add User"}
        </button>

        {openForm && (
          <form onSubmit={onSubmit} className="inner-form">
            <label>
              Full Name
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Username
              <input
                value={formUsername}
                onChange={e => setFormUsername(e.target.value)}
                required
              />
            </label>
            {!editingId && (
              <label>
                Password
                <input
                  type="password"
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  required
                />
              </label>
            )}
            <label>
              Role
              <select value={formRole} onChange={e => setFormRole(e.target.value as any)}>
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setOpenForm(false)}>Cancel</button>
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save User"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
