from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import require_roles
from app.models.user import User
from app.models.misc import OrganizerRequest, AuditLog

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/organizer-requests")
def list_requests(db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    rows = db.query(OrganizerRequest).filter_by(status="pending").order_by(OrganizerRequest.id).all()
    out = []
    for r in rows:
        u = db.get(User, r.user_id)
        out.append({"id": r.id, "user": u.full_name if u else "?", "email": u.email if u else "?",
                    "org_name": r.org_name, "message": r.message, "at": str(r.created_at)})
    return out

@router.post("/organizer-requests/{rid}/decision")
def decide_request(rid: int, approve: bool, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    r = db.get(OrganizerRequest, rid)
    if not r or r.status != "pending":
        raise HTTPException(404, "Not found")
    r.status = "approved" if approve else "rejected"
    u = db.get(User, r.user_id)
    if approve and u:
        u.role = "organizer"
    db.add(AuditLog(actor_id=user.id, action=f"organizer request {r.status}", entity="organizer_request", entity_id=r.id))
    db.commit()
    return {"ok": True, "status": r.status}
