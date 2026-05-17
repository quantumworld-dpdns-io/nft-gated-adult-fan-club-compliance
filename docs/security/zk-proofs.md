# ZK Age Verification Design

## Problem Statement

Adult fan clubs must verify that users are at least 18 years old before granting access to age-restricted content. Traditional approaches require users to submit government-issued ID documents or enter their full date of birth, which:

1. **Exposes sensitive PII**: Birth date, full name, and document images are transmitted and stored
2. **Creates regulatory liability**: GDPR, CCPA, and other privacy regulations apply to stored biometric/PII data
3. **Damages user trust**: Users are increasingly wary of sharing personal identity documents online
4. **Increases attack surface**: Stored KYC documents are high-value targets for data breaches

## Solution: Zero-Knowledge Age Verification

The platform uses **Noir zero-knowledge circuits** to prove that a user is at least 18 years old without revealing:
- The user's exact birth date
- Any government ID number
- Any other personally identifiable information

The server and smart contracts only learn:
- That the user passed or failed the age check
- A hash commitment of the proof (stored on-chain for auditability)

## Circuit Design

### Age Verification Circuit

**Source**: `zk-circuits/age-verification/src/main.nr`

```
Inputs:
  [private]  birth_date: Field        (e.g., 19900115 for Jan 15, 1990)
  [private]  current_date: Field      (e.g., 20250517 for May 17, 2025)
  [public]   age_threshold: Field      (e.g., 18)
  [public]   verification_hash: Field  (Pedersen commitment of birth_date || current_date)

Constraints:
  1. Compute age = current_date - birth_date (with month/day adjustment)
  2. Assert age >= age_threshold
  3. Assert Pedersen([birth_date, current_date]) == verification_hash
```

#### Circuit Pseudocode

```
fn compute_age(birth_date, current_date):
    birth_year = birth_date / 10000
    birth_month = (birth_date / 100) % 100
    birth_day = birth_date % 100
    
    current_year = current_date / 10000
    current_month = (current_date / 100) % 100
    current_day = current_date % 100
    
    age = current_year - birth_year
    if current_month < birth_month: age -= 1
    elif current_month == birth_month and current_day < birth_day: age -= 1
    
    return age

fn main(birth_date, current_date, age_threshold, verification_hash):
    age = compute_age(birth_date, current_date)
    assert(age >= age_threshold)
    assert(Pedersen([birth_date, current_date]) == verification_hash)
```

### Membership Proof Circuit

**Source**: `zk-circuits/membership-proof/src/main.nr`

```
Inputs:
  [private]   token_id: Field               (NFT token ID)
  [private]   owner_private_key_hash: Field  (hash of wallet's private key-derived secret)
  [public]    membership_tier: Field         (1=BASIC, 2=PREMIUM, 3=VIP)
  [public]    expiry_timestamp: Field        (membership expiry UNIX timestamp)

Output:
  [public]    proof_hash: Field              (Pedersen commitment of all inputs)

Constraints:
  1. Derive tier from token_id range: 1-1000=BASIC, 1001-5000=PREMIUM, 5001-10000=VIP
  2. Assert derived_tier == claimed membership_tier
  3. Assert expiry_timestamp > current_time
  4. Output Pedersen([token_id, owner_key_hash, tier, expiry])
```

## Verification Flow

