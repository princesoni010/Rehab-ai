from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from api_server.database import get_db
from api_server.deps import require_role
from api_server.exercise_factory import list_exercises, create_exercise_instance
from api_server.schemas import ExerciseInfo

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseInfo])
async def get_exercises(
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(require_role({"doctor", "patient", "admin"})),
) -> list[ExerciseInfo]:
    response: list[ExerciseInfo] = []
    for name in list_exercises():
        exercise = create_exercise_instance(name)
        response.append(
            ExerciseInfo(
                name=name,
                target_rom=exercise.config.target_rom,
                ideal_rep_time=exercise.config.ideal_rep_time,
                acceptable_sway=exercise.config.acceptable_sway,
            )
        )

    # Also include catalog exercises from MongoDB
    cursor = db.exercises_catalog.find({})
    async for doc in cursor:
        response.append(
            ExerciseInfo(
                name=doc["name"],
                target_rom=doc.get("target_rom", 0.0),
                ideal_rep_time=doc.get("ideal_rep_time", 0.0),
                acceptable_sway=doc.get("acceptable_sway", 0.0),
            )
        )
    return response
