import logging
from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from models import AuditLog

logger = logging.getLogger(__name__)


async def record(
    db: AsyncSession,
    actor: str,
    action: str,
    resource: str,
    resource_id: Optional[str] = None,
    detail: Optional[dict[str, Any]] = None,
    ip: Optional[str] = None,
) -> None:
    """Append an audit entry to the session. Caller is responsible for commit."""
    try:
        db.add(AuditLog(
            actor=actor,
            action=action,
            resource=resource,
            resource_id=resource_id,
            detail=detail,
            ip=ip,
        ))
    except Exception as exc:
        logger.error("audit record failed: %s", exc)
