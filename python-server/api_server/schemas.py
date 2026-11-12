from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


Role = Literal["doctor", "patient", "admin"]


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=200)
    username: str = Field(min_length=3, max_length=60)
    password: str = Field(min_length=8, max_length=128)
    role: Role


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    username: str
    role: Role
    created_at: datetime


class UserCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=200)
    username: str = Field(min_length=3, max_length=60)
    password: str = Field(min_length=8, max_length=128)
    role: Role


class DoctorCreatePatientRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=200)
    username: str | None = Field(default=None, min_length=3, max_length=60)


class UserUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    email: str | None = Field(default=None, min_length=5, max_length=200)
    username: str | None = Field(default=None, min_length=3, max_length=60)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: Role | None = None


class PatientAssignmentStats(BaseModel):
    patient: UserProfile
    assigned_count: int
    in_progress_count: int
    completed_count: int
    total_count: int
    risk_status: str = "On track"
    risk_score: int = 100


class PatientLinkRequest(BaseModel):
    patient_id: str | None = None
    patient_email: str | None = None
    patient_username: str | None = None


class AssignmentCreateRequest(BaseModel):
    patient_id: str
    exercise_name: str
    target_reps: int = Field(ge=1, le=200)
    target_sets: int = Field(default=1, ge=1, le=20)
    rest_interval_seconds: int = Field(default=60, ge=0, le=600)
    protocol: str | None = Field(default=None, max_length=200)
    due_date: datetime | None = None
    notes: str | None = Field(default=None, max_length=600)


class AssignmentResponse(BaseModel):
    id: str
    patient_id: str
    doctor_id: str
    exercise_name: str
    target_reps: int
    target_sets: int = 1
    rest_interval_seconds: int = 60
    protocol: str | None = None
    due_date: datetime | None = None
    status: str
    notes: str | None = None
    created_at: datetime


class PainLogRequest(BaseModel):
    score: float = Field(ge=0, le=10)
    location: str = Field(default="general", max_length=100)
    notes: str | None = Field(default=None, max_length=500)


class RoadmapMilestone(BaseModel):
    title: str
    description: str
    target_week: int
    status: Literal["done", "active", "pending"]


class ExerciseInfo(BaseModel):
    name: str
    target_rom: float
    ideal_rep_time: float
    acceptable_sway: float


class ExerciseCatalogCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    category: str = Field(min_length=2, max_length=50)
    difficulty: Literal["beginner", "intermediate", "advanced"] = "beginner"
    description: str | None = Field(default=None, max_length=500)
    target_rom: float | None = None
    ideal_rep_time: float | None = None
    acceptable_sway: float | None = None


class ExerciseCatalogUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    category: str | None = Field(default=None, min_length=2, max_length=50)
    difficulty: Literal["beginner", "intermediate", "advanced"] | None = None
    description: str | None = Field(default=None, max_length=500)
    target_rom: float | None = None
    ideal_rep_time: float | None = None
    acceptable_sway: float | None = None


class ExerciseCatalogResponse(BaseModel):
    id: str
    name: str
    category: str
    difficulty: str
    description: str | None = None
    target_rom: float | None = None
    ideal_rep_time: float | None = None
    acceptable_sway: float | None = None
    created_at: datetime


class RealtimeLandmark(BaseModel):
    x: float
    y: float
    z: float
    visibility: float = 1.0


class DoctorFeedbackRequest(BaseModel):
    patient_id: str
    message: str = Field(min_length=1, max_length=2000)
    category: str = Field(default="general")


class RealtimeFrameMessage(BaseModel):
    type: Literal["landmark_frame"]
    frame_index: int | None = None
    timestamp_ms: int | None = None
    landmarks: list[RealtimeLandmark]


class HealthProfileCreate(BaseModel):
    height_cm: float = Field(gt=0, le=300)
    weight_kg: float = Field(gt=0, le=300)
    medical_conditions: str | None = Field(default=None, max_length=500)
    allergies: str | None = Field(default=None, max_length=500)
    emergency_contact: str | None = Field(default=None, max_length=200)


class HealthProfileResponse(BaseModel):
    id: str
    user_id: str
    height_cm: float
    weight_kg: float
    bmi: float
    bmi_category: str
    medical_conditions: str | None = None
    allergies: str | None = None
    emergency_contact: str | None = None
    updated_at: datetime


class VitalSignsCreate(BaseModel):
    systolic_bp: int | None = Field(default=None, ge=50, le=300)
    diastolic_bp: int | None = Field(default=None, ge=30, le=200)
    heart_rate: int | None = Field(default=None, ge=30, le=220)
    blood_sugar: float | None = Field(default=None, ge=0, le=600)
    temperature_c: float | None = Field(default=None, ge=30, le=45)
    notes: str | None = Field(default=None, max_length=500)


class VitalSignsResponse(BaseModel):
    id: str
    user_id: str
    systolic_bp: int | None = None
    diastolic_bp: int | None = None
    heart_rate: int | None = None
    blood_sugar: float | None = None
    temperature_c: float | None = None
    notes: str | None = None
    recorded_at: datetime


class HealthGoalCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    target_type: Literal["weight_loss", "weight_gain", "flexibility", "strength", "recovery", "general"]
    target_value: float | None = None
    target_date: datetime | None = None
    description: str | None = Field(default=None, max_length=500)


class HealthGoalResponse(BaseModel):
    id: str
    user_id: str
    title: str
    target_type: str
    target_value: float | None = None
    target_date: datetime | None = None
    description: str | None = None
    status: Literal["active", "completed", "paused"] = "active"
    created_at: datetime


class DietPlanCreate(BaseModel):
    patient_id: str
    title: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    calories_target: int | None = Field(default=None, ge=0, le=5000)
    protein_g: float | None = Field(default=None, ge=0, le=500)
    carbs_g: float | None = Field(default=None, ge=0, le=500)
    fat_g: float | None = Field(default=None, ge=0, le=500)
    meal_plan: str | None = Field(default=None, max_length=2000)
    start_date: datetime | None = None
    end_date: datetime | None = None


class DietPlanResponse(BaseModel):
    id: str
    patient_id: str
    doctor_id: str
    title: str
    description: str | None = None
    calories_target: int | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    meal_plan: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    status: Literal["active", "completed", "paused"] = "active"
    created_at: datetime
