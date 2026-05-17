import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.compliance import ComplianceLog
from app.models.subscription import Subscription
from app.models.user import User

logger = logging.getLogger(__name__)


DEFAULT_RULES: dict[str, dict[str, Any]] = {
    "age_verified": {
        "type": "age_verified",
        "enabled": True,
        "severity": "high",
        "description": "User must have completed age verification",
    },
    "subscription_active": {
        "type": "subscription_active",
        "enabled": True,
        "severity": "high",
        "description": "User must have an active subscription",
    },
    "no_previous_violations": {
        "type": "no_previous_violations",
        "enabled": True,
        "severity": "medium",
        "description": "User must not have previous compliance violations",
    },
}


async def check_user_compliance(
    user_id: str,
    db: AsyncSession,
    rules_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    rules = rules_config or DEFAULT_RULES

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {
            "user_id": user_id,
            "compliant": False,
            "errors": ["User not found"],
            "checks": [],
        }

    checks: list[dict[str, Any]] = []
    all_passed = True

    for rule_name, rule_config in rules.items():
        if not rule_config.get("enabled", True):
            continue

        rule_type = rule_config["type"]
        passed = False
        details: dict[str, Any] = {}

        try:
            if rule_type == "age_verified":
                passed = bool(user.age_verified)
                details = {
                    "age_verified": user.age_verified,
                    "age_verified_at": (
                        user.age_verified_at.isoformat() if user.age_verified_at else None
                    ),
                }

            elif rule_type == "subscription_active":
                sub_result = await db.execute(
                    select(Subscription).where(
                        Subscription.user_id == user_id,
                        Subscription.active.is_(True),
                    )
                )
                active_sub = sub_result.scalar_one_or_none()
                passed = active_sub is not None
                details = {
                    "has_active_subscription": passed,
                    "subscription_id": str(active_sub.id) if active_sub else None,
                }

            elif rule_type == "no_previous_violations":
                violation_result = await db.execute(
                    select(ComplianceLog).where(
                        ComplianceLog.user_id == user_id,
                        ComplianceLog.check_type == "violation",
                    ).limit(1)
                )
                violation = violation_result.scalar_one_or_none()
                passed = violation is None
                details = {
                    "has_violations": not passed,
                }

        except Exception as e:
            logger.error(f"Error checking rule {rule_name}: {e}")
            passed = False
            details = {"error": str(e)}

        check_result = {
            "rule": rule_name,
            "type": rule_type,
            "passed": passed,
            "severity": rule_config.get("severity", "medium"),
            "details": details,
        }
        checks.append(check_result)

        if not passed:
            all_passed = False

    check_data = {
        "user_id": str(user_id),
        "compliant": all_passed,
        "checks": checks,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    check_hash = hashlib.sha256(
        json.dumps(check_data, sort_keys=True, default=str).encode()
    ).hexdigest()

    await _log_compliance_check(
        db=db,
        user_id=user_id,
        check_type="compliance_check",
        check_hash=check_hash,
        metadata=check_data,
    )

    return check_data


async def _log_compliance_check(
    db: AsyncSession,
    user_id: str,
    check_type: str,
    check_hash: str,
    metadata: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> ComplianceLog:
    log_entry = ComplianceLog(
        user_id=user_id,
        check_type=check_type,
        check_hash=check_hash,
        metadata=metadata,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(log_entry)
    await db.flush()
    return log_entry
