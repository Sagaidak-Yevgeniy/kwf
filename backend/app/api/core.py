from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import require_roles, get_current_user
from app.models.user import User
from app.models.club_athlete import Athlete, Club
from app.models.tournament import Tournament, TournamentCategory
from app.models.competition import Registration, Bracket, BracketMatch
from app.models.misc import News, Notification
from app.schemas.api import AthleteIn, ClubIn, NewsIn

router = APIRouter(tags=["core"])

@router.get("/api/athletes")
def list_athletes(q: str = "", db: Session = Depends(get_db)):
    query = db.query(Athlete).order_by(Athlete.points.desc()).limit(200)
    if q:
        query = db.query(Athlete).filter((Athlete.first_name.ilike(f"%{q}%")) | (Athlete.last_name.ilike(f"%{q}%"))).limit(200)
    return [{"id": a.id, "name": a.full_name, "club_id": a.club_id, "country": a.country, "points": a.points,
             "wins": a.wins, "losses": a.losses, "weight": a.weight_kg} for a in query.all()]

def _placement(db: Session, athlete_id: int, tournament_id: int, category_id: int) -> str:
    """champion > finalist > semifinalist > participant, derived from bracket data."""
    b = db.query(Bracket).filter_by(tournament_id=tournament_id, category_id=category_id).first()
    if not b:
        return "registered"
    champ = db.query(BracketMatch).filter_by(bracket_id=b.id, winner_id=athlete_id, next_match_id=None).first()
    if champ:
        return "champion"
    finals = db.query(BracketMatch).filter_by(bracket_id=b.id, next_match_id=None).all()
    if any(m.athlete_a_id == athlete_id or m.athlete_b_id == athlete_id for m in finals):
        return "finalist"
    semis = [m for m in db.query(BracketMatch).filter_by(bracket_id=b.id).all()
             if m.next_match_id and db.get(BracketMatch, m.next_match_id) and db.get(BracketMatch, m.next_match_id).next_match_id is None]
    if any(m.athlete_a_id == athlete_id or m.athlete_b_id == athlete_id for m in semis):
        return "semifinalist"
    return "participant"

@router.get("/api/athletes/{aid}")
def athlete_profile(aid: int, db: Session = Depends(get_db)):
    a = db.get(Athlete, aid)
    if not a:
        raise HTTPException(404, "Not found")
    club = db.get(Club, a.club_id) if a.club_id else None
    history = []
    for r in db.query(Registration).filter_by(athlete_id=aid).all():
        t = db.get(Tournament, r.tournament_id)
        c = db.get(TournamentCategory, r.category_id)
        history.append({"tournament_id": r.tournament_id, "tournament": t.name if t else "?",
                        "date": str(t.start_date) if t else "", "category": c.name if c else "?",
                        "result": _placement(db, aid, r.tournament_id, r.category_id)})
    return {"id": a.id, "name": a.full_name, "gender": a.gender, "birth_year": a.birth_year,
            "weight": a.weight_kg, "level": a.level, "country": a.country,
            "club": club.name if club else "—", "club_id": a.club_id,
            "points": a.points, "wins": a.wins, "losses": a.losses, "history": history}

