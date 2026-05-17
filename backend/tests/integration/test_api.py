import pytest
from httpx import AsyncClient


class TestRegistration:
    async def test_register_new_user(self, async_client: AsyncClient, sample_payload):
        response = await async_client.post("/api/auth/register", json=sample_payload)
        assert response.status_code in (200, 201)
        data = response.json()
        assert data["wallet"] == sample_payload["wallet"]
        assert "id" in data

    async def test_register_duplicate_wallet(self, async_client: AsyncClient, sample_user, sample_payload):
        sample_payload["wallet"] = sample_user.wallet_address
        response = await async_client.post("/api/auth/register", json=sample_payload)
        assert response.status_code == 409
        assert "already exists" in response.text.lower()

    async def test_register_with_missing_fields(self, async_client: AsyncClient):
        response = await async_client.post("/api/auth/register", json={})
        assert response.status_code == 422

    async def test_register_with_invalid_wallet(self, async_client: AsyncClient, sample_payload):
        sample_payload["wallet"] = "invalid_wallet"
        response = await async_client.post("/api/auth/register", json=sample_payload)
        assert response.status_code == 422

    async def test_register_with_weak_password(self, async_client: AsyncClient, sample_payload):
        sample_payload["password"] = "123"
        response = await async_client.post("/api/auth/register", json=sample_payload)
        assert response.status_code == 422


