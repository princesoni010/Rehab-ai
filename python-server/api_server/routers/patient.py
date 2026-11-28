import asyncio
import os
import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Response
from google import genai
from motor.motor_asyncio import AsyncIOMotorDatabase
import openai

from api_server.database import get_db
from api_server.deps import require_role
from api_server.pdf_report import build_progress_pdf, build_session_pdf
from api_server.schemas import PainLogRequest
from api_server.utils import serialize_doc, to_object_id, utc_now

router = APIRouter(prefix="/patient", tags=["patient"])

async def _generate_ai_response(prompt: str) -> str:
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        try:
            client = openai.AsyncOpenAI(api_key=openai_key)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=600
            )
            return response.choices[0].message.content.strip()
        except Exception:
            pass
            
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            client = genai.Client(api_key=gemini_key)
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )
            return response.text.strip()
        except Exception:
            pass
            
    return "AI validation currently unavailable."


def _trend_label(values: list[float]) -> str:
    if len(values) < 2:
        return "insufficient_data"
    delta = values[-1] - values[0]
    if delta > 3.0:
        return "improving"
    if delta < -3.0:
        return "declining"
    return "stable"


@router.get("/assignments")
async def my_assignments(
    patient: dict = Depends(require_role({"patient"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    cursor = db.exercise_assignments.find(
        {"patient_id": ObjectId(patient["id"]), "status": {"$in": ["assigned", "in_progress"]}}
    ).sort("created_at", -1)
    assignments = [serialize_doc(doc) async for doc in cursor]
    return {"assignments": assignments}


@router.get("/notifications")
async def my_notifications(
    patient: dict = Depends(require_role({"patient"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Return today's newly assigned tasks as notifications."""
    from datetime import datetime, timezone, timedelta
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    # Assignments created today (or assigned status, last 7 days as fallback)
    cursor = db.exercise_assignments.find(
        {
            "patient_id": ObjectId(patient["id"]),
            "status": {"$in": ["assigned", "in_progress"]},
            "created_at": {"$gte": today_start - timedelta(days=7)},
        }
    ).sort("created_at", -1).limit(20)
    all_docs = [serialize_doc(doc) async for doc in cursor]

    notifications = []
    for doc in all_docs:
        created_str = doc.get("created_at", "")
        try:
            created_dt = datetime.fromisoformat(created_str.replace("Z", "+00:00")) if isinstance(created_str, str) else created_str
            is_today = created_dt.date() == datetime.now(timezone.utc).date()
        except Exception:
            is_today = False
        notifications.append({
            "id": doc["id"],
            "exercise_name": doc.get("exercise_name"),
            "target_reps": doc.get("target_reps"),
            "target_sets": doc.get("target_sets"),
            "rest_interval_seconds": doc.get("rest_interval_seconds", 60),
            "status": doc.get("status"),
            "notes": doc.get("notes"),
            "created_at": created_str,
            "is_today": is_today,
        })
    today_count = sum(1 for n in notifications if n["is_today"])
    return {"notifications": notifications, "today_count": today_count}


@router.get("/roadmap")
async def my_roadmap(
    patient: dict = Depends(require_role({"patient"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    roadmap = await db.clinical_roadmaps.find_one({"patient_id": ObjectId(patient["id"])}, sort=[("created_at", -1)])
    if roadmap:
        return {"roadmap": serialize_doc(roadmap)}
    return {"roadmap": None}

@router.get("/sessions")
async def my_sessions(
    patient: dict = Depends(require_role({"patient"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    cursor = db.sessions.find({"patient_id": ObjectId(patient["id"])}).sort("started_at", -1).limit(100)
    sessions = [serialize_doc(doc) async for doc in cursor]
    return {"sessions": sessions}


@router.get("/progress")
async def my_progress(
    exercise_name: str | None = None,
    patient: dict = Depends(require_role({"patient"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    session_filter: dict = {"patient_id": ObjectId(patient["id"]), "status": "completed"}
    if exercise_name:
        session_filter["exercise_name"] = exercise_name

    sessions = [serialize_doc(doc) async for doc in db.sessions.find(session_filter).sort("started_at", 1)]
    scores = [float((session.get("summary") or {}).get("avg_final_score", 0.0)) for session in sessions]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

    assignments_filter: dict = {"patient_id": ObjectId(patient["id"])}
    if exercise_name:
        assignments_filter["exercise_name"] = exercise_name
    total_assignments = await db.exercise_assignments.count_documents(assignments_filter)
    completed_assignments = await db.exercise_assignments.count_documents({**assignments_filter, "status": "completed"})
    adherence = round((completed_assignments / total_assignments) * 100.0, 1) if total_assignments else 0.0

    progression_filter: dict = {"patient_id": ObjectId(patient["id"])}
    if exercise_name:
        progression_filter["exercise_name"] = exercise_name
    latest_snapshot = await db.progression_snapshots.find_one(progression_filter, sort=[("snapshot_at", -1)])

    return {
        "patient_id": patient["id"],
        "exercise_name": exercise_name,
        "session_count": len(sessions),
        "avg_final_score": avg_score,
        "trend": _trend_label(scores[-5:]),
        "adherence_percent": adherence,
        "recent_scores": scores[-10:],
        "latest_progression": serialize_doc(latest_snapshot),
        "recent_sessions": sessions[-10:],
    }


@router.get("/feedback")
async def my_feedback(
    patient: dict = Depends(require_role({"patient"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    cursor = db.doctor_feedback.find(
        {"patient_id": ObjectId(patient["id"])}
    ).sort("created_at", -1).limit(50)
    feedback_list = [serialize_doc(doc) async for doc in cursor]
    return {"feedback": feedback_list}


@router.post("/pain-logs")
async def log_pain(
    payload: PainLogRequest,
    patient: dict = Depends(require_role({"patient"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    # Fetch today's latest session to validate pain
    latest_session = await db.sessions.find_one(
        {"patient_id": ObjectId(patient["id"]), "status": "completed"},
        sort=[("started_at", -1)]
    )
    
    validation_note = None
    if latest_session and latest_session.get("summary"):
        summary = latest_session["summary"]
        prompt = f"""
You are an expert AI physical therapist. The patient reported a pain score of {payload.score}/10 today.
Here are their stats from their most recent session today:
- Average ROM Score: {summary.get('avg_rom_score', 'N/A')}/100
- Average Stability Score: {summary.get('avg_stability_score', 'N/A')}/100
- Average Tempo Score: {summary.get('avg_tempo_score', 'N/A')}/100

Does the reported pain score align with their movement data? If they report low pain but have terrible ROM/stability, or high pain but perfect movement, flag it gently. Keep it to 1-2 short sentences.
"""
        validation_note = await _generate_ai_response(prompt)

    pain_doc = {
        "patient_id": ObjectId(patient["id"]),
        "score": payload.score,
        "location": payload.location,
        "notes": payload.notes,
        "validation_note": validation_note,
        "created_at": utc_now(),
    }
    result = await db.pain_logs.insert_one(pain_doc)
    return {"status": "created", "pain_log_id": str(result.inserted_id), "validation_note": validation_note}

@router.get("/pain-logs")
async def get_pain_logs(
    patient: dict = Depends(require_role({"patient"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    cursor = db.pain_logs.find({"patient_id": ObjectId(patient["id"])}).sort("created_at", -1).limit(30)
    logs = [serialize_doc(doc) async for doc in cursor]
    return {"pain_logs": logs}


@router.get("/recovery-score")
async def get_recovery_score(
    patient: dict = Depends(require_role({"patient"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    pid = ObjectId(patient["id"])
    
    # 1. User's reported pain (65% priority)
    recent_pains_cursor = db.pain_logs.find({"patient_id": pid}).sort("created_at", 1)
    recent_pains_docs = [serialize_doc(p) async for p in recent_pains_cursor]
    
    # Calculate avg pain from last 3 for the current score
    latest_pains = recent_pains_docs[-3:] if recent_pains_docs else []
    avg_pain = sum([p.get("score", 0) for p in latest_pains]) / len(latest_pains) if latest_pains else 0.0
    user_score = max(0, 100 - (avg_pain * 10))
    
    # Previous pain
    prev_pains = recent_pains_docs[-6:-3] if len(recent_pains_docs) > 3 else []
    prev_avg_pain = sum([p.get("score", 0) for p in prev_pains]) / len(prev_pains) if prev_pains else avg_pain
    prev_user_score = max(0, 100 - (prev_avg_pain * 10))
    
    # 2. Analysis Score (35% priority)
    sessions = [s async for s in db.sessions.find({"patient_id": pid, "status": "completed"}).sort("started_at", -1).limit(10)]
    
    current_sessions = sessions[:5]
    prev_sessions = sessions[5:10] if len(sessions) > 5 else current_sessions
    
    def calc_analysis(sess_list):
        r_scores = [float((s.get("summary") or {}).get("avg_rom_score", 0.0)) for s in sess_list]
        t_scores = [float((s.get("summary") or {}).get("avg_tempo_score", 0.0)) for s in sess_list]
        a_r = sum(r_scores) / len(r_scores) if r_scores else 0.0
        a_t = sum(t_scores) / len(t_scores) if t_scores else 0.0
        return (a_r + a_t) / 2.0, a_r, a_t

    analysis_score, avg_rom, avg_tempo = calc_analysis(current_sessions)
    prev_analysis_score, _, _ = calc_analysis(prev_sessions)
    
    composite_score = (user_score * 0.65) + (analysis_score * 0.35)
    prev_composite_score = (prev_user_score * 0.65) + (prev_analysis_score * 0.35)
    
    score_delta = composite_score - prev_composite_score
    pain_delta = avg_pain - prev_avg_pain
    
    return {
        "recovery_score": round(composite_score, 1),
        "score_delta": round(score_delta, 1),
        "recent_pains": [p.get("score", 0) for p in recent_pains_docs[-10:]],
        "avg_pain": round(avg_pain, 1),
        "pain_delta": round(pain_delta, 1),
        "components": {
            "user_score": round(user_score, 1),
            "analysis_score": round(analysis_score, 1),
            "avg_rom": round(avg_rom, 1),
            "avg_tempo": round(avg_tempo, 1)
        }
    }


def _safe_filename_part(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "-", value.strip().lower()).strip("-")
    return cleaned or "session"


@router.get("/sessions/{session_id}/report.pdf")
async def download_session_report_pdf(
    session_id: str,
    patient: dict = Depends(require_role({"patient"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Response:
    sid = to_object_id(session_id, "session_id")
    session_doc = await db.sessions.find_one(
        {"_id": sid, "patient_id": ObjectId(patient["id"])}
    )
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")

    session = serialize_doc(session_doc)
    summary = dict(session.get("summary") or {})

    # Reconstruct rep summary from rep_events if session hasn't finalized summary yet
    if not summary.get("reps"):
        rep_docs = [
            serialize_doc(r)
            async for r in db.rep_events.find({"session_id": sid}).sort("rep_number", 1)
        ]
        if rep_docs:
            n = len(rep_docs)
            reps_list = []
            for r in rep_docs:
                sc = r.get("scores") or {}
                reps_list.append({
                    "rep": r.get("rep_number"),
                    "rom_score": sc.get("rom_score", 0),
                    "stability_score": sc.get("stability_score", 0),
                    "tempo_score": sc.get("tempo_score", 0),
                    "asymmetry_score": sc.get("asymmetry_score", 100),
                    "final_score": sc.get("final_score", 0),
                    "rom_value": r.get("rom_value", 0),
                    "rep_time": r.get("rep_time", 0),
                    "feedback": [],
                })
            summary.setdefault("total_reps", n)
            summary.setdefault("avg_final_score", round(sum(float(x["final_score"]) for x in reps_list) / n, 1))
            summary.setdefault("avg_rom_score", round(sum(float(x["rom_score"]) for x in reps_list) / n, 1))
            summary.setdefault("avg_stability_score", round(sum(float(x["stability_score"]) for x in reps_list) / n, 1))
            summary.setdefault("avg_tempo_score", round(sum(float(x["tempo_score"]) for x in reps_list) / n, 1))
            summary.setdefault("avg_asymmetry_score", round(sum(float(x["asymmetry_score"]) for x in reps_list) / n, 1))
            summary["reps"] = reps_list
            session["summary"] = summary

    ai_feedback = session.get("ai_feedback_cache")
    pdf_bytes = await asyncio.to_thread(build_session_pdf, session, patient, ai_feedback)

    ex_slug = _safe_filename_part(str(session.get("exercise_name") or "exercise"))
    filename = f"rehab-{ex_slug}-{session_id[-6:]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/progress/report.pdf")
async def download_progress_report_pdf(
    patient: dict = Depends(require_role({"patient"})),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Response:
    pid = ObjectId(patient["id"])
    progress = await my_progress(None, patient, db)
    recovery_data = await get_recovery_score(patient, db)
    sessions = [
        serialize_doc(doc)
        async for doc in db.sessions.find({"patient_id": pid}).sort("started_at", -1).limit(50)
    ]
    pain_logs = [
        serialize_doc(doc)
        async for doc in db.pain_logs.find({"patient_id": pid}).sort("created_at", -1).limit(20)
    ]
    user_doc = await db.users.find_one({"_id": pid})
    ai_insight = (user_doc or {}).get("cached_ai_insight", {}).get("insight")

    pdf_bytes = await asyncio.to_thread(
        build_progress_pdf,
        patient,
        progress,
        sessions,
        pain_logs,
        recovery_data,
        ai_insight,
    )
    user_slug = _safe_filename_part(str(patient.get("username") or patient.get("name") or "patient"))
    filename = f"rehab-progress-{user_slug}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )



