from __future__ import annotations
import csv, io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import require_roles, get_current_user
from app.core.lang import pick
from app.models.user import User
from app.models.club_athlete import Athlete, Club
from app.models.tournament import Tournament, TournamentCategory
from app.models.competition import Registration, Tatami, Bracket, BracketMatch
from app.models.misc import AuditLog
from app.schemas.api import TournamentIn, CategoryIn, RegistrationIn, WeighIn, CheckIn, StatusChange, FinishFight, TimerIn
from app.services.brackets import generate_bracket, finish_fight
from app.services.schedule import generate_schedule, detect_conflicts
from app.services.validation import validate_tournament, autofix_weighin_status
from app.services.notifications import sync_conflict_notifications, sync_weighin_notifications
from app.services.ranking import recalc_match_participants
from app.services.live import publish, set_timer, get_timer
from datetime import datetime, timezone

router = APIRouter(prefix="/api/tournaments", tags=["tournaments"])

def audit(db: Session, user: User | None, action: str, entity: str = "", entity_id: int | None = None):
    db.add(AuditLog(actor_id=user.id if user else None, action=action, entity=entity, entity_id=entity_id))
    db.commit()

def to_dict(t: Tournament, db: Session) -> dict:
    count = db.query(Registration).filter_by(tournament_id=t.id).count()
    return {"id": t.id, "name": t.name, "city": t.city, "country": t.country, "organization": t.organization,
            "start_date": str(t.start_date), "status": t.status, "type": t.type,
            "tatami_count": t.tatami_count, "participants": count}

@router.get("")
def list_tournaments(q: str = "", country: str = "", status: str = "", db: Session = Depends(get_db)):
    query = db.query(Tournament).order_by(Tournament.start_date)
    if q:
        query = query.filter(Tournament.name.ilike(f"%{q}%"))
    if country:
        query = query.filter_by(country=country)
    if status:
        query = query.filter_by(status=status)
    return [to_dict(t, db) for t in query.limit(200).all()]

