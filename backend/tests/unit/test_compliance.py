from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.compliance import AgeVerification, AuditLogEntry, ComplianceRule, ComplianceRuleViolation


class TestAgeVerificationThresholdLogic:
    async def test_age_verification_above_threshold(self, age_verification):
        assert age_verification.is_valid is True
        assert age_verification.verified_at is not None

    async def test_age_verification_below_threshold_rejected(self):
        from app.services.compliance import verify_age

        result = await verify_age(
            user_id=1,
            date_of_birth="2010-01-01",
            threshold=18,
        )
        assert result is False

    async def test_age_verification_at_threshold(self):
        from app.services.compliance import verify_age

        result = await verify_age(
            user_id=1,
            date_of_birth="2006-05-17",
            threshold=18,
        )
        assert result is True

    async def test_age_verification_expired(self, db_session, sample_user):
        expired = AgeVerification(
            user_id=sample_user.id,
            verified_at=datetime.now(timezone.utc) - timedelta(days=400),
            expires_at=datetime.now(timezone.utc) - timedelta(days=35),
            method="third_party_api",
            provider="verify_age_co",
            is_valid=False,
            created_at=datetime.now(timezone.utc) - timedelta(days=400),
            updated_at=datetime.now(timezone.utc) - timedelta(days=35),
        )
        db_session.add(expired)
        await db_session.commit()

        assert expired.is_valid is False
        assert expired.expires_at < datetime.now(timezone.utc)

    async def test_age_verification_different_thresholds(self):
        from app.services.compliance import verify_age

        dob = "2000-01-01"
        assert await verify_age(user_id=1, date_of_birth=dob, threshold=18) is True
        assert await verify_age(user_id=1, date_of_birth=dob, threshold=21) is True
        assert await verify_age(user_id=1, date_of_birth=dob, threshold=25) is True

    async def test_age_verification_edge_case_today_birthday(self):
        from app.services.compliance import verify_age

        today = datetime.now(timezone.utc)
        dob_18_years_ago = today - timedelta(days=365 * 18)
        dob_str = dob_18_years_ago.strftime("%Y-%m-%d")

        result = await verify_age(user_id=1, date_of_birth=dob_str, threshold=18)
        assert result is True

    async def test_age_verification_one_day_below_threshold(self):
        from app.services.compliance import verify_age

        today = datetime.now(timezone.utc)
        dob_17_years_364_days = today - timedelta(days=365 * 17 + 364)
        dob_str = dob_17_years_364_days.strftime("%Y-%m-%d")

        result = await verify_age(user_id=1, date_of_birth=dob_str, threshold=18)
        assert result is False


