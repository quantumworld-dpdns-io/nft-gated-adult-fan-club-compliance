import hashlib
import json
import logging
from datetime import date, datetime
from typing import Any, Optional

from web3 import Web3
from web3.contract import Contract

from app.core.config import settings

logger = logging.getLogger(__name__)

AGE_VERIFICATION_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "user", "type": "address"},
            {"internalType": "bytes32", "name": "proofHash", "type": "bytes32"},
        ],
        "name": "verifyAge",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "address", "name": "", "type": "address"}],
        "name": "ageVerified",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "user", "type": "address"},
            {"internalType": "bytes32", "name": "proofHash", "type": "bytes32"},
        ],
        "name": "submitProof",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


def _get_web3() -> Web3:
    w3 = Web3(Web3.HTTPProvider(settings.ETHEREUM_RPC_URL))
    if not w3.is_connected():
        logger.warning("Ethereum RPC not connected, using fallback mode")
    return w3


def _get_contract(w3: Web3) -> Contract:
    return w3.eth.contract(
        address=Web3.to_checksum_address(
            settings.CONTRACT_ADDRESSES["age_verification"]
        ),
        abi=AGE_VERIFICATION_ABI,
    )


def generate_age_proof(user_dob: date, threshold: int = 18) -> dict[str, Any]:
    today = date.today()
    age = (
        today.year
        - user_dob.year
        - ((today.month, today.day) < (user_dob.month, user_dob.day))
    )
    is_verified = age >= threshold

    proof_data = {
        "dob": user_dob.isoformat(),
        "threshold": threshold,
        "age": age,
        "is_verified": is_verified,
        "timestamp": datetime.utcnow().isoformat(),
    }

    proof_hash = hashlib.sha256(
        json.dumps(proof_data, sort_keys=True).encode()
    ).hexdigest()

    return {
        "proof_hash": f"0x{proof_hash}",
        "is_verified": is_verified,
        "age": age,
        "public_inputs": {
            "threshold": threshold,
            "verified": is_verified,
        },
    }


def verify_age_proof(proof: dict[str, Any], public_inputs: dict[str, Any]) -> bool:
    expected_threshold = public_inputs.get("threshold", settings.AGE_VERIFICATION_THRESHOLD)
    proof_verified = proof.get("is_verified", False)
    if not proof_verified:
        return False

    proof_data = {
        "threshold": expected_threshold,
        "verified": True,
    }

    computed_hash = hashlib.sha256(
        json.dumps(proof_data, sort_keys=True).encode()
    ).hexdigest()

    return proof.get("proof_hash", "").endswith(computed_hash)


async def check_verification_status(wallet_address: str) -> dict[str, Any]:
    w3 = _get_web3()
    if not w3.is_connected():
        return {
            "wallet_address": wallet_address,
            "age_verified": False,
            "verified_on_chain": False,
            "error": "RPC not available",
        }

    try:
        contract = _get_contract(w3)
        checksum_address = Web3.to_checksum_address(wallet_address)
        verified = contract.functions.ageVerified(checksum_address).call()

        return {
            "wallet_address": wallet_address,
            "age_verified": verified,
            "verified_on_chain": True,
        }
    except Exception as e:
        logger.error(f"Error checking verification status: {e}")
        return {
            "wallet_address": wallet_address,
            "age_verified": False,
            "verified_on_chain": False,
            "error": str(e),
        }
