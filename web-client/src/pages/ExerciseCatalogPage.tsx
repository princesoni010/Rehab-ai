import { FormEvent, useEffect, useState } from "react";

import {
  getAdminExercises,
  createAdminExercise,
  updateAdminExercise,
  deleteAdminExercise,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import type { ExerciseCatalogItem } from "../lib/types";

export function ExerciseCatalogPage() {
  const { accessToken } = useAuth();
  const [exercises, setExercises] = useState<ExerciseCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Mobility");
  const [formDifficulty, setFormDifficulty] = useState("beginner");
  const [formDescription, setFormDescription] = useState("");
  const [formTargetRom, setFormTargetRom] = useState("");
  const [formIdealRepTime, setFormIdealRepTime] = useState("");
  const [formAcceptableSway, setFormAcceptableSway] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    getAdminExercises(accessToken)
      .then(setExercises)
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
        category: formCategory,
        difficulty: formDifficulty,
        description: formDescription || undefined,
        target_rom: formTargetRom ? parseFloat(formTargetRom) : undefined,
        ideal_rep_time: formIdealRepTime ? parseFloat(formIdealRepTime) : undefined,
        acceptable_sway: formAcceptableSway ? parseFloat(formAcceptableSway) : undefined,
      };
      if (editingId) {
        await updateAdminExercise(accessToken, editingId, payload);
      } else {
        await createAdminExercise(accessToken, payload);
      }
      setSuccess(editingId ? "Exercise updated" : "Exercise created");
      resetForm();
      setOpenForm(false);
      const refreshed = await getAdminExercises(accessToken);
      setExercises(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save exercise");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this exercise?")) return;
    if (!accessToken) return;
    try {
      await deleteAdminExercise(accessToken, id);
      setSuccess("Exercise deleted");
      setExercises(exercises.filter(e => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  function resetForm() {
    setEditingId(null);
    setFormName("");
    setFormCategory("Mobility");
    setFormDifficulty("beginner");
    setFormDescription("");
    setFormTargetRom("");
    setFormIdealRepTime("");
    setFormAcceptableSway("");
  }

  function editItem(item: ExerciseCatalogItem) {
    setEditingId(item.id);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormDifficulty(item.difficulty);
    setFormDescription(item.description || "");
    setFormTargetRom(item.target_rom?.toString() || "");
    setFormIdealRepTime(item.ideal_rep_time?.toString() || "");
    setFormAcceptableSway(item.acceptable_sway?.toString() || "");
    setOpenForm(true);
  }

  if (loading) return <div className="loading">Loading exercises...</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Exercise Catalog</h1>
        <p>Manage the library of available exercises and workouts.</p>
      </div>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Difficulty</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {exercises.map(e => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td>{e.category}</td>
                <td>
                  <span className={`badge badge-${e.difficulty}`}>{e.difficulty}</span>
                </td>
                <td>{e.description || "-"}</td>
                <td>
                  <button className="btn-ghost" onClick={() => editItem(e)}>Edit</button>
                  <button className="btn-ghost btn-danger" onClick={() => handleDelete(e.id)}>Delete</button>
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
          {editingId ? "Edit Exercise" : "Add Exercise"}
        </button>

        {openForm && (
          <form onSubmit={onSubmit} className="inner-form">
            <label>
              Exercise Name
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                required
              />
            </label>
            <label>
              Category
              <input
                value={formCategory}
                onChange={e => setFormCategory(e.target.value)}
                required
              />
            </label>
            <label>
              Difficulty
              <select value={formDifficulty} onChange={e => setFormDifficulty(e.target.value as any)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <label>
              Description
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
              />
            </label>
            <label>
              Target ROM (degrees)
              <input type="number" value={formTargetRom} onChange={e => setFormTargetRom(e.target.value)} />
            </label>
            <label>
              Ideal Rep Time (seconds)
              <input type="number" value={formIdealRepTime} onChange={e => setFormIdealRepTime(e.target.value)} />
            </label>
            <label>
              Acceptable Sway
              <input type="number" value={formAcceptableSway} onChange={e => setFormAcceptableSway(e.target.value)} />
            </label>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setOpenForm(false)}>Cancel</button>
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Exercise"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
