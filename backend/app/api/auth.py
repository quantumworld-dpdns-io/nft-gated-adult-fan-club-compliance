from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import rate_limiter
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
    verify_wallet_signature,
)
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])
rate_limit_check = rate_limiter(max_requests=20, window_seconds=60)


class WalletLoginRequest(BaseModel):
    wallet_address: str
    message: str
    signature: str


class OAuthLoginRequest(BaseModel):
    provider: str
    code: str
    redirect_uri: str


class RegisterRequest(BaseModel):
    wallet_address: str
    email: str | None = None
    display_name: str | None = None
    password: str | None = None


class RefreshRequest(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    wallet_address: str


class UserResponse(BaseModel):
    id: str
    wallet_address: str
    email: str | None = None
    display_name: str | None = None
    age_verified: bool
    membership_tier: str | None = None
    is_admin: bool


@router.post("/login/wallet", response_model=TokenResponse)
async def wallet_login(
    request: WalletLoginRequest,
    db: AsyncSession = Depends(get_db),
    req: Request = None,
):
    if not verify_wallet_signature(
        request.wallet_address, request.message, request.signature
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid wallet signature",
        )

    result = await db.execute(
        select(User).where(User.wallet_address == request.wallet_address)
    )
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            wallet_address=request.wallet_address,
            display_name=request.wallet_address[:8],
        )
        db.add(user)
        await db.flush()

    token = create_access_token(
        data={
            "sub": str(user.id),
            "wallet": user.wallet_address,
            "is_admin": user.is_admin,
        }
    )

    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        wallet_address=user.wallet_address,
    )


@router.post("/login/oauth", response_model=TokenResponse)
async def oauth_login(
    request: OAuthLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    provider = request.provider.lower()
    if provider not in ("google", "discord"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported OAuth provider",
        )

    dummy_user_id = f"oauth_{provider}_{request.code[:16]}"
    result = await db.execute(
        select(User).where(User.wallet_address == dummy_user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            wallet_address=dummy_user_id,
            display_name=f"{provider}_user",
        )
        db.add(user)
        await db.flush()

    token = create_access_token(
        data={
            "sub": str(user.id),
            "wallet": user.wallet_address,
            "is_admin": user.is_admin,
        }
    )

    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        wallet_address=user.wallet_address,
    )


@router.post("/register", response_model=TokenResponse)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(User).where(User.wallet_address == request.wallet_address)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Wallet address already registered",
        )

    user = User(
        wallet_address=request.wallet_address,
        email=request.email,
        display_name=request.display_name or request.wallet_address[:8],
    )
    db.add(user)
    await db.flush()

    token = create_access_token(
        data={
            "sub": str(user.id),
            "wallet": user.wallet_address,
            "is_admin": user.is_admin,
        }
    )

    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        wallet_address=user.wallet_address,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    from app.core.security import verify_token

    payload = verify_token(request.token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    token = create_access_token(
        data={
            "sub": str(user.id),
            "wallet": user.wallet_address,
            "is_admin": user.is_admin,
        }
    )

    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        wallet_address=user.wallet_address,
    )


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        wallet_address=current_user.wallet_address,
        email=current_user.email,
        display_name=current_user.display_name,
        age_verified=current_user.age_verified,
        membership_tier=current_user.membership_tier,
        is_admin=current_user.is_admin,
    )
