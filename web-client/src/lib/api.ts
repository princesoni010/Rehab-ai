import type {
  Assignment,
  DietPlan,
  ExerciseCatalogItem,
  ExerciseInfo,
  HealthGoal,
  HealthProfile,
  PatientAssignmentStats,
  PatientSearchResult,
  SessionDoc,
  TokenResponse,
  UserProfile,
  VitalSigns,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const body = await response.json();
      if (body?.detail) {
        message = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export async function register(payload: {
  name: string;
  email: string;
  username: string;
  password: string;
  role: RoleType;
}): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<TokenResponse>(res);
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseJson<TokenResponse>(res);
}

export async function refresh(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return parseJson<TokenResponse>(res);
}

export async function me(accessToken: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJson<UserProfile>(res);
}

export async function getExercises(accessToken: string): Promise<ExerciseInfo[]> {
  const res = await fetch(`${API_BASE}/exercises`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJson<ExerciseInfo[]>(res);
}

export async function getDoctorPatients(accessToken: string): Promise<UserProfile[]> {
  const res = await fetch(`${API_BASE}/doctor/patients`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJson<{ patients: UserProfile[] }>(res);
  return body.patients;
}

export async function getDoctorPatientAssignmentStats(
  accessToken: string,
  query = ""
): Promise<PatientAssignmentStats[]> {
  const q = query.trim();
  const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
  const res = await fetch(`${API_BASE}/doctor/patients/assignment-stats${suffix}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJson<{ stats: PatientAssignmentStats[] }>(res);
  return body.stats;
}

export async function searchDoctorPatients(
  accessToken: string,
  query: string
): Promise<PatientSearchResult[]> {
  const res = await fetch(`${API_BASE}/doctor/patients/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJson<{ patients: PatientSearchResult[] }>(res);
  return body.patients;
}

export async function linkPatient(
  accessToken: string,
  payload: { patientId?: string; patientLookup?: string }
): Promise<void> {
  const lookup = payload.patientLookup?.trim() ?? "";
  const body = payload.patientId
    ? { patient_id: payload.patientId }
    : lookup.includes("@")
      ? { patient_email: lookup.toLowerCase() }
      : { patient_username: lookup.toLowerCase() };

  const res = await fetch(`${API_BASE}/doctor/patients/link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  await parseJson<Record<string, string>>(res);
}

export async function createDoctorPatient(
  accessToken: string,
  payload: { name: string; email: string; username?: string; password?: string }
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/doctor/patients/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return parseJson<UserProfile>(res);
}

export async function createAssignment(
  accessToken: string,
  payload: {
    patient_id: string;
    exercise_name: string;
    target_reps: number;
    target_sets?: number;
    rest_interval_seconds?: number;
    protocol?: string;
    due_date?: string;
    notes?: string;
  }
): Promise<Assignment> {
  const res = await fetch(`${API_BASE}/doctor/assignments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return parseJson<Assignment>(res);
}

export async function getDoctorReport(accessToken: string, patientId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/doctor/patients/${patientId}/report`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJson<any>(res);
}

export async function getDoctorPatientAssignments(accessToken: string, patientId: string): Promise<Assignment[]> {
  const res = await fetch(`${API_BASE}/doctor/patients/${patientId}/assignments`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJson<{ assignments: Assignment[] }>(res);
  return body.assignments;
}

export async function updateAssignment(
  accessToken: string,
  assignmentId: string,
  payload: { target_reps?: number; target_sets?: number; rest_interval_seconds?: number }
): Promise<Assignment> {
  const res = await fetch(`${API_BASE}/doctor/assignments/${assignmentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ assignment: Assignment }>(res);
  return body.assignment;
}

export async function deleteAssignment(
  accessToken: string,
  assignmentId: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/doctor/assignments/${assignmentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await parseJson<Record<string, string>>(res);
}

export async function getDoctorPatientSessions(accessToken: string, patientId: string): Promise<SessionDoc[]> {
  const res = await fetch(`${API_BASE}/doctor/patients/${patientId}/sessions`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJson<{ sessions: SessionDoc[] }>(res);
  return body.sessions;
}

export async function getDoctorSessionAiFeedback(accessToken: string, sessionId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/doctor/sessions/${sessionId}/ai-feedback`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJson<{ feedback: string }>(res);
  return body.feedback;
}

export async function postSessionFeedback(
  accessToken: string,
  sessionId: string,
  doctorFeedback: string
): Promise<void> {
  await fetch(`${API_BASE}/doctor/sessions/${sessionId}/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ doctor_feedback: doctorFeedback }),
  });
}

export async function getPatientAssignments(accessToken: string): Promise<Assignment[]> {
  const res = await fetch(`${API_BASE}/patient/assignments`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJson<{ assignments: Assignment[] }>(res);
  return body.assignments;
}

export async function getPatientSessions(accessToken: string): Promise<SessionDoc[]> {
  const res = await fetch(`${API_BASE}/patient/sessions`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJson<{ sessions: SessionDoc[] }>(res);
  return body.sessions;
}

export async function getPatientProgress(accessToken: string): Promise<any> {
  const res = await fetch(`${API_BASE}/patient/progress`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJson<any>(res);
}

export async function getGlobalAiInsights(accessToken: string): Promise<string> {
  const res = await fetch(`${API_BASE}/patient/progress/ai-insights`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJson<{ insights: string }>(res);
  return body.insights;
}

export async function getPatientFeedback(accessToken: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/patient/feedback`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJson<{ feedback: any[] }>(res);
  return body.feedback;
}

export async function postDoctorFeedback(
  accessToken: string,
  patientId: string,
  message: string,
  category: string = "general"
): Promise<void> {
  const res = await fetch(`${API_BASE}/doctor/patients/${patientId}/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ patient_id: patientId, message, category }),
  });
  await parseJson<Record<string, string>>(res);
}

export async function getDoctorPatientFeedback(
  accessToken: string,
  patientId: string
): Promise<any[]> {
  const res = await fetch(`${API_BASE}/doctor/patients/${patientId}/feedback`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJson<{ feedback: any[] }>(res);
  return body.feedback;
}

export async function getPatientSessionAiFeedback(accessToken: string, sessionId: string): Promise<{ feedback: string }> {
  const res = await fetch(`${API_BASE}/patient/sessions/${sessionId}/ai-feedback`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJson<{ feedback: string }>(res);
}

export async function getPatientRecoveryScore(accessToken: string): Promise<any> {
  const res = await fetch(`${API_BASE}/patient/recovery-score`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJson<any>(res);
}

export async function getPatientPainLogs(accessToken: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/patient/pain-logs`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJson<{ pain_logs: any[] }>(res);
  return body.pain_logs;
}

export async function postPatientPainLog(accessToken: string, score: number, location: string, notes: string): Promise<any> {
  const res = await fetch(`${API_BASE}/patient/pain-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ score, location, notes }),
  });
  return parseJson<any>(res);
}

export async function getPatientRoadmap(accessToken: string): Promise<any> {
  const res = await fetch(`${API_BASE}/patient/roadmap`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJson<{ roadmap: any }>(res);
  return body.roadmap;
}

export async function getDoctorPatientRecommendations(accessToken: string, patientId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/doctor/patients/${patientId}/recommendations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJson<{ recommendations: any[] }>(res);
  return body.recommendations;
}

// ========== ADMIN APIS ==========

export async function getAdminUsers(accessToken: string): Promise<UserProfile[]> {
  const res = await fetch(`${API_BASE}/admin/users`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJson<{ users: UserProfile[] }>(res);
  return body.users;
}

export async function createAdminUser(
  accessToken: string,
  payload: { name: string; email: string; username: string; password: string; role: RoleType }
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return parseJson<UserProfile>(res);
}

export async function updateAdminUser(
  accessToken: string,
  userId: string,
  payload: { name?: string; email?: string; username?: string; password?: string; role?: RoleType }
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return parseJson<UserProfile>(res);
}

export async function deleteAdminUser(accessToken: string, userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await parseJson<Record<string, string>>(res);
}

export async function getAdminExercises(accessToken: string): Promise<ExerciseCatalogItem[]> {
  const res = await fetch(`${API_BASE}/admin/exercises`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJson<ExerciseCatalogItem[]>(res);
}

export async function createAdminExercise(
  accessToken: string,
  payload: {
    name: string;
    category: string;
    difficulty: string;
    description?: string;
    target_rom?: number;
    ideal_rep_time?: number;
    acceptable_sway?: number;
  }
): Promise<ExerciseCatalogItem> {
  const res = await fetch(`${API_BASE}/admin/exercises`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return parseJson<ExerciseCatalogItem>(res);
}

export async function updateAdminExercise(
  accessToken: string,
  exerciseId: string,
  payload: {
    name?: string;
    category?: string;
    difficulty?: string;
    description?: string;
    target_rom?: number;
    ideal_rep_time?: number;
    acceptable_sway?: number;
  }
): Promise<ExerciseCatalogItem> {
  const res = await fetch(`${API_BASE}/admin/exercises/${exerciseId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return parseJson<ExerciseCatalogItem>(res);
}

export async function deleteAdminExercise(accessToken: string, exerciseId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/exercises/${exerciseId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await parseJson<Record<string, string>>(res);
}

// ========== HEALTH APIS ==========

export async function getHealthProfile(accessToken: string): Promise<HealthProfile | null> {
  const res = await fetch(`${API_BASE}/health/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 200) {
    return parseJson<HealthProfile>(res);
  }
  return null;
}

export async function saveHealthProfile(accessToken: string, payload: {
  height_cm: number;
  weight_kg: number;
  medical_conditions?: string;
  allergies?: string;
  emergency_contact?: string;
}): Promise<HealthProfile> {
  const res = await fetch(`${API_BASE}/health/profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return parseJson<HealthProfile>(res);
}

export async function getVitals(accessToken: string): Promise<VitalSigns[]> {
  const res = await fetch(`${API_BASE}/health/vitals`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJson<VitalSigns[]>(res);
}

export async function saveVitals(accessToken: string, payload: {
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate?: number;
  blood_sugar?: number;
  temperature_c?: number;
  notes?: string;
}): Promise<VitalSigns> {
  const res = await fetch(`${API_BASE}/health/vitals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return parseJson<VitalSigns>(res);
}

export async function getHealthGoals(accessToken: string): Promise<HealthGoal[]> {
  const res = await fetch(`${API_BASE}/health/goals`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJson<HealthGoal[]>(res);
}

export async function saveHealthGoal(accessToken: string, payload: {
  title: string;
  target_type: string;
  target_value?: number;
  target_date?: string;
  description?: string;
}): Promise<HealthGoal> {
  const res = await fetch(`${API_BASE}/health/goals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return parseJson<HealthGoal>(res);
}

export async function updateHealthGoalStatus(accessToken: string, goalId: string, statusValue: string): Promise<void> {
  const res = await fetch(`${API_BASE}/health/goals/${goalId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ status: statusValue }),
  });
  await parseJson<Record<string, string>>(res);
}

export async function getDietPlans(accessToken: string): Promise<DietPlan[]> {
  const res = await fetch(`${API_BASE}/health/diet-plans`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJson<DietPlan[]>(res);
}

export async function saveDietPlan(accessToken: string, payload: {
  patient_id: string;
  title: string;
  description?: string;
  calories_target?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  meal_plan?: string;
  start_date?: string;
  end_date?: string;
}): Promise<DietPlan> {
  const res = await fetch(`${API_BASE}/health/diet-plans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return parseJson<DietPlan>(res);
}

type RoleType = "doctor" | "patient" | "admin";
