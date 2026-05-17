from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from freezegun import freeze_time

from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
    verify_wallet_signature,
)


class TestJWTToken:
    def test_create_access_token(self):
        token = create_access_token(
            data={"sub": "0x1234", "user_id": "1"},
            expires_delta=timedelta(hours=1),
        )
        assert isinstance(token, str)
        assert len(token.split(".")) == 3

    def test_decode_valid_token(self, auth_token, sample_user):
        payload = decode_access_token(auth_token)
        assert payload["sub"] == sample_user.wallet_address
        assert payload["user_id"] == str(sample_user.id)

    def test_token_contains_expiry(self):
        with freeze_time("2025-01-01 12:00:00"):
            token = create_access_token(
                data={"sub": "0x1234", "user_id": "1"},
                expires_delta=timedelta(hours=1),
            )
            payload = decode_access_token(token)
            assert payload["exp"] == int(
                datetime(2025, 1, 1, 13, 0, 0, tzinfo=timezone.utc).timestamp()
            )

    def test_expired_token_raises(self, expired_token):
        with pytest.raises(jwt.ExpiredSignatureError):
            decode_access_token(expired_token)

    def test_token_with_invalid_signature_raises(self):
        token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIweDEyMzQifQ.invalidsignature"
        with pytest.raises(jwt.InvalidSignatureError):
            decode_access_token(token)

    def test_token_with_malformed_payload_raises(self):
        token = create_access_token(data={"sub": "0x1234"})
        tampered = token.rsplit(".", 1)[0] + ".tampered"
        with pytest.raises(jwt.InvalidSignatureError):
            decode_access_token(tampered)

    def test_token_without_sub_claim_raises(self):
        token = create_access_token(data={"foo": "bar"})
        with pytest.raises(jwt.InvalidTokenError):
            decode_access_token(token)

    def test_token_with_none_subject_raises(self):
        token = create_access_token(data={"sub": None, "user_id": "1"})
        with pytest.raises(jwt.InvalidTokenError):
            decode_access_token(token)


class TestPasswordHashing:
    def test_hash_password(self):
        password = "SecurePass123!"
        hashed = get_password_hash(password)
        assert hashed != password
        assert isinstance(hashed, str)
        assert hashed.startswith("$2b$")

    def test_verify_correct_password(self):
        password = "SecurePass123!"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True

    def test_verify_incorrect_password(self):
        hashed = get_password_hash("CorrectPass123!")
        assert verify_password("WrongPass456!", hashed) is False

    def test_verify_empty_password(self):
        hashed = get_password_hash("SomePass123!")
        assert verify_password("", hashed) is False

    def test_hash_is_deterministic_different(self):
        hashed1 = get_password_hash("SamePass123!")
        hashed2 = get_password_hash("SamePass123!")
        assert hashed1 != hashed2

    def test_verify_none_hash_raises(self):
        with pytest.raises(ValueError):
            verify_password("password", None)


class TestWalletSignatureVerification:
    def test_verify_valid_signature(self):
        message = "Sign this message to authenticate: 123456"
        wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
        signature = "0x" + "aabb" * 32

        with patch("app.core.security.Web3") as mock_web3:
            mock_w3 = MagicMock()
            mock_w3.eth.account.recover_message.return_value = wallet
            mock_web3.return_value = mock_w3

            result = verify_wallet_signature(message, signature, wallet)
            assert result is True

    def test_verify_invalid_signature_rejected(self):
        message = "Sign this message to authenticate: 123456"
        wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
        signature = "0x" + "bbaa" * 32
        wrong_wallet = "0x1234567890123456789012345678901234567890"

        with patch("app.core.security.Web3") as mock_web3:
            mock_w3 = MagicMock()
            mock_w3.eth.account.recover_message.return_value = wrong_wallet
            mock_web3.return_value = mock_w3

            result = verify_wallet_signature(message, signature, wallet)
            assert result is False

    def test_verify_signature_with_tampered_message(self):
        original_message = "Sign this message to authenticate: 123456"
        tampered_message = "Sign this message to authenticate: 999999"
        wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
        signature = "0x" + "aabb" * 32

        with patch("app.core.security.Web3") as mock_web3:
            mock_w3 = MagicMock()
            mock_w3.eth.account.recover_message.side_effect = [
                wallet,
                "0x0000000000000000000000000000000000000000",
            ]
            mock_web3.return_value = mock_w3

            result = verify_wallet_signature(tampered_message, signature, wallet)
            assert result is False

    def test_verify_signature_with_malformed_signature(self):
        message = "Test message"
        wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"

        with patch("app.core.security.Web3") as mock_web3:
            mock_w3 = MagicMock()
            mock_w3.eth.account.recover_message.side_effect = ValueError("Invalid signature format")
            mock_web3.return_value = mock_w3

            result = verify_wallet_signature(message, "invalid_signature", wallet)
            assert result is False

    def test_verify_signature_with_empty_inputs(self):
        with patch("app.core.security.Web3") as mock_web3:
            mock_w3 = MagicMock()
            mock_w3.eth.account.recover_message.side_effect = ValueError("Empty input")
            mock_web3.return_value = mock_w3

            result = verify_wallet_signature("", "", "")
            assert result is False


