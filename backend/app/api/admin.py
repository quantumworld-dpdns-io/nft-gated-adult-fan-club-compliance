from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_admin_user
from app.models.compliance import ComplianceLog
from app.models.content import Content
from app.models.payment import Payment
from app.models.subscription import Subscription
from app.models.user import User

router = APIRouter(prefix="/api/admin", tags=["admin"])


class UserAdminResponse(BaseModel):
    id: str
    wallet_address: str
    email: str | None = None
    display_name: str | None = None
    age_verified: bool
    membership_tier: str | None = None
    is_admin: bool
    is_active: bool
    created_at: str


class AuditLogEntry(BaseModel):
    id: str
    user_id: str
    check_type: str
    check_hash: str
    metadata: dict | None = None
    ip_address: str | None = None
    created_at: str


class MetricsResponse(BaseModel):
    total_users: int
    active_subscriptions: int
    age_verified_users: int
    total_payments: float
    payment_count: int
    content_count: int


class ComplianceSummaryResponse(BaseModel):
    total_users: int
    verified_users: int
    unverified_users: int
    compliance_rate: float
    total_checks: int


@router.get("/users", response_model=list[UserAdminResponse])
async def list_users(
    skip: int = 0,
    limit: int = 50,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).offset(skip).limit(limit).order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return [
        UserAdminResponse(
            id=str(u.id),
            wallet_address=u.wallet_address,
            email=u.email,
            display_name=u.display_name,
            age_verified=u.age_verified,
            membership_tier=u.membership_tier,
            is_admin=u.is_admin,
            is_active=u.is_active,
            created_at=u.created_at.isoformat(),
        )
        for u in users
    ]


@router.get("/users/{user_id}", response_model=UserAdminResponse)
async def get_user_details(
    user_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserAdminResponse(
        id=str(user.id),
        wallet_address=user.wallet_address,
        email=user.email,
        display_name=user.display_name,
        age_verified=user.age_verified,
        membership_tier=user.membership_tier,
        is_admin=user.is_admin,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
    )


@router.post("/users/{user_id}/revoke")
async def revoke_membership(
    user_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.membership_tier = None
    user.membership_token_id = None

    sub_result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == user.id,
            Subscription.active.is_(True),
        )
    )
    for sub in sub_result.scalars().all():
        sub.active = False

    compliance_log = ComplianceLog(
        user_id=user.id,
        check_type="membership_revoked",
        check_hash=f"revoke:{user.id}:{datetime.now(timezone.utc).isoformat()}",
        metadata={
            "action": "revoke",
            "admin_id": str(admin.id),
        },
    )
    db.add(compliance_log)

    return {
        "message": "Membership revoked",
        "user_id": user_id,
    }


@router.get("/audit-log", response_model=list[AuditLogEntry])
async def get_full_audit_log(
    skip: int = 0,
    limit: int = 100,
    user_id: str | None = None,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ComplianceLog).order_by(ComplianceLog.created_at.desc())
    if user_id:
        query = query.where(ComplianceLog.user_id == user_id)

    result = await db.execute(query.offset(skip).limit(limit))
    logs = result.scalars().all()
    return [
        AuditLogEntry(
            id=str(log.id),
            user_id=str(log.user_id),
            check_type=log.check_type,
            check_hash=log.check_hash,
            metadata=log.metadata,
            ip_address=log.ip_address,
            created_at=log.created_at.isoformat(),
        )
        for log in logs
    ]


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    total_users_result = await db.execute(select(func.count(User.id)))
    total_users = total_users_result.scalar() or 0

    active_subs_result = await db.execute(
        select(func.count(Subscription.id)).where(Subscription.active.is_(True))
    )
    active_subs = active_subs_result.scalar() or 0

    age_verified_result = await db.execute(
        select(func.count(User.id)).where(User.age_verified.is_(True))
    )
    age_verified = age_verified_result.scalar() or 0

    payment_result = await db.execute(
        select(
            func.coalesce(func.sum(Payment.amount), 0),
            func.count(Payment.id),
        ).where(Payment.status == "succeeded")
    )
    payment_row = payment_result.one()
    total_payments = float(payment_row[0]) if payment_row[0] else 0.0
    payment_count = payment_row[1] or 0

    content_result = await db.execute(
        select(func.count(Content.id)).where(Content.is_active.is_(True))
    )
    content_count = content_result.scalar() or 0

    return MetricsResponse(
        total_users=total_users,
        active_subscriptions=active_subs,
        age_verified_users=age_verified,
        total_payments=total_payments,
        payment_count=payment_count,
        content_count=content_count,
    )


@router.get("/compliance/summary", response_model=ComplianceSummaryResponse)
async def get_compliance_summary(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    total_users_result = await db.execute(select(func.count(User.id)))
    total_users = total_users_result.scalar() or 0

    verified_users_result = await db.execute(
        select(func.count(User.id)).where(User.age_verified.is_(True))
    )
    verified_users = verified_users_result.scalar() or 0

    unverified_users = total_users - verified_users
    compliance_rate = (verified_users / total_users * 100) if total_users > 0 else 0.0

    checks_result = await db.execute(select(func.count(ComplianceLog.id)))
    total_checks = checks_result.scalar() or 0

    return ComplianceSummaryResponse(
        total_users=total_users,
        verified_users=verified_users,
        unverified_users=unverified_users,
        compliance_rate=round(compliance_rate, 2),
        total_checks=total_checks,
    )
