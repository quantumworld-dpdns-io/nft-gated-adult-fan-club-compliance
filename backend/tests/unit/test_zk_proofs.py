import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, PropertyMock, patch

import pytest


class TestProofGenerationFlow:
    async def test_proof_generation_with_valid_inputs(self):
        from app.services.zk_proofs import generate_proof

        with patch("app.services.zk_proofs.run_nargo") as mock_nargo:
            mock_nargo.return_value = MagicMock(
                returncode=0,
                stdout='{"proof": "0xabcd1234", "public_inputs": ["18"]}',
            )

            result = await generate_proof(
                circuit_name="age_verification",
                inputs={"date_of_birth": "2000-01-01", "threshold": 18},
            )
            assert result is not None
            assert result.proof == "0xabcd1234"
            assert result.public_inputs == ["18"]

    async def test_proof_generation_failure_raises(self):
        from app.services.zk_proofs import generate_proof

        with patch("app.services.zk_proofs.run_nargo") as mock_nargo:
            mock_nargo.return_value = MagicMock(
                returncode=1,
                stderr="Circuit compilation error",
            )

            with pytest.raises(RuntimeError, match="Proof generation failed"):
                await generate_proof(
                    circuit_name="age_verification",
                    inputs={"date_of_birth": "2000-01-01", "threshold": 18},
                )

    async def test_proof_generation_with_missing_inputs(self):
        from app.services.zk_proofs import generate_proof

        with patch("app.services.zk_proofs.run_nargo") as mock_nargo:
            mock_nargo.return_value = MagicMock(
                returncode=1,
                stderr="Missing required input: date_of_birth",
            )

            with pytest.raises(RuntimeError):
                await generate_proof(
                    circuit_name="age_verification",
                    inputs={},
                )

    async def test_proof_generation_timeout(self):
        from app.services.zk_proofs import generate_proof

        with patch("app.services.zk_proofs.run_nargo") as mock_nargo:
            mock_nargo.side_effect = TimeoutError("Proof generation timed out")

            with pytest.raises(TimeoutError):
                await generate_proof(
                    circuit_name="age_verification",
                    inputs={"date_of_birth": "2000-01-01", "threshold": 18},
                    timeout=5,
                )

    async def test_proof_generation_with_large_inputs(self):
        from app.services.zk_proofs import generate_proof

        with patch("app.services.zk_proofs.run_nargo") as mock_nargo:
            mock_nargo.return_value = MagicMock(
                returncode=0,
                stdout='{"proof": "0x' + "ab" * 1000 + '", "public_inputs": ["1"]}',
            )

            result = await generate_proof(
                circuit_name="large_input_test",
                inputs={"data": "x" * 10000},
            )
            assert result is not None


class TestProofVerificationFlow:
    async def test_verify_valid_proof(self):
        from app.services.zk_proofs import verify_proof

        with patch("app.services.zk_proofs.run_nargo") as mock_nargo:
            mock_nargo.return_value = MagicMock(
                returncode=0,
                stdout="Verification successful",
            )

            result = await verify_proof(
                circuit_name="age_verification",
                proof="0xabcd1234",
                public_inputs=["18"],
            )
            assert result is True

    async def test_verify_invalid_proof(self):
        from app.services.zk_proofs import verify_proof

        with patch("app.services.zk_proofs.run_nargo") as mock_nargo:
            mock_nargo.return_value = MagicMock(
                returncode=1,
                stderr="Proof verification failed",
            )

            result = await verify_proof(
                circuit_name="age_verification",
                proof="0xbadproof",
                public_inputs=["18"],
            )
            assert result is False

    async def test_verify_proof_with_wrong_public_inputs(self):
        from app.services.zk_proofs import verify_proof

        with patch("app.services.zk_proofs.run_nargo") as mock_nargo:
            mock_nargo.return_value = MagicMock(
                returncode=1,
                stderr="Public inputs do not match proof",
            )

            result = await verify_proof(
                circuit_name="age_verification",
                proof="0xabcd1234",
                public_inputs=["wrong_input"],
            )
            assert result is False

    async def test_verify_proof_wrong_circuit(self):
        from app.services.zk_proofs import verify_proof

        with patch("app.services.zk_proofs.run_nargo") as mock_nargo:
            mock_nargo.side_effect = FileNotFoundError("Circuit not found")

            result = await verify_proof(
                circuit_name="nonexistent_circuit",
                proof="0xabcd1234",
                public_inputs=["18"],
            )
            assert result is False


