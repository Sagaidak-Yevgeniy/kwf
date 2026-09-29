"""P1: exports (CSV/XLSX/PDF), public results + medal table, QR certificates, audit log."""
from __future__ import annotations
import csv, io, json, secrets
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import require_roles
from app.models.user import User
from app.models.club_athlete import Athlete, Club
from app.models.tournament import Tournament, TournamentCategory
from app.models.competition import Registration, Bracket, BracketMatch
from app.models.misc import AuditLog, Document

router = APIRouter(tags=["exports"])

# ---------- results / medals (§47) ----------

def _category_standings(db: Session, tid: int) -> list[dict]:
    out = []
    for b in db.query(Bracket).filter_by(tournament_id=tid).all():
        cat = db.get(TournamentCategory, b.category_id)
        finals = db.query(BracketMatch).filter_by(bracket_id=b.id, status="finished", next_match_id=None).all()
        winner = finals[0].winner_id if finals else None
        finalists = {m.athlete_a_id for m in finals} | {m.athlete_b_id for m in finals}
        def name(aid):
            a = db.get(Athlete, aid) if aid else None
            return a.full_name if a else "—"
        out.append({"category_id": b.category_id, "category": cat.name if cat else "?",
                    "champion_id": winner, "champion": name(winner),
                    "finalists": [name(f) for f in finalists if f and f != winner]})
    return out

@router.get("/api/tournaments/{tid}/results")
def results(tid: int, db: Session = Depends(get_db)):
    t = db.get(Tournament, tid)
    if not t:
        raise HTTPException(404, "Not found")
    standings = _category_standings(db, tid)
    medals: dict[int, dict] = {}
    for s in standings:
        if s["champion_id"]:
            m = medals.setdefault(s["champion_id"], {"athlete_id": s["champion_id"], "gold": 0, "titles": []})
            m["gold"] += 1
            m["titles"].append(s["category"])
    table = sorted(medals.values(), key=lambda m: -m["gold"])
    for m in table:
        a = db.get(Athlete, m["athlete_id"])
        m["athlete"] = a.full_name if a else "?"
        club = db.get(Club, a.club_id) if a and a.club_id else None
        m["club"] = club.name if club else "—"
    return {"tournament": t.name, "standings": standings, "medal_table": table}

# ---------- exports (§21) ----------

def _participants(db: Session, tid: int) -> list[dict]:
    rows = []
    for r in db.query(Registration).filter_by(tournament_id=tid).all():
        a = db.get(Athlete, r.athlete_id)
        c = db.get(TournamentCategory, r.category_id)
        club = db.get(Club, a.club_id) if a and a.club_id else None
        rows.append({"athlete": a.full_name if a else "?", "club": club.name if club else "—",
                     "country": a.country if a else "", "category": c.name if c else "?",
                     "weight": r.weigh_in_kg or (a.weight_kg if a else ""),
                     "weigh_in": r.weigh_in_status, "checked_in": "yes" if r.checked_in else "no"})
    return rows

