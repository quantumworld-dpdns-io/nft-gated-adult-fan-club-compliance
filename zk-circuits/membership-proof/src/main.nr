use dep::std;

fn derive_membership_tier(token_id: Field) -> Field {
    let tier_basic_min = 1;
    let tier_basic_max = 1000;
    let tier_premium_min = 1001;
    let tier_premium_max = 5000;
    let tier_vip_min = 5001;
    let tier_vip_max = 10000;

    if (token_id >= tier_basic_min) & (token_id <= tier_basic_max) {
        1
    } else if (token_id >= tier_premium_min) & (token_id <= tier_premium_max) {
        2
    } else if (token_id >= tier_vip_min) & (token_id <= tier_vip_max) {
        3
    } else {
        0
    }
}

fn compute_proof_hash(token_id: Field, owner_private_key_hash: Field, membership_tier: Field, expiry_timestamp: Field) -> Field {
    std::hash::pedersen_commitment([
        token_id,
        owner_private_key_hash,
        membership_tier,
        expiry_timestamp,
    ])
}

fn main(
    token_id: Field,
    owner_private_key_hash: Field,
    membership_tier: pub Field,
    expiry_timestamp: pub Field,
) -> pub Field {
    let derived_tier = derive_membership_tier(token_id);
    std::println(f"Derived tier: {derived_tier}");
    std::println(f"Claimed tier: {membership_tier}");

    assert(derived_tier == membership_tier, "Token ID does not correspond to the claimed membership tier");
    assert(derived_tier != 0, "Token ID is not associated with any valid membership tier");

    let current_time_placeholder = 0;
    assert(expiry_timestamp > current_time_placeholder, "Membership has expired");

    let proof_hash = compute_proof_hash(token_id, owner_private_key_hash, membership_tier, expiry_timestamp);
    std::println(f"Proof hash: {proof_hash}");

    proof_hash
}
