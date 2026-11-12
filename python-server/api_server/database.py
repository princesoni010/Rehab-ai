import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from api_server.config import get_settings

logger = logging.getLogger(__name__)


class MongoManager:
    def __init__(self) -> None:
        self.client: AsyncIOMotorClient | None = None
        self.db: AsyncIOMotorDatabase | None = None
        self.is_mock: bool = False

    async def connect(self) -> None:
        settings = get_settings()
        
        # If explicitly set to mock, or empty, use mongomock
        if not settings.mongodb_uri or settings.mongodb_uri.strip().lower() in ("mock", "memory"):
            await self._use_mock()
            return

        try:
            client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=2000)
            await client.admin.command("ping")
            self.client = client
            self.db = self.client[settings.mongodb_db]
            await self._ensure_indexes()
            logger.info("Connected to MongoDB at %s", settings.mongodb_uri)
        except Exception as exc:
            logger.warning(
                "Could not connect to MongoDB (%s). Falling back to in-memory mongomock database.",
                exc,
            )
            await self._use_mock()

    async def _use_mock(self) -> None:
        import mongomock_motor
        settings = get_settings()
        self.is_mock = True
        self.client = mongomock_motor.AsyncMongoMockClient()
        self.db = self.client[settings.mongodb_db]
        try:
            await self._ensure_indexes()
        except Exception:
            pass
        try:
            from api_server.seed_demo import seed_data
            await seed_data(self.db)
            logger.info("Auto-seeded in-memory database with demo users.")
        except Exception as seed_err:
            logger.warning("Mock auto-seed note: %s", seed_err)

    async def close(self) -> None:
        if self.client:
            self.client.close()
            self.client = None
            self.db = None

    async def _ensure_indexes(self) -> None:
        if self.db is None:
            return

        await self.db.users.create_index("email", unique=True)
        await self.db.users.create_index("username", unique=True)

        await self.db.doctor_patient_links.create_index(
            [("doctor_id", 1), ("patient_id", 1)],
            unique=True,
        )

        await self.db.exercise_assignments.create_index([("patient_id", 1), ("status", 1)])
        await self.db.exercise_assignments.create_index([("doctor_id", 1), ("created_at", -1)])

        await self.db.sessions.create_index([("patient_id", 1), ("started_at", -1)])
        await self.db.sessions.create_index(
            [("doctor_id", 1), ("patient_id", 1), ("exercise_name", 1), ("started_at", -1)]
        )

        await self.db.rep_events.create_index([("session_id", 1), ("rep_number", 1)])

        await self.db.progression_snapshots.create_index(
            [("patient_id", 1), ("exercise_name", 1), ("snapshot_at", -1)]
        )

        await self.db.health_profiles.create_index([("user_id", 1)], unique=True)
        await self.db.vital_signs.create_index([("user_id", 1), ("recorded_at", -1)])
        await self.db.health_goals.create_index([("user_id", 1), ("status", 1)])
        await self.db.diet_plans.create_index([("patient_id", 1), ("status", 1)])
        await self.db.exercises_catalog.create_index("name", unique=True)
        await self.db.exercises_catalog.create_index("category")


mongo = MongoManager()


def get_db() -> AsyncIOMotorDatabase:
    if mongo.db is None:
        raise RuntimeError("MongoDB connection is not initialized")
    return mongo.db