class TestInvalidProofRejection:
    async def test_reject_empty_proof(self):
        from app.services.zk_proofs import verify_proof

        result = await verify_proof(
            circuit_name="age_verification",
            proof="",
            public_inputs=["18"],
        )
        assert result is False

    async def test_reject_malformed_proof(self):
        from app.services.zk_proofs import verify_proof

        result = await verify_proof(
            circuit_name="age_verification",
            proof="not_a_hex_string",
            public_inputs=["18"],
        )
        assert result is False

    async def test_reject_proof_with_null_bytes(self):
        from app.services.zk_proofs import verify_proof

        result = await verify_proof(
            circuit_name="age_verification",
            proof="\x00\x00\x00",
            public_inputs=["18"],
        )
        assert result is False

    async def test_reject_proof_with_script_injection(self):
        from app.services.zk_proofs import verify_proof

        result = await verify_proof(
            circuit_name="age_verification",
            proof="<script>alert('xss')</script>",
            public_inputs=["18"],
        )
        assert result is False

    @pytest.mark.parametrize(
        "bad_proof",
        [
            "0x",
            "0xgggg",
            "0x" + "00" * 100000,
            None,
            "0x" + "zz" * 32,
        ],
    )
    async def test_reject_various_bad_proofs(self, bad_proof):
        from app.services.zk_proofs import verify_proof

        if bad_proof is None:
            result = await verify_proof(
                circuit_name="age_verification",
                proof=None,
                public_inputs=["18"],
            )
        else:
            result = await verify_proof(
                circuit_name="age_verification",
                proof=bad_proof,
                public_inputs=["18"],
            )
        assert result is False


class TestProofFormatValidation:
    def test_valid_proof_format(self):
        from app.schemas.zk_proofs import ProofSubmission

        proof = ProofSubmission(
            circuit_name="age_verification",
            proof="0x" + "ab" * 32,
            public_inputs=["18"],
        )
        assert proof.circuit_name == "age_verification"
        assert proof.proof.startswith("0x")

    def test_invalid_proof_format_no_hex_prefix(self):
        from app.schemas.zk_proofs import ProofSubmission

        with pytest.raises(ValueError):
            ProofSubmission(
                circuit_name="age_verification",
                proof="abcd1234",
                public_inputs=["18"],
            )

    def test_proof_format_with_invalid_chars(self):
        from app.schemas.zk_proofs import ProofSubmission

        with pytest.raises(ValueError):
            ProofSubmission(
                circuit_name="age_verification",
                proof="0xgggg1234",
                public_inputs=["18"],
            )

    def test_proof_public_inputs_validation(self):
        from app.schemas.zk_proofs import ProofSubmission

        with pytest.raises(ValueError):
            ProofSubmission(
                circuit_name="age_verification",
                proof="0xabcd1234",
                public_inputs=[],
            )

    def test_proof_circuit_name_validation(self):
        from app.schemas.zk_proofs import ProofSubmission

        with pytest.raises(ValueError):
            ProofSubmission(
                circuit_name="",
                proof="0xabcd1234",
                public_inputs=["18"],
            )

    def test_proof_length_validation(self):
        from app.schemas.zk_proofs import ProofSubmission

        with pytest.raises(ValueError):
            ProofSubmission(
                circuit_name="age_verification",
                proof="0x",
                public_inputs=["18"],
            )


class TestCircuitCompilation:
    async def test_compile_valid_circuit(self):
        from app.services.zk_proofs import compile_circuit

        with patch("app.services.zk_proofs.run_nargo") as mock_nargo:
            mock_nargo.return_value = MagicMock(
                returncode=0,
                stdout="Circuit compiled successfully",
            )

            result = await compile_circuit("age_verification")
            assert result is True

    async def test_compile_invalid_circuit(self):
        from app.services.zk_proofs import compile_circuit

        with patch("app.services.zk_proofs.run_nargo") as mock_nargo:
            mock_nargo.return_value = MagicMock(
                returncode=1,
                stderr="Compilation error: syntax error",
            )

            result = await compile_circuit("invalid_circuit")
            assert result is False

    async def test_compile_circuit_not_found(self):
        from app.services.zk_proofs import compile_circuit

        with patch("app.services.zk_proofs.run_nargo") as mock_nargo:
            mock_nargo.side_effect = FileNotFoundError("Circuit directory not found")

            result = await compile_circuit("nonexistent")
            assert result is False

    async def test_compile_all_circuits(self):
        from app.services.zk_proofs import compile_all_circuits

        with patch("app.services.zk_proofs.run_nargo") as mock_nargo:
            mock_nargo.return_value = MagicMock(
                returncode=0,
                stdout="All circuits compiled",
            )

            results = await compile_all_circuits()
            assert isinstance(results, dict)

    async def test_compile_circuit_with_dependencies(self):
        from app.services.zk_proofs import compile_circuit

        with patch("app.services.zk_proofs.run_nargo") as mock_nargo:
            mock_nargo.return_value = MagicMock(
                returncode=0,
                stdout="Compiled with dependencies",
            )

            result = await compile_circuit("age_verification", compile_dependencies=True)
            assert result is True
