import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


def _find_nargo() -> str:
    nargo = os.environ.get("NARGO_PATH", "nargo")
    return nargo


async def _run_command(cmd: list[str], cwd: Optional[str] = None) -> tuple[int, str, str]:
    process = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    return (
        process.returncode or 0,
        stdout.decode("utf-8") if stdout else "",
        stderr.decode("utf-8") if stderr else "",
    )


async def compile_circuit(circuit_path: str) -> dict[str, Any]:
    nargo = _find_nargo()
    circuit_dir = os.path.dirname(circuit_path) if os.path.isfile(circuit_path) else circuit_path

    if not os.path.exists(os.path.join(circuit_dir, "Nargo.toml")):
        return {
            "success": False,
            "error": f"No Nargo.toml found in {circuit_dir}",
        }

    logger.info(f"Compiling circuit in {circuit_dir}")
    returncode, stdout, stderr = await _run_command(
        [nargo, "compile"], cwd=circuit_dir
    )

    if returncode != 0:
        logger.error(f"Compilation failed: {stderr}")
        return {
            "success": False,
            "error": stderr,
            "stdout": stdout,
        }

    logger.info("Circuit compiled successfully")
    return {
        "success": True,
        "output": stdout,
        "circuit_dir": circuit_dir,
    }


async def generate_proof(prover_toml_path: str) -> dict[str, Any]:
    nargo = _find_nargo()
    prover_dir = os.path.dirname(prover_toml_path)

    if not os.path.exists(prover_toml_path):
        return {
            "success": False,
            "error": f"Prover.toml not found at {prover_toml_path}",
        }

    logger.info(f"Generating proof from {prover_toml_path}")
    returncode, stdout, stderr = await _run_command(
        [nargo, "execute"], cwd=prover_dir
    )

    if returncode != 0:
        logger.error(f"Proof generation failed: {stderr}")
        return {
            "success": False,
            "error": stderr,
        }

    proof_path = os.path.join(prover_dir, "proofs", "proof.json")
    if os.path.exists(proof_path):
        with open(proof_path, "r") as f:
            proof_data = json.load(f)
    else:
        proof_data = {"raw": stdout}

    logger.info("Proof generated successfully")
    return {
        "success": True,
        "proof": proof_data,
        "proof_path": proof_path,
    }


async def verify_proof(
    vkey_path: str,
    proof_path: str,
) -> dict[str, Any]:
    nargo = _find_nargo()
    proof_dir = os.path.dirname(proof_path)

    if not os.path.exists(vkey_path):
        return {
            "success": False,
            "error": f"Verification key not found at {vkey_path}",
        }

    if not os.path.exists(proof_path):
        return {
            "success": False,
            "error": f"Proof not found at {proof_path}",
        }

    logger.info(f"Verifying proof using {proof_path}")
    returncode, stdout, stderr = await _run_command(
        [nargo, "verify"], cwd=proof_dir
    )

    if returncode != 0:
        logger.warning(f"Proof verification failed: {stderr}")
        return {
            "success": False,
            "verified": False,
            "error": stderr,
        }

    logger.info("Proof verified successfully")
    return {
        "success": True,
        "verified": True,
        "output": stdout,
    }


async def get_verification_key(circuit_path: str) -> Optional[str]:
    nargo = _find_nargo()
    circuit_dir = os.path.dirname(circuit_path) if os.path.isfile(circuit_path) else circuit_path

    vkey_path = os.path.join(circuit_dir, "target", "vk.json")
    if os.path.exists(vkey_path):
        with open(vkey_path, "r") as f:
            return f.read()

    compile_result = await compile_circuit(circuit_dir)
    if not compile_result["success"]:
        logger.error(f"Cannot compile circuit: {compile_result.get('error')}")
        return None

    if os.path.exists(vkey_path):
        with open(vkey_path, "r") as f:
            return f.read()

    logger.warning(f"Verification key not found at {vkey_path}")
    return None
