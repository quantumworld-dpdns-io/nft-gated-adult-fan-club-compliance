from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/nft_fanclub"

    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    ETHEREUM_RPC_URL: str = "http://localhost:8545"
    CHAIN_ID: int = 31337
    WALLET_PRIVATE_KEY: str = ""

    CONTRACT_MEMBERSHIP_NFT: str = "0x0000000000000000000000000000000000000000"
    CONTRACT_AGE_VERIFICATION: str = "0x0000000000000000000000000000000000000000"
    CONTRACT_TOKEN_GATED_ACCESS: str = "0x0000000000000000000000000000000000000000"
    CONTRACT_COMPLIANCE_REGISTRY: str = "0x0000000000000000000000000000000000000000"

    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    SENTRY_DSN: Optional[str] = None

    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4318"
    OTEL_SERVICE_NAME: str = "nft-fanclub"

    AGE_VERIFICATION_THRESHOLD: int = 18

    ENVIRONMENT: str = "dev"

    KYC_PROVIDER_URL: Optional[str] = None

    @property
    def CONTRACT_ADDRESSES(self) -> dict:
        return {
            "membership_nft": self.CONTRACT_MEMBERSHIP_NFT,
            "age_verification": self.CONTRACT_AGE_VERIFICATION,
            "token_gated_access": self.CONTRACT_TOKEN_GATED_ACCESS,
            "compliance_registry": self.CONTRACT_COMPLIANCE_REGISTRY,
        }


settings = Settings()