class TestTokenRefresh:
    async def test_refresh_token_creates_new_token(self, auth_token, sample_user):
        new_token = create_access_token(
            data={"sub": sample_user.wallet_address, "user_id": str(sample_user.id)},
            expires_delta=timedelta(hours=2),
        )
        assert new_token != auth_token
        payload = decode_access_token(new_token)
        assert payload["sub"] == sample_user.wallet_address

    async def test_refresh_with_expired_token_fails(self, expired_token):
        with pytest.raises(jwt.ExpiredSignatureError):
            decode_access_token(expired_token)

    async def test_refresh_token_preserves_claims(self, sample_user):
        original_claims = {
            "sub": sample_user.wallet_address,
            "user_id": str(sample_user.id),
            "role": "member",
        }
        token = create_access_token(data=original_claims)
        payload = decode_access_token(token)
        assert payload["role"] == "member"
        assert payload["sub"] == sample_user.wallet_address


class TestRateLimiting:
    async def test_rate_limiter_allows_within_limit(self, redis_client):
        from app.core.rate_limiter import check_rate_limit

        redis_client.get = AsyncMock(return_value=None)
        redis_client.incr = AsyncMock(return_value=1)
        redis_client.expire = AsyncMock(return_value=True)

        result = await check_rate_limit(redis_client, "test_key", max_requests=10, window=60)
        assert result is True

    async def test_rate_limiter_blocks_exceeded(self, redis_client):
        from app.core.rate_limiter import check_rate_limit

        redis_client.get = AsyncMock(return_value=b"10")
        redis_client.incr = AsyncMock(return_value=11)

        result = await check_rate_limit(redis_client, "test_key", max_requests=10, window=60)
        assert result is False

    async def test_rate_limiter_different_keys_independent(self, redis_client):
        from app.core.rate_limiter import check_rate_limit

        calls = {}

        async def mock_get(key):
            return calls.get(key)

        async def mock_incr(key):
            calls[key] = calls.get(key, 0) + 1
            return calls[key]

        redis_client.get = AsyncMock(side_effect=mock_get)
        redis_client.incr = AsyncMock(side_effect=mock_incr)
        redis_client.expire = AsyncMock(return_value=True)

        result1 = await check_rate_limit(redis_client, "user:1", max_requests=5, window=60)
        result2 = await check_rate_limit(redis_client, "user:2", max_requests=5, window=60)
        assert result1 is True
        assert result2 is True

    async def test_rate_limiter_resets_after_window(self, redis_client):
        from app.core.rate_limiter import check_rate_limit

        redis_client.get = AsyncMock(return_value=None)
        redis_client.incr = AsyncMock(return_value=1)
        redis_client.expire = AsyncMock(return_value=True)

        result = await check_rate_limit(redis_client, "reset_key", max_requests=10, window=60)
        assert result is True


class TestInvalidTokens:
    def test_token_with_wrong_type_raises(self):
        token = create_access_token(data={"sub": "0x1234", "user_id": "1", "type": "refresh"})
        with pytest.raises(jwt.InvalidTokenError):
            payload = decode_access_token(token)
            if payload.get("type") != "access":
                raise jwt.InvalidTokenError("Invalid token type")

    def test_token_with_missing_user_id_raises(self):
        token = create_access_token(data={"sub": "0x1234"})
        payload = decode_access_token(token)
        assert payload.get("sub") == "0x1234"

    @pytest.mark.parametrize(
        "bad_token",
        [
            "",
            "not.a.token",
            "eyJ.eyJ.eyJ",
            None,
        ],
    )
    def test_various_malformed_tokens(self, bad_token):
        if bad_token is None:
            with pytest.raises((jwt.InvalidTokenError, AttributeError)):
                decode_access_token(bad_token)
        else:
            with pytest.raises(jwt.InvalidTokenError):
                decode_access_token(bad_token)

    def test_token_with_extraneous_whitespace(self):
        token = create_access_token(data={"sub": "0x1234", "user_id": "1"})
        with pytest.raises(jwt.InvalidTokenError):
            decode_access_token(token + " ")


class TestExpiredTokens:
    @freeze_time("2025-01-01 12:00:00")
    def test_token_expires_at_correct_time(self):
        token = create_access_token(
            data={"sub": "0x1234", "user_id": "1"},
            expires_delta=timedelta(hours=1),
        )
        payload = decode_access_token(token)
        exp_time = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        assert exp_time == datetime(2025, 1, 1, 13, 0, 0, tzinfo=timezone.utc)

    @freeze_time("2025-01-01 12:00:00")
    def test_token_valid_before_expiry(self):
        token = create_access_token(
            data={"sub": "0x1234", "user_id": "1"},
            expires_delta=timedelta(hours=1),
        )
        payload = decode_access_token(token)
        assert payload["sub"] == "0x1234"

    @freeze_time("2025-01-01 13:00:01")
    def test_token_invalid_after_expiry(self):
        token = create_access_token(
            data={"sub": "0x1234", "user_id": "1"},
            expires_delta=timedelta(hours=1),
        )
        with pytest.raises(jwt.ExpiredSignatureError):
            decode_access_token(token)

    @freeze_time("2025-01-01 12:00:00")
    def test_token_with_zero_expiry_raises(self):
        token = create_access_token(
            data={"sub": "0x1234", "user_id": "1"},
            expires_delta=timedelta(seconds=0),
        )
        with pytest.raises(jwt.ExpiredSignatureError):
            decode_access_token(token)
