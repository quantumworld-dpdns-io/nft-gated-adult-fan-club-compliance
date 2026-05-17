from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_admin_user, get_current_user
from app.models.payment import Payment
from app.models.user import User

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/api/payments", tags=["payments"])


class CreatePaymentIntentRequest(BaseModel):
    amount: int
    currency: str = "usd"
    payment_type: str = "membership"
    metadata: dict | None = None


class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: int
    currency: str


class PaymentHistoryResponse(BaseModel):
    id: str
    amount: float
    currency: str
    status: str
    payment_type: str
    stripe_payment_intent_id: str | None = None
    metadata: dict | None = None
    created_at: str


class WithdrawRequest(BaseModel):
    amount: str
    destination: str


@router.post("/create-payment-intent", response_model=PaymentIntentResponse)
async def create_payment_intent(
    request: CreatePaymentIntentRequest,
    current_user: User = Depends(get_current_user),
):
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Stripe not configured",
        )

    try:
        intent = stripe.PaymentIntent.create(
            amount=request.amount,
            currency=request.currency.lower(),
            metadata={
                "user_id": str(current_user.id),
                "payment_type": request.payment_type,
                **(request.metadata or {}),
            },
        )

        return PaymentIntentResponse(
            client_secret=intent.client_secret,
            payment_intent_id=intent.id,
            amount=intent.amount,
            currency=intent.currency,
        )
    except stripe.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment error: {str(e)}",
        )


@router.post("/webhook/stripe")
async def stripe_webhook(req: Request, db: AsyncSession = Depends(get_db)):
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Stripe webhook not configured",
        )

    payload = await req.body()
    sig_header = req.headers.get("stripe-signature")
    if not sig_header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing stripe-signature header",
        )

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature",
        )

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    if event_type == "payment_intent.succeeded":
        payment_intent_id = data.get("id")
        metadata = data.get("metadata", {})
        user_id = metadata.get("user_id")
        payment_type = metadata.get("payment_type", "unknown")
        amount = data.get("amount", 0) / 100
        currency = data.get("currency", "usd")

        if user_id:
            payment = Payment(
                user_id=user_id,
                stripe_payment_intent_id=payment_intent_id,
                amount=amount,
                currency=currency,
                status="succeeded",
                payment_type=payment_type,
                metadata=metadata,
            )
            db.add(payment)

    return {"message": "Webhook received", "event": event_type}


@router.post("/withdraw")
async def withdraw_funds(
    request: WithdrawRequest,
    admin: User = Depends(get_admin_user),
):
    return {
        "message": "Withdrawal initiated",
        "amount": request.amount,
        "destination": request.destination,
        "status": "pending",
    }


@router.get("/history", response_model=list[PaymentHistoryResponse])
async def payment_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
        .limit(100)
    )
    payments = result.scalars().all()

    return [
        PaymentHistoryResponse(
            id=str(p.id),
            amount=float(p.amount),
            currency=p.currency,
            status=p.status,
            payment_type=p.payment_type,
            stripe_payment_intent_id=p.stripe_payment_intent_id,
            metadata=p.metadata,
            created_at=p.created_at.isoformat(),
        )
        for p in payments
    ]
