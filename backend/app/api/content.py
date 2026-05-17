from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.content import Content, ContentCategory
from app.models.user import User

router = APIRouter(prefix="/api/content", tags=["content"])


class ContentResponse(BaseModel):
    id: str
    title: str
    description: str | None = None
    content_type: str
    url: str
    thumbnail_url: str | None = None
    required_tier: str | None = None
    age_restricted: bool
    category_id: str | None = None


class ContentDetailResponse(ContentResponse):
    pass


class CategoryResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None = None


class AccessResponse(BaseModel):
    granted: bool
    reason: str


@router.get("/", response_model=list[ContentResponse])
async def list_content(
    category: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Content)
        .where(Content.is_active.is_(True))
    )
    if category:
        query = query.join(ContentCategory).where(ContentCategory.slug == category)

    result = await db.execute(query.order_by(Content.created_at.desc()))
    content_list = result.scalars().all()
    return [
        ContentResponse(
            id=str(c.id),
            title=c.title,
            description=c.description,
            content_type=c.content_type,
            url=c.url,
            thumbnail_url=c.thumbnail_url,
            required_tier=c.required_tier,
            age_restricted=c.age_restricted,
            category_id=str(c.category_id) if c.category_id else None,
        )
        for c in content_list
    ]


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ContentCategory).order_by(ContentCategory.name))
    categories = result.scalars().all()
    return [
        CategoryResponse(
            id=str(c.id),
            name=c.name,
            slug=c.slug,
            description=c.description,
        )
        for c in categories
    ]


@router.get("/{content_id}", response_model=ContentDetailResponse)
async def get_content(
    content_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Content).where(
            Content.id == content_id,
            Content.is_active.is_(True),
        )
    )
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found",
        )

    return ContentDetailResponse(
        id=str(content.id),
        title=content.title,
        description=content.description,
        content_type=content.content_type,
        url=content.url,
        thumbnail_url=content.thumbnail_url,
        required_tier=content.required_tier,
        age_restricted=content.age_restricted,
        category_id=str(content.category_id) if content.category_id else None,
    )


@router.post("/access/{content_id}", response_model=AccessResponse)
async def request_access(
    content_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Content).where(
            Content.id == content_id,
            Content.is_active.is_(True),
        )
    )
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found",
        )

    if content.age_restricted and not current_user.age_verified:
        return AccessResponse(
            granted=False,
            reason="Age verification required",
        )

    if content.required_tier and current_user.membership_tier != content.required_tier:
        if current_user.membership_tier is None:
            return AccessResponse(
                granted=False,
                reason=f"Membership required: {content.required_tier}",
            )

    return AccessResponse(
        granted=True,
        reason="Access granted",
    )