@router.post("/api/athletes")
def create_athlete(data: AthleteIn, db: Session = Depends(get_db), user=Depends(require_roles("organizer", "coach"))):
    a = Athlete(**data.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    return {"id": a.id}

@router.get("/api/clubs")
def list_clubs(q: str = "", db: Session = Depends(get_db)):
    query = db.query(Club).limit(200)
    if q:
        query = db.query(Club).filter(Club.name.ilike(f"%{q}%")).limit(200)
    return [{"id": c.id, "name": c.name, "country": c.country, "city": c.city, "coach": c.coach_name} for c in query.all()]

@router.post("/api/clubs")
def create_club(data: ClubIn, db: Session = Depends(get_db), user=Depends(require_roles("organizer"))):
    c = Club(**data.model_dump())
    db.add(c)
    db.commit()
    return {"id": c.id}

@router.get("/api/clubs/{cid}")
def club_detail(cid: int, db: Session = Depends(get_db)):
    c = db.get(Club, cid)
    if not c:
        raise HTTPException(404, "Not found")
    athletes = db.query(Athlete).filter_by(club_id=cid).order_by(Athlete.points.desc()).all()
    titles = sum(db.query(BracketMatch).filter_by(winner_id=a.id, status="finished", next_match_id=None).count() for a in athletes)
    return {"id": c.id, "name": c.name, "country": c.country, "city": c.city, "coach": c.coach_name,
            "athletes": [{"id": a.id, "name": a.full_name, "points": a.points, "wins": a.wins, "losses": a.losses} for a in athletes],
            "titles": titles}

@router.get("/api/rankings")
def rankings(gender: str = "", country: str = "", weight_min: float = 0, weight_max: float = 999, db: Session = Depends(get_db)):
    q = db.query(Athlete).filter(Athlete.weight_kg >= weight_min, Athlete.weight_kg <= weight_max)
    if gender:
        q = q.filter(Athlete.gender == gender)
    if country:
        q = q.filter(Athlete.country == country)
    q = q.order_by(Athlete.points.desc()).limit(100)
    return [{"rank": i + 1, "id": a.id, "name": a.full_name, "club_id": a.club_id, "weight": a.weight_kg,
             "points": a.points, "wins": a.wins, "losses": a.losses} for i, a in enumerate(q.all())]

@router.get("/api/news")
def list_news(db: Session = Depends(get_db)):
    return [{"id": n.id, "title": n.title, "slug": n.slug, "excerpt": n.excerpt, "category": n.category} for n in db.query(News).order_by(News.id.desc()).limit(50).all()]

@router.post("/api/news")
def create_news(data: NewsIn, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer", "admin"))):
    if db.query(News).filter_by(slug=data.slug).first():
        raise HTTPException(400, "Slug already used")
    n = News(**data.model_dump(), author_id=user.id)
    db.add(n)
    db.commit()
    db.refresh(n)
    return {"id": n.id, "slug": n.slug}

@router.get("/api/news/{slug}")
def get_news(slug: str, db: Session = Depends(get_db)):
    n = db.query(News).filter_by(slug=slug).first()
    if not n:
        raise HTTPException(404, "Not found")
    return {"id": n.id, "title": n.title, "slug": n.slug, "excerpt": n.excerpt,
            "body": n.body, "category": n.category, "created_at": str(n.created_at)}

@router.put("/api/news/{nid}")
def update_news(nid: int, data: NewsIn, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer", "admin"))):
    n = db.get(News, nid)
    if not n:
        raise HTTPException(404, "Not found")
    for k, v in data.model_dump().items():
        setattr(n, k, v)
    db.commit()
    return {"ok": True}

@router.get("/api/search")
def search(q: str, db: Session = Depends(get_db)):
    athletes = db.query(Athlete).filter((Athlete.first_name.ilike(f"%{q}%")) | (Athlete.last_name.ilike(f"%{q}%"))).limit(5).all()
    clubs = db.query(Club).filter(Club.name.ilike(f"%{q}%")).limit(5).all()
    return {"athletes": [{"id": a.id, "name": a.full_name} for a in athletes],
            "clubs": [{"id": c.id, "name": c.name} for c in clubs]}

@router.get("/api/notifications")
def list_notifications(unread_only: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Notification).filter_by(user_id=user.id).order_by(Notification.id.desc()).limit(50)
    rows = q.all()
    if unread_only:
        rows = [r for r in rows if not r.is_read]
    return {"unread": sum(1 for r in q.all() if not r.is_read),
            "items": [{"id": r.id, "type": r.type, "message": r.message, "link": r.link,
                       "is_read": r.is_read, "at": str(r.created_at)} for r in rows]}

@router.post("/api/notifications/{nid}/read")
def read_notification(nid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.get(Notification, nid)
    if not n or n.user_id != user.id:
        raise HTTPException(404, "Not found")
    n.is_read = True
    db.commit()
    return {"ok": True}