@router.get("/api/tournaments/{tid}/export/participants.csv")
def exp_part_csv(tid: int, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer"))):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=["athlete", "club", "country", "category", "weight", "weigh_in", "checked_in"])
    w.writeheader()
    w.writerows(_participants(db, tid))
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=t{tid}-participants.csv"})

@router.get("/api/tournaments/{tid}/export/participants.xlsx")
def exp_part_xlsx(tid: int, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer"))):
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Participants"
    ws.append(["Athlete", "Club", "Country", "Category", "Weight", "Weigh-in", "Checked-in"])
    for r in _participants(db, tid):
        ws.append([r["athlete"], r["club"], r["country"], r["category"], r["weight"], r["weigh_in"], r["checked_in"]])
    buf = io.BytesIO()
    wb.save(buf)
    return Response(buf.getvalue(),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f"attachment; filename=t{tid}-participants.xlsx"})

@router.get("/api/tournaments/{tid}/export/schedule.csv")
def exp_sched_csv(tid: int, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer"))):
    bids = [b.id for b in db.query(Bracket).filter_by(tournament_id=tid).all()]
    ms = db.query(BracketMatch).filter(BracketMatch.bracket_id.in_(bids)).order_by(BracketMatch.scheduled_at).all() if bids else []
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["match_id", "round", "athlete_a", "athlete_b", "tatami", "scheduled_at", "status"])
    for m in ms:
        def nm(aid):
            a = db.get(Athlete, aid) if aid else None
            return a.full_name if a else "bye"
        w.writerow([m.id, m.round_no, nm(m.athlete_a_id), nm(m.athlete_b_id), m.tatami_id, m.scheduled_at, m.status])
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=t{tid}-schedule.csv"})

def _pdf(title: str, lines: list[str]) -> bytes:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(60, 780, title)
    c.setFont("Helvetica", 11)
    y = 750
    for ln in lines:
        c.drawString(60, y, ln[:110])
        y -= 18
        if y < 60:
            c.showPage()
            y = 780
    c.showPage()
    c.save()
    return buf.getvalue()

@router.get("/api/tournaments/{tid}/export/protocol.pdf")
def exp_protocol(tid: int, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer"))):
    t = db.get(Tournament, tid)
    if not t:
        raise HTTPException(404, "Not found")
    lines = [f"{s['category']}: champion {s['champion']}" for s in _category_standings(db, tid)]
    pdf = _pdf(f"Protocol - {t.name}", lines or ["No results yet"])
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=t{tid}-protocol.pdf"})

# ---------- documents / certificates (§19) ----------

@router.post("/api/documents/issue")
def issue_doc(athlete_id: int, tournament_id: int, kind: str = "participation",
              place: str = "", category: str = "",
              db: Session = Depends(get_db), user: User = Depends(require_roles("organizer"))):
    code = secrets.token_hex(6).upper()
    payload = json.dumps({"place": place, "category": category})
    db.add(Document(code=code, kind=kind, athlete_id=athlete_id, tournament_id=tournament_id, payload=payload))
    db.commit()
    return {"code": code}

@router.get("/api/documents/verify/{code}")
def verify_doc(code: str, db: Session = Depends(get_db)):
    d = db.query(Document).filter_by(code=code.upper()).first()
    if not d:
        return {"valid": False}
    a = db.get(Athlete, d.athlete_id) if d.athlete_id else None
    t = db.get(Tournament, d.tournament_id) if d.tournament_id else None
    try:
        payload = json.loads(d.payload or "{}")
    except ValueError:
        payload = {}
    return {"valid": True, "code": d.code, "kind": d.kind,
            "athlete": a.full_name if a else "?", "tournament": t.name if t else "?",
            "date": str(t.start_date) if t else "", **payload}

@router.get("/api/documents/{code}/certificate.pdf")
def certificate_pdf(code: str, db: Session = Depends(get_db)):
    import qrcode
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.utils import ImageReader
    d = db.query(Document).filter_by(code=code.upper()).first()
    if not d:
        raise HTTPException(404, "Document not found")
    v = verify_doc(code, db)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(300, 700, "KWF")
    c.setFont("Helvetica", 14)
    c.drawCentredString(300, 670, {"participation": "Certificate of Participation", "diploma": "Diploma"}.get(d.kind, d.kind))
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(300, 620, v["athlete"])
    c.setFont("Helvetica", 12)
    c.drawCentredString(300, 590, f"{v['tournament']}  ·  {v.get('category', '')}  ·  {v.get('place', '')}")
    qr = qrcode.make(f"verify:{d.code}")
    qbuf = io.BytesIO()
    qr.save(qbuf, format="PNG")
    qbuf.seek(0)
    c.drawImage(ImageReader(qbuf), 250, 400, 100, 100)
    c.setFont("Helvetica", 10)
    c.drawCentredString(300, 380, f"Verify: {d.code}")
    c.showPage()
    c.save()
    return Response(buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=kwf-{d.code}.pdf"})

# ---------- audit log (§32) ----------

@router.get("/api/audit")
def list_audit(limit: int = 100, db: Session = Depends(get_db), user: User = Depends(require_roles("organizer", "admin"))):
    rows = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(min(limit, 500)).all()
    return [{"id": r.id, "actor": r.actor_id, "action": r.action, "entity": r.entity,
             "entity_id": r.entity_id, "at": str(r.created_at)} for r in rows]

# ---------- tournament report (§46 Report/News Assistant) ----------

@router.get("/api/tournaments/{tid}/report")
def tournament_report(tid: int, lang: str = "ru", db: Session = Depends(get_db)):
    """Auto-generated post-tournament summary: stats + markdown draft for a news post.
    AI-free and factual — the organizer reviews before publishing."""
    kk = lang.lower().startswith("kk")
    t = db.get(Tournament, tid)
    if not t:
        raise HTTPException(404, "Not found")
    regs = db.query(Registration).filter_by(tournament_id=tid).all()
    athlete_ids = {r.athlete_id for r in regs}
    athletes = [db.get(Athlete, aid) for aid in athlete_ids if db.get(Athlete, aid)]
    bids = [b.id for b in db.query(Bracket).filter_by(tournament_id=tid).all()]
    fights = db.query(BracketMatch).filter(BracketMatch.bracket_id.in_(bids)).all() if bids else []
    finished = [m for m in fights if m.status == "finished"]
    standings = _category_standings(db, tid)
    countries = sorted({a.country for a in athletes if a.country})
    clubs = sorted({(db.get(Club, a.club_id).name if a.club_id and db.get(Club, a.club_id) else "—") for a in athletes})
    club_gold: dict[str, int] = {}
    for s in standings:
        if s["champion_id"]:
            a = db.get(Athlete, s["champion_id"])
            club = db.get(Club, a.club_id).name if a and a.club_id and db.get(Club, a.club_id) else "—"
            club_gold[club] = club_gold.get(club, 0) + 1
    lines = [f"# {t.name}: {'қорытынды' if kk else 'итоги'}", "",
             f"{'Қатысушылар' if kk else 'Участников'}: {len(athletes)} · {'Елдер' if kk else 'Стран'}: {len(countries)} · {'Клубтар' if kk else 'Клубов'}: {len(clubs)} · "
             f"{'Жекпе-жектер' if kk else 'Боёв'}: {len(finished)}/{len(fights)}", ""]
    for s in standings:
        lines.append(f"- {s['category']}: 🏆 {s['champion']}")
    stats = {"participants": len(athletes), "countries": len(countries), "clubs": len(clubs),
             "fights_total": len(fights), "fights_finished": len(finished),
             "club_gold": sorted(club_gold.items(), key=lambda x: -x[1])}
    return {"tournament": t.name, "stats": stats, "standings": standings, "markdown": "\n".join(lines)}
