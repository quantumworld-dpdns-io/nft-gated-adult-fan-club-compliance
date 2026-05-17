from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.membership import SubscriptionStatus, TierTier, UserMembership


class TestTierValidation:
    async def test_valid_tier_creation(self, membership_tier):
        assert membership_tier.id is not None
        assert membership_tier.name == "Premium"
        assert membership_tier.price_wei > 0
        assert membership_tier.duration_days > 0
        assert membership_tier.is_active is True

    async def test_tier_with_zero_price(self, db_session, data_factory):
        from app.models.membership import MembershipTier

        tier_data = data_factory.membership_tier_data(price_wei=0)
        tier = MembershipTier(**tier_data)
        assert tier.price_wei == 0

    async def test_tier_with_negative_price_raises(self, data_factory):
        from pydantic import ValidationError
        from app.schemas.membership import MembershipTierCreate

        with pytest.raises(ValidationError):
            MembershipTierCreate(**data_factory.membership_tier_data(price_wei=-100))

    async def test_tier_name_uniqueness(self, db_session, membership_tier):
        from app.models.membership import MembershipTier
        from sqlalchemy.exc import IntegrityError

        duplicate = MembershipTier(
            name=membership_tier.name,
            description="Duplicate tier",
            price_wei=200000000000000000,
            duration_days=60,
            benefits=["test"],
            sort_order=3,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db_session.add(duplicate)
        with pytest.raises(IntegrityError):
            await db_session.commit()
        await db_session.rollback()

    async def test_tier_with_empty_name(self, data_factory):
        from pydantic import ValidationError
        from app.schemas.membership import MembershipTierCreate

        with pytest.raises(ValidationError):
            MembershipTierCreate(**data_factory.membership_tier_data(name=""))

    async def test_tier_with_negative_duration_raises(self, data_factory):
        from pydantic import ValidationError
        from app.schemas.membership import MembershipTierCreate

        with pytest.raises(ValidationError):
            MembershipTierCreate(**data_factory.membership_tier_data(duration_days=-1))

    async def test_tier_sort_order_validation(self, data_factory):
        from pydantic import ValidationError
        from app.schemas.membership import MembershipTierCreate

        with pytest.raises(ValidationError):
            MembershipTierCreate(**data_factory.membership_tier_data(sort_order=-1))


class TestSubscriptionCalculations:
    async def test_subscription_end_date_calculation(self, subscription, membership_tier):
        expected_end = subscription.start_date + timedelta(days=membership_tier.duration_days)
        assert subscription.end_date.date() == expected_end.date()

    async def test_subscription_renewal_date(self, subscription):
        renewal_date = subscription.end_date
        assert renewal_date > subscription.start_date

    async def test_subscription_price_matches_tier(self, subscription, membership_tier):
        assert subscription.tier_id == membership_tier.id

    async def test_subscription_with_auto_renew(self, subscription):
        assert subscription.auto_renew is True

    async def test_subscription_without_auto_renew(self, db_session, sample_user, membership_tier_basic):
        from app.models.membership import Subscription

        sub = Subscription(
            user_id=sample_user.id,
            tier_id=membership_tier_basic.id,
            start_date=datetime.now(timezone.utc),
            end_date=datetime.now(timezone.utc) + timedelta(days=30),
            is_active=True,
            auto_renew=False,
            payment_method="wallet",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db_session.add(sub)
        await db_session.commit()
        assert sub.auto_renew is False

    async def test_prorated_refund_calculation(self):
        from app.services.membership import calculate_prorated_refund

        total_paid = 100000000000000000
        days_used = 10
        total_days = 30
        refund = calculate_prorated_refund(total_paid, days_used, total_days)
        expected_refund = total_paid * (total_days - days_used) // total_days
        assert refund == expected_refund

    async def test_prorated_refund_full_period(self):
        from app.services.membership import calculate_prorated_refund

        total_paid = 100000000000000000
        refund = calculate_prorated_refund(total_paid, 0, 30)
        assert refund == total_paid

    async def test_prorated_refund_no_refund_after_full_use(self):
        from app.services.membership import calculate_prorated_refund

        refund = calculate_prorated_refund(100000000000000000, 30, 30)
        assert refund == 0


class TestMembershipStatusChecks:
    async def test_active_membership(self, user_membership):
        assert user_membership.is_active is True
        assert user_membership.expires_at > datetime.now(timezone.utc)

    async def test_expired_membership(self, db_session, sample_user, membership_tier):
        from app.models.membership import UserMembership

        expired = UserMembership(
            user_id=sample_user.id,
            tier_id=membership_tier.id,
            nft_token_id=2,
            minted_at=datetime.now(timezone.utc) - timedelta(days=60),
            expires_at=datetime.now(timezone.utc) - timedelta(days=30),
            is_active=False,
            created_at=datetime.now(timezone.utc) - timedelta(days=60),
            updated_at=datetime.now(timezone.utc) - timedelta(days=30),
        )
        db_session.add(expired)
        await db_session.commit()

        assert expired.is_active is False
        assert expired.expires_at < datetime.now(timezone.utc)

    async def test_membership_status_about_to_expire(self, db_session, sample_user, membership_tier):
        from app.models.membership import UserMembership

        about_to_expire = UserMembership(
            user_id=sample_user.id,
            tier_id=membership_tier.id,
            nft_token_id=3,
            minted_at=datetime.now(timezone.utc) - timedelta(days=28),
            expires_at=datetime.now(timezone.utc) + timedelta(days=2),
            is_active=True,
            created_at=datetime.now(timezone.utc) - timedelta(days=28),
            updated_at=datetime.now(timezone.utc),
        )
        db_session.add(about_to_expire)
        await db_session.commit()

        assert about_to_expire.is_active is True
        days_remaining = (about_to_expire.expires_at - datetime.now(timezone.utc)).days
        assert 0 <= days_remaining <= 2

    async def test_check_membership_access_granted(self, user_membership):
        from app.services.membership import check_content_access

        has_access = await check_content_access(
            user_id=user_membership.user_id,
            required_tier_id=user_membership.tier_id,
        )
        assert has_access is True

    async def test_check_membership_access_denied_no_membership(self):
        from app.services.membership import check_content_access

        has_access = await check_content_access(
            user_id=99999,
            required_tier_id=1,
        )
        assert has_access is False

    async def test_check_membership_access_denied_expired(self, db_session, sample_user, membership_tier):
        from app.models.membership import UserMembership
        from app.services.membership import check_content_access

        expired = UserMembership(
            user_id=sample_user.id,
            tier_id=membership_tier.id,
            nft_token_id=4,
            minted_at=datetime.now(timezone.utc) - timedelta(days=60),
            expires_at=datetime.now(timezone.utc) - timedelta(days=30),
            is_active=False,
            created_at=datetime.now(timezone.utc) - timedelta(days=60),
            updated_at=datetime.now(timezone.utc) - timedelta(days=30),
        )
        db_session.add(expired)
        await db_session.commit()

        has_access = await check_content_access(
            user_id=sample_user.id,
            required_tier_id=membership_tier.id,
        )
        assert has_access is False


class TestTierUpgradeLogic:
    async def test_tier_upgrade_higher_tier(self, db_session, sample_user, membership_tier, membership_tier_basic):
        from app.services.membership import upgrade_membership_tier

        upgraded = await upgrade_membership_tier(
            user_id=sample_user.id,
            current_tier_id=membership_tier_basic.id,
            new_tier_id=membership_tier.id,
        )
        assert upgraded is True

    async def test_tier_upgrade_same_tier_noop(self, db_session, sample_user, membership_tier):
        from app.services.membership import upgrade_membership_tier

        result = await upgrade_membership_tier(
            user_id=sample_user.id,
            current_tier_id=membership_tier.id,
            new_tier_id=membership_tier.id,
        )
        assert result is True

    async def test_tier_upgrade_downgrade_rejected(self, db_session, sample_user, membership_tier, membership_tier_basic):
        from app.services.membership import upgrade_membership_tier

        result = await upgrade_membership_tier(
            user_id=sample_user.id,
            current_tier_id=membership_tier.id,
            new_tier_id=membership_tier_basic.id,
        )
        assert result is False

    async def test_tier_upgrade_preserves_expiry(self, db_session, sample_user, membership_tier, membership_tier_basic):
        from app.services.membership import upgrade_membership_tier

        original_expiry = datetime.now(timezone.utc) + timedelta(days=15)
        membership = UserMembership(
            user_id=sample_user.id,
            tier_id=membership_tier_basic.id,
            nft_token_id=5,
            minted_at=datetime.now(timezone.utc),
            expires_at=original_expiry,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db_session.add(membership)
        await db_session.commit()

        await upgrade_membership_tier(
            user_id=sample_user.id,
            current_tier_id=membership_tier_basic.id,
            new_tier_id=membership_tier.id,
        )
        await db_session.refresh(membership)
        assert membership.tier_id == membership_tier.id

    async def test_tier_upgrade_invalid_tier_rejected(self, db_session, sample_user):
        from app.services.membership import upgrade_membership_tier

        result = await upgrade_membership_tier(
            user_id=sample_user.id,
            current_tier_id=999,
            new_tier_id=888,
        )
        assert result is False


class TestSubscriptionRenewalLogic:
    async def test_subscription_renewal_extends_end_date(self, db_session, subscription):
        from app.services.membership import renew_subscription

        old_end = subscription.end_date
        renewed = await renew_subscription(subscription.id)
        assert renewed is not None
        assert renewed.end_date > old_end

    async def test_subscription_renewal_maintains_auto_renew(self, db_session, subscription):
        from app.services.membership import renew_subscription

        renewed = await renew_subscription(subscription.id)
        assert renewed.auto_renew == subscription.auto_renew

    async def test_cancelled_subscription_not_renewed(self, db_session, sample_user, membership_tier):
        from app.models.membership import Subscription
        from app.services.membership import renew_subscription

        cancelled = Subscription(
            user_id=sample_user.id,
            tier_id=membership_tier.id,
            start_date=datetime.now(timezone.utc) - timedelta(days=30),
            end_date=datetime.now(timezone.utc),
            is_active=False,
            auto_renew=False,
            payment_method="wallet",
            cancelled_at=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc) - timedelta(days=30),
            updated_at=datetime.now(timezone.utc),
        )
        db_session.add(cancelled)
        await db_session.commit()

        result = await renew_subscription(cancelled.id)
        assert result is None

    async def test_subscription_renewal_updates_membership(self, db_session, subscription, user_membership):
        from app.services.membership import renew_subscription

        renewed = await renew_subscription(subscription.id)
        assert renewed.is_active is True

    async def test_multiple_renewals(self, db_session, subscription):
        from app.services.membership import renew_subscription

        for _ in range(3):
            subscription = await renew_subscription(subscription.id)
            assert subscription is not None

        assert subscription.is_active is True

    async def test_subscription_renewal_invalid_id(self):
        from app.services.membership import renew_subscription

        result = await renew_subscription(99999)
        assert result is None