class TestComplianceRuleEngine:
    async def test_rule_engine_evaluates_true(self, db_session, sample_user):
        from app.services.compliance import evaluate_compliance_rules

        rule = ComplianceRule(
            name="age_verification_required",
            description="Must verify age",
            rule_type="prerequisite",
            threshold=18,
            action="block_access",
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db_session.add(rule)
        await db_session.commit()

        sample_user.age_verified = True
        sample_user.age_verified_at = datetime.now(timezone.utc)
        await db_session.commit()

        results = await evaluate_compliance_rules(user_id=sample_user.id)
        matching = [r for r in results if r.rule_id == rule.id]
        assert all(r.passed for r in matching)

    async def test_rule_engine_evaluates_false(self, db_session, sample_user):
        from app.services.compliance import evaluate_compliance_rules

        rule = ComplianceRule(
            name="age_verification_required",
            description="Must verify age",
            rule_type="prerequisite",
            threshold=18,
            action="block_access",
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db_session.add(rule)
        await db_session.commit()

        sample_user.age_verified = False
        sample_user.age_verified_at = None
        await db_session.commit()

        results = await evaluate_compliance_rules(user_id=sample_user.id)
        matching = [r for r in results if r.rule_id == rule.id]
        assert not any(r.passed for r in matching)

    async def test_inactive_rules_skipped(self, db_session, sample_user):
        from app.services.compliance import evaluate_compliance_rules

        inactive_rule = ComplianceRule(
            name="inactive_rule",
            description="This rule is inactive",
            rule_type="restriction",
            threshold=18,
            action="block_access",
            is_active=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db_session.add(inactive_rule)
        await db_session.commit()

        results = await evaluate_compliance_rules(user_id=sample_user.id)
        matching = [r for r in results if r.rule_id == inactive_rule.id]
        assert len(matching) == 0

    async def test_mutliple_rules_evaluated(self, db_session, sample_user):
        from app.services.compliance import evaluate_compliance_rules

        rules = [
            ComplianceRule(
                name=f"rule_{i}",
                description=f"Test rule {i}",
                rule_type="prerequisite",
                threshold=18,
                action="block_access",
                is_active=True,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            for i in range(5)
        ]
        for rule in rules:
            db_session.add(rule)
        await db_session.commit()

        results = await evaluate_compliance_rules(user_id=sample_user.id)
        assert all(r.passed is False for r in results)

    async def test_rule_with_custom_action_executed(self, db_session, sample_user):
        from app.services.compliance import evaluate_compliance_rules

        rule = ComplianceRule(
            name="flag_high_value",
            description="Flag high-value accounts for review",
            rule_type="restriction",
            threshold=1000000,
            action="flag_for_review",
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db_session.add(rule)
        await db_session.commit()

        results = await evaluate_compliance_rules(user_id=sample_user.id)
        matching = [r for r in results if r.rule_id == rule.id]
        assert len(matching) > 0


class TestAuditLogging:
    async def test_audit_log_entry_creation(self, db_session, sample_user):
        from app.services.audit import create_audit_entry

        entry = await create_audit_entry(
            user_id=sample_user.id,
            action="age_verification_submitted",
            resource_type="compliance",
            resource_id=str(sample_user.id),
            details={"method": "third_party_api"},
        )
        assert entry is not None
        assert entry.user_id == sample_user.id
        assert entry.action == "age_verification_submitted"

    async def test_audit_log_timestamp(self, db_session, sample_user):
        from app.services.audit import create_audit_entry

        entry = await create_audit_entry(
            user_id=sample_user.id,
            action="test_action",
            resource_type="test",
            resource_id="1",
            details={},
        )
        assert entry.created_at is not None
        assert entry.created_at <= datetime.now(timezone.utc)

    async def test_audit_log_with_ip_address(self, db_session, sample_user):
        from app.services.audit import create_audit_entry

        entry = await create_audit_entry(
            user_id=sample_user.id,
            action="login",
            resource_type="auth",
            resource_id=str(sample_user.id),
            details={"ip_address": "192.168.1.1"},
        )
        assert entry.details.get("ip_address") == "192.168.1.1"

    async def test_audit_log_retrieval_by_user(self, db_session, sample_user):
        from app.services.audit import create_audit_entry, get_audit_entries_for_user

        for i in range(3):
            await create_audit_entry(
                user_id=sample_user.id,
                action=f"action_{i}",
                resource_type="test",
                resource_id=str(i),
                details={},
            )

        entries = await get_audit_entries_for_user(sample_user.id)
        assert len(entries) >= 3

    async def test_audit_log_retrieval_by_action(self, db_session, sample_user):
        from app.services.audit import create_audit_entry, get_audit_entries_by_action

        for i in range(3):
            await create_audit_entry(
                user_id=sample_user.id,
                action="login",
                resource_type="auth",
                resource_id=str(sample_user.id),
                details={},
            )

        entries = await get_audit_entries_by_action("login")
        assert len(entries) >= 3


class TestComplianceReportGeneration:
    async def test_report_generation(self, db_session, sample_user):
        from app.services.compliance import generate_compliance_report

        report = await generate_compliance_report(user_id=sample_user.id)
        assert report is not None
        assert report.user_id == sample_user.id

    async def test_report_contains_verification_status(self, db_session, sample_user):
        from app.services.compliance import generate_compliance_report

        sample_user.age_verified = True
        sample_user.age_verified_at = datetime.now(timezone.utc)
        await db_session.commit()

        report = await generate_compliance_report(user_id=sample_user.id)
        assert report.age_verified is True
        assert report.age_verified_at is not None

    async def test_report_contains_rule_evaluations(self, db_session, sample_user):
        from app.services.compliance import generate_compliance_report

        rule = ComplianceRule(
            name="test_rule",
            description="Test",
            rule_type="prerequisite",
            threshold=18,
            action="block_access",
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db_session.add(rule)
        await db_session.commit()

        report = await generate_compliance_report(user_id=sample_user.id)
        assert len(report.rule_evaluations) > 0

    async def test_report_for_nonexistent_user(self):
        from app.services.compliance import generate_compliance_report

        report = await generate_compliance_report(user_id=99999)
        assert report is None

    async def test_report_format_and_structure(self, db_session, sample_user):
        from app.services.compliance import generate_compliance_report

        report = await generate_compliance_report(user_id=sample_user.id)
        assert hasattr(report, "user_id")
        assert hasattr(report, "generated_at")
        assert hasattr(report, "age_verified")
        assert hasattr(report, "rule_evaluations")


class TestRuleViolations:
    async def test_violation_recorded(self, db_session, sample_user):
        from app.services.compliance import record_violation

        violation = await record_violation(
            user_id=sample_user.id,
            rule_id=1,
            violation_type="age_verification_missing",
            details={"reason": "User attempted to access adult content without verification"},
        )
        assert violation is not None
        assert violation.user_id == sample_user.id

    async def test_violation_with_severity(self, db_session, sample_user):
        from app.services.compliance import record_violation

        violation = await record_violation(
            user_id=sample_user.id,
            rule_id=1,
            violation_type="under_age",
            severity="high",
            details={"user_age": 16, "threshold": 18},
        )
        assert violation.severity == "high"

    async def test_multiple_violations_tracked(self, db_session, sample_user):
        from app.services.compliance import get_violation_count, record_violation

        for _ in range(5):
            await record_violation(
                user_id=sample_user.id,
                rule_id=1,
                violation_type="test_violation",
                details={},
            )

        count = await get_violation_count(user_id=sample_user.id)
        assert count >= 5

    async def test_violation_resolved(self, db_session, sample_user):
        from app.services.compliance import record_violation, resolve_violation

        violation = await record_violation(
            user_id=sample_user.id,
            rule_id=1,
            violation_type="temporary_flag",
            details={"reason": "Pending review"},
        )

        resolved = await resolve_violation(
            violation_id=violation.id,
            resolved_by="admin",
            resolution_note="User completed verification",
        )
        assert resolved.resolved_at is not None
        assert resolved.resolved_by == "admin"

    async def test_violation_escalation(self, db_session, sample_user):
        from app.services.compliance import escalate_violation, record_violation

        violation = await record_violation(
            user_id=sample_user.id,
            rule_id=1,
            violation_type="serious_breach",
            severity="critical",
            details={"description": "Repeated access attempts"},
        )

        escalated = await escalate_violation(violation_id=violation.id)
        assert escalated.is_escalated is True
