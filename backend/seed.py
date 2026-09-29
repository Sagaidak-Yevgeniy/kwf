"""Idempotent demo seed: organizer + club + athletes + tournament. Run: python3 seed.py"""
from datetime import date
from app.core.db import Base, engine, SessionLocal
import app.models.user, app.models.club_athlete, app.models.tournament, app.models.competition, app.models.misc  # noqa
from app.models.user import User
from app.models.club_athlete import Club, Athlete
from app.models.tournament import Tournament, TournamentCategory
from app.models.competition import Registration
from app.core.security import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()

org = db.query(User).filter_by(email="organizer@kwf.org").first()
if not org:
    org = User(email="organizer@kwf.org", password_hash=hash_password("organizer123"),
               full_name="Demo Organizer", role="organizer")
    db.add(org)
    db.commit()

admin = db.query(User).filter_by(email="admin@kwf.org").first()
if not admin:
    admin = User(email="admin@kwf.org", password_hash=hash_password("admin123"),
                 full_name="Admin", role="admin")
    db.add(admin)
    db.commit()

club = db.query(Club).filter_by(name="Kyokushin Almaty").first()
if not club:
    club = Club(name="Kyokushin Almaty", country="KZ", city="Almaty", coach_name="Sensei Demo")
    db.add(club)
    db.commit()

names = [("Ayan", "Serik"), ("Ivan", "Ivanov"), ("Dias", "Nurlan"), ("Timur", "Bek"),
         ("Arman", "Kairat"), ("Sasha", "Petrov"), ("Miras", "Erlan"), ("Daniyar", "Omar")]
for i, (fn, ln) in enumerate(names):
    if not db.query(Athlete).filter_by(first_name=fn, last_name=ln).first():
        db.add(Athlete(first_name=fn, last_name=ln, gender="male", birth_year=2002,
                       weight_kg=68 + (i % 3), level="advanced", country="KZ",
                       club_id=club.id, points=20 - i * 2))
db.commit()

t = db.query(Tournament).filter_by(name="KWF Championship 2026").first()
if not t:
    t = Tournament(name="KWF Championship 2026", city="Almaty", country="KZ",
                   organization="KWF", start_date=date(2026, 11, 15), status="registration", tatami_count=2,
                   created_by=org.id)
    db.add(t)
    db.commit()
    db.add(TournamentCategory(tournament_id=t.id, name="Men -70kg", gender="male",
                              age_min=18, age_max=35, weight_min=60, weight_max=70))
    db.add(TournamentCategory(tournament_id=t.id, name="Men -80kg", gender="male",
                              age_min=18, age_max=35, weight_min=70, weight_max=80))
    db.commit()

cat = db.query(TournamentCategory).filter_by(tournament_id=t.id).first()
for a in db.query(Athlete).limit(8).all():
    if not db.query(Registration).filter_by(tournament_id=t.id, athlete_id=a.id, category_id=cat.id).first():
        db.add(Registration(tournament_id=t.id, athlete_id=a.id, category_id=cat.id, seed=a.points))
db.commit()
print(f"Seed OK: tournament={t.id} org=organizer@kwf.org/oragnizer123".replace("oragnizer", "organizer"))
db.close()