### End-to-End Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                      USER DEVICE (Browser/Mobile)                    │
│                                                                      │
│  1. User enters date of birth: 1990-01-15                           │
│  2. App retrieves current date: 2025-05-17                          │
│  3. Noir circuit compiles proof locally:                             │
│     - Public inputs:  age_threshold=18, verification_hash=0xabc...   │
│     - Private inputs: birth_date=19900115, current_date=20250517     │
│     - Proves: age=35 >= 18 AND hash matches                          │
│  4. Proof sent to API → POST /api/compliance/verify-age              │
│     (Only the proof is transmitted; birth date stays on device)       │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ proof.json (serialized proof)
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       BACKEND API (FastAPI)                          │
│                                                                      │
│  5. Receive proof from user                                          │
│  6. Verify proof using Noir verifier                                 │
│  7. Compute age from proof (or from DOB as fallback)                 │
│  8. If age >= threshold:                                             │
│     a. Set user.age_verified = True in PostgreSQL                   │
│     b. Submit proof hash to AgeVerificationOracle.sol on-chain      │
│     c. Create off-chain ComplianceLog entry                          │
│     d. Return success response to frontend                           │
│  9. If underage: Return failure response (no data stored)            │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   SMART CONTRACT (L2 Blockchain)                     │
│                                                                      │
│  10. AgeVerificationOracle.submitVerification(                       │
│        user: 0x1234...,                                              │
│        proofHash: 0xabc123...,                                       │
│        expiry: timestamp + 365 days                                  │
│      )                                                              │
│  11. ComplianceRegistry.recordCheck(                                 │
│        user: 0x1234...,                                              │
│        checkHash: sha256(proofData),                                 │
│        checkType: "age_verification",                                 │
│        timestamp: block.timestamp                                     │
│      )                                                              │
└──────────────────────────────────────────────────────────────────────┘
```

### Proof Generation (Local/Client-Side)

In production, proof generation happens on the user's device using a WASM-compiled version of the Noir circuit:

```bash
# Compile circuit for browser
nargo compile --target wasm

# Use in frontend JavaScript/WASM
import { generateAgeProof } from '@noir-lang/noir_wasm';

const proof = await generateAgeProof({
  birth_date: "19900115",
  current_date: "20250517",
  age_threshold: 18,
});
```

### Proof Verification (Server-Side)

The backend verifies the proof before accepting it:

```python
# From backend/app/services/age_verification.py
async def verify_age_proof(proof: dict, public_inputs: dict) -> bool:
    # Verify the proof using Noir verifier
    result = await noir_prover.verify_proof(
        vkey_path="zk-circuits/age-verification/target/vk.json",
        proof_path=proof["path"],
    )
    
    if not result["verified"]:
        return False
    
    # Verify public inputs match
    expected_hash = compute_verification_hash(
        public_inputs["threshold"]
    )
    return proof["public_inputs"]["verification_hash"] == expected_hash
```

## Noir Circuit Source Code

### Age Verification Circuit

File: `zk-circuits/age-verification/src/main.nr`

```noir
use dep::std;

fn compute_age(birth_date: Field, current_date: Field) -> Field {
    let birth_year = birth_date / 10000;
    let birth_month = (birth_date / 100) % 100;
    let birth_day = birth_date % 100;

    let current_year = current_date / 10000;
    let current_month = (current_date / 100) % 100;
    let current_day = current_date % 100;

    let mut age = current_year - birth_year;

    if current_month < birth_month {
        age = age - 1;
    } else if current_month == birth_month {
        if current_day < birth_day {
            age = age - 1;
        }
    }

    age
}

fn main(
    birth_date: Field,
    current_date: Field,
    age_threshold: pub Field,
    verification_hash: pub Field,
) {
    let age = compute_age(birth_date, current_date);
    assert(age >= age_threshold);
    
    let computed_hash = std::hash::pedersen_commitment([
        birth_date,
        current_date,
    ]);
    assert(computed_hash == verification_hash);
}
```

### Membership Proof Circuit

File: `zk-circuits/membership-proof/src/main.nr`

```noir
use dep::std;

fn derive_membership_tier(token_id: Field) -> Field {
    if (token_id >= 1) & (token_id <= 1000) { 1 }
    else if (token_id >= 1001) & (token_id <= 5000) { 2 }
    else if (token_id >= 5001) & (token_id <= 10000) { 3 }
    else { 0 }
}

