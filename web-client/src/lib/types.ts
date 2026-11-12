export type Role = "doctor" | "patient" | "admin";

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: Role;
  created_at: string;
};

export type PatientSearchResult = UserProfile & {
  linked: boolean;
};

export type PatientAssignmentStats = {
  patient: UserProfile;
  assigned_count: number;
  in_progress_count: number;
  completed_count: number;
  total_count: number;
  triage_status?: string;
  risk_score?: number;
};

export type Assignment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  exercise_name: string;
  target_reps: number;
  target_sets?: number;
  rest_interval_seconds?: number;
  protocol?: string;
  due_date?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  doctor_name?: string;
};

export type ExerciseInfo = {
  name: string;
  target_rom: number;
  ideal_rep_time: number;
  acceptable_sway: number;
};

export type ExerciseCatalogItem = {
  id: string;
  name: string;
  category: string;
  difficulty: string;
  description: string | null;
  target_rom: number | null;
  ideal_rep_time: number | null;
  acceptable_sway: number | null;
  created_at: string;
};

export type SessionSummary = {
  avg_final_score: number;
  total_reps: number;
  duration_seconds: number;
  reps?: any[];
};

export type SessionDoc = {
  id: string;
  exercise_name: string;
  target_reps?: number;
  target_sets?: number;
  status: string;
  started_at: string;
  ended_at?: string;
  summary?: SessionSummary;
  doctor_feedback?: string;
};

export type RepScores = {
  rom_score: number;
  stability_score: number;
  tempo_score: number;
  asymmetry_score: number;
  final_score: number;
  rom_value?: number;
  rep_time?: number;
  lstm_final?: number | string;
  transformer_final?: number | string;
};

export type RepEvent = {
  rep_number: number;
  scores: RepScores;
  rep_time: number;
  rom_value: number;
  session_avg: number;
};

export type FrameFeedback = {
  type: "frame_feedback";
  counter: number;
  stage: string | null;
  feedback: string;
  feedback_rules: string[];
  sway: number;
  rep_event: RepEvent | null;
};

export type SessionStarted = {
  type: "session_started";
  session_id: string;
  exercise_name: string;
  target_reps: number;
};

export type WsMessage = FrameFeedback | SessionStarted | {
  type: "error" | "warning";
  detail: string;
};

export type HealthProfile = {
  id: string;
  user_id: string;
  height_cm: number;
  weight_kg: number;
  bmi: number;
  bmi_category: string;
  medical_conditions: string | null;
  allergies: string | null;
  emergency_contact: string | null;
  updated_at: string;
};

export type VitalSigns = {
  id: string;
  user_id: string;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  heart_rate: number | null;
  blood_sugar: number | null;
  temperature_c: number | null;
  notes: string | null;
  recorded_at: string;
};

export type HealthGoal = {
  id: string;
  user_id: string;
  title: string;
  target_type: string;
  target_value: number | null;
  target_date: string | null;
  description: string | null;
  status: string;
  created_at: string;
};

export type DietPlan = {
  id: string;
  patient_id: string;
  doctor_id: string;
  title: string;
  description: string | null;
  calories_target: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  meal_plan: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
};
