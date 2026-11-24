from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_server.config import get_settings
from api_server.database import mongo
from api_server.routers import auth, doctor, exercises, patient, ws, ai_feedback, admin, health
from ml_scoring.ml_scorer import preload_models

@asynccontextmanager
async def lifespan(_: FastAPI):
    await mongo.connect()
    # Preload models to avoid lag on first session start
    preload_models()
    yield
    await mongo.close()


settings = get_settings()
app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://[::1]:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix=settings.api_prefix)
api_router.include_router(auth.router)
api_router.include_router(exercises.router)
api_router.include_router(doctor.router)
api_router.include_router(patient.router)
api_router.include_router(ws.router)
api_router.include_router(ai_feedback.router)
api_router.include_router(admin.router)
api_router.include_router(health.router)


@api_router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


app.include_router(api_router)


@app.get("/")
async def root() -> dict:
    return {
        "app": settings.app_name,
        "status": "online",
        "frontend": "http://localhost:5173",
        "docs": "/docs",
        "api": f"{settings.api_prefix}/health",
        "message": "Rehab AI Backend API is running! Access the frontend at http://localhost:5173",
    }


@app.get("/health")
async def root_health() -> dict:
    return {"status": "ok"}