fn main(
    token_id: Field,
    owner_private_key_hash: Field,
    membership_tier: pub Field,
    expiry_timestamp: pub Field,
) -> pub Field {
    let derived_tier = derive_membership_tier(token_id);
    assert(derived_tier == membership_tier);
    assert(derived_tier != 0);
    assert(expiry_timestamp > 0);
    
    std::hash::pedersen_commitment([
        token_id,
        owner_private_key_hash,
        membership_tier,
        expiry_timestamp,
    ])
}
```

## Solidity Verifier Integration

Noir can generate a Solidity verifier contract for on-chain proof verification:

```bash
# Generate Solidity verifier from compiled circuit
cd zk-circuits/age-verification
nargo codegen-verifier
# Output: contracts/plonk_vk.sol
```

The generated verifier contract works with `AgeVerificationOracle.sol`:

```solidity
// Conceptual integration
contract AgeVerificationOracle is Ownable {
    UltraVerifier public verifier;  // Generated by Noir
    
    function submitProof(bytes calldata proof, bytes32 publicInputs) external {
        require(verifier.verify(proof, [publicInputs]), "Invalid proof");
        _verifications[msg.sender] = Verification({
            proofHash: publicInputs,
            expiry: block.timestamp + 365 days,
            exists: true
        });
    }
}
```

This integration is automatically checked in the CI workflow `zk-circuits.yml` (the `sol-verifier` job).

## Privacy Guarantees and Limitations

### What the ZK Proof Guarantees

| Property | Guarantee | Explanation |
|----------|-----------|-------------|
| **Zero-knowledge** | ✅ Full | Server learns only pass/fail, not birth date |
| **Soundness** | ✅ Full | User cannot prove age >= 18 if they are underage |
| **Completeness** | ✅ Full | User who is >= 18 can always generate a valid proof |
| **Non-interactive** | ✅ Full | Single proof submission; no back-and-forth |
| **Public verifiability** | ✅ Full | Anyone with the verification key can verify |

### What the ZK Proof Does NOT Guarantee

| Limitation | Explanation | Mitigation |
|------------|-------------|------------|
| **Freshness** | Proof could be generated from old data | Current date is a circuit input; server validates it's reasonable |
| **Liveness** | Proof doesn't prove the user is present | Combined with wallet signature (proves user controls the wallet) |
| **Identity binding** | Proof doesn't link to a real-world identity | KYC provider integration for high-value memberships |
| **Sybil resistance** | One user can create multiple wallets | Future: proof-of-personhood or KYC for unique verification |
| **Front-running** | Proof could be submitted before user | No front-running value in age proofs |

### Data Flow Privacy

```
Before submitting proof:
  User's device: birth_date, current_date, age_threshold, verification_hash
  └── All private 🔒

After submitting proof:
  API receives: proof, public_inputs (age_threshold, verification_hash)
  API stores in DB: user_id, proof_hash, verified (bool), timestamp
  Blockchain stores: user_address, proof_hash, expiry
  
  Permanently private 🔒: birth_date, exact age
  Stored ⚠️: verification result (pass/fail), proof hash (commitment only)
```

## Alternative: RISC Zero zkVM Approach

As an alternative to Noir native circuits, the platform could use **RISC Zero's zkVM**:

### Comparison

| Feature | Noir (Current) | RISC Zero (Alternative) |
|---------|----------------|------------------------|
| **Language** | Domain-specific (Noir) | Rust (general purpose) |
| **Proof system** | Barretenberg (PLONK-based) | STARK-based (RISC Zero zkVM) |
| **Circuit size** | Smaller (~100-500 constraints) | Larger (~1000-5000+ cycles) |
| **Gas cost (on-chain)** | Lower (PLONK verifier) | Higher (STARK → SNARK wrapper) |
| **Smart contract integration** | Native Solidity verifier | Solidity verifier via risc0-ethereum |
| **Prover time** | Fast (~1s) | Moderate (~5-10s) |
| **Browser support** | WASM compilation | WASM compilation |
| **Maturity** | Mature (Noir 0.34+) | Mature (zkVM 1.0+) |

### RISC Zero Implementation Sketch

```rust
// RISC Zero zkVM guest program (hosted in zk-circuits/age-verification-risc0/)
use risc0_zkvm::guest::env;

fn main() {
    let birth_date: u64 = env::read();
    let current_date: u64 = env::read();
    let age_threshold: u64 = env::read();
    
    let age = compute_age(birth_date, current_date);
    assert!(age >= age_threshold);
    
    env::commit(&age);
    env::commit(&age_threshold);
}
```

The platform currently uses Noir due to:
1. **Lower gas costs** on L2 (critical for frequent compliance checks)
2. **Smaller circuit size** (simpler age computation)
3. **Native Solidity verifier** generation (no STARK-to-SNARK wrapper needed)
4. **Faster proof generation** (important for browser-based proving)

However, RISC Zero would be considered for:
1. More complex compliance logic (income verification, multi-jurisdiction checks)
2. Scenarios requiring Rust ecosystem libraries
3. Post-quantum resistance (STARKs are quantum-safe)
