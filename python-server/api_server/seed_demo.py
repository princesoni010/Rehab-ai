import asyncio

from bson import ObjectId

from api_server.database import mongo
from api_server.security import hash_password
from api_server.utils import utc_now


def _doc_id(doc: dict | None) -> ObjectId | None:
    return doc.get("_id") if doc else None


async def seed_data(db) -> None:
    # Admin user
    for admin_email in ["admin@physico.local", "admin@rehabai.local"]:
        admin_doc = await db.users.find_one({"email": admin_email})
        if not admin_doc:
            await db.users.insert_one(
                {
                    "name": "Admin User",
                    "email": admin_email,
                    "username": "admin" if admin_email.endswith("physico.local") else "admin_rehab",
                    "password_hash": hash_password("Admin@123"),
                    "role": "admin",
                    "created_at": utc_now(),
                }
            )

    # Doctor user
    doctor_ids: list[ObjectId] = []
    for doctor_email, uname in [("doctor.demo@physico.local", "doctor_demo"), ("doctor.demo@rehabai.local", "doctor_rehab")]:
        doctor_doc = await db.users.find_one({"email": doctor_email})
        if not doctor_doc:
            result = await db.users.insert_one(
                {
                    "name": "Dr. Demo",
                    "email": doctor_email,
                    "username": uname,
                    "password_hash": hash_password("Doctor@123"),
                    "role": "doctor",
                    "created_at": utc_now(),
                }
            )
            d_id = result.inserted_id
        else:
            d_id = _doc_id(doctor_doc)
        if d_id:
            doctor_ids.append(d_id)

    if not doctor_ids:
        raise RuntimeError("Doctor seed failed")
    doctor_id = doctor_ids[0]

    # Patients
    patients = [
        {"name": "Aarav Pathak", "email": "pathak@physico.local", "username": "pathak"},
        {"name": "Aarav Pathak", "email": "pathak@rehabai.local", "username": "pathak_rehab"},
        {"name": "Neha Kapoor", "email": "neha.k@physico.local", "username": "neha_k"},
        {"name": "Rohan Mehta", "email": "rohan.m@physico.local", "username": "rohan_m"},
        {"name": "Priya Sharma", "email": "priya.s@physico.local", "username": "priya_s"},
        {"name": "Vikram Rao", "email": "vikram.r@physico.local", "username": "vikram_r"},
        {"name": "Ananya Iyer", "email": "ananya.i@physico.local", "username": "ananya_i"},
    ]

    patient_ids: list[ObjectId] = []
    for idx, patient in enumerate(patients, start=1):
        patient_doc = await db.users.find_one(
            {
                "role": "patient",
                "$or": [
                    {"email": patient["email"]},
                    {"username": patient["username"]},
                ],
            }
        )
        patient_hash = hash_password("12345678")

        if not patient_doc:
            result = await db.users.insert_one(
                {
                    "name": patient["name"],
                    "email": patient["email"],
                    "username": patient["username"],
                    "password_hash": patient_hash,
                    "role": "patient",
                    "created_at": utc_now(),
                }
            )
            patient_id = result.inserted_id
        else:
            patient_id = _doc_id(patient_doc)
            await db.users.update_one(
                {"_id": patient_id},
                {
                    "$set": {
                        "name": patient["name"],
                        "username": patient["username"],
                        "password_hash": patient_hash,
                    }
                },
            )

        if patient_id is None:
            continue

        patient_ids.append(patient_id)
        for d_id in doctor_ids:
            await db.doctor_patient_links.update_one(
                {"doctor_id": d_id, "patient_id": patient_id},
                {
                    "$setOnInsert": {
                        "doctor_id": d_id,
                        "patient_id": patient_id,
                        "status": "active",
                        "created_at": utc_now(),
                    }
                },
                upsert=True,
            )

            assignment_templates = [
                {"exercise_name": "Squats", "target_reps": 10, "status": "assigned"},
                {"exercise_name": "Heel Raises", "target_reps": 12, "status": "in_progress"},
                {"exercise_name": "Marching", "target_reps": 14, "status": "completed"},
            ]

            for template in assignment_templates:
                await db.exercise_assignments.update_one(
                    {
                        "doctor_id": d_id,
                        "patient_id": patient_id,
                        "exercise_name": template["exercise_name"],
                        "status": template["status"],
                    },
                    {
                        "$setOnInsert": {
                            "doctor_id": d_id,
                            "patient_id": patient_id,
                            "exercise_name": template["exercise_name"],
                            "target_reps": template["target_reps"],
                            "status": template["status"],
                            "notes": "Demo assignment",
                            "created_at": utc_now(),
                            "updated_at": utc_now(),
                        }
                    },
                    upsert=True,
                )

    # Seed default exercise catalog
    default_exercises = [
        {"name": "Squats", "category": "Strength", "difficulty": "beginner", "description": "Lower body strength exercise"},
        {"name": "Sit-to-Stand", "category": "Mobility", "difficulty": "beginner", "description": "Chair-based sit to stand"},
        {"name": "Marching", "category": "Cardio", "difficulty": "beginner", "description": "Marching in place"},
        {"name": "Leg Raises", "category": "Strength", "difficulty": "beginner", "description": "Straight leg raises"},
        {"name": "Wall Push-ups", "category": "Strength", "difficulty": "beginner", "description": "Wall push-ups for upper body"},
        {"name": "Standing Hip Abduction", "category": "Mobility", "difficulty": "beginner", "description": "Hip abduction standing"},
        {"name": "Standing Hip Extension", "category": "Mobility", "difficulty": "beginner", "description": "Hip extension standing"},
        {"name": "Heel Raises", "category": "Strength", "difficulty": "beginner", "description": "Calf raises"},
        {"name": "Forward Arm Raises", "category": "Mobility", "difficulty": "beginner", "description": "Forward arm raises"},
        {"name": "Side Arm Raises", "category": "Mobility", "difficulty": "beginner", "description": "Side arm raises"},
    ]

    for ex in default_exercises:
        await db.exercises_catalog.update_one(
            {"name": ex["name"]},
            {
                "$setOnInsert": {
                    **ex,
                    "description": ex["description"],
                    "target_rom": None,
                    "ideal_rep_time": None,
                    "acceptable_sway": None,
                    "created_at": utc_now(),
                }
            },
            upsert=True,
        )

    print("Seed complete")
    print("Admin login: admin@physico.local / Admin@123")
    print("Doctor login: doctor.demo@physico.local / Doctor@123")
    print("All seeded patient passwords: 12345678")


async def seed() -> None:
    await mongo.connect()
    db = mongo.db
    if db is None:
        raise RuntimeError("MongoDB not connected")
    await seed_data(db)
    await mongo.close()


if __name__ == "__main__":
    asyncio.run(seed())