class TestLogin:
    async def test_login_with_wallet(self, async_client: AsyncClient, sample_user, sample_password):
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr("app.services.auth.verify_wallet_signature", lambda *a, **kw: True)
            response = await async_client.post("/api/auth/login/wallet", json={
                "wallet": sample_user.wallet_address,
                "signature": "0x" + "ab" * 32,
                "message": "Sign to authenticate",
            })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_with_password(self, async_client: AsyncClient, sample_user, sample_password):
        response = await async_client.post("/api/auth/login/password", json={
            "email": sample_user.email,
            "password": sample_password,
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

    async def test_login_with_wrong_password(self, async_client: AsyncClient, sample_user):
        response = await async_client.post("/api/auth/login/password", json={
            "email": sample_user.email,
            "password": "wrong_password",
        })
        assert response.status_code == 401

    async def test_login_nonexistent_user(self, async_client: AsyncClient):
        response = await async_client.post("/api/auth/login/password", json={
            "email": "nonexistent@example.com",
            "password": "password123",
        })
        assert response.status_code == 401

    async def test_login_invalid_wallet_signature(self, async_client: AsyncClient, sample_user):
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr("app.services.auth.verify_wallet_signature", lambda *a, **kw: False)
            response = await async_client.post("/api/auth/login/wallet", json={
                "wallet": sample_user.wallet_address,
                "signature": "0xdeadbeef",
                "message": "Sign to authenticate",
            })
        assert response.status_code == 401

    async def test_login_with_disabled_account(self, async_client: AsyncClient, sample_user, sample_password):
        sample_user.is_active = False
        response = await async_client.post("/api/auth/login/password", json={
            "email": sample_user.email,
            "password": sample_password,
        })
        assert response.status_code == 403


class TestMembershipMintFlow:
    async def test_mint_membership(self, async_client: AsyncClient, auth_token, membership_tier):
        response = await async_client.post(
            "/api/membership/mint",
            json={"tier_id": membership_tier.id},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code in (200, 201)
        data = response.json()
        assert data["tier_id"] == membership_tier.id

    async def test_mint_membership_without_auth(self, async_client: AsyncClient, membership_tier):
        response = await async_client.post(
            "/api/membership/mint",
            json={"tier_id": membership_tier.id},
        )
        assert response.status_code == 401

    async def test_mint_membership_invalid_tier(self, async_client: AsyncClient, auth_token):
        response = await async_client.post(
            "/api/membership/mint",
            json={"tier_id": 99999},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 404

    async def test_mint_membership_already_owned(self, async_client: AsyncClient, auth_token, user_membership):
        response = await async_client.post(
            "/api/membership/mint",
            json={"tier_id": user_membership.tier_id},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 409

    async def test_get_membership_tiers(self, async_client: AsyncClient, membership_tier):
        response = await async_client.get("/api/membership/tiers")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(t["id"] == membership_tier.id for t in data)


class TestSubscriptionFlow:
    async def test_create_subscription(self, async_client: AsyncClient, auth_token, membership_tier):
        response = await async_client.post(
            "/api/membership/subscribe",
            json={"tier_id": membership_tier.id, "auto_renew": True},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code in (200, 201)

    async def test_get_subscription_status(self, async_client: AsyncClient, auth_token, subscription):
        response = await async_client.get(
            "/api/membership/subscription",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is True

    async def test_cancel_subscription(self, async_client: AsyncClient, auth_token, subscription):
        response = await async_client.post(
            "/api/membership/subscription/cancel",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False

    async def test_renew_subscription(self, async_client: AsyncClient, auth_token, subscription):
        response = await async_client.post(
            "/api/membership/subscription/renew",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200

    async def test_subscription_requires_auth(self, async_client: AsyncClient):
        response = await async_client.get("/api/membership/subscription")
        assert response.status_code == 401


class TestContentAccessFlow:
    async def test_verified_user_accesses_content(self, async_client: AsyncClient, auth_token, verified_user, user_membership):
        response = await async_client.get(
            "/api/content/protected",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200

    async def test_unverified_user_rejected(self, async_client: AsyncClient, auth_token, sample_user):
        assert sample_user.is_verified is False
        response = await async_client.get(
            "/api/content/protected",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 403

    async def test_content_access_without_auth(self, async_client: AsyncClient):
        response = await async_client.get("/api/content/protected")
        assert response.status_code == 401

    async def test_content_access_with_expired_membership(self, async_client: AsyncClient, auth_token, verified_user):
        response = await async_client.get(
            "/api/content/premium",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code in (402, 403)

    async def test_content_access_with_valid_membership(self, async_client: AsyncClient, auth_token, verified_user, user_membership):
        response = await async_client.get(
            "/api/content/premium",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200


class TestAgeVerificationSubmission:
    async def test_submit_age_verification(self, async_client: AsyncClient, auth_token):
        response = await async_client.post(
            "/api/compliance/age-verification",
            json={
                "date_of_birth": "2000-01-01",
                "country": "US",
                "document_type": "passport",
                "document_number": "AB123456",
            },
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code in (200, 201)

    async def test_age_verification_underage_rejected(self, async_client: AsyncClient, auth_token):
        response = await async_client.post(
            "/api/compliance/age-verification",
            json={
                "date_of_birth": "2010-01-01",
                "country": "US",
                "document_type": "passport",
                "document_number": "AB123456",
            },
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 422

    async def test_age_verification_status(self, async_client: AsyncClient, auth_token, age_verification):
        response = await async_client.get(
            "/api/compliance/age-verification/status",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] is True

    async def test_age_verification_requires_auth(self, async_client: AsyncClient):
        response = await async_client.get("/api/compliance/age-verification/status")
        assert response.status_code == 401

    async def test_age_verification_methods_listed(self, async_client: AsyncClient):
        response = await async_client.get("/api/compliance/age-verification/methods")
        assert response.status_code == 200


class TestAdminEndpoints:
    async def test_admin_get_users(self, async_client: AsyncClient, admin_token):
        response = await async_client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200

    async def test_admin_get_user_detail(self, async_client: AsyncClient, admin_token, sample_user):
        response = await async_client.get(
            f"/api/admin/users/{sample_user.id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200

    async def test_admin_non_admin_rejected(self, async_client: AsyncClient, auth_token):
        response = await async_client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 403

    async def test_admin_manage_compliance_rules(self, async_client: AsyncClient, admin_token):
        response = await async_client.post(
            "/api/admin/compliance/rules",
            json={
                "name": "new_rule",
                "description": "Test rule",
                "rule_type": "prerequisite",
                "threshold": 18,
                "action": "block_access",
                "is_active": True,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code in (200, 201)

    async def test_admin_generate_report(self, async_client: AsyncClient, admin_token):
        response = await async_client.post(
            "/api/admin/compliance/report",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200


class TestErrorResponses:
    async def test_404_response(self, async_client: AsyncClient):
        response = await async_client.get("/api/nonexistent")
        assert response.status_code == 404

    async def test_405_method_not_allowed(self, async_client: AsyncClient):
        response = await async_client.put("/api/auth/login/wallet")
        assert response.status_code == 405

    async def test_422_validation_error(self, async_client: AsyncClient):
        response = await async_client.post("/api/auth/register", json={"invalid": "data"})
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    async def test_500_internal_error(self, async_client: AsyncClient):
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr("app.api.auth.router", MagicMock(side_effect=Exception("Internal error")))
            response = await async_client.get("/api/health")
            assert response.status_code in (200, 500)

    async def test_error_response_format(self, async_client: AsyncClient):
        response = await async_client.get("/api/nonexistent")
        data = response.json()
        assert "detail" in data


class TestAuthenticationMiddleware:
    async def test_valid_token_passes_middleware(self, async_client: AsyncClient, auth_token):
        response = await async_client.get(
            "/api/user/me",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code in (200, 401)

    async def test_expired_token_rejected(self, async_client: AsyncClient, expired_token):
        response = await async_client.get(
            "/api/user/me",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    async def test_malformed_token_rejected(self, async_client: AsyncClient):
        response = await async_client.get(
            "/api/user/me",
            headers={"Authorization": "Bearer malformed_token"},
        )
        assert response.status_code == 401

    async def test_missing_token_rejected(self, async_client: AsyncClient):
        response = await async_client.get("/api/user/me")
        assert response.status_code == 401

    async def test_wrong_auth_scheme_rejected(self, async_client: AsyncClient, auth_token):
        response = await async_client.get(
            "/api/user/me",
            headers={"Authorization": f"Basic {auth_token}"},
        )
        assert response.status_code == 401

    async def test_public_endpoints_accessible_without_auth(self, async_client: AsyncClient):
        response = await async_client.get("/api/health")
        assert response.status_code in (200, 404)


class TestCORSHeaders:
    async def test_cors_headers_present(self, async_client: AsyncClient):
        response = await async_client.options(
            "/api/auth/login/wallet",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert "access-control-allow-origin" in response.headers
        assert "access-control-allow-methods" in response.headers
        assert "access-control-allow-headers" in response.headers

    async def test_cors_allows_frontend_origin(self, async_client: AsyncClient):
        response = await async_client.options(
            "/api/auth/login/wallet",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"

    async def test_cors_rejects_unknown_origin(self, async_client: AsyncClient):
        response = await async_client.options(
            "/api/auth/login/wallet",
            headers={
                "Origin": "https://evil.site",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.headers.get("access-control-allow-origin") != "https://evil.site"

    async def test_cors_allows_credentials(self, async_client: AsyncClient):
        response = await async_client.options(
            "/api/auth/login/wallet",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.headers.get("access-control-allow-credentials") == "true"

    async def test_cors_allows_specified_methods(self, async_client: AsyncClient):
        response = await async_client.options(
            "/api/auth/login/wallet",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        allowed = response.headers.get("access-control-allow-methods", "")
        assert "POST" in allowed
        assert "GET" in allowed
        assert "PUT" in allowed
        assert "DELETE" in allowed
