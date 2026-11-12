from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from api_server.database import get_db
from api_server.deps import require_role
from api_server.schemas import (
    UserCreateRequest,
    UserUpdateRequest,
    UserProfile,
    ExerciseCatalogCreate,
    ExerciseCatalogUpdate,
    ExerciseCatalogResponse,
)
from api_server.security import hash_password
from api_server.utils import serialize_doc, to_object_id, utc_now

router = APIRouter(prefix="/admin", tags=["admin"])


def _user_profile(doc: dict) -> UserProfile:
    serialized = serialize_doc(doc)
    return UserProfile(**serialized)


@router.get("/users", response_model=list[UserProfile])
async def list_users(
    admin: dict = Depends(require_role({"admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[UserProfile]:
    cursor = db.users.find({}).sort("created_at", -1)
    users = []
    async for doc in cursor:
        users.append(_user_profile(doc))
    return users


@router.post("/users", response_model=UserProfile, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreateRequest,
    admin: dict = Depends(require_role({"admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> UserProfile:
    email = payload.email.strip().lower()
    username = payload.username.strip().lower()

    existing = await db.users.find_one({"$or": [{"email": email}, {"username": username}]})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email or username already exists")

    user_doc = {
        "name": payload.name.strip(),
        "email": email,
        "username": username,
        "password_hash": hash_password(payload.password),
        "role": payload.role,
        "created_at": utc_now(),
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    return _user_profile(user_doc)


@router.put("/users/{user_id}", response_model=UserProfile)
async def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    admin: dict = Depends(require_role({"admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> UserProfile:
    oid = to_object_id(user_id, "user_id")
    user_doc = await db.users.find_one({"_id": oid})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_fields: dict = {}
    if payload.name is not None:
        update_fields["name"] = payload.name.strip()
    if payload.email is not None:
        email = payload.email.strip().lower()
        conflict = await db.users.find_one({"email": email, "_id": {"$ne": oid}})
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
        update_fields["email"] = email
    if payload.username is not None:
        username = payload.username.strip().lower()
        conflict = await db.users.find_one({"username": username, "_id": {"$ne": oid}})
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
        update_fields["username"] = username
    if payload.password is not None:
        update_fields["password_hash"] = hash_password(payload.password)
    if payload.role is not None:
        update_fields["role"] = payload.role

    if not update_fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    update_fields["updated_at"] = utc_now()
    await db.users.update_one({"_id": oid}, {"$set": update_fields})
    updated = await db.users.find_one({"_id": oid})
    return _user_profile(updated)


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin: dict = Depends(require_role({"admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    oid = to_object_id(user_id, "user_id")
    user_doc = await db.users.find_one({"_id": oid})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if str(oid) == admin["id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")

    await db.users.delete_one({"_id": oid})
    return {"status": "deleted", "user_id": user_id}


@router.get("/exercises", response_model=list[ExerciseCatalogResponse])
async def list_catalog_exercises(
    admin: dict = Depends(require_role({"admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[ExerciseCatalogResponse]:
    cursor = db.exercises_catalog.find({}).sort("created_at", -1)
    items = []
    async for doc in cursor:
        serialized = serialize_doc(doc)
        items.append(ExerciseCatalogResponse(**serialized))
    return items


@router.post("/exercises", response_model=ExerciseCatalogResponse, status_code=status.HTTP_201_CREATED)
async def create_catalog_exercise(
    payload: ExerciseCatalogCreate,
    admin: dict = Depends(require_role({"admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ExerciseCatalogResponse:
    existing = await db.exercises_catalog.find_one({"name": payload.name.strip()})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Exercise already exists")

    doc = {
        "name": payload.name.strip(),
        "category": payload.category.strip(),
        "difficulty": payload.difficulty,
        "description": payload.description,
        "target_rom": payload.target_rom,
        "ideal_rep_time": payload.ideal_rep_time,
        "acceptable_sway": payload.acceptable_sway,
        "created_at": utc_now(),
    }
    result = await db.exercises_catalog.insert_one(doc)
    doc["_id"] = result.inserted_id
    serialized = serialize_doc(doc)
    return ExerciseCatalogResponse(**serialized)


@router.put("/exercises/{exercise_id}", response_model=ExerciseCatalogResponse)
async def update_catalog_exercise(
    exercise_id: str,
    payload: ExerciseCatalogUpdate,
    admin: dict = Depends(require_role({"admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ExerciseCatalogResponse:
    oid = to_object_id(exercise_id, "exercise_id")
    doc = await db.exercises_catalog.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")

    update_fields: dict = {}
    if payload.name is not None:
        update_fields["name"] = payload.name.strip()
    if payload.category is not None:
        update_fields["category"] = payload.category.strip()
    if payload.difficulty is not None:
        update_fields["difficulty"] = payload.difficulty
    if payload.description is not None:
        update_fields["description"] = payload.description
    if payload.target_rom is not None:
        update_fields["target_rom"] = payload.target_rom
    if payload.ideal_rep_time is not None:
        update_fields["ideal_rep_time"] = payload.ideal_rep_time
    if payload.acceptable_sway is not None:
        update_fields["acceptable_sway"] = payload.acceptable_sway

    if not update_fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    update_fields["updated_at"] = utc_now()
    await db.exercises_catalog.update_one({"_id": oid}, {"$set": update_fields})
    updated = await db.exercises_catalog.find_one({"_id": oid})
    serialized = serialize_doc(updated)
    return ExerciseCatalogResponse(**serialized)


@router.delete("/exercises/{exercise_id}")
async def delete_catalog_exercise(
    exercise_id: str,
    admin: dict = Depends(require_role({"admin"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    oid = to_object_id(exercise_id, "exercise_id")
    doc = await db.exercises_catalog.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")

    await db.exercises_catalog.delete_one({"_id": oid})
    return {"status": "deleted", "exercise_id": exercise_id}
