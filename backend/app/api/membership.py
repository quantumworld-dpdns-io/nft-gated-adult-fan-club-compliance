import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.membership import MembershipTier
from app.models.subscription import Subscription
from app.models.user import User

router = APIRouter(prefix="/api/membership", tags=["membership"])


class TierResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    price: float
    token_price: str | None = None
    duration_days: int
    benefits: dict | None = None


class MintRequest(BaseModel):
    tier_id: str
    payment_method: str = "stripe"
    stripe_payment_intent_id: str | None = None


class SubscribeRequest(BaseModel):
    tier_id: str
    auto_renew: bool = False


class MembershipStatusResponse(BaseModel):
    tier: str | None = None
    token_id: str | None = None
    is_active: bool
    age_verified: bool


class SubscriptionResponse(BaseModel):
    id: str
    tier_id: str | None = None
    start_date: str
    end_date: str | None = None
    active: bool
    auto_renew: bool


@router.get("/tiers", response_model=list[TierResponse])
async def list_tiers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MembershipTier).where(MembershipTier.is_active.is_(True))
    )
    tiers = result.scalars().all()
    return [
        TierResponse(
            id=str(t.id),
            name=t.name,
            description=t.description,
            price=float(t.price),
            token_price=t.token_price,
            duration_days=t.duration_days,
            benefits=t.benefits,
        )
        for t in tiers
    ]


@router.post("/mint")
async def mint_membership(
    request: MintRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tier_result = await db.execute(
        select(MembershipTier).where(
            MembershipTier.id == request.tier_id,
            MembershipTier.is_active.is_(True),
        )
    )
    tier = tier_result.scalar_one_or_none()
    if not tier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tier not found",
        )

    current_user.membership_tier = tier.name

    subscription = Subscription(
        user_id=current_user.id,
        tier_id=tier.id,
        stripe_subscription_id=request.stripe_payment_intent_id,
        start_date=datetime.now(timezone.utc),
        end_date=datetime.now(timezone.utc) + timedelta(days=tier.duration_days),
        active=True,
    )
    db.add(subscription)

    return {
        "message": f"Membership minted: {tier.name}",
        "tier": tier.name,
        "subscription_id": str(subscription.id),
    }


@router.post("/upgrade")
async def upgrade_membership(
    request: MintRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tier_result = await db.execute(
        select(MembershipTier).where(
            MembershipTier.id == request.tier_id,
            MembershipTier.is_active.is_(True),
        )
    )
    tier = tier_result.scalar_one_or_none()
    if not tier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tier not found",
        )

    sub_result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.active.is_(True),
        )
    )
    active_sub = sub_result.scalar_one_or_none()
    if active_sub:
        active_sub.active = False

    current_user.membership_tier = tier.name

    new_sub = Subscription(
        user_id=current_user.id,
        tier_id=tier.id,
        start_date=datetime.now(timezone.utc),
        end_date=datetime.now(timezone.utc) + timedelta(days=tier.duration_days),
        active=True,
    )
    db.add(new_sub)

    return {
        "message": f"Upgraded to {tier.name}",
        "tier": tier.name,
        "subscription_id": str(new_sub.id),
    }


@router.get("/status", response_model=MembershipStatusResponse)
async def membership_status(
    current_user: User = Depends(get_current_user),
):
    return MembershipStatusResponse(
        tier=current_user.membership_tier,
        token_id=current_user.membership_token_id,
        is_active=current_user.membership_tier is not None,
        age_verified=current_user.age_verified,
    )


@router.get("/subscriptions", response_model=list[SubscriptionResponse])
async def list_subscriptions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == current_user.id)
        .order_by(Subscription.created_at.desc())
    )
    subs = result.scalars().all()
    return [
        SubscriptionResponse(
            id=str(s.id),
            tier_id=str(s.tier_id) if s.tier_id else None,
            start_date=s.start_date.isoformat(),
            end_date=s.end_date.isoformat() if s.end_date else None,
            active=s.active,
            auto_renew=s.auto_renew,
        )
        for s in subs
    ]


@router.post("/subscribe", response_model=SubscriptionResponse)
async def subscribe(
    request: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tier_result = await db.execute(
        select(MembershipTier).where(
            MembershipTier.id == request.tier_id,
            MembershipTier.is_active.is_(True),
        )
    )
    tier = tier_result.scalar_one_or_none()
    if not tier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tier not found",
        )

    subscription = Subscription(
        user_id=current_user.id,
        tier_id=tier.id,
        start_date=datetime.now(timezone.utc),
        end_date=datetime.now(timezone.utc) + timedelta(days=tier.duration_days),
        active=True,
        auto_renew=request.auto_renew,
    )
    db.add(subscription)

    current_user.membership_tier = tier.name

    return SubscriptionResponse(
        id=str(subscription.id),
        tier_id=str(subscription.tier_id),
        start_date=subscription.start_date.isoformat(),
        end_date=subscription.end_date.isoformat() if subscription.end_date else None,
        active=subscription.active,
        auto_renew=subscription.auto_renew,
    )


@router.post("/cancel-subscription")
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub_result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.active.is_(True),
        )
    )
    sub = sub_result.scalar_one_or_none()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription found",
        )

    sub.active = False
    sub.auto_renew = False
    current_user.membership_tier = None

    return {"message": "Subscription cancelled", "subscription_id": str(sub.id)}