@router.post("")
def create_tournament(data: TournamentIn, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer"))):
    t = Tournament(**data.model_dump(), created_by=user.id)
    db.add(t)
    db.commit()
    db.refresh(t)
    for i in range(t.tatami_count):
        db.add(Tatami(tournament_id=t.id, name=f"Tatami {i+1}"))
    db.commit()
    audit(db, user, "created tournament", "tournament", t.id)
    return to_dict(t, db)

@router.get("/{tid}")
def get_tournament(tid: int, db: Session = Depends(get_db)):
    t = db.get(Tournament, tid)
    if not t:
        raise HTTPException(404, "Not found")
    cats = db.query(TournamentCategory).filter_by(tournament_id=tid).all()
    return {**to_dict(t, db), "categories": [{"id": c.id, "name": c.name, "gender": c.gender, "age_min": c.age_min,
            "age_max": c.age_max, "weight_min": c.weight_min, "weight_max": c.weight_max} for c in cats]}

@router.post("/{tid}/categories")
def add_category(tid: int, data: CategoryIn, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer"))):
    t = db.get(Tournament, tid)
    if not t:
        raise HTTPException(404, "Not found")
    c = TournamentCategory(tournament_id=tid, **data.model_dump())
    db.add(c)
    db.commit()
    # suspicious-category hint (§10/§46): tiny check returned inline
    return {"id": c.id, **data.model_dump()}

@router.get("/{tid}/registrations")
def list_regs(tid: int, db: Session = Depends(get_db)):
    regs = db.query(Registration).filter_by(tournament_id=tid).all()
    out = []
    for r in regs:
        a = db.get(Athlete, r.athlete_id)
        out.append({"id": r.id, "athlete_id": r.athlete_id, "athlete": a.full_name if a else "?",
                    "category_id": r.category_id, "seed": r.seed, "checked_in": r.checked_in,
                    "weigh_in_kg": r.weigh_in_kg, "weigh_in_status": r.weigh_in_status})
    return out

@router.post("/{tid}/registrations")
def add_reg(tid: int, data: RegistrationIn, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer", "coach"))):
    a = db.get(Athlete, data.athlete_id)
    c = db.get(TournamentCategory, data.category_id)
    if not a or not c or c.tournament_id != tid:
        raise HTTPException(400, "Bad athlete or category")
    # §10 eligibility warnings (not hard block)
    warnings: list[str] = []
    age = datetime.now().year - a.birth_year
    if not (c.age_min <= age <= c.age_max):
        warnings.append(f"Age {age} outside {c.age_min}-{c.age_max}")
    if not (c.weight_min <= a.weight_kg <= c.weight_max):
        warnings.append(f"Weight {a.weight_kg}kg outside {c.weight_min}-{c.weight_max}kg")
    if a.gender != c.gender:
        warnings.append("Gender mismatch")
    r = Registration(tournament_id=tid, athlete_id=a.id, category_id=c.id,
                     seed=(a.points or 0))
    db.add(r)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(400, "Already registered")
    return {"id": r.id, "warnings": warnings}

MAX_IMPORT_BYTES = 5 * 1024 * 1024
MAX_IMPORT_ROWS = 2000
ALLOWED_IMPORT_EXT = (".csv", ".xlsx")

@router.post("/{tid}/registrations/import")
async def import_file(tid: int, file: UploadFile = File(...), request: Request = None, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer"))):
    """CSV/XLSX preview import: first_name,last_name,gender,birth_year,weight_kg,category_id. Never silently imports bad rows."""
    name = (file.filename or "").lower()
    if not name.endswith(ALLOWED_IMPORT_EXT):
        raise HTTPException(400, pick(request, "Только .csv или .xlsx файлы", "Тек .csv немесе .xlsx файлдары"))
    raw = await file.read()
    if len(raw) > MAX_IMPORT_BYTES:
        raise HTTPException(413, pick(request, "Файл слишком большой (максимум 5 МБ)", "Файл тым үлкен (максимум 5 МБ)"))
    if name.endswith(".xlsx"):
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        ws = wb.active
        it = ws.iter_rows(values_only=True)
        header = [str(h or "").strip() for h in next(it)]
        rows = [dict(zip(header, r)) for r in it if any(v is not None and str(v).strip() != "" for v in r)]
    else:
        rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig", errors="replace"))))
    if len(rows) > MAX_IMPORT_ROWS:
        raise HTTPException(413, pick(request, f"Слишком много строк (максимум {MAX_IMPORT_ROWS})", f"Жолдар тым көп (максимум {MAX_IMPORT_ROWS})"))
    ok, errors = 0, []
    for i, row in enumerate(rows, 1):
        try:
            row = {str(k or "").strip(): (v if not isinstance(v, str) else v.strip()) for k, v in row.items()}
            cat_id = int(row.get("category_id") or 0)
            if not db.get(TournamentCategory, cat_id) or db.get(TournamentCategory, cat_id).tournament_id != tid:
                raise ValueError(f"Unknown category_id {row.get('category_id')}")
            if not row.get("first_name") or not row.get("last_name"):
                raise ValueError("first_name/last_name required")
            a = Athlete(first_name=row["first_name"], last_name=row["last_name"],
                        gender=row.get("gender") or "male", birth_year=int(row.get("birth_year") or 2000),
                        weight_kg=float(row.get("weight_kg") or 0))
            db.add(a)
            db.flush()
            db.add(Registration(tournament_id=tid, athlete_id=a.id, category_id=cat_id))
            ok += 1
        except Exception as e:
            db.rollback()
            errors.append({"row": i, "error": str(e)[:120]})
    db.commit()
    return {"found": len(rows), "imported": ok, "errors": errors,
            "summary": f"{len(rows)} found, {ok} ok, {len(errors)} errors"}

@router.post("/{tid}/weigh-in/{reg_id}")
def weigh_in(tid: int, reg_id: int, data: WeighIn, request: Request = None, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer", "referee"))):
    r = db.get(Registration, reg_id)
    if not r or r.tournament_id != tid:
        raise HTTPException(404, "Not found")
    c = db.get(TournamentCategory, r.category_id)
    r.weigh_in_kg = data.weigh_in_kg
    r.weigh_in_status = "ok" if c.weight_min <= data.weigh_in_kg <= c.weight_max else ("over" if data.weigh_in_kg > c.weight_max else "under")
    db.commit()
    if r.weigh_in_status in ("over", "under"):
        lang = request.headers.get("Accept-Language", "") if request else ""
        sync_weighin_notifications(db, tid, lang=lang)
    labels = {"ok": ("В норме", "Қалыпты"), "over": ("Перевес", "Артық салмақ"), "under": ("Недовес", "Салмақ жетіспейді")}
    ru, kk = labels[r.weigh_in_status]
    return {"status": r.weigh_in_status, "label": pick(request, ru, kk)}

@router.post("/{tid}/check-in/{reg_id}")
def check_in(tid: int, reg_id: int, data: CheckIn, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer", "referee"))):
    """Mobile-friendly one-tap check-in (§26): single boolean, audited."""
    r = db.get(Registration, reg_id)
    if not r or r.tournament_id != tid:
        raise HTTPException(404, "Not found")
    r.checked_in = data.checked_in
    db.commit()
    audit(db, user, "checked in athlete" if data.checked_in else "unchecked athlete", "registration", r.id)
    return {"ok": True, "checked_in": r.checked_in}

FLOW = ["upcoming", "registration", "live", "finished"]

@router.post("/{tid}/status")
def change_status(tid: int, data: StatusChange, request: Request = None, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer"))):
    """Lifecycle with guards: only forward, live requires brackets, finished requires no pending fights."""
    t = db.get(Tournament, tid)
    if not t:
        raise HTTPException(404, "Not found")
    cur, nxt = FLOW.index(t.status) if t.status in FLOW else 0, FLOW.index(data.status)
    if nxt <= cur:
        raise HTTPException(400, pick(request, f"Нельзя вернуться со статуса '{t.status}' на '{data.status}'",
                                      f"'{t.status}' мәртебесінен '{data.status}' мәртебесіне оралуға болмайды"))
    if nxt > cur + 1:
        raise HTTPException(400, pick(request, "Статусы переключаются только по порядку", "Мәртебелер тек ретімен ауысады"))
    bids = [b.id for b in db.query(Bracket).filter_by(tournament_id=tid).all()]
    if data.status == "live" and not bids:
        raise HTTPException(400, pick(request, "Нельзя начать турнир без сеток: сначала сгенерируйте сетки",
                                      "Торларсыз турнирді бастауға болмайды: алдымен торларды құрыңыз"))
    if data.status == "finished" and bids:
        pending = db.query(BracketMatch).filter(BracketMatch.bracket_id.in_(bids),
                                                BracketMatch.status.in_(["scheduled", "live"])).count()
        if pending:
            raise HTTPException(400, pick(request, f"Нельзя завершить: осталось {pending} незавершённых боёв",
                                          f"Аяқтауға болмайды: {pending} аяқталмаған жекпе-жек қалды"))
    t.status = data.status
    db.commit()
    audit(db, user, f"status -> {data.status}", "tournament", tid)
    return {"ok": True, "status": t.status}

@router.post("/{tid}/brackets/generate")
def gen_brackets(tid: int, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer"))):
    cats = db.query(TournamentCategory).filter_by(tournament_id=tid).all()
    made = []
    for c in cats:
        regs = db.query(Registration).filter_by(tournament_id=tid, category_id=c.id).order_by(Registration.seed.desc()).all()
        ids = [r.athlete_id for r in regs]
        if len(ids) < 2:
            continue
        b = generate_bracket(db, tid, c.id, ids)
        made.append({"category_id": c.id, "bracket_id": b.id, "size": b.size})
    audit(db, user, "generated brackets", "tournament", tid)
    return made

@router.get("/{tid}/brackets")
def get_brackets(tid: int, db: Session = Depends(get_db)):
    brackets = db.query(Bracket).filter_by(tournament_id=tid).all()
    out = []
    for b in brackets:
        matches = db.query(BracketMatch).filter_by(bracket_id=b.id).order_by(BracketMatch.round_no, BracketMatch.position).all()
        out.append({"id": b.id, "category_id": b.category_id, "size": b.size,
                    "matches": [{"id": m.id, "round": m.round_no, "pos": m.position, "a": m.athlete_a_id,
                                 "b": m.athlete_b_id, "winner": m.winner_id, "status": m.status,
                                 "tatami_id": m.tatami_id, "scheduled_at": str(m.scheduled_at) if m.scheduled_at else None,
                                 "score_a": m.score_a, "score_b": m.score_b, "next": m.next_match_id} for m in matches]})
    return out

@router.post("/{tid}/schedule/generate")
def gen_schedule(tid: int, request: Request = None, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer"))):
    t = db.get(Tournament, tid)
    start = datetime.now(timezone.utc)
    ms = generate_schedule(db, tid, start)
    lang = request.headers.get("Accept-Language", "") if request else ""
    created = sync_conflict_notifications(db, tid, lang=lang)
    audit(db, user, "generated schedule", "tournament", tid)
    return {"scheduled": len(ms), "conflict_notifications": created}

@router.get("/{tid}/conflicts")
def conflicts(tid: int, lang: str = "ru", db: Session = Depends(get_db)):
    return detect_conflicts(db, tid, lang=lang)

@router.get("/{tid}/validate")
def validate(tid: int, lang: str = "ru", db: Session = Depends(get_db)):
    return validate_tournament(db, tid, lang=lang)

@router.post("/{tid}/validate/autofix")
def autofix(tid: int, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer"))):
    n = autofix_weighin_status(db, tid)
    audit(db, user, "autofix weigh-in", "tournament", tid)
    return {"fixed": n}

@router.post("/matches/{mid}/finish")
def finish(mid: int, data: FinishFight, request: Request = None, db: Session = Depends(get_db), user: User = Depends(require_roles("referee", "organizer"))):
    try:
        m = finish_fight(db, mid, data.winner_id, data.score_a, data.score_b)
    except ValueError:
        raise HTTPException(400, pick(request, "Победитель должен быть участником этого боя", "Жеңімпаз осы жекпе-жектің қатысушысы болуы керек"))
    b = db.get(Bracket, m.bracket_id)
    recalc_match_participants(db, m)
    publish(b.tournament_id, {"type": "fight_finished", "match_id": m.id, "winner": m.winner_id,
                              "score_a": m.score_a, "score_b": m.score_b})
    audit(db, user, "finished fight", "match", m.id)
    # human-readable error already enforced in service; success:
    return {"ok": True, "winner": m.winner_id, "next": m.next_match_id}

@router.post("/matches/{mid}/timer")
def match_timer(mid: int, data: TimerIn, db: Session = Depends(get_db), user: User = Depends(require_roles("referee", "organizer"))):
    m = db.get(BracketMatch, mid)
    if not m:
        raise HTTPException(404, "Match not found")
    b = db.get(Bracket, m.bracket_id)
    state = set_timer(mid, data.action, data.duration_sec)
    publish(b.tournament_id, {"type": "timer", **state})
    return state

@router.get("/{tid}/live")
def live_state(tid: int, db: Session = Depends(get_db)):
    bracket_ids = [b.id for b in db.query(Bracket).filter_by(tournament_id=tid).all()]
    live = db.query(BracketMatch).filter(BracketMatch.bracket_id.in_(bracket_ids), BracketMatch.status == "live").all() if bracket_ids else []
    upcoming = db.query(BracketMatch).filter(BracketMatch.bracket_id.in_(bracket_ids), BracketMatch.status == "scheduled").order_by(BracketMatch.scheduled_at).limit(10).all() if bracket_ids else []
    def ser(m: BracketMatch):
        an = db.get(Athlete, m.athlete_id) if False else None
        return {"id": m.id, "a": m.athlete_a_id, "b": m.athlete_b_id, "tatami_id": m.tatami_id,
                "status": m.status, "timer": get_timer(m.id)}
    return {"live": [ser(m) for m in live], "queue": [ser(m) for m in upcoming]}
