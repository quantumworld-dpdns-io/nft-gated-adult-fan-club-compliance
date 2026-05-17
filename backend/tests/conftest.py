import asyncio
from collections.abc import AsyncGenerator, Generator
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
import pytest_asyncio
from faker import Faker
from fakeredis import FakeAsyncRedis
from httpx import ASGITransport, AsyncClient
from sqlalchemy import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import Settings
from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models.compliance import AgeVerification, ComplianceRule, ComplianceRuleViolation
from app.models.membership import MembershipTier, Subscription, UserMembership
from app.models.user import User

fake = Faker()

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"


def pytest_addoption(parser):
    parser.addoption("--db-url", action="store", default=TEST_DATABASE_URL)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def async_engine():
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def test_app(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def async_client(test_app) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def redis_client():
    return FakeAsyncRedis()


@pytest.fixture
def mock_wallet_address() -> str:
    return "0x" + fake.hexify(text="^" * 40)


@pytest.fixture
def mock_wallet_address_2() -> str:
    return "0x" + fake.hexify(text="^" * 40)


@pytest.fixture
def sample_password() -> str:
    return "TestPassword123!"


@pytest_asyncio.fixture
async def sample_user(db_session: AsyncSession, mock_wallet_address: str, sample_password: str) -> User:
    user = User(
        wallet_address=mock_wallet_address,
        email=fake.email(),
        username=fake.user_name(),
        hashed_password=get_password_hash(sample_password),
        is_active=True,
        is_verified=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def verified_user(db_session: AsyncSession, sample_user: User) -> User:
    sample_user.is_verified = True
    sample_user.age_verified = True
    sample_user.age_verified_at = datetime.now(timezone.utc)
    await db_session.commit()
    await db_session.refresh(sample_user)
    return sample_user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    user = User(
        wallet_address="0x" + fake.hexify(text="^" * 40),
        email="admin@example.com",
        username="admin",
        hashed_password=get_password_hash("AdminPass123!"),
        is_active=True,
        is_verified=True,
        is_admin=True,
        age_verified=True,
        age_verified_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def auth_token(sample_user: User) -> str:
    return create_access_token(
        data={"sub": sample_user.wallet_address, "user_id": str(sample_user.id)}
    )


@pytest.fixture
def admin_token(admin_user: User) -> str:
    return create_access_token(
        data={"sub": admin_user.wallet_address, "user_id": str(admin_user.id)}
    )


@pytest.fixture
def expired_token() -> str:
    return create_access_token(
        data={"sub": "0xdeadbeef", "user_id": "123"},
        expires_delta=timedelta(seconds=-1),
    )


@pytest_asyncio.fixture
async def membership_tier(db_session: AsyncSession) -> MembershipTier:
    tier = MembershipTier(
        name="Premium",
        description="Premium membership tier",
        price_wei=100000000000000000,
        duration_days=30,
        benefits=["exclusive_content", "early_access"],
        sort_order=1,
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(tier)
    await db_session.commit()
    await db_session.refresh(tier)
    return tier


@pytest_asyncio.fixture
async def membership_tier_basic(db_session: AsyncSession) -> MembershipTier:
    tier = MembershipTier(
        name="Basic",
        description="Basic membership tier",
        price_wei=50000000000000000,
        duration_days=30,
        benefits=["basic_content"],
        sort_order=2,
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(tier)
    await db_session.commit()
    await db_session.refresh(tier)
    return tier


@pytest_asyncio.fixture
async def user_membership(
    db_session: AsyncSession, sample_user: User, membership_tier: MembershipTier
) -> UserMembership:
    membership = UserMembership(
        user_id=sample_user.id,
        tier_id=membership_tier.id,
        nft_token_id=1,
        minted_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(membership)
    await db_session.commit()
    await db_session.refresh(membership)
    return membership


@pytest_asyncio.fixture
async def subscription(
    db_session: AsyncSession, sample_user: User, membership_tier: MembershipTier
) -> Subscription:
    sub = Subscription(
        user_id=sample_user.id,
        tier_id=membership_tier.id,
        start_date=datetime.now(timezone.utc),
        end_date=datetime.now(timezone.utc) + timedelta(days=30),
        is_active=True,
        auto_renew=True,
        payment_method="wallet",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(sub)
    await db_session.commit()
    await db_session.refresh(sub)
    return sub


@pytest_asyncio.fixture
async def age_verification(db_session: AsyncSession, sample_user: User) -> AgeVerification:
    verification = AgeVerification(
        user_id=sample_user.id,
        verified_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=365),
        method="third_party_api",
        provider="verify_age_co",
        is_valid=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(verification)
    await db_session.commit()
    await db_session.refresh(verification)
    return verification


@pytest.fixture
def sample_payload() -> dict[str, Any]:
    return {
        "wallet": "0x" + fake.hexify(text="^" * 40),
        "email": fake.email(),
        "username": fake.user_name(),
        "password": "StrongPass123!",
    }


@pytest.fixture
def compliance_rule_data() -> dict[str, Any]:
    return {
        "name": "age_verification_required",
        "description": "Users must complete age verification before accessing adult content",
        "rule_type": "prerequisite",
        "threshold": 18,
        "action": "block_access",
        "is_active": True,
    }


class DataFactory:
    def __init__(self):
        self.fake = Faker()

    def wallet_address(self) -> str:
        return "0x" + self.fake.hexify(text="^" * 40)

    def user_data(self, **overrides: Any) -> dict[str, Any]:
        data = {
            "wallet": self.wallet_address(),
            "email": self.fake.email(),
            "username": self.fake.user_name(),
            "password": "TestPassword123!",
        }
        data.update(overrides)
        return data

    def membership_tier_data(self, **overrides: Any) -> dict[str, Any]:
        data = {
            "name": self.fake.word().capitalize() + " Tier",
            "description": self.fake.sentence(),
            "price_wei": self.fake.random_int(min=10**17, max=10**19),
            "duration_days": 30,
            "benefits": [self.fake.word() for _ in range(3)],
        }
        data.update(overrides)
        return data

    def compliance_rule_data(self, **overrides: Any) -> dict[str, Any]:
        data = {
            "name": self.fake.slug(),
            "description": self.fake.sentence(),
            "rule_type": self.fake.random_element(["prerequisite", "restriction", "requirement"]),
            "threshold": self.fake.random_int(min=18, max=21),
            "action": self.fake.random_element(["block_access", "flag_for_review", "log_only"]),
            "is_active": True,
        }
        data.update(overrides)
        return data


@pytest.fixture
def data_factory() -> DataFactory:
    return DataFactory()
