from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_admin_user, get_current_user, rate_limit
from app.models.compliance import ComplianceLog
from app.models.user import User
from app.services.age_verification import (
    check_verification_status,
    generate_age_proof,
    verify_age_proof,
)
from app.services.compliance_checker import check_user_compliance

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


class AgeVerifyRequest(BaseModel):
    dob: str
    threshold: int = 18


class AgeVerifyResponse(BaseModel):
    proof: dict | None = None
    verified: bool
    message: str


class VerifyStatusResponse(BaseModel):
    wallet_address: str
    age_verified: bool
    verified_on_chain: bool
    error: str | None = None


class AuditLogEntry(BaseModel):
    id: str
    check_type: str
    check_hash: str
    metadata: dict | None = None
    ip_address: str | None = None
    created_at: str


class ComplianceReportResponse(BaseModel):
    user_id: str
    compliant: bool
    checks: list[dict]
    timestamp: str


class KYCWebhookRequest(BaseModel):
    user_id: str
    status: str
    provider: str
    data: dict | None = None


@router.post("/verify-age", response_model=AgeVerifyResponse)
async def verify_age(
    request: AgeVerifyRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        dob = date.fromisoformat(request.dob)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD.",
        )

    proof = generate_age_proof(dob, request.threshold)

    if proof["is_verified"]:
        current_user.age_verified = True
        current_user.age_verified_at = datetime.now(timezone.utc)
        return AgeVerifyResponse(
            proof=proof,
            verified=True,
            message="Age verified successfully",
        )

    return AgeVerifyResponse(
        proof=proof,
        verified=False,
        message="Age verification failed: underage",
    )


@router.get("/verify-status", response_model=VerifyStatusResponse)
async def get_verify_status(
    current_user: User = Depends(get_current_user),
):
    status = await check_verification_status(current_user.wallet_address)
    return VerifyStatusResponse(
        wallet_address=status["wallet_address"],
        age_verified=current_user.age_verified or status.get("age_verified", False),
        verified_on_chain=status.get("verified_on_chain", False),
        error=status.get("error"),
    )


@router.get("/audit-log", response_model=list[AuditLogEntry])
async def get_audit_log(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ComplianceLog)
        .where(ComplianceLog.user_id == current_user.id)
        .order_by(ComplianceLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    logs = result.scalars().all()
    return [
        AuditLogEntry(
            id=str(log.id),
            check_type=log.check_type,
            check_hash=log.check_hash,
            metadata=log.metadata,
            ip_address=log.ip_address,
            created_at=log.created_at.isoformat(),
        )
        for log in logs
    ]


@router.post("/webhook/kyc")
async def kyc_webhook(
    request: KYCWebhookRequest,
    req: Request,
    db: AsyncSession = Depends(get_db),
):
    rate_limit(f"kyc_webhook:{req.client.host if req.client else 'unknown'}", 5, 60)

    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if request.status == "approved":
        user.age_verified = True
        user.age_verified_at = datetime.now(timezone.utc)

    compliance_log = ComplianceLog(
        user_id=user.id,
        check_type=f"kyc_{request.provider}",
        check_hash=f"kyc:{request.user_id}:{request.status}",
        metadata={
            "provider": request.provider,
            "status": request.status,
            "data": request.data,
        },
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
    db.add(compliance_log)

    return {"message": "KYC webhook processed", "status": request.status}


@router.get("/report", response_model=ComplianceReportResponse)
async def get_compliance_report(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = await check_user_compliance(str(current_user.id), db)
    return ComplianceReportResponse(
        user_id=report["user_id"],
        compliant=report["compliant"],
        checks=report["checks"],
        timestamp=report["timestamp"],
    )
