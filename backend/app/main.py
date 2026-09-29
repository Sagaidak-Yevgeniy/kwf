from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings
from app.core.db import Base, engine
import app.models.user, app.models.club_athlete, app.models.tournament, app.models.competition, app.models.misc
from app.api import auth, tournaments, core, live, exports, admin
from app.core.ratelimit import RateLimitMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        resp = await call_next(request)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        return resp

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="KWF Tournament Platform", version="0.1.0", docs_url="/api/docs", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

app.include_router(auth.router)
app.include_router(tournaments.router)
app.include_router(core.router)
app.include_router(live.router)
app.include_router(exports.router)
app.include_router(admin.router)

@app.get("/api/health")
def health():
    return {"ok": True}
