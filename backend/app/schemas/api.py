from __future__ import annotations
from datetime import date
from pydantic import BaseModel, Field

class TournamentIn(BaseModel):
    name: str = Field(min_length=3, max_length=255)
    city: str = ""
    country: str = ""
    organization: str = "KWF"
    start_date: date
    status: str = "upcoming"
    type: str = "championship"
    tatami_count: int = Field(default=2, ge=1, le=12)

class CategoryIn(BaseModel):
    name: str
    gender: str = "male"
    age_min: int = 18
    age_max: int = 99
    weight_min: float = 0
    weight_max: float = 999
    level: str = "open"
    fight_duration_sec: int = 180

class RegistrationIn(BaseModel):
    athlete_id: int
    category_id: int

class WeighIn(BaseModel):
    weigh_in_kg: float = Field(ge=20, le=250)

class CheckIn(BaseModel):
    checked_in: bool = True

class StatusChange(BaseModel):
    status: str = Field(pattern="^(upcoming|registration|live|finished)$")

class FinishFight(BaseModel):
    winner_id: int
    score_a: int = 0
    score_b: int = 0

class TimerIn(BaseModel):
    action: str = Field(pattern="^(start|pause|reset)$")
    duration_sec: int = Field(default=180, ge=30, le=600)

class AthleteIn(BaseModel):
    first_name: str
    last_name: str
    gender: str = "male"
    birth_year: int
    weight_kg: float = 0
    level: str = "novice"
    country: str = ""
    club_id: int | None = None

class ClubIn(BaseModel):
    name: str
    country: str = ""
    city: str = ""
    coach_name: str = ""

class NewsIn(BaseModel):
    title: str
    slug: str
    excerpt: str = ""
    body: str = ""
    category: str = "events"
