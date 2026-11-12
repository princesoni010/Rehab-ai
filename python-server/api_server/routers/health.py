from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from api_server.database import get_db
from api_server.deps import require_role
from api_server.schemas import (
    HealthProfileCreate,
    HealthProfileResponse,
    VitalSignsCreate,
    VitalSignsResponse,
    HealthGoalCreate,
    HealthGoalResponse,
    DietPlanCreate,
    DietPlanResponse,
    UserProfile,
)
from api_server.utils import serialize_doc, to_object_id, utc_now

router = APIRouter(prefix="/health", tags=["health"])


def _bmi_category(bmi: float) -> str:
    if bmi < 18.5:
        return "Underweight"
    if bmi < 25:
        return "Normal"
    if bmi < 30:
        return "Overweight"
    return "Obese"


@router.get("/profile", response_model=HealthProfileResponse | None)
async def get_health_profile(
    user: dict = Depends(require_role({"patient", "doctor", "admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = await db.health_profiles.find_one({"user_id": ObjectId(user["id"])})
    if not doc:
        return None
    return HealthProfileResponse(**serialize_doc(doc))


@router.post("/profile", response_model=HealthProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_health_profile(
    payload: HealthProfileCreate,
    user: dict = Depends(require_role({"patient", "doctor", "admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    existing = await db.health_profiles.find_one({"user_id": ObjectId(user["id"])})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Health profile already exists")

    bmi = round(payload.weight_kg / ((payload.height_cm / 100) ** 2), 1)
    doc = {
        "user_id": ObjectId(user["id"]),
        "height_cm": payload.height_cm,
        "weight_kg": payload.weight_kg,
        "bmi": bmi,
        "bmi_category": _bmi_category(bmi),
        "medical_conditions": payload.medical_conditions,
        "allergies": payload.allergies,
        "emergency_contact": payload.emergency_contact,
        "updated_at": utc_now(),
    }
    result = await db.health_profiles.insert_one(doc)
    doc["_id"] = result.inserted_id
    return HealthProfileResponse(**serialize_doc(doc))


@router.put("/profile", response_model=HealthProfileResponse)
async def update_health_profile(
    payload: HealthProfileCreate,
    user: dict = Depends(require_role({"patient", "doctor", "admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    oid = ObjectId(user["id"])
    doc = await db.health_profiles.find_one({"user_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Health profile not found")

    bmi = round(payload.weight_kg / ((payload.height_cm / 100) ** 2), 1)
    update_fields = {
        "height_cm": payload.height_cm,
        "weight_kg": payload.weight_kg,
        "bmi": bmi,
        "bmi_category": _bmi_category(bmi),
        "medical_conditions": payload.medical_conditions,
        "allergies": payload.allergies,
        "emergency_contact": payload.emergency_contact,
        "updated_at": utc_now(),
    }
    await db.health_profiles.update_one({"user_id": oid}, {"$set": update_fields})
    updated = await db.health_profiles.find_one({"user_id": oid})
    return HealthProfileResponse(**serialize_doc(updated))


@router.get("/vitals", response_model=list[VitalSignsResponse])
async def get_vitals(
    user: dict = Depends(require_role({"patient", "doctor", "admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    cursor = db.vital_signs.find({"user_id": ObjectId(user["id"])}).sort("recorded_at", -1).limit(50)
    return [VitalSignsResponse(**serialize_doc(d)) async for d in cursor]


@router.post("/vitals", response_model=VitalSignsResponse, status_code=status.HTTP_201_CREATED)
async def create_vitals(
    payload: VitalSignsCreate,
    user: dict = Depends(require_role({"patient", "doctor", "admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = {
        "user_id": ObjectId(user["id"]),
        "systolic_bp": payload.systolic_bp,
        "diastolic_bp": payload.diastolic_bp,
        "heart_rate": payload.heart_rate,
        "blood_sugar": payload.blood_sugar,
        "temperature_c": payload.temperature_c,
        "notes": payload.notes,
        "recorded_at": utc_now(),
    }
    result = await db.vital_signs.insert_one(doc)
    doc["_id"] = result.inserted_id
    return VitalSignsResponse(**serialize_doc(doc))


@router.get("/goals", response_model=list[HealthGoalResponse])
async def get_goals(
    user: dict = Depends(require_role({"patient", "doctor", "admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    cursor = db.health_goals.find({"user_id": ObjectId(user["id"])}).sort("created_at", -1)
    return [HealthGoalResponse(**serialize_doc(d)) async for d in cursor]


@router.post("/goals", response_model=HealthGoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    payload: HealthGoalCreate,
    user: dict = Depends(require_role({"patient", "doctor", "admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = {
        "user_id": ObjectId(user["id"]),
        "title": payload.title.strip(),
        "target_type": payload.target_type,
        "target_value": payload.target_value,
        "target_date": payload.target_date,
        "description": payload.description,
        "status": "active",
        "created_at": utc_now(),
    }
    result = await db.health_goals.insert_one(doc)
    doc["_id"] = result.inserted_id
    return HealthGoalResponse(**serialize_doc(doc))


@router.put("/goals/{goal_id}/status")
async def update_goal_status(
    goal_id: str,
    status_value: str,
    user: dict = Depends(require_role({"patient", "doctor", "admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    oid = to_object_id(goal_id, "goal_id")
    if status_value not in ("active", "completed", "paused"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
    result = await db.health_goals.update_one(
        {"_id": oid, "user_id": ObjectId(user["id"])},
        {"$set": {"status": status_value}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return {"status": "updated"}


@router.get("/diet-plans", response_model=list[DietPlanResponse])
async def get_diet_plans(
    user: dict = Depends(require_role({"patient", "doctor", "admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if user["role"] == "patient":
        cursor = db.diet_plans.find({"patient_id": user["id"]}).sort("created_at", -1)
    else:
        cursor = db.diet_plans.find({}).sort("created_at", -1)
    return [DietPlanResponse(**serialize_doc(d)) async for d in cursor]


@router.post("/diet-plans", response_model=DietPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_diet_plan(
    payload: DietPlanCreate,
    user: dict = Depends(require_role({"doctor", "admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = {
        "patient_id": payload.patient_id,
        "doctor_id": user["id"],
        "title": payload.title.strip(),
        "description": payload.description,
        "calories_target": payload.calories_target,
        "protein_g": payload.protein_g,
        "carbs_g": payload.carbs_g,
        "fat_g": payload.fat_g,
        "meal_plan": payload.meal_plan,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "status": "active",
        "created_at": utc_now(),
    }
    result = await db.diet_plans.insert_one(doc)
    doc["_id"] = result.inserted_id
    return DietPlanResponse(**serialize_doc(doc))
